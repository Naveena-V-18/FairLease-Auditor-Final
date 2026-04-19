# FairLease Auditor

FairLease Auditor is an AI-assisted rental agreement review platform for lease risk detection, clause analysis, document validation, and guided tenant decision support.

## Overview

The platform is designed to help users upload a lease PDF and understand what is inside it before signing. It combines deterministic rule checks with AI analysis to produce a fairness score, a verdict, highlighted risks, and a readable explanation of the document.

It also includes a floating assistant, audit history, downloadable reports, and email notifications for user workflow support.

## What It Does

- Validates whether a document looks like a complete rental agreement.
- Scores the lease using a hybrid AI + rules pipeline.
- Detects risky clauses, contradictory language, and missing terms.
- Shows evidence snippets so users can verify why a clause was flagged.
- Generates a negotiation draft and what-if simulations for lease changes.
- Sends audit results by email and stores history in Supabase.
- Provides an admin dashboard for user management and outreach.

## Live Links

- Live app: https://fair-lease-auditor-final.vercel.app
- GitHub: https://github.com/Naveena-V-18/FairLease-Auditor-Final
- Demo video: https://drive.google.com/drive/folders/1LltORUk1TXroGlGK-nnkuBa7lSKBK-g1
- Poster: https://drive.google.com/file/d/1QhJqQb6Okhdj2gFThlOF6nsnCJSLd64K/view
- Documentation: https://drive.google.com/drive/folders/1EimOQx6CHBY3RRFiq9Ge74h5TiJz7dWI?usp=sharing

## Key Features

- Secure sign-in and sign-up with Supabase Auth
- Lease PDF upload and text extraction
- Invalid-document rejection flow
- Fairness score, AI score, rule score, and confidence snapshot
- Risk cards with evidence text
- Clause contradiction detection and consistency checks
- Priority buckets for immediate, important, and optional fixes
- Negotiation draft generator
- What-if simulator for alternate lease terms
- Audit history with delete support
- PDF report download
- Email notifications:
  - Welcome email
  - Security alert email
  - Audit result email

## AI and Trust Architecture

FairLease Auditor uses a hybrid review model.

1. Deterministic rule checks inspect objective lease terms first.
2. The AI layer evaluates the document contextually.
3. The final audit response blends both signals.
4. The UI exposes rule score, AI score, confidence, and evidence so the result is explainable.

This approach is meant to make the audit more transparent than a plain black-box score.

## Audit Flow

1. User uploads a lease PDF.
2. The Python service extracts text from the document.
3. The document is checked for minimum structure and lease keywords.
4. Rule-based lease checks run on the text.
5. OpenRouter AI generates risk analysis and a final assessment.
6. The app maps the response into success, rejection, or error states.
7. Audit metadata is stored in Supabase.
8. An audit email can be sent to the user.

## Sample File Workflow

Use the sample files to test the major output paths in the app.

Recommended test cases:

- Fair agreement sample: should produce a high fairness score and mostly clean output.
- Moderate agreement sample: should produce mixed findings and medium-risk signals.
- Contradiction sample: should trigger the Document Consistency Check card.
- Missing-fields sample: should trigger the rejection or incomplete-document path.
- Non-lease sample: should be flagged as outside audit scope.

How to use them:

1. Generate or download a sample PDF.
2. Open FairLease Auditor and sign in.
3. Upload the PDF from the home page.
4. Review the fairness score, risks, trust snapshot, and consistency checks.
5. Compare the result against the intended test case.

If you are creating your own sample PDFs, make sure they are saved as real PDF files, not screenshots or images inside a document.

## Tech Stack

Frontend

- Next.js 16 with App Router
- React 19
- Tailwind CSS
- Framer Motion
- React Markdown
- React Dropzone

Backend

- FastAPI
- Python PDF extraction and audit processing
- Next.js API routes for mail and auxiliary actions
- Nodemailer for outbound email

AI

- OpenRouter API
- Gemini 2.0 Flash and Llama 3.3 70B failover support

Data and Auth

- Supabase Auth
- Supabase Postgres for lease history and user records

## Project Structure

- app: Next.js pages, UI, and API routes
- api: FastAPI backend for lease analysis
- components: reusable UI components
- emails: React Email templates
- lib: mailer, Supabase, and session utilities
- public: static assets and generated report files

## Local Setup

### Prerequisites

- Node.js 18 or newer
- Python 3.10 or newer
- A Supabase project
- An OpenRouter API key
- Gmail app password or equivalent SMTP credentials

### 1. Clone the repository

```bash
git clone https://github.com/Naveena-V-18/FairLease-Auditor-Final.git
cd FairLease-Auditor-Final
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install backend dependencies

```bash
cd api
pip install -r requirements.txt
cd ..
```

### 4. Configure environment variables

Create a root `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

Create an `api/.env` file:

```env
OPENROUTER_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

For email and admin flows, add the required values in your deployment environment:

```env
EMAIL_USER=
EMAIL_PASS=
SUPABASE_SERVICE_ROLE_KEY=
```

## Run Locally

### Backend

```bash
cd api
python -m uvicorn main:app --reload --port 8000
```

### Frontend

In a second terminal, from the project root:

```bash
npm run dev
```

If you are running the backend locally, set the API URL to the Python server:

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

On PowerShell:

```powershell
$env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:8000"
```

Then open `http://localhost:3000`.

## Build and Deploy

```bash
npm run build
```

For Vercel deployment, the repository is already configured to route API traffic and use the FastAPI backend in production.

```bash
vercel --prod
```

## Deployment Notes

- The frontend uses relative API routing in production.
- The Python backend handles PDF upload and audit processing.
- Environment variables must be configured in Vercel, not committed to the repository.
- For local development, the frontend can point to the local Python service through `NEXT_PUBLIC_API_URL`.

## Data Model Notes

The app uses Supabase-backed tables for lease history and user data. Typical operations include:

- Create: store a new audit record
- Read: load a user’s audit history
- Delete: remove a specific record from history

## Sample Assets

If you need test documents, use the sample folder provided with the project materials:

- Sample leases and testing files: https://drive.google.com/drive/folders/1AHlovC2LAGjcp-A0t97MN3_hQxmT2jeD?usp=sharing

Suggested testing sequence:

1. Upload a fair lease sample.
2. Upload a moderate-risk lease sample.
3. Upload a contradiction sample.
4. Upload a missing-fields sample.
5. Upload a non-lease document.

Each case should exercise a different branch of the audit pipeline.

## Known Notes

- Next.js 16 middleware may show a deprecation warning, but the app still runs correctly.
- Audit email generation is handled directly; the system avoids writing files server-side in serverless flows.
- Some outputs depend on the quality of the uploaded PDF text extraction.

## Author

- Naveena V


