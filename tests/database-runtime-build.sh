#!/bin/bash

# BIHARI AI — Database Runtime Build Test (PostgreSQL)
#
# Verifies that database-runtime-build.sh:
# 1. Fails when DATABASE_URL is not set
# 2. Fails when DATABASE_URL is a SQLite URL (file:...)
# 3. Runs bun db:push when DATABASE_URL is a valid PostgreSQL URL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/../.zscripts" && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

FAKE_BIN="$TEST_ROOT/bin"
mkdir -p "$FAKE_BIN"

# Create a fake bun that records db:push calls
cat >"$FAKE_BIN/bun" <<'EOF'
#!/bin/bash
set -euo pipefail

if [ "$#" -ne 2 ] || [ "$1" != "run" ] || [ "$2" != "db:push" ]; then
    echo "unexpected bun invocation: $*" >&2
    exit 1
fi

case "${DATABASE_URL:-}" in
    postgresql://*|postgres://*) ;;
    *)
        echo "DATABASE_URL must be a PostgreSQL URL" >&2
        exit 1
        ;;
esac

printf '%s\n' "$DATABASE_URL" >>"${DB_PUSH_CALLS:?}"
EOF
chmod +x "$FAKE_BIN/bun"

export PATH="$FAKE_BIN:$PATH"
export DB_PUSH_CALLS="$TEST_ROOT/db-push-calls"

PROJECT_DIR="$TEST_ROOT/project"
BUILD_DIR="$TEST_ROOT/build"
mkdir -p "$PROJECT_DIR" "$BUILD_DIR"

# Test 1: Should fail when DATABASE_URL is not set
echo "Test 1: DATABASE_URL not set..."
if PROJECT_DIR="$PROJECT_DIR" BUILD_DIR="$BUILD_DIR" \
    bash "$SCRIPT_DIR/database-runtime-build.sh" 2>/dev/null; then
    echo "❌ FAIL: should have failed without DATABASE_URL"
    exit 1
fi
echo "✅ PASS: fails without DATABASE_URL"

# Test 2: Should fail when DATABASE_URL is a SQLite URL
echo "Test 2: DATABASE_URL is SQLite..."
if DATABASE_URL="file:/tmp/test.db" PROJECT_DIR="$PROJECT_DIR" BUILD_DIR="$BUILD_DIR" \
    bash "$SCRIPT_DIR/database-runtime-build.sh" 2>/dev/null; then
    echo "❌ FAIL: should have rejected SQLite URL"
    exit 1
fi
echo "✅ PASS: rejects SQLite URL"

# Test 3: Should run db:push when DATABASE_URL is PostgreSQL
echo "Test 3: DATABASE_URL is PostgreSQL..."
DATABASE_URL="postgresql://user@localhost:5432/bihari?schema=public" \
    PROJECT_DIR="$PROJECT_DIR" BUILD_DIR="$BUILD_DIR" \
    bash "$SCRIPT_DIR/database-runtime-build.sh"

# Verify db:push was called with the PostgreSQL URL
test -f "$DB_PUSH_CALLS"
test "$(cat "$DB_PUSH_CALLS")" = "postgresql://user@localhost:5432/bihari?schema=public"
echo "✅ PASS: runs db:push with PostgreSQL URL"

echo ""
echo "database runtime build tests passed (PostgreSQL)"
