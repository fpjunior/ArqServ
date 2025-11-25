#!/usr/bin/env bash

# debug-supabase-connect.sh
# Usage: ./scripts/debug-supabase-connect.sh
# This script checks DNS, TCP connectivity (IPv4 and IPv6), and tests DB connection via Docker psql
# It also calls backend debug endpoints (if BACKEND_URL is set) and attempts an auth sync (optional)

set -e

# Load env from file if exists
ENV_FILE="./backend/.env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' $ENV_FILE | xargs)
fi

# Helper
die() { echo "ERROR: $*" 1>&2; exit 1; }

BACKEND_URL=${BACKEND_URL:-${1:-}}
SUPABASE_URL=${SUPABASE_URL:-${SUPABASE_URL:-$(grep -E '^SUPABASE_URL=' backend/.env 2>/dev/null | cut -d '=' -f2- )}}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-$(grep -E '^SUPABASE_ANON_KEY=' backend/.env 2>/dev/null | cut -d '=' -f2- )}
DB_URL=${DATABASE_URL:-$(grep -E '^DATABASE_URL=' backend/.env 2>/dev/null | cut -d '=' -f2- )}
DB_HOST=${DB_HOST:-$(grep -E '^DB_HOST=' backend/.env 2>/dev/null | cut -d '=' -f2- )}
DB_PORT=${DB_PORT:-$(grep -E '^DB_PORT=' backend/.env 2>/dev/null | cut -d '=' -f2- )}
DB_USER=${DB_USER:-$(grep -E '^DB_USER=' backend/.env 2>/dev/null | cut -d '=' -f2- )}
DB_PASSWORD=${DB_PASSWORD:-$(grep -E '^DB_PASSWORD=' backend/.env 2>/dev/null | cut -d '=' -f2- )}

if [ -z "$BACKEND_URL" ]; then
  read -rp "Backend URL (e.g., https://arqserv-backend.onrender.com): " BACKEND_URL
fi

if [ -z "$SUPABASE_URL" ]; then
  echo "Notice: SUPABASE_URL not set in env; you can still test backend endpoints."
fi

if [ -z "$DB_URL" ] && [ -z "$DB_HOST" ]; then
  echo "Note: No DATABASE_URL or DB_HOST found; skipping DB tcp/db connect tests."
fi

echo "----- Running DNS and TCP tests for Supabase host -----"
if [ -n "$DB_URL" ]; then
  # extract host and port from DB_URL
  parsed=$(echo "$DB_URL" | sed -E 's#^[a-z]+://[^:]+:([^@]+)@([^:]+):([0-9]+)/.*#\2:\3#' || true)
  # fallback parse
  HOST=${DB_HOST:-$(echo "$DB_URL" | sed -E 's#^[^/]+://[^@]+@([^:]+):([0-9]+)/.*#\1#' || true)}
  PORT=${DB_PORT:-$(echo "$DB_URL" | sed -E 's#^[^/]+://[^@]+@([^:]+):([0-9]+)/.*#\2#' || true)}
else
  HOST=${DB_HOST}
  PORT=${DB_PORT}
fi

if [ -n "$HOST" ]; then
  echo "Host: $HOST, Port: ${PORT:-5432}"
  echo "DNS A records for $HOST:"
  if command -v dig >/dev/null 2>&1; then
    dig +short A "$HOST" || true
    dig +short AAAA "$HOST" || true
  else
    echo "dig not available; skipping DNS lookup"
  fi

  echo "Testing TCP connectivity to each resolved IP (via nc)"
  if command -v nc >/dev/null 2>&1; then
    # look up both A and AAAA
    addresses=$(dig +short A $HOST || true)
    addresses_ipv6=$(dig +short AAAA $HOST || true)
    addresses_combined="$addresses\n$addresses_ipv6"
    echo -e "$addresses_combined" | while read -r ip; do
      if [ -z "$ip" ]; then continue; fi
      echo -n "Testing $ip:$PORT ... "
      if nc -vz -w 3 $ip ${PORT:-5432} 2>&1 | grep -q succeeded; then
        echo "OK"
      else
        echo "FAILED"
      fi
    done
  else
    echo "nc not available; skipping tcp tests"
  fi
else
  echo "No host available for TCP tests"
fi

# Quick psql test using Docker image
if [ -n "$DB_URL" ]; then
  echo "\n----- Testing DB connection via Docker psql -----"
  if command -v docker >/dev/null 2>&1; then
    echo "Using docker run postgres to test connection (sslmode=require set)"
    docker run --rm -e PGPASSWORD="$DB_PASSWORD" postgres:15-alpine psql -h ${HOST} -U ${DB_USER:-postgres} -d ${DB_NAME:-postgres} -p ${PORT:-5432} -c "SELECT version();" || echo "pg test failed"
  else
    echo "docker not available; skipping psql test"
  fi
fi

# Call backend debug endpoints
echo "\n----- Calling backend debug endpoints -----"
if command -v curl >/dev/null 2>&1; then
  echo "GET $BACKEND_URL/api/debug"
  curl -s "$BACKEND_URL/api/debug" | jq . || true
  echo "\nGET $BACKEND_URL/api/debug/tables"
  curl -s "$BACKEND_URL/api/debug/tables" | jq . || true
  echo "\nGET $BACKEND_URL/api/debug/users"
  curl -s "$BACKEND_URL/api/debug/users" | jq . || true
  echo "\nGET $BACKEND_URL/api/debug/db-ping"
  curl -s "$BACKEND_URL/api/debug/db-ping" | jq . || true
else
  echo "curl not available; cannot call backend endpoints"
fi

# Optional: Test Supabase token + backend sync if anon key and credentials provided
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_ANON_KEY" ]; then
  echo "\n----- Supabase Auth sign-in test (requires credentials) -----"
  read -rp "Enter supabase email to test (or leave empty to skip): " SUPABASE_TEST_EMAIL
  if [ -n "$SUPABASE_TEST_EMAIL" ]; then
    read -rsp "Enter supabase PASSWORD for $SUPABASE_TEST_EMAIL: " SUPABASE_TEST_PASS
    echo ""
    token=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d "{\"email\": \"$SUPABASE_TEST_EMAIL\", \"password\": \"$SUPABASE_TEST_PASS\"}" | jq -r '.access_token') || true
    if [ -n "$token" ] && [ "$token" != "null" ]; then
      echo "Got Supabase access_token (hidden)... attempting backend /auth/supabase/sync"
      curl -s -X POST "$BACKEND_URL/api/auth/supabase/sync" -H "Authorization: Bearer $token" -H "Content-Type: application/json" | jq . || true
    else
      echo "Failed to obtain supabase token; check credentials or anon key"
    fi
  fi
else
  echo "Skip Supabase sign-in test (SUPABASE_URL or SUPABASE_ANON_KEY missing)"
fi

echo "\nDone."
