import os
import json
import re
import traceback
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import pypdf
from openai import OpenAI

try:
    from rule_engine import evaluate_lease_rules
except ModuleNotFoundError:
    # Vercel runtime can resolve package imports differently than local runs.
    from api.rule_engine import evaluate_lease_rules

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


def _normalize_confidence(value: str | None):
    if not value:
        return "medium"
    lowered = str(value).strip().lower()
    if lowered in {"high", "medium", "low"}:
        return lowered
    return "medium"


def _normalize_status(value: str | None):
    if not value:
        return "warning"
    lowered = str(value).strip().lower()
    if lowered in {"pass", "warning", "fail"}:
        return lowered
    return "warning"


def _build_enriched_risks(ai_risks: list, rule_breakdown: list):
    ai_risks = ai_risks if isinstance(ai_risks, list) else []
    rules = rule_breakdown if isinstance(rule_breakdown, list) else []

    risky_rules = [
        rule
        for rule in rules
        if _normalize_status(rule.get("status")) in {"fail", "warning"}
    ]

    enriched = []
    used_rule_indexes = set()

    for risk in ai_risks:
        if not isinstance(risk, dict):
            continue

        issue = str(risk.get("issue", "Lease Risk")).strip() or "Lease Risk"
        reason = str(risk.get("reason", "Potential lease concern detected.")).strip() or "Potential lease concern detected."

        issue_tokens = set(re.findall(r"[a-z]{4,}", issue.lower()))
        reason_tokens = set(re.findall(r"[a-z]{4,}", reason.lower()))
        tokens = issue_tokens.union(reason_tokens)

        matched_rule_index = None
        for idx, rule in enumerate(risky_rules):
            hay = " ".join([
                str(rule.get("title", "")),
                str(rule.get("reason", "")),
                str(rule.get("evidence", "")),
            ]).lower()
            if tokens and any(token in hay for token in tokens):
                matched_rule_index = idx
                break

        if matched_rule_index is None and risky_rules:
            for idx, _ in enumerate(risky_rules):
                if idx not in used_rule_indexes:
                    matched_rule_index = idx
                    break
            if matched_rule_index is None:
                matched_rule_index = 0

        linked_rule = risky_rules[matched_rule_index] if matched_rule_index is not None and risky_rules else None
        if matched_rule_index is not None:
            used_rule_indexes.add(matched_rule_index)

        evidence_text = str(linked_rule.get("evidence", "")).strip() if linked_rule else ""
        if not evidence_text:
            evidence_text = str(risk.get("evidence", "")).strip()

        confidence = _normalize_confidence(
            str(risk.get("confidence", "")).strip() or (linked_rule.get("confidence") if linked_rule else "")
        )
        risk_status = _normalize_status(linked_rule.get("status") if linked_rule else "warning")
        score_impact = _safe_int(linked_rule.get("score_impact", 8) if linked_rule else 8, 8)

        enriched.append(
            {
                "issue": issue,
                "reason": reason,
                "evidence_text": evidence_text,
                "confidence": confidence,
                "severity": risk_status,
                "score_impact": score_impact,
                "rule_id": str(linked_rule.get("rule_id", "")).strip() if linked_rule else "",
            }
        )

    if not enriched:
        for rule in risky_rules[:5]:
            enriched.append(
                {
                    "issue": str(rule.get("title", "Lease Risk")),
                    "reason": str(rule.get("reason", "Potential lease concern detected.")),
                    "evidence_text": str(rule.get("evidence", "")),
                    "confidence": _normalize_confidence(rule.get("confidence")),
                    "severity": _normalize_status(rule.get("status")),
                    "score_impact": _safe_int(rule.get("score_impact", 8), 8),
                    "rule_id": str(rule.get("rule_id", "")).strip(),
                }
            )

    return enriched


