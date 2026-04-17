import os
import json
import re
import traceback
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import pypdf
from openai import OpenAI

from rule_engine import evaluate_lease_rules

load_dotenv()

# --- INITIALIZATION ---
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
    default_headers={
        "HTTP-Referer": os.getenv("OPENROUTER_HTTP_REFERER", "http://localhost:3000"),
        "X-Title": os.getenv("OPENROUTER_APP_TITLE", "FairLease Auditor"),
    },
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 🛡️ TIER 1: PHYSICAL PRE-VALIDATION (Python)
# ==========================================
def pre_validate_text(text: str):
    clean_text = text.strip()
    
    # 1. Length Check
    if len(clean_text) < 300:
        return False, "INVALID_LENGTH", f"The uploaded document is too short ({len(clean_text)} characters). A valid lease usually requires at least 1,000 characters to cover legal terms."

    # 2. Blank Template Detection (Check for excessive underscores)
    underscore_sequences = re.findall(r"_{10,}", clean_text)
    if len(underscore_sequences) > 12:
        return False, "BLANK_TEMPLATE", "This document contains too many empty underscores. It looks like an unfilled template. Please upload a signed and completed version."

    # 3. Basic Keyword Check
    essential_keywords = ["lessor", "lessee", "landlord", "tenant", "rent", "agreement", "premises"]
    matches = [word for word in essential_keywords if word in clean_text.lower()]
    if len(matches) < 2:
        return False, "UNRELATED_DOCUMENT", "This document does not contain standard lease terminology (like Lessor, Lessee, or Rent). Please upload a rental agreement."

    return True, "VALID", "Success"


def _safe_int(value, default=0):
    try:
        if value is None:
            return default
        if isinstance(value, bool):
            return default
        if isinstance(value, (int, float)):
            return int(value)
        cleaned = re.sub(r"[^0-9.-]", "", str(value))
        if not cleaned or cleaned in {"-", ".", "-."}:
            return default
        return int(float(cleaned))
    except Exception:
        return default


def _score_to_verdict(score: int, critical_flags: list[str] | None = None):
    critical_flags = critical_flags or []
    if critical_flags:
        return "MEDIUM RISK" if score >= 85 else "HIGH RISK"
    if score >= 75:
        return "SAFE"
    if score >= 50:
        return "MEDIUM RISK"
    return "HIGH RISK"


def _build_rule_snapshot_markdown(rule_assessment: dict, ai_score: int, final_score: int):
    breakdown = rule_assessment.get("rule_breakdown", []) or []
    critical_flags = rule_assessment.get("critical_flags", []) or []
    confidence_level = rule_assessment.get("confidence_level", "medium")
    confidence_percent = rule_assessment.get("confidence_percent", 0)
    rule_score = rule_assessment.get("rule_score", 0)

    lines = [
        "## Rule Trust Snapshot",
        f"- Rule score: **{rule_score}/100**",
        f"- AI score: **{ai_score}/100**",
        f"- Final score: **{final_score}/100**",
        f"- Confidence: **{confidence_level}** ({confidence_percent}%)",
    ]

    if critical_flags:
        lines.append("\n### Critical flags")
        for flag in critical_flags[:5]:
            lines.append(f"- {flag}")

    if breakdown:
        lines.append("\n### Key rule outcomes")
        for rule in breakdown[:5]:
            title = rule.get("title", "Rule")
            status = str(rule.get("status", "unknown")).upper()
            reason = rule.get("reason", "No reason provided.")
            lines.append(f"- **{title}**: {status} — {reason}")

    return "\n".join(lines)

