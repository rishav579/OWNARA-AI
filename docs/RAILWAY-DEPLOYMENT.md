# BIHARI AI — Railway Staging Deployment Guide

This guide details how to deploy BIHARI AI to Railway with 3 decoupled services:
1. **PostgreSQL Database**
2. **BIHARI Web Service** (Next.js Application)
3. **BIHARI Worker Service** (Background Runtime Engine)

---

## 1. Architecture on Railway

```
┌─────────────────────────────────────────────────────────────┐
│                    Railway Project                          │
│                                                             │
│  ┌────────────────────┐          ┌───────────────────────┐  │
│  │   PostgreSQL DB    │◄─────────┤   BIHARI Web Service  │  │
│  │   (Railway Plugin) │          │   (Next.js Port 3000) │  │
│  └─────────▲──────────┘          │   Public HTTPS URL    │  │
│            │                     └───────────────────────┘  │
│            │                                                │
│            │                     ┌───────────────────────┐  │
│            └─────────────────────┤ BIHARI Worker Service │  │
│                                  │ (scripts/worker.ts)   │  │
│                                  └───────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Step-by-Step Deployment Setup

### Step 1: Provision PostgreSQL
1. In your Railway project, click **New** → **Database** → **Add PostgreSQL**.
2. Railway will automatically provision PostgreSQL and expose `DATABASE_URL`.

### Step 2: Deploy Web Service
1. In the same project, click **New** → **GitHub Repo** → select `BIHARI_AI`.
2. Name the service: `bihari-web`.
3. Configure **Variables**:
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}` *(Railway Reference Variable)*
   - `JWT_SECRET`: Generate a random 64-char string (e.g. `openssl rand -base64 48`)
   - `LLM_PROVIDER`: `gemini`
   - `LLM_MODEL`: `gemini-2.0-flash`
   - `GEMINI_API_KEY`: `<your-gemini-api-key>`
   - `SMTP_HOST`: `smtp.sendgrid.net` (or your SMTP host)
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: `apikey` (or your SMTP username)
   - `SMTP_PASS`: `<your-smtp-api-key>`
   - `SMTP_FROM`: `noreply@bihari.ai`
   - `SMTP_FROM_NAME`: `BIHARI AI`
   - `CORS_ALLOWED_ORIGINS`: `https://${{RAILWAY_PUBLIC_DOMAIN}}`
   - `NODE_ENV`: `production`
4. Under **Settings**:
   - **Build Command**: `npx prisma generate && npm run build`
   - **Start Command**: `node .next/standalone/server.js`
   - **Healthcheck Path**: `/api/health`
   - **Public Networking**: Enable Public Domain (generates HTTPS endpoint)

### Step 3: Initialize Database Schema & Seed Data
In Railway CLI or via one-off Railway deployment command on `bihari-web`:
```bash
npx prisma db push --accept-data-loss
npx tsx scripts/seed.ts
```

### Step 4: Deploy Worker Service
1. Click **New** → **GitHub Repo** → select `BIHARI_AI` (same repository).
2. Name the service: `bihari-worker`.
3. Configure **Variables** (Shared with Web service):
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
   - `JWT_SECRET`: `${{bihari-web.JWT_SECRET}}`
   - `LLM_PROVIDER`: `gemini`
   - `LLM_MODEL`: `gemini-2.0-flash`
   - `GEMINI_API_KEY`: `${{bihari-web.GEMINI_API_KEY}}`
   - `SMTP_HOST`: `${{bihari-web.SMTP_HOST}}`
   - `SMTP_PORT`: `${{bihari-web.SMTP_PORT}}`
   - `SMTP_USER`: `${{bihari-web.SMTP_USER}}`
   - `SMTP_PASS`: `${{bihari-web.SMTP_PASS}}`
   - `SMTP_FROM`: `${{bihari-web.SMTP_FROM}}`
   - `NODE_ENV`: `production`
4. Under **Settings**:
   - **Build Command**: `npx prisma generate && npm run build`
   - **Start Command**: `npx tsx scripts/worker.ts`
   - **Public Networking**: Disabled (internal background worker)

---

## 3. Environment Variables Summary Table

| Variable | Required | Staging Value / Format | Purpose |
|---|---|---|---|
| `DATABASE_URL` | YES | `postgresql://...` | Connection string to PostgreSQL |
| `JWT_SECRET` | YES | 32+ char random string | Signs auth access/refresh tokens |
| `LLM_PROVIDER` | YES | `gemini` | Primary AI reasoning provider |
| `GEMINI_API_KEY` | YES | Google AI Studio Key | Server-side Gemini completions |
| `LLM_MODEL` | NO | `gemini-2.0-flash` | Gemini model name |
| `SMTP_HOST` | RECOMMENDED | e.g. `smtp.sendgrid.net` | Email relay hostname |
| `SMTP_PORT` | NO | `587` | SMTP port |
| `SMTP_USER` | RECOMMENDED | e.g. `apikey` | SMTP username |
| `SMTP_PASS` | RECOMMENDED | SMTP password/key | SMTP authentication password |
| `SMTP_FROM` | NO | `noreply@bihari.ai` | Sender email address |
| `CORS_ALLOWED_ORIGINS` | NO | `https://your-domain.up.railway.app` | CORS allowed origins |
| `NODE_ENV` | YES | `production` | Production mode flag |

---

## 4. Verification After Staging Deployment

1. **Web Healthcheck:** Open `https://<your-railway-domain>/api/health` -> returns `{ "status": "ok" }`.
2. **Login Test:** Log in at `https://<your-railway-domain>/#/login` with `rishav@acmetrading.in` / `demo-password`.
3. **Mandate Health:** Confirm Mandate "Maintain Healthy Receivables" shows live health score.
4. **Worker Polling:** Check worker logs in Railway to confirm supervisor cycle is evaluating mandates every 2s.
