-- ============================================================
-- Custom dbt Singular Test: assert_valid_order_dates.sql
-- Return baris jika tanggal order berada di masa depan atau anomali masa lalu.
-- Test dinyatakan PASS jika hasil query ini 0 baris.
-- ============================================================

SELECT
    order_id,
    order_date
FROM {{ ref('fact_order_items') }}
WHERE order_date > CURRENT_DATE + INTERVAL '1 day'
   OR order_date < '2020-01-01'
