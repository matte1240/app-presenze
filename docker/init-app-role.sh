#!/bin/bash
# Creates the unprivileged role the application signs in with.
#
# Run once by the postgres image, the first time the data directory is
# initialised. POSTGRES_USER owns the tables and is therefore exempt from the
# row-level security policies; this role owns nothing and is bound by them, so
# it is the one that serves requests. Granting it only DML — never CREATE or
# ALTER — is also what keeps migrations out of the application's reach.
set -euo pipefail

if [ -z "${POSTGRES_APP_PASSWORD:-}" ]; then
  echo "POSTGRES_APP_PASSWORD non impostata: il ruolo applicativo non viene creato." >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
  CREATE ROLE presenze_app LOGIN PASSWORD '${POSTGRES_APP_PASSWORD}';

  GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO presenze_app;
  GRANT USAGE ON SCHEMA public TO presenze_app;

  -- The tables do not exist yet: migrations create them at first boot, and
  -- these default privileges are what the application will find waiting.
  ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO presenze_app;
  ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO presenze_app;
EOSQL
