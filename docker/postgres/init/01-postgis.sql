-- Runs once, the first time the database volume is created (docker-entrypoint-initdb.d).

-- PostGIS powers nearby-store and driver-dispatch queries. The migrations also run
-- CREATE EXTENSION IF NOT EXISTS postgis, this just makes psql sessions convenient.
CREATE EXTENSION IF NOT EXISTS postgis;

-- A second, disposable database for the integration tests (TEST_DATABASE_URL).
-- Its schema is wiped before every `npm run test:e2e`, so never point tests at the real database.
SELECT 'CREATE DATABASE hardware_delivery_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hardware_delivery_test')\gexec

\connect hardware_delivery_test
CREATE EXTENSION IF NOT EXISTS postgis;
