# OWNARA

**Governed AI Execution for Delegated Business Responsibilities**

OWNARA is an AI-powered business operations system designed around a simple idea:

> **Instead of asking AI to perform isolated tasks, give an AI operator a persistent business responsibility — with clear authority boundaries, human approval, and an auditable execution trail.**

The system represents responsibilities as **Mandates**. Each Mandate defines what an AI operator is responsible for, what actions it is allowed to take, when human approval is required, and how every decision is recorded.

The current implementation focuses on **Kavya**, an AI Accounts Receivable operator for B2B businesses.

---

## What OWNARA Does

Kavya is responsible for maintaining healthy receivables.

The system continuously evaluates receivables data, identifies collection risks, proposes actions, waits for human approval when an action is consequential, executes the approved action, and records the complete execution history.

### The governed execution loop

```text
┌──────────────┐
│   OBSERVE    │
│ Receivables  │
│ State & Risk │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    REASON    │
│ Strategy &   │
│ Reminders    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   APPROVE    │
│ Human Review │
│    Gate      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   EXECUTE    │
│ Approved     │
│ Actions      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    AUDIT     │
│ Hash-Chained │
│ Ledger       │
└──────────────┘
```

### 1. Observe

The operator evaluates:

* Accounts receivable state
* Invoice aging buckets
* Customer credit profiles
* Previous payment-response history
* Outstanding and overdue invoices

### 2. Reason

The system determines an appropriate recovery strategy, such as:

* Prioritizing high-value overdue accounts
* Investigating disputed invoices
* Escalating unresponsive customers
* Drafting targeted payment reminders

### 3. Approve

Consequential actions do not execute immediately.

OWNARA generates a canonical **Execution Contract** containing the proposed action and its authority context.

The contract is cryptographically hashed and presented to a human reviewer before execution.

### 4. Execute

Once approved, the action is executed through the configured communication layer.

The current implementation uses **transactional SMTP email**.

### 5. Audit

Every important decision and execution event is recorded in a tamper-evident audit ledger using:

* Monotonic sequence numbers
* SHA-256 hash chaining
* PostgreSQL transaction controls
* Execution contracts
* Operator performance metrics

---

# Current Implementation

## Kavya — AI Accounts Receivable Operator

Kavya is the first specialized AI operator implemented inside OWNARA.

Her current Mandate is:

> **Maintain Healthy Receivables**

The system evaluates the persistent objective:

```text
overdueRate <= 0.15
```

and selects appropriate strategies based on the current receivables state.

---

## Core Capabilities

### Mandate Engine

Persistent business objectives are represented as Mandates rather than isolated prompts.

The Mandate Supervisor continuously evaluates whether the objective is being satisfied and determines when another execution cycle is required.

### Human-in-the-Loop Decision Center

Before consequential actions are executed, the proposed action can be reviewed by a human.

The interface provides:

* Proposed action
* Authority context
* Execution Contract
* Action diff
* Approval
* Rejection

### Tamper-Evident Audit Ledger

OWNARA records the execution history using a hash-chained ledger.

Each event contains deterministic sequencing and cryptographic linkage to previous events, making unauthorized modification easier to detect.

### Multi-Provider LLM Gateway

The backend supports provider adapters for:

* Google Gemini
* OpenAI
* Anthropic

The default configuration uses Google Gemini.

### Deterministic Evaluation

The project includes automated evaluation capabilities for measuring operator behavior across predefined Mandate scenarios.

Evaluation includes:

* Task outcomes
* Authority compliance
* Decision quality
* Execution behavior
* Operator skill progression

### CSV Data Import

Customer and invoice information can be imported through CSV files with validation for fields such as:

* GSTIN
* Payment terms
* Customer information
* Invoice information

---

# Architecture

OWNARA currently runs as a two-service application backed by PostgreSQL.

```text
                    ┌─────────────────────────┐
                    │       Web Service       │
                    │                         │
                    │ Next.js 16 + React 19   │
                    │ UI + API Routes         │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      Mandate Engine      │
                    │                           │
                    │ Supervisor / Authority   │
                    │ Decision / Execution     │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      Worker Service      │
                    │                           │
                    │ Background Runtime       │
                    │ Task Execution            │
                    │ Audit Processing          │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
             ┌──────────────┐         ┌──────────────┐
             │ PostgreSQL   │         │ LLM Gateway  │
             │              │         │ Gemini /     │
             │ State / Audit│         │ OpenAI /     │
             │ / Mandates   │         │ Anthropic    │
             └──────────────┘         └──────────────┘
```

### Technology Stack

| Layer              | Technology                              |
| ------------------ | --------------------------------------- |
| Frontend           | Next.js 16, React 19                    |
| Backend            | Next.js API Routes / Node.js            |
| Database           | PostgreSQL                              |
| ORM                | Prisma                                  |
| AI                 | Gemini / OpenAI / Anthropic adapters    |
| Background Runtime | Node.js / TypeScript                    |
| Email              | SMTP                                    |
| Authentication     | JWT                                     |
| Evaluation         | Deterministic scenario-based evaluation |
| Deployment         | Railway / Docker                        |

---

# Governance Model

OWNARA is intentionally designed around **authority**, not just intelligence.

An AI operator should not automatically have unlimited permission to act.

The execution model therefore separates:

