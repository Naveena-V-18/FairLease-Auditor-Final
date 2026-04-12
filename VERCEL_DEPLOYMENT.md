# Vercel Deployment Guide - FastAPI + Next.js Integration

## ✅ Completed Setup

### 1. **vercel.json** - Created
- Configures Vercel to route all `/api/*` requests to the Python FastAPI backend
- Uses `@vercel/python@4.3.1` runtime for serverless Python functions
- Sets up proper build and install commands for both Next.js frontend and Python backend
- Includes optimized function settings (3GB memory, 30-second timeout)

### 2. **api/main.py** - Verified
✅ **FastAPI instance named "app"** - Properly exported for Vercel
✅ **Routes configured** - `/api/upload-lease` endpoint ready for PDF processing
✅ **CORS enabled** - Allows frontend-to-backend communication
✅ **AI logic implemented** - Processes PDFs and returns "Predatory Clause" analysis

### 3. **Frontend (app/page.tsx)** - Updated
✅ **Smart API URL routing** - Works for both local development and Vercel production
✅ **FormData handling** - Correctly sends multipart/form-data for PDF uploads
✅ **Error handling** - Properly displays "rejected" or "success" states

## 🚀 Deployment Steps

### Step 1: Prepare for Deployment
```bash
# Ensure all environment variables are set in Vercel
# Go to Vercel Dashboard → Project → Settings → Environment Variables

# Required environment variables:
NEXT_PUBLIC_SUPABASE_URL=https://fxxzqszlktefcclyppaq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-key]
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=[your-key]
CLERK_SECRET_KEY=[your-key]
SUPABASE_SERVICE_ROLE_KEY=[your-key]
OPENROUTER_API_KEY=[your-api-key]  # Important for AI processing!
RESEND_API_KEY=[your-api-key]
EMAIL_USER=[gmail-account]
EMAIL_PASS=[app-specific-password]
```

### Step 2: Push to GitHub
```bash
git add .
git commit -m "Setup Vercel deployment with FastAPI + Next.js"
git push
```

### Step 3: Deploy to Vercel
```bash
# Option A: Via Vercel CLI
npm install -g vercel
vercel --prod

# Option B: Via Vercel Dashboard
# Connect your GitHub repo → Vercel automatically deploys on push
```

### Step 4: Verify Deployment
1. Visit your Vercel deployment URL
2. Sign in with Clerk authentication
3. Upload a PDF file
4. Check the processing steps and ensure results display correctly

## 🔍 Testing Locally vs Production

### Local Development (Debug Mode)
```bash
# Terminal 1: Start Python backend
cd api
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2: Start Next.js frontend
npm run dev
```
**Uses:** `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`

### Production (Vercel)
**Uses:** Relative paths `/api/*` (no external URL needed)

## 🔧 Key Architecture

```
POST /api/upload-lease (FormData with PDF)
    ↓
Vercel Routes → api/main.py
    ↓
FastAPI processes PDF:
  1. Extract text from PDF
  2. Pre-validate document (length, keywords, template detection)
  3. Send to OpenRouter AI for classification & audit
  4. Return audit results with risks and fairness score
    ↓
Frontend displays:
  ✓ Fairness Score (0-100)
  ✓ Verdict (SAFE / MEDIUM RISK / HIGH RISK)
  ✓ Predatory Clauses & Risks
  ✓ Extracted rental terms
  ✓ Compliance report (Tamil Nadu Act 2017)
```

## 🐛 Troubleshooting

### Blank Results Issue (Fixed)
**Problem:** Results appear blank after upload
**Solution:** 
- ✅ Updated `getApiUrl()` helper to handle both local and production URLs
- ✅ FormData is correctly sent with multipart/form-data
- ✅ Backend returns all required fields (score, verdict, explanation, risks)
- ✅ Frontend properly maps backend response to component display

### PDF Not Processing
1. Ensure PDF has selectable text (not an image scan)
2. Check OPENROUTER_API_KEY is set correctly
3. Verify file size < 20MB (Vercel limit)
4. Check vercel.json routes are correct

### CORS Errors
✅ Already fixed - CORS middleware allows all origins in api/main.py

### Environment Variables Not Loading
1. Ensure `.env.local` is in root for local development
2. For Vercel, must be set in dashboard (not pushed to repo)
3. Never commit `.env.local` - keep it local only

## 📋 Project Structure (Verified)

```
fairlease/
├── vercel.json                    ← Routes /api/* to Python
├── .vercelignore                  ← Deployment ignore list
├── next.config.ts
├── tsconfig.json
├── package.json                   ← Next.js dependencies
├── app/
│   ├── page.tsx                   ← Updated with smart API routing
│   ├── api/
│   │   ├── send-audit/route.tsx
│   │   └── ... (other routes)
├── api/
│   ├── main.py                    ← FastAPI app (name = "app" ✓)
│   ├── requirements.txt           ← All dependencies included ✓
│   └── package.json
└── components/
    └── ... (UI components)
```

## ✨ Result: What Users Will See

**Upload Flow:**
1. User selects PDF → "Establishing Encrypted Connection..."
2. PDF uploads → "Executing Document Validation..."
3. Backend processes → "Analyzing Regulatory Compliance..."
4. AI generates report → "Generating Risk Assessment Report..."
5. Results display → Score, verdict, risks, and predatory clauses shown

**Success Response:**
```json
{
  "status": "success",
  "score": 85,
  "verdict": "SAFE",
  "theme": "#4CAF50",
  "risks": [
    {"issue": "Early termination clause", "reason": "..."}
  ],
  "explanation": "## ✅ Audit Passed\n...",
  "summary": {"rent": 50000, "deposit": "MISSING"}
}
```

**Error Handling:**
- Invalid PDFs show specific rejection reasons
- AI failures are caught with graceful error messages
- All errors logged for debugging

## 🎯 Next Steps After Deployment

1. **Monitor** - Check Vercel logs for any runtime errors
2. **Test** - Upload sample PDFs and verify results display
3. **Optimize** - Adjust timeout/memory in vercel.json if needed
4. **Secure** - Review environment variables aren't exposed in logs
5. **Scale** - Monitor function execution time and adjust as needed

---

**Your deployment is now ready! 🚀**
Push to GitHub and watch Vercel automatically deploy your FastAPI + Next.js integration.