def _build_risk_priorities(enriched_risks: list):
    immediate = []
    important = []
    optional = []

    for risk in enriched_risks if isinstance(enriched_risks, list) else []:
        if not isinstance(risk, dict):
            continue

        issue = str(risk.get("issue", "Lease Risk")).strip() or "Lease Risk"
        reason = str(risk.get("reason", "Potential concern")).strip() or "Potential concern"
        score_impact = _safe_int(risk.get("score_impact", 8), 8)
        severity = _normalize_status(risk.get("severity"))
        confidence = _normalize_confidence(risk.get("confidence"))

        item = {
            "issue": issue,
            "why_now": reason,
            "score_impact": score_impact,
            "confidence": confidence,
        }

        if severity == "fail" or score_impact >= 14:
            immediate.append(item)
        elif severity == "warning" or score_impact >= 8:
            important.append(item)
        else:
            optional.append(item)

    return {
        "immediate": immediate[:3],
        "important": important[:3],
        "optional": optional[:3],
    }


def _detect_clause_conflicts(text: str, extracted_data: dict, enriched_risks: list):
    lower_text = text.lower()
    conflicts = []

    def add_conflict(title: str, details: str, evidence_terms: list[str], confidence: str = "medium"):
        evidence = ""
        for term in evidence_terms:
            idx = lower_text.find(term)
            if idx >= 0:
                start = max(0, idx - 80)
                end = min(len(text), idx + len(term) + 80)
                evidence = text[start:end].strip()
                break

        conflicts.append(
            {
                "title": title,
                "details": details,
                "evidence_text": evidence,
                "confidence": confidence,
            }
        )

    has_non_refundable = "non-refundable" in lower_text or "not refundable" in lower_text
    has_refund = "refund" in lower_text or "refundable" in lower_text
    if has_non_refundable and has_refund:
        add_conflict(
            "Deposit Refund Contradiction",
            "The lease text includes both refundable and non-refundable deposit language, which can create disputes.",
            ["non-refundable", "refund", "refundable"],
            "high",
        )

    has_notice_required = "notice" in lower_text and ("days" in lower_text or "month" in lower_text)
    has_immediate_termination = "immediate termination" in lower_text or "without notice" in lower_text
    if has_notice_required and has_immediate_termination:
        add_conflict(
            "Termination Path Conflict",
            "The lease contains both notice-period requirements and immediate termination language.",
            ["notice", "immediate termination", "without notice"],
            "high",
        )

    has_entry_with_notice = "prior notice" in lower_text or "with notice" in lower_text
    has_entry_without_notice = "without notice" in lower_text and ("entry" in lower_text or "access" in lower_text)
    if has_entry_with_notice and has_entry_without_notice:
        add_conflict(
            "Privacy Entry Conflict",
            "Landlord entry appears to be described both with and without notice conditions.",
            ["entry", "access", "without notice", "prior notice"],
            "medium",
        )

    deposit_candidates = re.findall(r"deposit\s*[:=]?\s*(?:rs\.?\s*)?([0-9][0-9,]*(?:\.[0-9]+)?)", lower_text)
    normalized = {re.sub(r"[^0-9.]", "", value) for value in deposit_candidates}
    normalized = {value for value in normalized if value}
    if len(normalized) >= 2:
        add_conflict(
            "Deposit Amount Inconsistency",
            "Multiple different deposit values were detected in the lease text.",
            ["deposit"],
            "medium",
        )

    if not conflicts:
        high_risks = [risk for risk in (enriched_risks or []) if _normalize_status(risk.get("severity")) == "fail"]
        if len(high_risks) >= 2:
            titles = ", ".join(str(item.get("issue", "Risk")) for item in high_risks[:2])
            conflicts.append(
                {
                    "title": "High-Risk Clause Stack",
                    "details": f"Multiple high-risk clauses may overlap and create combined liability: {titles}.",
                    "evidence_text": "",
                    "confidence": "medium",
                }
            )

    return conflicts[:4]

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
            "risks": [ {{ "issue": "string", "reason": "string", "evidence": "string", "confidence": "high|medium|low" }} ]
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
        enriched_risks = _build_enriched_risks(audit_data.get("risks", []), rule_assessment.get("rule_breakdown", []))
        risk_priorities = _build_risk_priorities(enriched_risks)
        clause_conflicts = _detect_clause_conflicts(text, result_data.get("extracted_data", {}), enriched_risks)
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
            "enriched_risks": enriched_risks,
            "risk_priorities": risk_priorities,
            "clause_conflicts": clause_conflicts,
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