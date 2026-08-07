#!/bin/bash

set -euo pipefail

# BIHARI AI — Database Build Script (provider-portable)
#
# Runs prisma db:push against the database specified in DATABASE_URL.
# Supports both SQLite (dev/demo) and PostgreSQL (production).
# The concurrency layer (src/lib/concurrency.ts) auto-detects the provider.

PROJECT_DIR="${PROJECT_DIR:-/home/z/my-project}"

if [ -z "${DATABASE_URL:-}" ]; then
    echo "❌ DATABASE_URL is not set."
    echo "   SQLite:      DATABASE_URL=file:./db/custom.db"
    echo "   PostgreSQL:  DATABASE_URL=postgresql://user@localhost:5432/bihari?schema=public"
    exit 1
fi

# Detect provider from DATABASE_URL
DB_PROVIDER="sqlite"
case "$DATABASE_URL" in
    postgresql://*|postgres://*)
        DB_PROVIDER="postgresql"
        ;;
    file:*)
        DB_PROVIDER="sqlite"
        ;;
    *)
        echo "⚠️  Unrecognized DATABASE_URL scheme, defaulting to SQLite."
        DB_PROVIDER="sqlite"
        ;;
esac

echo "🗄️  Syncing database schema to ${DB_PROVIDER}..."
(
    cd "$PROJECT_DIR"
    bun run db:push
)

echo "✅ Database schema synced to ${DB_PROVIDER}"
