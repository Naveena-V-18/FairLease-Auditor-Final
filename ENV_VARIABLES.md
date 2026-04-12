# Environment Variables Reference - Vercel Deployment

## Required Environment Variables for Vercel

Copy each variable to your Vercel Dashboard:
**Project Settings → Environment Variables**

### Authentication & Database
```
NEXT_PUBLIC_SUPABASE_URL=https://fxxzqszlktefcclyppaq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_7VmLZrqN6thDiif1o4TObA_uRSJRT00
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4eHpxc3psa3RlZmNjbHlwcGFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTgyNTgwOCwiZXhwIjoyMDg1NDAxODA4fQ.4ozpmW8c-W5BRirCNG9Dtw0JdLOU8RFyjzGL8R3z5Ts

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZW1lcmdpbmctY3ViLTc2LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_GYrPcWRS0Zz1PgiwywDRdLk5SkYyeUFDaFDZMzvyVx
```

### AI & Document Processing
```
OPENROUTER_API_KEY=[your-openrouter-api-key]
```
⚠️ **Critical:** Without this, PDF analysis will fail silently!

### Email Delivery
```
RESEND_API_KEY=re_QtrWr2hn_JNzVS6h4PjGqfPquzN5GUJrV
EMAIL_USER=fairlease.auditor@gmail.com
EMAIL_PASS=cynk drgy lgaa luyn
```

### API Configuration (Development Only)
```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```
❌ **Do NOT set this on Vercel** - It maintains local dev compatibility only.
✅ When unset, frontend uses relative paths `/api/*` (Vercel production)

---

## Setup Instructions in Vercel Dashboard

1. Go to **Project Settings**
2. Click **Environment Variables**
3. Add each variable above
4. Ensure variables are available to:
   - ☑️ Production
   - ☑️ Preview
   - ☑️ Development (optional)
5. Redeploy after adding variables

## Security Notes

⚠️ **NEVER commit .env.local to GitHub**
- Add to `.gitignore` (already done)
- Vercel reads from dashboard only
- Never paste secrets in code

✅ **Safe to commit:**
- `vercel.json` - Configuration only
- `api/requirements.txt` - Dependencies only
- Source code - No secrets

## Verification

After deployment, verify each component:

### Check Frontend
```bash
# Should resolve to your production URL
curl https://[your-app].vercel.app/
```

### Check API Routes
```bash
# Should return your FastAPI response
curl https://[your-app].vercel.app/api/upload-lease (should 405 - POST only)
```

### Check Environment Variables
```javascript
// In browser console on your site:
console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("Clerk Key:", process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
// Should NOT show backend keys (they're server-only)
```

---

**Ready to deploy?** Push to GitHub and watch Vercel build automatically! 🚀
