WITH source AS (
    SELECT * FROM {{ source('raw', 'products') }}
),

deduped AS (
    SELECT
        product_id,
        sku,
        product_name,
        category,
        price,
        cost,
        stock_qty,
        weight_gram,
        is_active,
        _loaded_at,
        ROW_NUMBER() OVER (
            PARTITION BY product_id 
            ORDER BY _loaded_at DESC
        ) AS row_num
    FROM source
),

cleaned AS (
    SELECT
        TRIM(product_id) AS product_id,
        TRIM(sku) AS sku,
        TRIM(product_name) AS product_name,
        TRIM(category) AS category,
        price::NUMERIC AS price_idr,
        cost::NUMERIC AS cost_idr,
        GREATEST(stock_qty::INTEGER, 0) AS stock_qty, -- handle stok negatif menjadi 0
        stock_qty::INTEGER AS raw_stock_qty,
        weight_gram::INTEGER AS weight_gram,
        is_active::BOOLEAN AS is_active,
        CASE 
            WHEN price::NUMERIC > 0 AND cost::NUMERIC > 0 THEN TRUE 
            ELSE FALSE 
        END AS is_valid_pricing,
        _loaded_at
    FROM deduped
    WHERE row_num = 1
)

SELECT * FROM cleaned
