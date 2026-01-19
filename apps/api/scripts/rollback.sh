#!/bin/bash
# Rollback the latest migration (or specified one)
# Usage: ./scripts/rollback.sh [--remote]
#        ./scripts/rollback.sh 0025_xxx [--remote]
#
# WARNING: You must manually revert DB schema changes!

set -e
cd "$(dirname "$0")/.."

ENV_FLAG="--local"
MIGRATION_NAME=""

# Parse arguments
for arg in "$@"; do
  case $arg in
    --remote) ENV_FLAG="--remote" ;;
    *) MIGRATION_NAME="$arg" ;;
  esac
done

# Auto-detect latest migration if not specified
if [ -z "$MIGRATION_NAME" ]; then
  MIGRATION_FILE=$(ls -1 migrations/*.sql 2>/dev/null | tail -1)
  if [ -z "$MIGRATION_FILE" ]; then
    echo "❌ No migrations found"
    exit 1
  fi
  MIGRATION_NAME=$(basename "$MIGRATION_FILE" .sql)
else
  MIGRATION_FILE="migrations/${MIGRATION_NAME}.sql"
fi

SNAPSHOT_FILE="migrations/meta/${MIGRATION_NAME}_snapshot.json"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Migration not found: $MIGRATION_FILE"
  exit 1
fi

if [ "$ENV_FLAG" = "--remote" ]; then
  echo "⚠️  WARNING: Rolling back PRODUCTION database!"
fi

echo "=========================================="
echo "Rollback: $MIGRATION_NAME"
echo "Env: ${ENV_FLAG#--}"
echo "=========================================="
echo ""
cat "$MIGRATION_FILE"
echo ""
echo "=========================================="
echo ""
read -p "Proceed? (y/N) " -n 1 -r
echo ""

[[ ! $REPLY =~ ^[Yy]$ ]] && echo "Cancelled." && exit 0

echo "1. Removing from d1_migrations..."
wrangler d1 execute tailf-db $ENV_FLAG --command "DELETE FROM d1_migrations WHERE name = '${MIGRATION_NAME}.sql';"

echo "2. Deleting files..."
rm -f "$MIGRATION_FILE" "$SNAPSHOT_FILE"

echo "3. Updating _journal.json..."
node -e "
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('migrations/meta/_journal.json'));
j.entries = j.entries.filter(e => e.tag !== '${MIGRATION_NAME}');
fs.writeFileSync('migrations/meta/_journal.json', JSON.stringify(j, null, 2));
"

echo ""
echo "✅ Done! Now manually revert DB changes:"
echo "   wrangler d1 execute tailf-db $ENV_FLAG --command \"DROP TABLE xxx;\""
