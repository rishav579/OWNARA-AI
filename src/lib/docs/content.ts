import type { Doc, DocMeta } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// DEP-001 — Deployment & Environment Design (FULL CONTENT)
// ─────────────────────────────────────────────────────────────────────────────

export const DEP_001: Doc = {
  code: "DEP-001",
  title: "Deployment & Environment Design",
  subtitle:
    "How BIHARI AI runs locally, in staging, and in production — without Kubernetes, without microservices, without over-engineering.",
  version: "1.0",
  status: "LOCKED",
  scope:
    "AI Employee Platform — Deployment, environments, and operations for Version 1.",
  subordinateTo: [
    "Product Foundation",
    "System Architecture",
    "DDS-001",
    "AI Employee Engine Design",
    "APS-001",
    "BED-001",
    "FED-001",
    "RSD-001",
  ],
  category: "Deployment",
  sectionCount: 25,
  summary:
    "Defines local, staging, and production environments, container strategy, database deployment, CI/CD, release and rollback, monitoring, backups, and the operational runbooks a solo founder needs to run an audit-first AI platform.",
  sections: [
    {
      id: "dep-header",
      number: "",
      title: "Document Header",
      blocks: [
        {
          type: "callout",
          variant: "principle",
          title: "Subordination & Authority",
          text: "This document is subordinate to all previously locked documents. Where any conflict appears, the locked upstream document prevails and DEP-001 is revised to conform. It is authoritative for deployment topology, environment definitions, operational procedures, CI/CD, and runtime configuration only.",
        },
        {
          type: "table",
          headers: ["Field", "Value"],
          rows: [
            ["Document", "DEP-001"],
            ["Title", "Deployment & Environment Design"],
            ["Version", "1.0"],
            ["Status", "LOCKED for V1 Implementation"],
            ["Scope", "AI Employee Platform — Deployment & Operations for V1"],
            ["Authoritative for", "Deployment topology, environments, operations, CI/CD, runtime config"],
          ],
        },
      ],
    },
    {
      id: "dep-1",
      number: "1",
      title: "Deployment Philosophy",
      blocks: [
        {
          type: "p",
          text: "The BIHARI AI deployment exists to serve one operational reality: **a solo founder running a production-grade, audit-first, human-approval-first AI platform without a dedicated operations team.** Every deployment decision is justified against that reality and against the locked architecture: modular monolith, monorepo, no Kubernetes, no microservices, no over-engineering.",
        },
        { type: "h3", text: "Solo-Founder Operability" },
        {
          type: "p",
          text: "Every operational task — deploy, rollback, backup, restore, migrate, verify the audit chain, rotate a secret — must be doable by one engineer using documented runbooks. This rules out any technology whose operational surface exceeds what one person can reason about: no self-managed Kubernetes, no service mesh, no multi-region active-active, no self-hosted message broker. Managed services are preferred wherever the cost of self-management exceeds the managed service's cost.",
        },
        { type: "h3", text: "Managed-First" },
        {
          type: "p",
          text: "Undifferentiated infrastructure (compute, database, object storage, email, DNS, TLS) is consumed as managed services. The founder's engineering effort goes into the application and the trust loop, not into running PostgreSQL or terminating TLS. The only self-managed components in V1 are the application processes and the reverse proxy in front of them.",
        },
        { type: "h3", text: "Modular Monolith at Runtime" },
        {
          type: "p",
          text: "The deployment mirrors the architecture: one deployable web application process and one background worker process, both sharing the same codebase and database. There are no per-module deployments, no service discovery, no internal load balancing. The module seams exist inside the code for future extraction, not for present-day distribution.",
        },
        { type: "h3", text: "Audit-First Operations" },
        {
          type: "p",
          text: "The deployment must never compromise the audit trail. The database role used by the application has no UPDATE or DELETE privilege on audit_logs; backups preserve the hash chain; migrations never rewrite audit history; a deploy or rollback cannot leave an action without its audit entry. Operations that touch the audit store require explicit founder action and are themselves logged.",
        },
        { type: "h3", text: "Reproducibility" },
        {
          type: "p",
          text: "Local, staging, and production environments are as similar as practical. The same Docker images run in all three. The same migration sequence applies in all three. Environment differences are configuration, not code. A bug that reproduces in staging reproduces in production.",
        },
        { type: "h3", text: "No-Downtime Where Possible, Bounded-Downtime Otherwise" },
        {
          type: "p",
          text: "V1 does not require zero-downtime deploys. A few seconds of request-draining during a rolling restart is acceptable. The trust loop's waiting_approval state is durable across restarts — a deploy does not lose pending approvals or in-flight tasks.",
        },
        { type: "h3", text: "Security by Default & Cost Discipline" },
        {
          type: "p",
          text: "Production is locked down by default: TLS everywhere, secrets in a secret manager, database not publicly reachable, least privilege on all resources, audit logging enabled, rate limiting enabled. V1 runs on the smallest footprint that serves the traffic, with cost monitored per environment so the founder can detect burn before it becomes a crisis.",
        },
      ],
    },
    {
      id: "dep-2",
      number: "2",
      title: "Environment Strategy",
      blocks: [
        {
          type: "p",
          text: "V1 defines three environments: **local**, **staging**, and **production**. Each has a distinct purpose, a distinct data sensitivity, and a distinct operational posture. They share the same images and the same code; they differ only in configuration and infrastructure class.",
        },
        {
          type: "table",
          headers: [
            "Property",
            "Local",
            "Staging",
            "Production",
          ],
          rows: [
            ["Purpose", "Developer iteration", "Pre-release verification", "Live customer traffic"],
            ["Data", "Synthetic / seeded", "Synthetic (no real PII)", "Real customer data"],
            ["Traffic", "None (developer)", "Internal + smoke tests", "Real users"],
            ["LLM", "Mock LLM server", "Real, small quota", "Real, production quota"],
            ["Database", "Local Postgres (Docker)", "Managed (small)", "Managed (sized)"],
            ["Object storage", "MinIO (Docker)", "Managed (small bucket)", "Managed (prod bucket)"],
            ["Redis", "Local (Docker)", "Managed / small", "Managed"],
            ["Email", "MailHog (capture)", "Real, sandbox recipients", "Real recipients"],
            ["TLS", "Self-signed / none", "Managed TLS", "Managed TLS"],
            ["Backups", "None", "Daily, short retention", "Daily + PITR, long retention"],
            ["Secrets", ".env (gitignored)", "Secret manager", "Secret manager"],
            ["Domain", "localhost", "staging.bihari-ai.in", "app.bihari-ai.in"],
            ["Scale", "Single process", "Single instance, small", "Single instance, sized"],
          ],
        },
        { type: "h3", text: "Environment Parity Rules" },
        {
          type: "ul",
          items: [
            "The same Docker images run in staging and production. Staging is not built from a different Dockerfile.",
            "The same Alembic migration sequence is applied in all three.",
            "Differences are expressed exclusively through environment variables and managed-resource sizing — never through code branches.",
            "The mock LLM is used locally and in tests; staging and production use the real provider with quotas and caps.",
            "No real customer data is ever copied into staging or local. Realistic shapes are synthesized from factories.",
          ],
        },
        { type: "h3", text: "Environment Promotion" },
        {
          type: "p",
          text: "Code moves: feature branch → main (via PR) → staging (deploy) → production (deploy after verification). Promotion is always forward; there is no long-lived staging branch. The same commit that passes CI and deploys to staging is the candidate for production. A production deploy is a re-deploy of the staging image with production configuration, not a rebuild.",
        },
      ],
    },
    {
      id: "dep-3",
      number: "3",
      title: "Infrastructure Components",
      blocks: [
        {
          type: "p",
          text: "V1 uses a small, conventional set of infrastructure components. Each is either managed (preferred) or containerized where management is impractical or disproportionate.",
        },
        { type: "h3", text: "Application Process (FastAPI)" },
        {
          type: "ul",
          items: [
            "Runtime: Uvicorn (ASGI) behind Gunicorn as a process manager, in a container.",
            "Workers: 2 × CPU + 1, capped (e.g., 4) to bound DB connection pressure. Worker recycling enabled.",
            "Timeout: 60s request timeout; long operations offloaded to the background worker.",
            "Health: /health (alive), /ready (ready to serve — DB + Redis reachable).",
          ],
        },
        { type: "h3", text: "Background Worker Process" },
        {
          type: "ul",
          items: [
            "A Python process running the custom worker loop, same image as the API, different entrypoint.",
            "Concurrency: 1–2 concurrent job executors, tuned to job volume and connection budget.",
            "Health: writes a worker_heartbeat periodically; a monitor alerts if stale.",
            "Scaling: independent of the API. Additional instances claim via SELECT … FOR UPDATE SKIP LOCKED.",
          ],
        },
        { type: "h3", text: "PostgreSQL 16 (with pgvector)" },
        {
          type: "ul",
          items: [
            "Local: Docker container (postgres:16 + pgvector).",
            "Staging/Production: Managed PostgreSQL with pgvector, automated backups, PITR.",
            "Connection pooling: PgBouncer in transaction mode in front of the managed instance.",
            "Privileges: app role has INSERT/SELECT/UPDATE on operational tables and INSERT/SELECT only on audit_logs (no UPDATE/DELETE). A separate maintenance role is not used by the running app.",
          ],
        },
        { type: "h3", text: "Redis" },
        {
          type: "ul",
          items: [
            "Purpose: rate-limit counters and the SSE/worker wake signal only.",
            "Not a cache of trust-loop data, not a session store, not a message bus.",
            "Degradation: the system operates correctly (looser rate limits, polling) if Redis is unavailable.",
          ],
        },
        { type: "h3", text: "Object Storage, Email, LLM, Reverse Proxy, DNS" },
        {
          type: "ul",
          items: [
            "Object storage: MinIO locally; managed S3-compatible in staging/prod. Client access via short-lived signed URLs.",
            "Email: MailHog locally; managed transactional provider in staging (sandbox allowlist) and production.",
            "LLM: mock server locally; real provider in staging/prod with per-task caps and a monthly spend alert.",
            "Reverse proxy / edge: managed LB (or Caddy/nginx) terminates TLS, routes /api/* and /realtime to backend, / to frontend. Must support long-lived SSE.",
            "DNS: app.bihari-ai.in → prod LB; staging.bihari-ai.in → staging LB.",
          ],
        },
      ],
    },
    {
      id: "dep-4",
      number: "4",
      title: "Container Strategy",
      blocks: [
        {
          type: "p",
          text: "Both applications are containerized. The background worker shares the backend image with a different entrypoint. Containers are the unit of deployment in staging and production; local development uses containers for infrastructure and may run applications natively for hot reload.",
        },
        { type: "h3", text: "Backend Image" },
        {
          type: "ul",
          items: [
            "Base: python:3.12-slim (pinned by digest).",
            "Build: multi-stage; build stage installs deps into a virtualenv, runtime stage copies virtualenv + app code (no tests, docs, or dev deps).",
            "Entrypoints — API: gunicorn -k uvicorn.workers.UvicornWorker; Worker: python -m bihari_ai.workers.runner.",
            "Size target: < 400 MB. Non-root user. Listens on port 8000.",
          ],
        },
        { type: "h3", text: "Frontend Image" },
        {
          type: "ul",
          items: [
            "Multi-stage: node:20-slim build stage produces the static bundle; nginx:alpine serves it.",
            "nginx config proxies /api/* to the backend and serves the SPA shell for all other routes.",
            "Size target: < 50 MB. Non-root where supported.",
          ],
        },
        { type: "h3", text: "Image Tagging & Security" },
        {
          type: "ul",
          items: [
            "Tagged by git SHA (short) and, for releases, semantic version. latest is never a deploy target.",
            "The same image runs in staging and production; only configuration differs.",
            "Images are never re-tagged. Rollback = deploy a previous tag.",
            "Base images pinned by digest. Periodic Trivy scan; critical vulns triaged.",
            "No secrets baked into images — all secrets come from the environment at runtime.",
          ],
        },
      ],
    },
    {
      id: "dep-5",
      number: "5",
      title: "Local Development Environment",
      blocks: [
        {
          type: "p",
          text: "Local is optimized for fast iteration while remaining sufficiently similar to staging and production that bugs reproduce. It uses containers for infrastructure and runs applications natively for hot reload. A fully containerized mode is available via a --docker flag for parity testing.",
        },
        { type: "h3", text: "Infrastructure containers (docker-compose)" },
        {
          type: "ul",
          items: [
            "PostgreSQL 16 with pgvector — port 5432, persistent volume, migrations on first start.",
            "Redis — port 6379, ephemeral.",
            "MinIO — ports 9000 (API) / 9001 (console), persistent volume.",
            "MailHog — ports 1025 (SMTP) / 8025 (web UI).",
            "Mock LLM server — deterministic canned responses keyed by prompt hash.",
          ],
        },
        { type: "h3", text: "Application Startup & Seeding" },
        {
          type: "ul",
          items: [
            "scripts/dev.sh starts infra containers, runs pending migrations, starts backend (reload), worker, and frontend dev server. Ctrl-C gracefully stops all.",
            "scripts/seed.ts seeds employee_templates and tool_registry (idempotent).",
            "scripts/create-owner.py bootstraps a local workspace owner.",
            "Backend at http://localhost:8000; frontend dev server proxies /api/* to it.",
          ],
        },
        { type: "h3", text: "Mock LLM & Database Lifecycle" },
        {
          type: "ul",
          items: [
            "Mock LLM keeps local dev free of cost/latency and makes AI Engine behavior reproducible. LLM_PROVIDER=mock routes the gateway to the mock adapter.",
            "Migrations run automatically on dev.sh startup via alembic upgrade head.",
            "Local DB reset: docker-compose down -v && up -d, then migrate + seed.",
          ],
        },
        {
          type: "callout",
          variant: "info",
          title: "Local Limitations (acknowledged)",
          text: "No TLS (HTTP only). Single process per app. No real email (MailHog captures). No backup automation. All acceptable for local; staging and production enforce the real thing.",
        },
      ],
    },
    {
      id: "dep-6",
      number: "6",
      title: "Staging Environment",
      blocks: [
        {
          type: "p",
          text: "Staging is the pre-release verification environment. It exists to catch issues local cannot: real LLM behavior, real provider integrations, real managed-service behavior, and the full deploy sequence. It is not a playground; it is a faithful, smaller-scale replica of production.",
        },
        { type: "h3", text: "Purpose" },
        {
          type: "ul",
          items: [
            "Verify the staging image (the production candidate) deploys and operates correctly.",
            "Run smoke tests and the E2E suite against real managed infrastructure.",
            "Verify migrations against managed PostgreSQL before applying them to production.",
            "Verify provider integrations with real services but sandboxed recipients and capped quotas.",
            "Provide a demonstrable environment for the founder and early design partners.",
          ],
        },
        { type: "h3", text: "Infrastructure & Data" },
        {
          type: "ul",
          items: [
            "Application: a single small compute instance (API + worker, same image, two processes).",
            "Database: small managed PostgreSQL + pgvector, daily backups, 7-day retention.",
            "Redis, object storage (separate bucket), email (sandbox allowlist), LLM (real, capped).",
            "DNS/TLS: staging.bihari-ai.in with managed TLS.",
            "Data: no real customer data. All accounts seeded or created for testing. Disposable between releases.",
          ],
        },
        { type: "h3", text: "Deployment & Access" },
        {
          type: "ul",
          items: [
            "Staging deploys automatically on every merge to main (after CI passes).",
            "Same image build, same migration sequence as production. A failed staging deploy blocks production.",
            "Smoke tests run post-deploy: health, auth flow, task creation, approval flow, audit chain integrity.",
            "Accessible only to the founder and authorized design partners (basic auth / IP allowlist at the proxy, plus application auth). No public link.",
          ],
        },
      ],
    },
    {
      id: "dep-7",
      number: "7",
      title: "Production Environment",
      blocks: [
        {
          type: "p",
          text: "Production serves real users, holds real data, and operates under the full trust-loop guarantees. It is sized to V1 traffic with headroom, monitored continuously, and changed only through the documented deploy and migration procedures.",
        },
        { type: "h3", text: "Infrastructure" },
        {
          type: "ul",
          items: [
            "API: a single compute instance (optionally 2 behind an LB for deploy-time availability).",
            "Worker: a single compute instance (co-located or separate), scaled independently.",
            "Database: managed PostgreSQL 16 + pgvector, sized to workload, PITR enabled, daily backups (7-day hot, longer cold).",
            "Redis: managed, small. Object storage: managed bucket, versioning enabled, lifecycle rules.",
            "Email & LLM: real providers, production config, monthly spend cap + alert.",
            "DNS/TLS: app.bihari-ai.in with managed TLS. Reverse proxy: managed LB with edge rate limiting.",
          ],
        },
        { type: "h3", text: "Network Topology" },
        {
          type: "ul",
          items: [
            "Database, Redis, and object storage are not publicly reachable — private network only.",
            "Application instances reachable only through the load balancer.",
            "Egress allowed to LLM, email, and object storage providers over HTTPS.",
            "SSH/administrative access via bastion or cloud console with audit logging; not open to the internet.",
          ],
        },
        {
          type: "callout",
          variant: "warning",
          title: "Availability & Data Residency",
          text: "V1 targets a single-region deployment. No multi-region active-active, no formal SLA. Brief downtime during deploys (seconds) is acceptable. All data resides in a single India-friendly region; the LLM provider's processing location is documented and minimized.",
        },
      ],
    },
    {
      id: "dep-8",
      number: "8",
      title: "Database Deployment",
      blocks: [
        {
          type: "p",
          text: "The database is the most operationally sensitive component because it holds the audit trail. Its deployment follows DDS-001 exactly.",
        },
        { type: "h3", text: "Provisioning & Privileges" },
        {
          type: "ul",
          items: [
            "Managed PostgreSQL 16 with pgvector enabled, dedicated database.",
            "Two roles: application role (least privilege) and maintenance role (administrative, migrations + founder ops only).",
            "App role: INSERT, SELECT, UPDATE on operational tables; INSERT, SELECT only on audit_logs; no TRUNCATE, DROP, or CREATE.",
          ],
        },
        { type: "h3", text: "Migrations" },
        {
          type: "ul",
          items: [
            "Alembic, run as part of the deploy before new code serves traffic.",
            "Forward-only in production. Down migrations are founder-only, manual, maintenance-window.",
            "Expand-contract for breaking changes: expand (add) in N, migrate data, contract (remove) in N+1.",
            "Migrations touching audit_logs are additive only. Long backfills are batched; CREATE INDEX CONCURRENTLY for new indexes.",
          ],
        },
        { type: "h3", text: "Backups & Recovery" },
        {
          type: "ul",
          items: [
            "Automated daily backups (7-day hot) + PITR (≥7 days) for recovery to a specific second.",
            "Backup encryption at rest (managed).",
            "Restore drills: tested in staging before launch and quarterly thereafter, including audit-chain verification post-restore.",
          ],
        },
        {
          type: "callout",
          variant: "info",
          title: "Partitioning Readiness",
          text: "audit_logs, task_steps, llm_usage are shaped for monthly partitioning. V1 launches unpartitioned; partitioning is an operational change at the growth stage, applied via migration during a maintenance window. The HNSW index on knowledge_chunks.embedding is tuned for the expected corpus and reindexed as a maintenance operation.",
        },
      ],
    },
    {
      id: "dep-9",
      number: "9",
      title: "Background Worker Deployment",
      blocks: [
        {
          type: "p",
          text: "The worker is a separate process (or instance) running the same backend image with a different entrypoint. It is deployed and scaled independently of the API.",
        },
        {
          type: "ul",
          items: [
            "Startup: connects to DB + Redis, registers worker_id, begins polling for runnable jobs. Self-check verifies DB, Redis, LLM, object storage reachability.",
            "Concurrency: a single process with 1–2 concurrent executors. Additional instances claim via SELECT FOR UPDATE SKIP LOCKED.",
            "Health: writes a heartbeat every 30s. A monitor alerts if stale (>2 min). The platform restarts on crash.",
            "Deploy: in-flight jobs left in a resumable state; new worker resumes from the last completed step. waiting_approval tasks persist in the DB and are unaffected.",
            "Stuck-claim recovery: a periodic job releases claims older than ~10 min and re-queues orphaned planning/executing tasks whose worker died.",
          ],
        },
        {
          type: "callout",
          variant: "success",
          title: "Why this is safe during deploys",
          text: "Because every step is persisted and idempotent, a worker restart mid-job resumes from the last completed step — never re-executes a completed step. waiting_approval is not held by any worker, so a deploy during an approval wait has zero impact on the task.",
        },
      ],
    },
    {
      id: "dep-10",
      number: "10",
      title: "Frontend Deployment",
      blocks: [
        {
          type: "p",
          text: "The frontend is a static SPA built by Vite and served by nginx in a container. It has no server runtime of its own; all dynamic data comes from the backend API.",
        },
        { type: "h3", text: "Build & Serving" },
        {
          type: "ul",
          items: [
            "vite build produces fingerprinted (content-hashed) static assets + index.html.",
            "Option A (V1): assets copied into an nginx:alpine image. nginx serves assets with long cache headers, no-cache for index.html, and proxies /api/* to the backend.",
            "Option B (future): managed static hosting / CDN. V1 chooses Option A for simplicity and same-origin (no CORS).",
          ],
        },
        { type: "h3", text: "Cache Strategy & SPA Routing" },
        {
          type: "ul",
          items: [
            "Fingerprinted assets: Cache-Control: public, max-age=31536000, immutable.",
            "index.html: Cache-Control: no-cache (always revalidate).",
            "API responses: no cache headers from nginx; caching handled by TanStack Query in the client.",
            "nginx returns index.html for any non-asset, non-/api path so client-side routes work on direct load and refresh.",
          ],
        },
        {
          type: "callout",
          variant: "info",
          title: "Deploy behavior",
          text: "Because assets are fingerprinted, an in-flight client continues to use old assets until it reloads; there is no half-deployed state. A 'new version available' prompt may be shown on long-lived sessions (optional V1 feature).",
        },
      ],
    },
    {
      id: "dep-11",
      number: "11",
      title: "Secrets Management",
      blocks: [
        {
          type: "p",
          text: "Secrets never live in the repository, never in images, and never in committed env files. The strategy follows DDS-001 §12 and BED-001 §12 and is enforced operationally.",
        },
        {
          type: "table",
          headers: ["Category", "Examples", "Storage"],
          rows: [
            ["Application", "JWT_SECRET, LLM_API_KEY, STORAGE_SECRET_KEY, EMAIL_API_KEY", "Secret manager → env at startup"],
            ["Infrastructure", "DB password, Redis password", "Managed by platform; connection string in env"],
            ["Provider", "Third-party API keys", "Secret manager"],
          ],
        },
        { type: "h3", text: "Access, Rotation & Hygiene" },
        {
          type: "ul",
          items: [
            "Only application instances and the founder can read secrets. Secret access is logged by the manager.",
            "No secret is ever logged; logging config explicitly redacts known secret-shaped values.",
            "JWT_SECRET rotation invalidates all access tokens immediately (users re-login).",
            "Provider key rotation: add new key to manager, restart app, revoke old after verification.",
            "DB password rotation: managed by the platform where supported; otherwise a maintenance-window operation.",
            "Pre-commit hook (detect-secrets / gitleaks) scans for accidental commits. Images scanned in CI.",
          ],
        },
      ],
    },
    {
      id: "dep-12",
      number: "12",
      title: "Environment Variables",
      blocks: [
        {
          type: "p",
          text: "All configuration is environment-driven (BED-001 §12). Variables marked required must be present in production; the application refuses to start if missing. Unknown variables are ignored; APP_ENV=production enables strict mode.",
        },
        {
          type: "table",
          headers: ["Variable", "Required", "Default", "Description"],
          rows: [
            ["APP_ENV", "Yes", "—", "development / staging / production"],
            ["APP_PORT", "No", "8000", "Backend listen port"],
            ["LOG_LEVEL", "No", "INFO", "DEBUG / INFO / WARNING / ERROR"],
            ["WORKER_CONCURRENCY", "No", "2", "Concurrent job executors"],
            ["DATABASE_URL", "Yes", "—", "Async PostgreSQL connection string"],
            ["DB_POOL_SIZE", "No", "10", "SQLAlchemy async pool size"],
            ["DB_MAX_OVERFLOW", "No", "5", "Pool overflow"],
            ["DB_STATEMENT_TIMEOUT_MS", "No", "5000", "Server-side statement timeout"],
            ["REDIS_URL", "No", "—", "If absent, degrades to in-memory + polling"],
            ["JWT_SECRET", "Yes", "—", "JWT signing secret (HS256)"],
            ["ACCESS_TOKEN_TTL_SECONDS", "No", "900", "15 minutes"],
            ["REFRESH_TOKEN_TTL_SECONDS", "No", "604800", "7 days"],
            ["LLM_PROVIDER", "Yes", "—", "mock / openai / other"],
            ["LLM_API_KEY", "Yes*", "—", "Provider API key (required if not mock)"],
            ["LLM_MODEL", "No", "provider default", "Chat model"],
            ["LLM_MAX_RETRIES", "No", "3", "Transient failure retries"],
            ["LLM_MONTHLY_SPEND_CAP_USD", "No", "—", "Optional soft cap; triggers alert"],
            ["STORAGE_PROVIDER / STORAGE_BUCKET / STORAGE_REGION", "Yes", "—", "Object storage config"],
            ["STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY", "Yes", "—", "Storage credentials (or IAM in prod)"],
            ["EMAIL_PROVIDER / EMAIL_API_KEY / EMAIL_FROM_ADDRESS", "Yes*", "—", "Email config (*API key required if not mailhog)"],
            ["CORS_ALLOWED_ORIGINS", "Yes", "—", "Comma-separated allowed origins"],
            ["RATE_LIMIT_ENABLED", "No", "true", "Enable/disable rate limiting"],
            ["MAX_DOCUMENT_SIZE_BYTES", "No", "10485760", "10 MB"],
            ["TASK_DEFAULT_STEP_CAP", "No", "20", "Default max steps per task"],
            ["TASK_DEFAULT_TOKEN_CAP", "No", "100000", "Default max tokens per task"],
            ["VITE_API_BASE_URL", "Yes", "—", "Frontend: backend API base URL"],
          ],
        },
        {
          type: "callout",
          variant: "warning",
          title: "Rules",
          text: "No secrets in VITE_-prefixed variables. APP_ENV=production enables strict mode (no debug routes, structured logs only, restrictive CORS, rate limiting on). Missing required variables cause startup failure.",
        },
      ],
    },
    {
      id: "dep-13",
      number: "13",
      title: "Networking & Gateway",
      blocks: [
        {
          type: "p",
          text: "V1 uses a single external entry point per environment, with a reverse proxy (managed load balancer or Caddy/nginx) handling TLS, routing, and edge concerns.",
        },
        { type: "h3", text: "Topology" },
        {
          type: "code",
          lang: "text",
          code: "Internet → Managed LB (TLS termination)\n            ├── /api/*     → Backend API (FastAPI, port 8000)\n            ├── /realtime  → Backend API (SSE endpoint)\n            └── /*         → Frontend (nginx static, port 80)",
        },
        { type: "h3", text: "TLS & Routing Rules" },
        {
          type: "ul",
          items: [
            "TLS terminated at the LB (managed certificate, auto-renewed). HSTS enabled in production. TLS 1.2+ only.",
            "/api/* → backend (X-Workspace-Id, Authorization pass through).",
            "/realtime (SSE) → backend. LB/proxy must support long-lived connections; idle timeout set high (e.g., 5 min) for this path. Client auto-reconnects regardless.",
            "/* → frontend. Non-asset, non-/api paths return index.html for SPA routing.",
            "Internal: DB, Redis, object storage on private network, not internet-reachable.",
            "CORS: same-origin in production (frontend + API share app.bihari-ai.in). Staging origin in staging. localhost in dev.",
            "Edge rate limits complement (not replace) application-level per-user limits for abuse protection.",
          ],
        },
      ],
    },
    {
      id: "dep-14",
      number: "14",
      title: "Monitoring & Observability",
      blocks: [
        {
          type: "p",
          text: "Observability is sized to a solo founder: enough to detect and diagnose problems, not so much that operating it becomes a second job. Three signals: metrics, logs, and lightweight traces.",
        },
        { type: "h3", text: "Metrics" },
        {
          type: "ul",
          items: [
            "Infrastructure: CPU, memory, disk, network per instance (platform-provided).",
            "Database: connections, query latency, cache hit ratio, replication lag.",
            "Application: request count, latency (p50/p95/p99), error rate (4xx/5xx), active requests.",
            "Worker: jobs claimed/completed/failed, job duration, queue depth, heartbeat age.",
            "Business: tasks created, approvals pending/decided, LLM calls/tokens/cost per workspace per day.",
            "Trust: audit entries appended per workspace, audit chain verification status.",
          ],
        },
        { type: "h3", text: "Alerts (high-signal, low-noise)" },
        {
          type: "ul",
          items: [
            "API 5xx > 1% for 5 min; API p95 > 2s for 5 min.",
            "Worker heartbeat stale > 2 min.",
            "DB connection pool utilization > 80%; DB disk > 80%.",
            "Audit chain verification failure (immediate).",
            "LLM monthly spend > 80% of cap.",
            "Backup failure (immediate). Instance down (immediate).",
          ],
        },
        {
          type: "callout",
          variant: "info",
          title: "Audit logs are NOT operational logs",
          text: "Audit logs live in the database (audit_logs table), not in log files — this is the trust trail, separate from operational logs. A founder or auditor verifying trust consults the audit trail, not operational logs. This separation enforces the audit-first principle: the audit trail is not at the mercy of log retention or log infrastructure.",
        },
        { type: "h3", text: "Health Checks" },
        {
          type: "ul",
          items: [
            "/health — process is alive (200).",
            "/ready — ready to serve (DB reachable, Redis reachable or degraded, LLM reachable or mock).",
            "The LB uses /ready for routing; an unready instance is removed from rotation.",
            "The worker has no HTTP health endpoint; it relies on the heartbeat monitor.",
          ],
        },
      ],
    },
    {
      id: "dep-15",
      number: "15",
      title: "Logging Strategy (Operational)",
      blocks: [
        {
          type: "p",
          text: "This section details the operational logging pipeline (distinct from BED-001 §11, which defines what is logged; this defines how logs are collected, stored, and accessed).",
        },
        { type: "h3", text: "Collection & Storage" },
        {
          type: "ul",
          items: [
            "All application processes write structured JSON to stdout. A platform log agent collects and ships to the aggregator. No local log files in production.",
            "Hot (searchable): 30 days application, 90 days security. Cold (archived): 90 days application, 1 year security.",
            "Audit logs are in the database, not in log storage; they follow the DB backup/retention strategy.",
            "Logs accessible to the founder via the aggregator UI/API. Security logs access-controlled separately.",
          ],
        },
        { type: "h3", text: "Log Structure" },
        {
          type: "p",
          text: "Every log line includes: timestamp (UTC ISO 8601), level, logger, message, request_id, workspace_id (where applicable), user_id (where applicable), and contextual fields (task_id, employee_id, error_code). No PII is logged; where a field might contain PII it is redacted or replaced with a UUID reference.",
        },
      ],
    },
    {
      id: "dep-16",
      number: "16",
      title: "CI/CD Pipeline",
      blocks: [
        {
          type: "p",
          text: "Continuous integration runs on every PR; continuous deployment runs on every merge to main (to staging) and on every release tag (to production). The pipeline is defined in .github/workflows/ and is the single path to production.",
        },
        { type: "h3", text: "CI (on every PR)" },
        {
          type: "ol",
          items: [
            "Lint — ruff (backend), eslint + prettier --check (frontend).",
            "Type check — mypy (backend), tsc --noEmit (frontend).",
            "Unit tests — pytest unit/, vitest.",
            "Integration tests — pytest integration/ against test PostgreSQL (pgvector) container; frontend vitest + MSW.",
            "API tests — pytest api/ via TestClient.",
            "Codegen freshness — regenerate shared-types from backend OpenAPI; fail if committed output differs.",
            "Import-rule check — import-linter (backend), ESLint boundary rules (frontend).",
            "Build — build backend + frontend images; fail on error.",
            "Security scan — detect-secrets/gitleaks on diff; trivy on built images.",
            "Bundle size check — frontend within budget.",
          ],
        },
        { type: "h3", text: "CD to Staging (on merge to main)" },
        {
          type: "ol",
          items: [
            "Build images tagged with the git SHA; push to registry.",
            "Deploy to staging: alembic upgrade head, roll backend API, roll worker, deploy frontend.",
            "Smoke tests: health, auth, task creation, approval flow, audit chain.",
            "E2E (nightly or per-deploy if fast): Playwright against staging.",
            "Notify founder with SHA + smoke results.",
          ],
        },
        { type: "h3", text: "CD to Production (on release tag / manual approval)" },
        {
          type: "ol",
          items: [
            "Verify staging: the same SHA must have passed staging smoke tests.",
            "Deploy to production: migrations, roll API, roll worker, deploy frontend.",
            "Smoke tests; elevated monitoring for 30 minutes post-deploy.",
            "Rollback if needed (§18).",
            "Notify founder; record the release in the changelog.",
          ],
        },
        {
          type: "callout",
          variant: "principle",
          title: "Pipeline Security",
          text: "CI/CD has least-privilege access to production secrets; deploy steps can access the secret manager, build steps cannot. The pipeline uses OIDC to authenticate to the cloud provider (no long-lived CI credentials). No code bypasses the pipeline — emergency fixes follow the same path, expedited.",
        },
      ],
    },
    {
      id: "dep-17",
      number: "17",
      title: "Release Strategy",
      blocks: [
        {
          type: "p",
          text: "Releases are deliberate, versioned, and reversible. V1 uses a rolling deploy with health checks, not blue-green or canary (which add complexity disproportionate to V1 traffic).",
        },
        { type: "h3", text: "Versioning" },
        {
          type: "ul",
          items: [
            "Semantic versioning: vMAJOR.MINOR.PATCH. V1 launches as v1.0.0.",
            "Patch = bug fixes. Minor = backward-compatible features. Major = breaking changes (rare; require versioned doc revisions).",
            "Git tags mark releases; a GitHub Release notes the changes.",
          ],
        },
        { type: "h3", text: "Deploy Sequence (production)" },
        {
          type: "ol",
          items: [
            "Pre-deploy checks: staging healthy, smoke tests pass, changelog reviewed, maintenance window chosen if a long migration is involved.",
            "Migrations: alembic upgrade head against production via the maintenance role. Forward-only. Long migrations monitored; maintenance mode if blocking.",
            "Backend API deploy: new image; rolling if multi-instance (drain before stop, health-gated); brief downtime if single instance.",
            "Worker deploy: new image; in-flight jobs left resumable; waiting_approval unaffected.",
            "Frontend deploy: new image; fingerprinted assets mean no half-deployed state.",
            "Post-deploy verification: smoke tests, 30-min metric watch, founder confirmation.",
          ],
        },
        {
          type: "callout",
          variant: "info",
          title: "Migrations in the deploy",
          text: "Migrations run before new code serves traffic, so new code sees the new schema. Expand-contract avoids downtime: expand in release N (additive), migrate data over time, contract in release N+1 (remove old). A failed migration halts the deploy; Alembic's version table tracks applied state so a re-run resumes correctly.",
        },
        { type: "h3", text: "Feature Flags in Release" },
        {
          type: "p",
          text: "Documented V1 feature flags (websocket_progress, email_notifications, audit_chain_verification) allow deploying a feature disabled and enabling it after verification, reducing deploy risk. Flags are checked at runtime; toggling does not require a redeploy.",
        },
      ],
    },
    {
      id: "dep-18",
      number: "18",
      title: "Rollback Strategy",
      blocks: [
        {
          type: "p",
          text: "Rollbacks are a first-class operation. Every deploy is reversible to the previous known-good state.",
        },
        { type: "h3", text: "Image Rollback" },
        {
          type: "ul",
          items: [
            "The previous image tag is always available in the registry. Rollback = re-deploy the previous tag.",
            "Images are immutable and tagged by SHA, so rollback is a configuration change, not a rebuild.",
          ],
        },
        { type: "h3", text: "Database Rollback (forward-only)" },
        {
          type: "ul",
          items: [
            "Forward-only migrations mean a code rollback to a previous image may be incompatible with a newer schema — unless expand-contract is followed.",
            "Expand (release N): additive schema changes; old code (release N-1) ignores new columns — safe to roll back past.",
            "Contract (release N+1): remove old columns only after release N is stable and won't be rolled back past.",
            "A contract migration is never in the same release as the code that depends on the new shape.",
            "Emergency data rollback: PITR to a point before the migration. Founder-only, maintenance-window, with full audit-chain verification afterward.",
          ],
        },
        { type: "h3", text: "Rollback Procedure & Limitations" },
        {
          type: "ol",
          items: [
            "Identify the issue (failed smoke test, metric degradation, user report).",
            "Decision: rollback vs forward-fix. Roll back if severe and the fix is not immediate.",
            "Roll back backend API image to previous SHA; roll back worker; roll back frontend if needed.",
            "Do NOT roll back the database — schema is additive and forward-compatible.",
            "Verify: smoke tests, metrics, user reports.",
            "Post-incident: document the issue, the rollback, and the forward-fix plan.",
          ],
        },
        {
          type: "callout",
          variant: "warning",
          title: "Rollback cannot undo side effects",
          text: "A rollback cannot undo side effects already executed (emails sent, LLM calls made). The audit trail records these; they are not 'undone,' only the code behavior is reverted. A rollback does not restore audit_logs to a previous state — the audit trail is append-only and forward-only by design.",
        },
        {
          type: "p",
          text: "A rollback is practiced in staging before launch and periodically thereafter, so the procedure is verified and the founder is fluent in it.",
        },
      ],
    },
    {
      id: "dep-19",
      number: "19",
      title: "Operational Runbooks",
      blocks: [
        {
          type: "p",
          text: "Runbooks live in docs/deployment/runbook.md and are linked from alerts. Each is a step-by-step procedure for a specific scenario. V1 includes the following (detailed steps in the runbook doc).",
        },
        {
          type: "table",
          headers: ["ID", "Runbook", "When"],
          rows: [
            ["RB-01", "Deploy to production", "Standard release"],
            ["RB-02", "Rollback a deploy", "Severe issue, fix not immediate"],
            ["RB-03", "Run a database migration", "Schema change"],
            ["RB-04", "Restore the database from backup / PITR", "Data loss or corruption"],
            ["RB-05", "Verify the audit chain", "Periodic / after alert"],
            ["RB-06", "Rotate a secret", "Routine / after incident"],
            ["RB-07", "Respond to an alert", "Any alert trigger"],
            ["RB-08", "Handle a security incident", "Suspected breach"],
            ["RB-09", "Scale up a resource", "Sustained threshold breach"],
            ["RB-10", "Handle an LLM provider outage", "Provider degraded/down"],
          ],
        },
        {
          type: "p",
          text: "Each runbook includes: trigger (when to use it), prerequisites, steps, verification, and escalation (when to seek help — even a solo founder should know when to call a consultant or the provider's support).",
        },
      ],
    },
    {
      id: "dep-20",
      number: "20",
      title: "Scaling Strategy",
      blocks: [
        {
          type: "p",
          text: "V1 is sized for hundreds of workspaces. The deployment scales operationally (bigger instances, replicas) before it scales architecturally (partitioning, sharding). This matches DDS-001 §13 and BED-001 §14.",
        },
        { type: "h3", text: "Vertical Scaling (first response)" },
        {
          type: "ul",
          items: [
            "API instance: larger instance when CPU/memory sustained.",
            "Worker instance: upgrade when job backlog grows or jobs time out.",
            "Database: upgrade managed instance when connection/CPU/IO thresholds hit.",
            "Redis: upgrade when rate-limit operations show latency.",
            "Vertical scaling is a configuration change on the managed service — no code change, no redeploy.",
          ],
        },
        { type: "h3", text: "Horizontal Scaling (second response)" },
        {
          type: "ul",
          items: [
            "API: add a second instance behind the LB. The app is stateless, so this works immediately. PgBouncer bounds connection growth.",
            "Worker: add a second instance. SELECT FOR UPDATE SKIP LOCKED prevents double-execution.",
            "Database: read replica for Dashboard and Audit reads, keeping writes on the primary.",
          ],
        },
        { type: "h3", text: "Architectural Scaling (growth stage, not V1)" },
        {
          type: "ul",
          items: [
            "Partitioning: audit_logs, task_steps, llm_usage partitioned by month.",
            "Knowledge extraction: knowledge_chunks moved behind the Knowledge Engine interface to a dedicated vector store.",
            "Sharding: tenant tables sharded by workspaceId hash at ~10,000 workspaces.",
          ],
        },
        {
          type: "callout",
          variant: "success",
          title: "Growth is operational, not redesign",
          text: "These are operational and extraction changes, not rewrites. The V1 architecture and deployment are shaped for them — nothing in V1 needs to be thrown away to grow.",
        },
        { type: "h3", text: "Scaling Triggers (alert thresholds)" },
        {
          type: "ul",
          items: [
            "API p95 latency > 1s for 10 min; API CPU > 70% for 10 min.",
            "Worker job backlog > 50 for 10 min.",
            "DB CPU > 70% for 10 min; DB connection utilization > 80%; DB disk > 80%.",
          ],
        },
      ],
    },
    {
      id: "dep-21",
      number: "21",
      title: "Security",
      blocks: [
        {
          type: "p",
          text: "Deployment security enforces the locked documents' security posture (DDS-001 §12, APS-001 §20, BED-001 §13, FED-001 §14) at the infrastructure level.",
        },
        {
          type: "ul",
          items: [
            "Network: DB, Redis, object storage on private networks. App instances reachable only through the LB. Egress restricted to required providers over HTTPS. SSH via bastion/cloud console with audit logging.",
            "TLS: 1.2+ everywhere, terminated at the LB. HSTS in production. Internal traffic HTTP on the private network.",
            "Secrets: platform secret manager, injected as env vars at startup. No secrets in images, env files, logs, or the repo.",
            "Database privileges: application role least-privilege, no UPDATE/DELETE on audit_logs. Maintenance role administrative, migrations + founder ops only.",
            "Application: input validation at the boundary (Pydantic), domain invariants in the Domain Layer, business rules in services. Rate limiting Redis-backed. Prompt-injection defenses: strict tool whitelist, tool input validation, approval gate on critical actions, no shell/code-execution tools.",
            "CSRF: Authorization header (not cookies) for API calls; refresh-token cookie is SameSite=Lax with a custom-header requirement.",
            "Dependencies: pinned by version (and hash where supported). pip-audit / bun audit in CI. Trivy on images. Critical vulns triaged within a documented SLA.",
            "Incident response: RB-08. Audit trail + security logs are the primary investigation tools. Customer notification follows legal/contractual obligations (e.g., DPDP).",
          ],
        },
        {
          type: "callout",
          variant: "info",
          title: "Compliance posture (V1)",
          text: "V1 does not pursue formal certifications (SOC 2, ISO 27001, DPDP audit) — these are post-V1. V1 follows the practices such certifications would require (least privilege, audit logging, access control, backups, encryption), so the path to certification is procedural, not architectural.",
        },
      ],
    },
    {
      id: "dep-22",
      number: "22",
      title: "Backup & Disaster Recovery",
      blocks: [
        {
          type: "p",
          text: "Backups protect against data loss; disaster recovery protects against regional or platform failure. V1's posture is pragmatic: strong backups, documented recovery, limited multi-region.",
        },
        { type: "h3", text: "Backups" },
        {
          type: "ul",
          items: [
            "Database: automated daily backups (7-day hot) + PITR (≥7 days). Longer cold retention (e.g., 30 days) via archived backups where supported.",
            "Object storage: versioning enabled; lifecycle rules protect against accidental deletion. Cross-region replication optional where cheap.",
            "Audit logs: protected by DB backup; additionally, the hash chain makes tamper detectable even if a backup is compromised.",
            "Configuration: the repository is the source of truth; secrets are in the secret manager. No additional config backup required.",
          ],
        },
        { type: "h3", text: "Recovery Objectives & Procedures" },
        {
          type: "table",
          headers: ["Objective", "Target"],
          rows: [
            ["RPO (Recovery Point)", "≤24h for snapshot restores; near-zero for PITR (down to the second)"],
            ["RTO (Recovery Time)", "<2 hours for a full restore to a new DB instance, including verification"],
          ],
        },
        {
          type: "ul",
          items: [
            "DB restore (PITR): restore to a new managed instance at the target timestamp, verify, switch connection string, verify audit chain (RB-04).",
            "Object storage restore: from bucket versioning or replication.",
            "Application restore: re-deploy the last known-good image against the restored database.",
            "Full environment rebuild: reproducible from the repository + secret manager. A full region loss is recoverable in a new region within the RTO.",
            "Restore drills: tested in staging before launch and quarterly thereafter.",
          ],
        },
        {
          type: "callout",
          variant: "warning",
          title: "What is NOT backed up (by design)",
          text: "Redis (transient). Local development data (disposable). Operational logs (not a system of record — the audit trail in the database is the system of record). DR is single-region in V1; a regional disaster requires rebuilding in a new region (estimated 4–8 hours), an accepted V1 risk.",
        },
      ],
    },
    {
      id: "dep-23",
      number: "23",
      title: "Risks",
      blocks: [
        {
          type: "table",
          headers: ["Risk", "Mitigation"],
          rows: [
            ["Single-region failure", "Documented DR procedure; cross-region backup replication where cheap; accepted V1 risk."],
            ["Solo-founder on-call burden", "High-signal/low-noise alerting; runbooks; critical-only alerts outside hours; documented escalation."],
            ["Migration-induced downtime", "Expand-contract; CREATE INDEX CONCURRENTLY; batched backfills; maintenance mode for risky ops."],
            ["Rollback incompatibility with schema", "Expand-contract keeps schema additive and forward-compatible; contract migrations deferred to a later release."],
            ["Secret leakage", "Pre-commit secret scanning; CI image scanning; .gitignore discipline; structured logging with redaction."],
            ["LLM provider outage", "LLM Gateway retries with backoff; tasks fail gracefully and owners notified; reads/approvals/audit remain available."],
            ["Audit chain corruption", "Append-only privileges; periodic verification (RB-05); immediate alert on verification failure; detection triggers incident response."],
            ["Database backup failure", "Backup-failure alerts; restore drills; PITR as a second line of defense."],
            ["Cost overrun (LLM / infra)", "Per-task token caps; monthly provider spend caps; per-workspace usage tracking; cost dashboards; alerts at 80%."],
            ["Deploy during an approval wait", "waiting_approval is durable; the user's decision is a new request to the new instance; no data loss."],
            ["Container supply-chain attack", "Pinned base images by digest; dependency pinning; vulnerability scanning; non-root runtime; minimal image."],
            ["Configuration drift (staging vs prod)", "Same images, same migrations, same code; differences are configuration only; validated at startup."],
            ["Worker crash loop", "Crash-loop backoff; API remains available; tasks queue in DB; founder alerted; fix deploys through the normal pipeline."],
            ["DB connection exhaustion", "PgBouncer transaction mode; bounded worker pool; statement timeouts; connection-utilization alert."],
            ["Disk space exhaustion", "Partitioning at growth stage; object-storage lifecycle rules; disk-usage alerts; archival runbook."],
            ["TLS certificate expiry", "Managed certificates auto-renew; expiry alert 30 days before; no self-managed certs in production."],
            ["DNS misconfiguration", "DNS changes founder-only, reviewed against the runbook; low TTL during changes; rollback is a DNS re-point."],
            ["Vendor lock-in", "Containerized, cloud-agnostic app; managed services via standard interfaces; migration is operational, not a rewrite."],
            ["Compliance gap (customer requires cert)", "V1 follows cert-required practices; path to certification is procedural; case-by-case in V1."],
          ],
        },
      ],
    },
    {
      id: "dep-24",
      number: "24",
      title: "Cost Management",
      blocks: [
        {
          type: "p",
          text: "V1's cost envelope is sized for an early-stage, solo-founded company. Cost is monitored per environment and per category so the founder can detect burn before it becomes a crisis.",
        },
        { type: "h3", text: "Cost Categories" },
        {
          type: "ul",
          items: [
            "Compute: API instance, worker instance (small, sized to traffic).",
            "Database: managed PostgreSQL (small; the largest fixed cost).",
            "Redis: managed small instance (or shared).",
            "Object storage: usage-based (storage + requests); small in V1.",
            "LLM: usage-based (tokens); the most variable cost; capped per task and monitored per workspace.",
            "Email: usage-based; small in V1.",
            "DNS, TLS, LB: small fixed costs. Logging/monitoring: managed free tier or small plan. Container registry: small or free tier.",
          ],
        },
        { type: "h3", text: "Cost Controls & Monitoring" },
        {
          type: "ul",
          items: [
            "Per-task token cap (TASK_DEFAULT_TOKEN_CAP, default 100k).",
            "Per-employee and per-workspace LLM usage tracking (DDS-001 §4.17).",
            "Monthly LLM spend cap at the provider level; alert at 80%.",
            "Infrastructure sizing alerts (CPU, memory, disk) trigger manual review before an upgrade.",
            "Object-storage lifecycle rules delete incomplete multipart uploads and archive cold data.",
            "Development uses the mock LLM (zero cost) and local infrastructure (zero cost).",
            "A cost dashboard shows monthly spend by category; the founder reviews weekly early, monthly once stable. Anomaly detection on LLM spend triggers an alert.",
          ],
        },
      ],
    },
    {
      id: "dep-25",
      number: "25",
      title: "Deployment Engineering Principles",
      blocks: [
        {
          type: "callout",
          variant: "principle",
          title: "1. Solo-founder operable",
          text: "Every operational task is doable by one engineer with documented runbooks. No Kubernetes, no microservices, no self-managed replication. Managed services for undifferentiated infrastructure.",
        },
        {
          type: "callout",
          variant: "principle",
          title: "2. Same image, every environment",
          text: "Local, staging, and production run the same Docker images. Differences are configuration. A bug in staging reproduces in production; a fix in staging works in production.",
        },
        {
          type: "callout",
          variant: "principle",
          title: "3. Forward-only migrations",
          text: "Database migrations advance; they do not roll back. Expand-contract protects rollback compatibility. The audit trail is never rewritten.",
        },
        {
          type: "callout",
          variant: "principle",
          title: "4. Audit-first operations",
          text: "The database role has no UPDATE/DELETE on audit_logs. Backups preserve the hash chain. A deploy or rollback cannot leave an action without its audit entry. Operations on the audit store are themselves auditable.",
        },
        {
          type: "callout",
          variant: "principle",
          title: "5. Reproducible environments",
          text: "The entire environment is reproducible from the repository (code, migrations, compose, IaC) and the secret manager. No snowflake servers; no manual configuration.",
        },
        {
          type: "callout",
          variant: "principle",
          title: "6. Secrets are external",
          text: "Secrets live in the secret manager, injected at runtime. No secrets in code, images, env files, or logs. Rotation is documented.",
        },
        {
          type: "callout",
          variant: "principle",
          title: "7. Least privilege",
          text: "The application DB role has minimal privileges. Instances are reachable only through the LB. Egress is restricted. Runtime is non-root.",
        },
        {
          type: "callout",
          variant: "principle",
          title: "8. Reversible deploys",
          text: "Every deploy is rolled back by re-deploying the previous image. Database schema is additive (expand-contract) so code rollback is safe. Rollback is practiced.",
        },
        {
          type: "callout",
          variant: "principle",
          title: "9. Bounded downtime",
          text: "Rolling deploys with health checks keep downtime to seconds. Maintenance mode for risky operations. The trust loop's durable states survive restarts.",
        },
        {
          type: "callout",
          variant: "principle",
          title: "10. High-signal observability",
          text: "A small set of actionable alerts; structured logs; metrics on system, application, worker, business, and trust health. Noise is the enemy of a solo founder.",
        },
        {
          type: "callout",
          variant: "principle",
          title: "11. CI is the gate",
          text: "Every change goes through CI. Codegen freshness, import rules, tests, security scans, and build must pass before merge. No bypasses.",
        },
        {
          type: "callout",
          variant: "principle",
          title: "12. Staging is the candidate",
          text: "The production candidate is the SHA that passed staging. Production deploys are manual approvals, not automatic. The founder verifies staging before approving production.",
        },
        {
          type: "callout",
          variant: "principle",
          title: "13. Cost is a first-class metric",
          text: "LLM cost is capped per task and monitored per workspace. Infrastructure is sized to need. Burn is visible before it is critical.",
        },
        {
          type: "callout",
          variant: "principle",
          title: "14. DR is documented, not hoped",
          text: "Backups, PITR, restore drills, and a regional DR procedure exist. Recovery objectives (RPO/RTO) are stated. Drills verify the procedure.",
        },
        {
          type: "callout",
          variant: "principle",
          title: "15. Growth is operational, not redesign",
          text: "Vertical scaling first, horizontal second, architectural (partitioning, sharding) last. The V1 deployment is shaped for these changes; none require a rewrite.",
        },
        {
          type: "callout",
          variant: "principle",
          title: "16. The deployment obeys the locked documents",
          text: "DEP-001 operationalizes what the upstream documents define. It is subordinate to them. Where any conflict appears, the upstream document prevails and DEP-001 is revised to conform.",
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// The full BIHARI AI locked-document registry
// ─────────────────────────────────────────────────────────────────────────────

export const DOC_REGISTRY: DocMeta[] = [
  {
    code: "PF",
    title: "Product Foundation",
    subtitle: "Mission, vision, problem, value proposition, V1 scope, and success metrics.",
    version: "1.0",
    status: "LOCKED",
    scope: "BIHARI AI — AI Employee Platform, Version 1 product foundation.",
    subordinateTo: ["Founder Requirements (LOCKED)"],
    category: "Product",
    sectionCount: 19,
    summary:
      "India's Trusted AI Employee Company. A platform where a business can hire, configure, supervise, and audit a role-based AI Employee that performs real operational work under human approval. Defines the trust loop: delegate → review → approve → audit.",
  },
  {
    code: "ARCH",
    title: "System Architecture",
    subtitle: "Modular monolith architecture: modules, lifecycle, state machine, request flow, trust architecture.",
    version: "1.0",
    status: "LOCKED",
    scope: "AI Employee Platform — technical architecture for Version 1.",
    subordinateTo: ["Product Foundation"],
    category: "Architecture",
    sectionCount: 12,
    summary:
      "A single deployable web application plus one background worker, with strictly bounded in-process modules. The Tool Engine is the only path to side effects; the Approval Engine is a hard gate; the Audit Engine is append-only and hash-chained.",
  },
  {
    code: "DDS-001",
    title: "Database Design Specification",
    subtitle: "PostgreSQL + pgvector schema, 18 tables, indexing, isolation, audit-chain, soft delete, scaling.",
    version: "1.0",
    status: "LOCKED",
    scope: "AI Employee Platform — database for Version 1.",
    subordinateTo: ["Product Foundation", "System Architecture"],
    category: "Database",
    sectionCount: 15,
    summary:
      "PostgreSQL 16 with pgvector as the single managed store. audit_logs is INSERT-only at the privilege level and hash-chained per workspace. Every tenant table carries workspaceId as the leading index column.",
  },
  {
    code: "AIEE",
    title: "AI Employee Engine Design",
    subtitle: "The reasoning loop: planner, executor, prompt builder, tool runtime, retriever, caps, explainability.",
    version: "1.0",
    status: "LOCKED",
    scope: "AI Employee Platform — AI Employee Engine for Version 1.",
    subordinateTo: ["Product Foundation", "System Architecture", "DDS-001"],
    category: "Architecture",
    sectionCount: 0,
    summary:
      "The AI Engine is the only caller of the LLM Gateway for reasoning. Prompt construction never includes secrets. Every step's input, reasoning, and output is persisted for explainability. Caps bound cost and runaway.",
  },
  {
    code: "APS-001",
    title: "API Specification",
    subtitle: "REST contract: auth, workspace, employees, tasks, approvals, audit, knowledge, tools, dashboard, notifications.",
    version: "1.0",
    status: "LOCKED",
    scope: "AI Employee Platform — REST API for Version 1.",
    subordinateTo: ["Product Foundation", "System Architecture", "DDS-001", "AI Employee Engine Design"],
    category: "API",
    sectionCount: 23,
    summary:
      "All endpoints prefixed /api/v1. JWT access (15 min) + opaque refresh (7 d, rotated). Standard success/error envelope. Cursor pagination on high-volume endpoints. Cross-tenant access returns 404 to prevent enumeration.",
  },
  {
    code: "BED-001",
    title: "Backend Engineering Design",
    subtitle: "FastAPI + SQLAlchemy 2.x + Alembic; clean architecture, DI, services, repositories, workers, testing.",
    version: "1.0",
    status: "LOCKED",
    scope: "AI Employee Platform — backend implementation for Version 1.",
    subordinateTo: ["Product Foundation", "System Architecture", "DDS-001", "AI Employee Engine Design", "APS-001"],
    category: "Backend",
    sectionCount: 18,
    summary:
      "Clean architecture: Domain (pure) ← Application (services) ← Infrastructure (repos, gateways). The LLM Gateway is the only LLM caller; the Tool Service is the only side-effect path; the Audit Service is the only audit writer.",
  },
  {
    code: "FED-001",
    title: "Frontend Engineering Design",
    subtitle: "React 19 + Vite + TanStack Query + Zustand + Tailwind + RHF/Zod; SSE; trust-first UX; accessibility.",
    version: "1.0",
    status: "LOCKED",
    scope: "AI Employee Platform — frontend implementation for Version 1.",
    subordinateTo: ["Product Foundation", "System Architecture", "DDS-001", "AI Employee Engine Design", "APS-001", "BED-001"],
    category: "Frontend",
    sectionCount: 19,
    summary:
      "Trust-first UX: the approval queue is always one click away, every action shows its reasoning, the audit trail is browsable, pause/stop are prominent. SSE for real-time task/approval/notification updates with polling fallback.",
  },
  {
    code: "RSD-001",
    title: "Repository Structure Design",
    subtitle: "Monorepo: apps/ + packages/ + docs/ + scripts/; import rules, shared-types codegen, git strategy.",
    version: "1.0",
    status: "LOCKED",
    scope: "AI Employee Platform — monorepo structure for Version 1.",
    subordinateTo: ["Product Foundation", "System Architecture", "DDS-001", "AI Employee Engine Design", "APS-001", "BED-001", "FED-001"],
    category: "Repository",
    sectionCount: 16,
    summary:
      "One repository, one source of truth. The backend's OpenAPI generates packages/shared-types consumed by the frontend — contract drift is impossible to merge. Import rules are machine-checkable.",
  },
];

export const ALL_DOCS: Doc[] = [DEP_001];
