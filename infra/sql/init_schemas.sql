-- ============================================================
-- Init SQL — Belanja Yuk Data Warehouse
-- Dijalankan otomatis saat postgres_dwh container pertama kali start
-- ============================================================

-- Schema raw: landing zone, data apa adanya dari source
CREATE SCHEMA IF NOT EXISTS raw;

-- Schema staging: data sudah di-clean & di-cast type-nya
CREATE SCHEMA IF NOT EXISTS staging;

-- Schema marts: model analytics-ready untuk tim analyst
CREATE SCHEMA IF NOT EXISTS marts;

-- Schema dbt internal (logging, state)
CREATE SCHEMA IF NOT EXISTS dbt_meta;

COMMENT ON SCHEMA raw     IS 'Landing zone — raw data as-is from source systems';
COMMENT ON SCHEMA staging IS 'Cleaned & typed data — output of dbt staging models';
COMMENT ON SCHEMA marts   IS 'Analytics-ready models — facts & dims for BI tools';
