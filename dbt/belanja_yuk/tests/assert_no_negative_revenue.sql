-- ============================================================
-- Custom dbt Singular Test: assert_no_negative_revenue.sql
-- Return baris jika terdapat revenue atau COGS bernilai negatif.
-- Test dinyatakan PASS jika hasil query ini 0 baris.
-- ============================================================

SELECT
    order_item_id,
    order_id,
    gross_revenue_idr,
    cogs_idr
FROM {{ ref('fact_order_items') }}
WHERE gross_revenue_idr < 0 
   OR cogs_idr < 0
