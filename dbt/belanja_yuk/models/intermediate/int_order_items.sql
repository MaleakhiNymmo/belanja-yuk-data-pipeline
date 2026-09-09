WITH orders AS (
    SELECT * FROM {{ ref('stg_orders') }}
),

products AS (
    SELECT * FROM {{ ref('stg_products') }}
),

-- Unnest JSONB items array into relational rows
unnested AS (
    SELECT
        o.order_id,
        o.customer_id,
        o.ordered_at,
        o.order_date,
        o.order_status,
        o.payment_method,
        o.channel,
        item.product_id,
        item.qty,
        item.unit_price,
        item.discount,
        item.subtotal
    FROM orders o
    CROSS JOIN LATERAL jsonb_to_recordset(o.items_jsonb) AS item(
        product_id TEXT,
        qty INTEGER,
        unit_price NUMERIC,
        discount NUMERIC,
        subtotal NUMERIC
    )
),

enriched AS (
    SELECT
        u.order_id,
        u.customer_id,
        u.ordered_at,
        u.order_date,
        u.order_status,
        u.payment_method,
        u.channel,
        u.product_id,
        p.product_name,
        p.category,
        
        -- Data hygiene: tangani qty negatif dari dirty data
        GREATEST(u.qty, 1) AS qty,
        COALESCE(u.unit_price, p.price_idr, 0) AS unit_price_idr,
        COALESCE(u.discount, 0) AS discount_idr,
        
        -- Calculated line metrics
        GREATEST(0, (COALESCE(u.unit_price, p.price_idr, 0) - COALESCE(u.discount, 0)) * GREATEST(u.qty, 1)) AS gross_revenue_idr,
        (COALESCE(p.cost_idr, 0) * GREATEST(u.qty, 1)) AS cogs_idr,
        GREATEST(0, (COALESCE(u.unit_price, p.price_idr, 0) - COALESCE(u.discount, 0)) * GREATEST(u.qty, 1)) 
          - (COALESCE(p.cost_idr, 0) * GREATEST(u.qty, 1)) AS gross_profit_idr,
        
        ROW_NUMBER() OVER (
            PARTITION BY u.order_id 
            ORDER BY u.product_id
        ) AS item_index
    FROM unnested u
    LEFT JOIN products p 
        ON u.product_id = p.product_id
)

SELECT
    MD5(order_id || '-' || item_index::TEXT) AS order_item_id,
    order_id,
    customer_id,
    ordered_at,
    order_date,
    order_status,
    payment_method,
    channel,
    product_id,
    product_name,
    category,
    qty,
    unit_price_idr,
    discount_idr,
    gross_revenue_idr,
    cogs_idr,
    gross_profit_idr
FROM enriched
