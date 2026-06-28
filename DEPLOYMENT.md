# AgroSmart AI — Deployment Guide

Stack: **Next.js 16** (Vercel) + **FastAPI** (Render) + **Clerk v7** (Auth)

---

## Step 1 — Deploy the backend on Render

### 1.1 Create a new Web Service on Render

Go to [render.com](https://render.com) → **New → Web Service** → connect your GitHub repo.

| Setting          | Value                                  |
|-----------------|----------------------------------------|
| **Repository**   | `mohammednafii/agrosmart-ai`           |
| **Root Directory** | `backend`                            |
| **Runtime**      | Python 3.10                            |
| **Build Command** | `pip install -r requirements.txt`     |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | **Standard (2 GB RAM minimum)**       |

> **Important — RAM requirement:**  
> TensorFlow requires at least **2 GB of RAM** to import and load the model.  
> Render's **free tier (512 MB) will NOT work**. Use the Standard plan ($7/month).

### 1.2 Set environment variables on Render

In your Render service → **Environment** tab, add:

| Variable | Value |
|----------|-------|
| `CLERK_FRONTEND_API_URL` | `https://your-instance.clerk.accounts.dev` |
| `CLERK_SECRET_KEY` | `sk_live_...` (from Clerk Dashboard) |
| `DATABASE_URL` | `sqlite:///./agrosmart.db` (or a Render Postgres URL) |
| `CORS_ALLOWED_ORIGINS` | `https://your-app.vercel.app` (set after Step 2) |

> **Database note:** SQLite data is lost on every Render deploy (ephemeral disk).  
> For persistent user data, add a **Render PostgreSQL** database and set `DATABASE_URL` to the Postgres connection string.

### 1.3 Verify the backend

Once deployed, open `https://your-backend.onrender.com/health`.  
Expected response:
```json
{ "status": "ok", "model": "loaded" }
```

Note your backend URL — you will need it in Step 2.

---

## Step 2 — Deploy the frontend on Vercel

### 2.1 Import project on Vercel

Go to [vercel.com](https://vercel.com) → **Add New → Project** → import `mohammednafii/agrosmart-ai`.

| Setting           | Value       |
|------------------|-------------|
| **Root Directory** | `agrosmart` |
| **Framework**     | Next.js (auto-detected) |
| **Build Command** | `next build` (default) |
| **Output Directory** | `.next` (default) |

### 2.2 Set environment variables on Vercel

In **Project Settings → Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.onrender.com` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` |
| `CLERK_SECRET_KEY` | `sk_live_...` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL` | `/` |

> Make sure to set the scope to **Production** (and optionally Preview/Development).

### 2.3 Verify the frontend

Once deployed, your app is live at `https://your-app.vercel.app`.  
- The landing page should load without auth.  
- Clicking **Connexion** should redirect to Clerk's hosted sign-in.

---

## Step 3 — Configure Clerk for production

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) → your application.
2. Switch from **Development** to **Production** instance.
3. Under **Domains**, add your Vercel URL: `https://your-app.vercel.app`
4. Copy the **Production API Keys**:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → starts with `pk_live_`
   - `CLERK_SECRET_KEY` → starts with `sk_live_`
5. Update these keys in both **Vercel** and **Render** environment variables.
6. Under **Redirect URLs**, add:
   - `https://your-app.vercel.app/sign-in`
   - `https://your-app.vercel.app/sign-up`
   - `https://your-app.vercel.app` (after sign-in redirect)

---

## Step 4 — Configure CORS

After deploying both services, go back to **Render → Environment** and update:

```
CORS_ALLOWED_ORIGINS=https://your-app.vercel.app
```

If you also want to keep local development working at the same time:

```
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-app.vercel.app
```

Then **redeploy the Render service** for the change to take effect.

---

## Step 5 — Verify the full deployment

| Test | How |
|------|-----|
| Backend health | `GET https://your-backend.onrender.com/health` → `{"status":"ok","model":"loaded"}` |
| CORS headers | `curl -I -H "Origin: https://your-app.vercel.app" https://your-backend.onrender.com/health` → `Access-Control-Allow-Origin` header present |
| Auth flow | Open frontend → click **Connexion** → sign in → should reach Dashboard |
| Prediction | In Dashboard → select a period → **Lancer la Simulation IA** → map overlay appears |
| Clerk JWT | Open browser DevTools → Network → `/predict` request → check `Authorization: Bearer sk_...` header |

---

## Local development

```bash
# Backend
cd backend
cp .env.example .env
# Fill in CLERK_FRONTEND_API_URL and CLERK_SECRET_KEY
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd agrosmart
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000 and Clerk TEST keys
npm install
npm run dev
```

---

## Architecture overview

```
Browser
  │
  ├── GET / → Vercel (Next.js)
  │     └── Landing page (public) or Dashboard (authenticated)
  │
  ├── Clerk hosted sign-in → clerk.accounts.dev
  │     └── JWT issued, stored in browser cookie
  │
  └── POST /predict → Render (FastAPI)
        ├── Clerk JWT verified via JWKS
        ├── User synced to DB
        └── U-Net inference → PNG overlay returned
```

---

## Environment variables reference

### Frontend (`agrosmart/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | FastAPI backend URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key |
| `CLERK_SECRET_KEY` | ✅ | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | ✅ | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | ✅ | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | ✅ | `/` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | ✅ | `/` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL` | ✅ | `/` |

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `CLERK_FRONTEND_API_URL` | ✅ | Clerk Frontend API for JWKS |
| `CLERK_SECRET_KEY` | ✅ | Clerk Management API key |
| `DATABASE_URL` | ✅ | SQLite path or Postgres URL |
| `CORS_ALLOWED_ORIGINS` | ✅ | Comma-separated allowed origins |
