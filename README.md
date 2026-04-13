# FairLease Auditor

AI-powered rental agreement auditing platform built for tenant risk detection, compliance checking, and guided decision support.

## Project Description

FairLease Auditor allows users to upload lease PDFs and receive:

- Document validation (is it a real, complete rental agreement?)
- AI-based legal risk analysis
- Fairness score and verdict
- Structured compliance insights aligned to Tamil Nadu rental rules
- Downloadable report and audit history
- Automated email notifications

## Live Links

- Deployment: https://fair-lease-auditor-final.vercel.app
- GitHub: https://github.com/Naveena-V-18/FairLease-Auditor-Final
- Demo Video: Add your video link here
- Poster: Add your poster link here
- Documentation: Add your documentation link here

## Tech Stack

Frontend

- Next.js 16 (App Router)
- React 19
- Tailwind CSS
- Framer Motion

Backend

- FastAPI (Python)
- Next.js API Routes (TypeScript)
- Nodemailer (Gmail SMTP)

AI

- OpenRouter API
- Models: Gemini 2.0 Flash + Llama 3.3 70B failover

Database and Auth

- Supabase Auth
- Supabase Postgres (leases and user data)

## Core Features

- Secure login/signup with Supabase and Google OAuth
- Lease PDF upload and extraction
- Multi-stage AI audit pipeline with failover
- Rejection flow for invalid or incomplete documents
- Fairness score, verdict, and detailed markdown analysis
- User vault/history with delete support
- Admin dashboard and user communication tools
- Email notifications:
	- Welcome email
	- Security alert email
	- Audit result email with attached PDF report

## AI Workflow

1. Input: User uploads lease PDF
2. Extraction: Python service reads text from PDF
3. Pre-validation: Rule checks for minimum content and lease keywords
4. AI reasoning: OpenRouter call with legal-auditor prompt
5. Output mapping:
	 - Invalid or incomplete document -> rejected response
	 - Valid document -> score, verdict, risks, explanation
6. Persistence: Audit metadata stored in Supabase
7. Communication: Audit result email triggered via API

## API Overview

Python endpoint

- POST /api/upload-lease

Next API endpoints

- POST /api/send-audit
- POST /api/send-welcome
- POST /api/send-security-alert
- GET /api/get-users
- GET /api/admin/users

## Project Structure

- app: Next.js app pages and API routes
- api: FastAPI backend service for AI audit processing
- components: Shared UI components
- emails: React email templates
- lib: Utility modules (mailer, supabase, auth helpers)

## Local Setup

Prerequisites

- Node.js 18+
- Python 3.10+
- Supabase project
- OpenRouter API key
- Gmail app password for SMTP

1) Clone and install frontend

- git clone https://github.com/Naveena-V-18/FairLease-Auditor-Final.git
- cd FairLease-Auditor-Final
- npm install

2) Install backend Python dependencies

- cd api
- pip install -r requirements.txt
- cd ..

3) Configure environment variables

In project root .env.local:

- NEXT_PUBLIC_SUPABASE_URL=
- NEXT_PUBLIC_SUPABASE_ANON_KEY=

In api/.env:

- OPENROUTER_API_KEY=
- NEXT_PUBLIC_SUPABASE_URL=
- NEXT_PUBLIC_SUPABASE_ANON_KEY=

For email sending (Vercel environment variables recommended):

- EMAIL_USER=
- EMAIL_PASS=
- SUPABASE_SERVICE_ROLE_KEY= (needed for some admin flows)

4) Run app

- npm run dev

## Build and Deploy

- npm run build
- vercel --prod

## Database Notes

This project uses Supabase tables such as:

- leases
- profiles
- users_info

Application-level CRUD currently implemented:

- Create: store new lease audit result
- Read: load user audit history
- Delete: remove specific audit history item

## Demo Readiness Guide

For live presentation, be ready to explain:

- Architecture: Next.js frontend + FastAPI AI backend + Supabase + SMTP mailer
- AI component: prompt design, model failover, and rejection logic
- Error handling: backend and UI fallback behavior
- Deployment: Vercel production pipeline

## Known Notes

- Middleware deprecation warning exists in Next.js 16, but app builds and runs.
- Serverless file writes are avoided for audit email flow; report is attached directly.

## Authors

- Naveena V

## License

For academic/internal project evaluation.