```text
Intent
  ↓
Authority
  ↓
Decision
  ↓
Approval
  ↓
Execution
  ↓
Audit
```

This creates a boundary between:

* What the business wants
* What the AI recommends
* What the AI is authorized to do
* What requires human approval
* What was actually executed
* What happened afterward

This governance layer is the core architectural idea behind OWNARA.

---

# Current Scope & Limitations

OWNARA is currently a **portfolio and engineering prototype**, not a production accounting or collections platform.

The repository intentionally does not claim real enterprise customers, real financial outcomes, or production-scale performance.

## Implemented

* Kavya AI Accounts Receivable operator
* Mandate engine
* Mandate supervisor
* Human approval workflow
* Execution Contracts
* Hash-chained audit ledger
* PostgreSQL persistence
* Deterministic evaluation engine
* Multi-provider LLM gateway
* CSV customer/invoice ingestion
* Transactional email execution
* JWT authentication
* Background worker runtime

## Not Yet Implemented

### Live accounting integrations

There is currently no active two-way integration with:

* Tally
* Zoho Books
* QuickBooks
* Stripe

Invoice and customer data is currently imported through CSV.

### Document RAG

Document upload metadata exists, but the project does not currently implement a production vector-search/RAG pipeline.

### WhatsApp / Voice Collections

Communication currently uses transactional email.

WhatsApp and voice-based collections are outside the current implementation.

### Multiple AI Employees

Kavya is currently the primary active operator.

General Sales, HR, Operations, and other AI employees are not yet implemented as separate production operators.

---

# Local Development

## Requirements

* Node.js 20+
* npm
* PostgreSQL 16+
* Gemini API key

## Install

```bash
npm install --legacy-peer-deps
```

## Configure environment

```bash
cp .env.example .env
```

Example:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/ownara?schema=public"
JWT_SECRET="replace-with-a-random-secret-at-least-32-chars-long"
LLM_PROVIDER="gemini"
LLM_MODEL="gemini-3.6-flash"
GEMINI_API_KEY="your-gemini-api-key"
NODE_ENV="development"
```

## Initialize database

```bash
npx prisma db push --accept-data-loss
```

## Seed demo data

```bash
npx tsx scripts/seed.ts
```

## Start the web application

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Start the background worker

In a second terminal:

```bash
npm run worker
```

---

# Available Scripts

| Command                   | Purpose                                     |
| ------------------------- | ------------------------------------------- |
| `npm run dev`             | Start Next.js development server            |
| `npm run worker`          | Start background execution worker           |
| `npm run build`           | Build the production application            |
| `npm run start`           | Start the standalone production server      |
| `npm run lint`            | Run ESLint                                  |
| `npm run test:authority`  | Run authority and permission boundary tests |
| `npm run test`            | Run core MVP acceptance tests               |
| `npm run test:evaluation` | Run Mandate evaluation scenarios            |
| `npm run test:staging`    | Run controlled staging verification         |
| `npm run db:push`         | Apply Prisma schema                         |
| `npm run db:generate`     | Regenerate Prisma Client                    |

---

# Environment Variables

| Variable               | Required | Description                    |
| ---------------------- | -------: | ------------------------------ |
| `DATABASE_URL`         |      Yes | PostgreSQL connection string   |
| `JWT_SECRET`           |      Yes | JWT signing secret             |
| `LLM_PROVIDER`         |      Yes | Primary LLM provider           |
| `LLM_MODEL`            |       No | Selected model                 |
| `GEMINI_API_KEY`       |     Yes* | Gemini server-side API key     |
| `SMTP_HOST`            |       No | SMTP relay host                |
| `SMTP_PORT`            |       No | SMTP relay port                |
| `SMTP_USER`            |       No | SMTP authentication username   |
| `SMTP_PASS`            |       No | SMTP authentication credential |
| `SMTP_FROM`            |       No | Outbound sender address        |
| `SMTP_FROM_NAME`       |       No | Sender display name            |
| `CORS_ALLOWED_ORIGINS` |       No | Allowed application origins    |
| `NODE_ENV`             |      Yes | Runtime environment            |

* Required when Gemini is configured as the active provider.

---

# Deployment

OWNARA is containerized and can be deployed as separate web and worker services.

The repository includes Railway deployment documentation:

[`docs/RAILWAY-DEPLOYMENT.md`](./docs/RAILWAY-DEPLOYMENT.md)

The production topology consists of:

```text
Web Service
     │
     ├── Next.js application
     ├── API routes
     └── Decision Center
     
Worker Service
     │
     ├── Mandate Supervisor
     ├── Task execution
     └── Background processing

        │
        ▼

   PostgreSQL
```

---

# Why OWNARA?

Most AI applications focus on:

> **"Can the model perform the task?"**

OWNARA focuses on a different question:

> **"Can an AI system be trusted with a persistent business responsibility?"**

That requires more than a capable model.

It requires:

**Authority → Governance → Approval → Execution → Audit**

OWNARA explores that architecture through a concrete business workflow: **accounts receivable operations**.

---

# Project Status

**Status: Active Portfolio Prototype**

The current implementation demonstrates the architecture and engineering patterns required for governed AI execution.

The project is intentionally evolving toward a broader AI Employee / Business Operations platform while keeping authority boundaries and auditability as first-class system primitives.

---

# License

Proprietary and Confidential.

Copyright © 2026 OWNARA. All rights reserved.
