#!/usr/bin/env bash
# Runs the permission scenarios on a throwaway local Postgres: once against a
# replica of the current production rules, once after the proposed migration.
# Never connects to production.
set -euo pipefail
cd "$(dirname "$0")/../.."
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "${PGHOST:-/var/tmp/amr-pg}" -p "${PGPORT:-54329}" -U postgres)
for mode in current migrated; do
  "${PSQL[@]}" -d postgres -c "drop database if exists amr_test_$mode" -c "create database amr_test_$mode" >/dev/null
  "${PSQL[@]}" -d "amr_test_$mode" -f tests/db/replica_current.sql >/dev/null
  if [ "$mode" = migrated ]; then
    "${PSQL[@]}" -d "amr_test_$mode" -f migrations/proposed/20261011_role_security.sql >/dev/null
  fi
  "${PSQL[@]}" -d "amr_test_$mode" -v mode="$mode" -f tests/db/role_security_tests.sql
done
