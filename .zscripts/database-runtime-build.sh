#!/bin/bash

set -euo pipefail

# BIHARI AI — Database Build Script (PostgreSQL)
#
# Runs prisma db:push against the PostgreSQL database specified in DATABASE_URL.
# PostgreSQL is a running server, not a file — there is no database file to copy.
# The schema is synced to the existing PostgreSQL instance.

PROJECT_DIR="${PROJECT_DIR:-/home/z/my-project}"

if [ -z "${DATABASE_URL:-}" ]; then
    echo "❌ DATABASE_URL is not set. Set it to a PostgreSQL connection string."
    echo "   Example: DATABASE_URL=postgresql://user@localhost:5432/bihari?schema=public"
    exit 1
fi

# Verify DATABASE_URL is a PostgreSQL URL (not SQLite)
case "$DATABASE_URL" in
    postgresql://*|postgres://*) ;;
    *)
        echo "❌ DATABASE_URL must be a PostgreSQL URL (postgresql://...), got: $DATABASE_URL"
        exit 1
        ;;
esac

echo "🗄️  Syncing database schema to PostgreSQL..."
(
    cd "$PROJECT_DIR"
    bun run db:push
)

echo "✅ Database schema synced to PostgreSQL"
