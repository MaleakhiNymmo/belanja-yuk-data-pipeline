WITH products AS (
    SELECT * FROM {{ ref('stg_products') }}
),

sales_metrics AS (
    SELECT
        product_id,
        COUNT(DISTINCT order_id) AS total_orders,
        SUM(qty) AS total_units_sold,
        SUM(gross_revenue_idr) AS total_revenue_generated_idr,
        SUM(gross_profit_idr) AS total_profit_generated_idr
    FROM {{ ref('int_order_items') }}
    WHERE order_status = 'completed'
    GROUP BY product_id
),

joined AS (
    SELECT
        p.product_id,
        p.sku,
        p.product_name,
        p.category,
        p.price_idr,
        p.cost_idr,
        p.price_idr - p.cost_idr AS unit_margin_idr,
        ROUND((p.price_idr - p.cost_idr) / NULLIF(p.price_idr, 0) * 100, 2) AS margin_percentage,
        p.stock_qty,
        p.weight_gram,
        p.is_active,
        p.is_valid_pricing,
        
        -- Sales Performance
        COALESCE(s.total_orders, 0) AS total_completed_orders,
        COALESCE(s.total_units_sold, 0) AS total_units_sold,
        COALESCE(s.total_revenue_generated_idr, 0) AS total_revenue_generated_idr,
        COALESCE(s.total_profit_generated_idr, 0) AS total_profit_generated_idr,
        
        -- Inventory Health Status
        CASE
            WHEN p.stock_qty = 0 THEN 'Out of Stock'
            WHEN p.stock_qty < 20 THEN 'Low Stock'
            ELSE 'Healthy'
        END AS stock_status
    FROM products p
    LEFT JOIN sales_metrics s 
        ON p.product_id = s.product_id
)

SELECT * FROM joined
