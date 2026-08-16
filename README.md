# OWNARA

**Governed AI Execution for Delegated Business Responsibilities**

OWNARA is a governed AI execution system where businesses delegate persistent operational responsibilities—called **Mandates**—to specialized AI operators with strict authority boundaries, mandatory human approval gates, and cryptographic auditability.

The current production implementation features **Kavya**, an AI accounts receivable and invoice collections operator for B2B businesses.

---

## How It Works

OWNARA operates via a continuous 5-stage governed execution loop:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   OBSERVE    │ ──► │    REASON    │ ──► │   APPROVE    │ ──► │   EXECUTE    │ ──► │    AUDIT     │
│ Receivables  │     │ Strategy &   │     │ Human Review │     │ SMTP Email   │     │ SHA-256 Hash │
│ State & Risk │     │ Reminders    │     │ Gate Locked  │     │ Delivery     │     │ Ledger & XP  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

1. **Observe:** Inspects accounts receivable data, invoice aging buckets (1–30d, 31–60d, 61–90d, 90+d), customer credit profiles, and previous response history.
2. **Reason:** Formulates targeted recovery strategies (e.g. prioritize high-value, investigate disputed invoices, escalate unresponsive debtors) and drafts tailored payment reminders.
3. **Approve:** Pauses consequential actions before sending. Generates a canonical 17-field cryptographic Execution Contract (`EC-xxxx`) with a SHA-256 hash that locks upon human review.
4. **Execute:** Delivers approved communication via verified SMTP email relay.
5. **Audit:** Records every decision, approval, and outcome to a monotonic, hash-chained ledger and updates operator performance metrics.

---

## Current Scope & Limitations

### Implemented Today
- **Kavya (AI Finance Operator):** Specialized in B2B Accounts Receivable collections and overdue invoice follow-up.
- **Mandate Engine & Supervisor:** Autonomous evaluation of persistent objectives (`overdueRate <= 0.15`) with dynamic strategy selection.
- **Decision Center:** Human-in-the-loop review interface with contract inspection, diffs, and 1-click approvals/rejections.
- **Tamper-Evident Audit Ledger:** Monotonic sequence numbers with SHA-256 hash chaining and PostgreSQL advisory transaction locks.
- **Deterministic Evaluation Engine:** Post-task scorecards, skill leveling, and career timeline tracking.
- **Multi-Provider LLM Gateway:** Server-side routing for Google Gemini (`gemini-2.0-flash` default), OpenAI, and Anthropic with deterministic fallbacks.
- **CSV Data Importer:** Support for customer and invoice CSV file ingestion with GSTIN and payment term validation.

### Explicitly Not Implemented / Out of Current Scope
- **No Live Accounting Sync:** Automated two-way sync with Tally, Zoho Books, QuickBooks, or Stripe is not yet active (invoice data is imported via CSV).
- **No Document RAG / Vector Search:** Document uploads record metadata only; embeddings and vector database retrieval are not active.
- **No WhatsApp or Voice Collections:** Communication is delivered strictly via transactional email over SMTP.
- **No Multi-Employee Suite:** Kavya (Accounts Receivable) is the single active operator; general Sales, HR, or Operations agents are not implemented.

---

## Architecture & Deployment Topology

OWNARA runs as two concurrent services connected to PostgreSQL:

1. **Web Service (Next.js 16 + React 19):** Serves the single-page application and REST API routes on port 3000.
2. **Worker Service (Node.js / tsx):** Runs the background runtime engine, mandate supervisor, task executor, and audit writer.

For cloud deployment instructions, see [Railway Staging Deployment Guide](./docs/RAILWAY-DEPLOYMENT.md).

---

## Prerequisites

- **Node.js 20+** and **npm**
- **PostgreSQL 16+** (local or managed — Railway, Supabase, RDS, Neon)
- **Google Gemini API Key** (Server-side `GEMINI_API_KEY`)

---

## Local Development Setup

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Set the required variables in `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/ownara?schema=public"
JWT_SECRET="replace-with-a-random-secret-at-least-32-chars-long"
LLM_PROVIDER="gemini"
LLM_MODEL="gemini-2.0-flash"
GEMINI_API_KEY="your-gemini-api-key"
NODE_ENV="development"
```

### 3. Initialize Database Schema

```bash
npx prisma db push --accept-data-loss
```

### 4. Seed Database (Optional)

```bash
npx tsx scripts/seed.ts
```

### 5. Start Web Server

```bash
npm run dev
```
The application will be accessible at **http://localhost:3000**.

### 6. Start Background Worker

In a separate terminal window:
```bash
npm run worker
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js development server on port 3000 |
| `npm run worker` | Start background runtime execution worker (`scripts/worker.ts`) |
| `npm run build` | Build standalone production bundle (`.next/standalone/`) |
| `npm run start` | Start standalone production server (`node .next/standalone/server.js`) |
| `npm run lint` | Run ESLint static analysis |
| `npm run test:authority` | Run authority and permission boundary test suite |
| `npm run test` | Run core MVP acceptance test suite |
| `npm run test:evaluation` | Run 20-scenario mandate evaluation test suite |
| `npm run test:staging` | Run controlled staging service verification (Gemini, SMTP, DB) |
| `npm run db:push` | Push Prisma schema directly to PostgreSQL |
| `npm run db:generate` | Regenerate Prisma client |

---

## Environment Variables Reference

| Variable | Required | Default / Format | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | `postgresql://...` | Connection URL for PostgreSQL database |
| `JWT_SECRET` | **Yes** | String (≥ 32 chars) | Secret key used for signing JWT access & refresh tokens |
| `LLM_PROVIDER` | **Yes** | `gemini` | Primary LLM provider adapter |
| `LLM_MODEL` | No | `gemini-2.0-flash` | Gemini model selection |
| `GEMINI_API_KEY` | **Yes** | String | Google AI Studio server-side API key |
| `SMTP_HOST` | No | Hostname | Outbound email relay host (e.g. `smtp.sendgrid.net`) |
| `SMTP_PORT` | No | `587` | Outbound email relay port |
| `SMTP_USER` | No | String | SMTP authentication username |
| `SMTP_PASS` | No | String | SMTP authentication password / API key |
| `SMTP_FROM` | No | `noreply@ownara.com` | Outbound email sender address |
| `SMTP_FROM_NAME` | No | `OWNARA` | Outbound email sender display name |
| `CORS_ALLOWED_ORIGINS` | No | URL | Allowed origins for CORS validation |
| `NODE_ENV` | **Yes** | `production` / `development` | Node environment flag |

---

## License

Proprietary and Confidential. Copyright (c) 2026 OWNARA. All rights reserved.