# ==========================================
# ⚖️ TIER 2 & 3: AI CLASSIFICATION & AUDIT
# ==========================================
def run_ats_logic_with_failover(text):
    if not OPENROUTER_API_KEY:
        return {
            "status": "error",
            "message": "OPENROUTER_API_KEY is missing.",
            "errors": ["OPENROUTER_API_KEY environment variable is not set."],
        }

    models = ["google/gemini-2.0-flash-001", "meta-llama/llama-3.3-70b-instruct"]

    prompt = f"""
    Act as a Senior Legal Auditor. Your job is to classify and audit the document.
    CURRENT DATE: April 2026.

    ### TASK 1: CLASSIFICATION (The "Gatekeeper")
    - If the document is NOT a lease (e.g. Resume, Aadhaar, Bill, Article, or generic text):
      Return 'document_status': 'invalid', 'detected_as': '[Actual Document Type]', 'rejection_reason': 'We identified this as a [Document Type]. We only accept Rental Agreements.'
    - If it IS a lease but is missing critical filled-in data (e.g. 'Rent: ____' or no names):
      Return 'document_status': 'incomplete', 'detected_as': 'Empty Lease Agreement', 'rejection_reason': 'Several vital fields (like Rent or Tenant Names) are not filled yet. We cannot audit an empty agreement.'
    - Otherwise, return 'document_status': 'valid'.

    ### TASK 2: EXTRACTION & AUDIT (Only if valid)
    - Extract Rent and Deposit as numbers.
    - Check Tamil Nadu Act 2017 compliance (Deposit <= 3 months rent).
    - Try to extract clause summaries for notice period, lock-in, late fee, maintenance, entry rights, refund timeline, dispute resolution, and property details.
    - Provide a Markdown report for the 'explanation' field.

    TEXT:
    {text[:16000]}

    RETURN JSON ONLY:
    {{
        "document_status": "valid | invalid | incomplete",
        "detected_as": "string",
        "rejection_reason": "Provide a very clear, human-friendly reason why this document failed.",
        "extracted_data": {{
            "rent": number | "MISSING",
            "deposit": number | "MISSING",
            "date": "string",
            "notice_period": "string | MISSING",
            "lock_in": "string | MISSING",
            "late_fee": "string | MISSING",
            "maintenance": "string | MISSING",
            "entry_notice": "string | MISSING",
            "termination": "string | MISSING",
            "refund_timeline": "string | MISSING",
            "dispute_resolution": "string | MISSING",
            "property_details": "string | MISSING"
        }},
        "audit": {{
            "score": 0-100,
            "verdict": "SAFE | MEDIUM RISK | HIGH RISK",
            "color": "hex_code",
            "risks": [ {{ "issue": "string", "reason": "string" }} ]
        }},
        "explanation": "MARKDOWN_REPORT"
    }}
    """

    errors = []

    for model_id in models:
        try:
            response = client.chat.completions.create(
                model=model_id,
                messages=[{"role": "user", "content": prompt}],
                response_format={ "type": "json_object" },
                timeout=40
            )
            content = response.choices[0].message.content or ""
            try:
                parsed = json.loads(content)
                return {
                    "status": "success",
                    "model": model_id,
                    "data": parsed,
                }
            except json.JSONDecodeError as parse_error:
                preview = content[:1000]
                error_message = f"{model_id}: invalid JSON returned by OpenRouter ({parse_error}). Preview: {preview}"
                errors.append(error_message)
                print(error_message)
                continue
        except Exception as exc:
            error_message = f"{model_id}: {type(exc).__name__}: {exc}"
            errors.append(error_message)
            print(error_message)
            traceback.print_exc()
            continue 

    return {
        "status": "error",
        "message": "OpenRouter request failed for all configured models.",
        "errors": errors,
    }

# ==========================================
# 🚀 API ENDPOINT
# ==========================================
@app.post("/api/upload-lease")
async def upload_lease(file: UploadFile = File(...)):
    try:
        # Read PDF
        reader = pypdf.PdfReader(file.file)
        text = "".join([p.extract_text() for p in reader.pages if p.extract_text()])
        
        if not text.strip():
            return {
                "status": "rejected",
                "verdict": "UNREADABLE",
                "rejection_reason": "The PDF is unreadable or empty.",
                "explanation": "## ❌ Audit Blocked\nThis PDF contains no selectable text. If this is a scan, please use a high-quality digital version."
            }

        # 🟢 STAGE 1: HARD PHYSICAL VALIDATION
        is_valid, error_code, error_msg = pre_validate_text(text)
        if not is_valid:
            return {
                "status": "rejected",
                "verdict": error_code,
                "detected_as": "Unknown",
                "rejection_reason": error_msg,
                "explanation": f"## ❌ Audit Blocked\n{error_msg}"
            }

        # 🟢 STAGE 2: AI REASONING
        result = run_ats_logic_with_failover(text)

        if result.get("status") == "error":
            return result

        result_data = result.get("data") or {}

        # 🟢 STAGE 3: SMART REJECTION HANDLING
        if result_data.get("document_status") != "valid":
            reason = result_data.get("rejection_reason", "This document was not recognized as a valid lease.")
            detected = result_data.get("detected_as", "Unknown")
            
            return {
                "status": "rejected",
                "verdict": str(result_data.get("document_status", "rejected")).upper(),
                "detected_as": detected,
                "rejection_reason": reason,
                "explanation": f"## ❌ Audit Blocked\nWe identified this as a **{detected}**. {reason}"
            }

        # 🟢 STAGE 4: SUCCESSFUL AUDIT
        audit_data = result_data.get("audit", {})
        rule_assessment = evaluate_lease_rules(text, result_data.get("extracted_data", {}))
        ai_score = _safe_int(audit_data.get("score", 0), 0)
        rule_score = _safe_int(rule_assessment.get("rule_score", 0), 0)
        final_score = round((rule_score * 0.7) + (ai_score * 0.3))
        final_verdict = _score_to_verdict(final_score, rule_assessment.get("critical_flags", []))
        snapshot_markdown = _build_rule_snapshot_markdown(rule_assessment, ai_score, final_score)
        explanation = result_data.get("explanation", "")
        if explanation:
            explanation = f"{explanation}\n\n{snapshot_markdown}"
        else:
            explanation = snapshot_markdown

        return {
            "status": "success",
            "model": result.get("model"),
            "detected_as": result_data.get("detected_as"),
            "score": final_score,
            "final_score": final_score,
            "ai_score": ai_score,
            "rule_score": rule_score,
            "confidence": rule_assessment.get("confidence_level", "medium"),
            "confidence_percent": rule_assessment.get("confidence_percent", 0),
            "critical_flags": rule_assessment.get("critical_flags", []),
            "rule_breakdown": rule_assessment.get("rule_breakdown", []),
            "verdict": final_verdict,
            "theme": audit_data.get("color", "#4CAF50"),
            "risks": audit_data.get("risks", []),
            "summary": result_data.get("extracted_data", {}),
            "structured_fields": rule_assessment.get("structured_fields", {}),
            "explanation": explanation
        }

    except Exception as e:
        traceback.print_exc()
        return {
            "status": "error",
            "message": f"Server Error: {str(e)}",
            "trace": traceback.format_exc(),
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)