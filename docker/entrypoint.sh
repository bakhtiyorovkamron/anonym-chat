#!/bin/sh
set -e

# Apply pending migrations before starting. Safe to run on every start:
# `migrate deploy` only applies migrations that haven't been applied yet.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "> Applying database migrations..."
  ./node_modules/.bin/prisma migrate deploy
fi

exec "$@"
