#!/bin/bash
# Dump all migrations into a single schema.sql file

cd "$(dirname "$0")/.."

OUTPUT="db/schema.sql"

echo "-- Auto-generated schema dump" > "$OUTPUT"
echo "-- Generated at: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> "$OUTPUT"
echo "-- DO NOT EDIT - This file is auto-generated from migrations" >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Concatenate all migration files in order
for file in migrations/0*.sql; do
  if [ -f "$file" ]; then
    echo "-- ==========================================" >> "$OUTPUT"
    echo "-- $(basename "$file")" >> "$OUTPUT"
    echo "-- ==========================================" >> "$OUTPUT"
    cat "$file" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
  fi
done

echo "Schema dumped to $OUTPUT"
