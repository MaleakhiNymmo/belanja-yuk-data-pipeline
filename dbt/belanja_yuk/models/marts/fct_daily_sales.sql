WITH items AS (
    SELECT * FROM {{ ref('int_order_items') }}
),

daily_agg AS (
    SELECT
        order_date,
        category,
        payment_method,
        channel,
        
        -- Volume metrics
        COUNT(DISTINCT order_id) AS total_orders,
        COUNT(DISTINCT CASE WHEN order_status = 'completed' THEN order_id END) AS completed_orders,
        COUNT(DISTINCT CASE WHEN order_status = 'cancelled' THEN order_id END) AS cancelled_orders,
        SUM(qty) AS total_units_sold,
        
        -- Financial metrics
        SUM(gross_revenue_idr) AS gross_revenue_idr,
        SUM(discount_idr * qty) AS total_discount_idr,
        SUM(cogs_idr) AS total_cogs_idr,
        SUM(gross_profit_idr) AS gross_profit_idr,
        
        -- Net figures (completed orders only)
        SUM(CASE WHEN order_status = 'completed' THEN gross_revenue_idr ELSE 0 END) AS net_revenue_idr,
        SUM(CASE WHEN order_status = 'completed' THEN gross_profit_idr ELSE 0 END) AS net_profit_idr
    FROM items
    GROUP BY 
        order_date,
        category,
        payment_method,
        channel
)

SELECT
    MD5(order_date::TEXT || '-' || COALESCE(category, 'None') || '-' || payment_method || '-' || channel) AS daily_sales_id,
    *,
    ROUND(net_profit_idr / NULLIF(net_revenue_idr, 0) * 100, 2) AS net_profit_margin_percentage
FROM daily_agg
