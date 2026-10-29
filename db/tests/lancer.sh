#!/bin/sh
# Monte une base de test neuve sur un Postgres local, y applique les
# migrations et le seed, puis lance les tests de permissions.
#
#   npm run test:db
#
# Connexion : variables standard de psql (PGHOST, PGPORT, PGUSER…).
# La base « chantierpilot_test » est supprimée puis recréée : ne jamais
# pointer ce script sur la production.
set -e
cd "$(dirname "$0")/../.."
BASE=${CP_BASE_TEST:-chantierpilot_test}
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $BASE" -c "create database $BASE"
for f in db/tests/supabase-local.sql db/schema.sql db/migration-002-003-reconstitution.sql \
         db/migration-004.sql db/migration-005-dashboard.sql db/migration-005-dashboard.sql \
         db/seed-demo.sql db/seed-demo.sql; do
  # Chaque fichier passe deux fois (migration 005 et seed) : ils doivent
  # être rejouables sans erreur ni doublon.
  psql -q -v ON_ERROR_STOP=1 -d $BASE -f "$f" > /dev/null 2>&1 || { echo "Échec : $f"; psql -q -v ON_ERROR_STOP=1 -d $BASE -f "$f"; exit 1; }
done
SORTIE=$(psql -d $BASE -f db/tests/permissions.sql 2>&1 || true)
echo "$SORTIE" | sed -e 's/^psql:[^ ]* NOTICE:  /  /'
echo "$SORTIE" | grep -q "Tous les tests sont passés." || { echo "TESTS EN ÉCHEC"; exit 1; }
