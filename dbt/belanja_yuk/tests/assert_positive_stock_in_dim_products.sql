-- ============================================================
-- Custom dbt Singular Test: assert_positive_stock_in_dim_products.sql
-- Memverifikasi bahwa data hygiene di layer staging berhasil
-- mengubah nilai stok negatif menjadi minimal 0 di tabel dimensi.
-- Test dinyatakan PASS jika hasil query ini 0 baris.
-- ============================================================

SELECT
    product_id,
    stock_qty
FROM {{ ref('dim_products') }}
WHERE stock_qty < 0
