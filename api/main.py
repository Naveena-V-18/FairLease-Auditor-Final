import os
import json
import re
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import pypdf
from openai import OpenAI

load_dotenv()

# --- INITIALIZATION ---
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
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

# ==========================================
# ⚖️ TIER 2 & 3: AI CLASSIFICATION & AUDIT
# ==========================================
def run_ats_logic_with_failover(text):
    models = ["google/gemini-2.0-flash-001", "meta-llama/llama-3.1-8b-instruct"]

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
    - Provide a Markdown report for the 'explanation' field.

    TEXT:
    {text[:16000]}

    RETURN JSON ONLY:
    {{
        "document_status": "valid | invalid | incomplete",
        "detected_as": "string",
        "rejection_reason": "Provide a very clear, human-friendly reason why this document failed.",
        "extracted_data": {{ "rent": number | "MISSING", "deposit": number | "MISSING", "date": "string" }},
        "audit": {{
            "score": 0-100,
            "verdict": "SAFE | MEDIUM RISK | HIGH RISK",
            "color": "hex_code",
            "risks": [ {{ "issue": "string", "reason": "string" }} ]
        }},
        "explanation": "MARKDOWN_REPORT"
    }}
    """

    for model_id in models:
        try:
            response = client.chat.completions.create(
                model=model_id,
                messages=[{"role": "user", "content": prompt}],
                response_format={ "type": "json_object" },
                timeout=40
            )
            return json.loads(response.choices[0].message.content)
        except Exception:
            continue 
    return None

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

        if not result:
            return {"status": "error", "message": "The engine is currently unavailable."}

        # 🟢 STAGE 3: SMART REJECTION HANDLING
        if result["document_status"] != "valid":
            reason = result.get("rejection_reason", "This document was not recognized as a valid lease.")
            detected = result.get("detected_as", "Unknown")
            
            return {
                "status": "rejected",
                "verdict": result["document_status"].upper(),
                "detected_as": detected,
                "rejection_reason": reason,
                "explanation": f"## ❌ Audit Blocked\nWe identified this as a **{detected}**. {reason}"
            }

        # 🟢 STAGE 4: SUCCESSFUL AUDIT
        return {
            "status": "success",
            "detected_as": result.get("detected_as"),
            "score": result["audit"].get("score", 0),
            "verdict": result["audit"].get("verdict", "UNKNOWN"),
            "theme": result["audit"].get("color", "#4CAF50"),
            "risks": result["audit"].get("risks", []),
            "summary": result["extracted_data"],
            "explanation": result["explanation"]
        }

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)