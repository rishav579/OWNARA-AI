# BIHARI AI

**The AI Employee Operating System.**

BIHARI AI hires AI Employees that do real business work. The first employee — **Kavya**, a Finance Employee — chases overdue invoices, drafts reminders, and escalates collection cases. Every irreversible action passes through a human approval gate, and every step is written to a hash-chained audit log.

---

## Prerequisites

- **Node.js 20+** and **Bun** (runtime + package manager)
- **PostgreSQL 16+** (local or managed — Railway, Neon, Supabase, RDS)
- A **Google Gemini API key** (free tier is sufficient)

---

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum `DATABASE_URL` and `JWT_SECRET`.

### 3. Start PostgreSQL

**Option A — Install locally (Debian/Ubuntu):**

```bash
sudo apt-get install -y postgresql
sudo service postgresql start
sudo -u postgres createuser --superuser $USER
createdb bihari
```

Set in `.env`:
```
DATABASE_URL=postgresql://$USER@localhost:5432/bihari?schema=public
```

**Option B — Docker:**

```bash
docker run -d --name bihari-pg \
  -e POSTGRES_USER=bihari \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=bihari \
  -p 5432:5432 \
  postgres:16
```

Set in `.env`:
```
DATABASE_URL=postgresql://bihari:password@localhost:5432/bihari?schema=public
```

**Option C — Managed (Railway/Neon/Supabase):**

Create a PostgreSQL database and copy the connection string into `.env`.

### 4. Push the database schema

```bash
bun run db:push
```

This creates all tables and indexes from `prisma/schema.prisma`.

### 5. Seed demo data (optional)

```bash
bun run scripts/seed.ts
```

Creates: demo user (Rishav Raj), Acme Trading workspace, Kavya (Finance Employee), 5 customers, 8 invoices, capabilities, audit trail.

**Login:** `rishav@acmetrading.in` / `demo-password`

### 6. Start the web server

```bash
bun run dev
```

The app runs on **http://localhost:3000**.

### 7. Start the worker process

The worker is a **separate process** that polls the database for runnable tasks and executes the trust loop (plan → reason → approve → execute → audit).

```bash
bun run worker
```

---

## Environment Variables

See [`.env.example`](./.env.example) for the full list.

### Required

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (`postgresql://...`) |
| `JWT_SECRET` | JWT signing secret (≥ 32 chars) |
| `LLM_PROVIDER` | `gemini` (default) |
| `LLM_MODEL` | `gemini-1.5-flash` |
| `GEMINI_API_KEY` | Google Gemini API key |
| `NODE_ENV` | `production` or `development` |

### Optional

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Enable OpenAI (not required — Gemini is default) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP relay for email |
| `SMTP_FROM` / `SMTP_FROM_NAME` | Sender identity |

> **No paid OpenAI key is required.** V1 runs on PostgreSQL + Gemini free tier.

---

## Scripts

| Command | Description |
|--------|-------------|
| `bun run dev` | Start Next.js dev server (port 3000) |
| `bun run worker` | Start the AI Employee runtime worker |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Sync Prisma schema to PostgreSQL |
| `bun run db:generate` | Regenerate Prisma client |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) + TypeScript 5 |
| Database | **PostgreSQL 16+** via Prisma ORM |
| AI | Google Gemini (default), OpenAI/Anthropic optional |
| Auth | JWT + bcrypt, refresh-token rotation |
| Email | nodemailer (SMTP, optional) |
| Runtime | Bun (worker) + Node (web server) |

---

## Important: PostgreSQL Only

This project uses PostgreSQL exclusively. The worker runtime depends on `SELECT ... FOR UPDATE SKIP LOCKED` for atomic task claiming — a PostgreSQL-specific feature that SQLite does not support. SQLite cannot be used.

---

## License

Proprietary. All rights reserved.
