#!/bin/bash
set -e

# check-destructive.sh
# Scans pending Supabase migrations for destructive SQL commands.
# Keywords: DROP TABLE, DROP COLUMN, TRUNCATE, DROP SCHEMA, DROP DATABASE, etc.

echo "Checking for destructive migrations..."

# Run dry-run and capture output.
# In CI, 'supabase link' must have been run before this.
DRY_RUN_OUTPUT=$(supabase db push --dry-run 2>&1 || echo "")

if [ -z "$DRY_RUN_OUTPUT" ]; then
  echo "No output from dry-run. Assuming no pending migrations."
  if [ -n "$GITHUB_OUTPUT" ]; then
    echo "destructive=false" >> "$GITHUB_OUTPUT"
  fi
  exit 0
fi

# Extract filenames (timestamp_name.sql) from the output.
PENDING_MIGRATIONS=$(echo "$DRY_RUN_OUTPUT" | grep -oE '[0-9]{14}_[^ ]+\.sql' | sort -u)

if [ -z "$PENDING_MIGRATIONS" ]; then
  echo "No pending migrations found."
  if [ -n "$GITHUB_OUTPUT" ]; then
    echo "destructive=false" >> "$GITHUB_OUTPUT"
  fi
  exit 0
fi

echo "Pending migrations:"
echo "$PENDING_MIGRATIONS"

DESTRUCTIVE_FOUND=false

# Regex for destructive keywords.
# 1. DROP (TABLE|COLUMN|SCHEMA|DATABASE|TYPE|VIEW|INDEX|FUNCTION|TRIGGER|POLICY|EXTENSION)
# 2. ALTER TABLE ... DROP ... (covers DROP COLUMN without the COLUMN keyword)
# 3. TRUNCATE
# Using basic case-insensitive grep with simplified patterns for robustness.
KEYWORDS="DROP|TRUNCATE"

for MIGRATION in $PENDING_MIGRATIONS; do
  FILE="supabase/migrations/$MIGRATION"
  if [ -f "$FILE" ]; then
    # Search for keywords while ignoring comments (lines starting with --)
    MATCHES=$(grep -iE "$KEYWORDS" "$FILE" | grep -v "^\s*--" || true)

    if [ -n "$MATCHES" ]; then
      # Narrow down to actually destructive DROP/TRUNCATE.
      # We look for "DROP [object]" or "TRUNCATE".
      # This may catch some false positives but errs on the side of safety.
      if echo "$MATCHES" | grep -iE "DROP\s+|TRUNCATE" > /dev/null; then
        echo "⚠️  DESTRUCTIVE CHANGE DETECTED in $MIGRATION:"
        echo "$MATCHES"
        DESTRUCTIVE_FOUND=true
      fi
    fi
  else
    echo "Warning: Migration file $FILE not found locally."
  fi
done

if [ "$DESTRUCTIVE_FOUND" = true ]; then
  echo "Outcome: Destructive changes found. Human approval required."
  if [ -n "$GITHUB_OUTPUT" ]; then
    echo "destructive=true" >> "$GITHUB_OUTPUT"
  fi
else
  echo "Outcome: No destructive changes detected."
  if [ -n "$GITHUB_OUTPUT" ]; then
    echo "destructive=false" >> "$GITHUB_OUTPUT"
  fi
fi
