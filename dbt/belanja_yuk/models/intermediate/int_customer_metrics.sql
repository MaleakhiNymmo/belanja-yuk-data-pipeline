WITH order_items AS (
    SELECT * FROM {{ ref('int_order_items') }}
),

aggregated AS (
    SELECT
        customer_id,
        COUNT(DISTINCT order_id) AS total_orders,
        COUNT(DISTINCT CASE WHEN order_status = 'completed' THEN order_id END) AS total_completed_orders,
        MIN(order_date) AS first_order_date,
        MAX(order_date) AS last_order_date,
        SUM(gross_revenue_idr) AS lifetime_gross_spend_idr,
        SUM(CASE WHEN order_status = 'completed' THEN gross_revenue_idr ELSE 0 END) AS lifetime_net_spend_idr,
        SUM(CASE WHEN order_status = 'completed' THEN gross_profit_idr ELSE 0 END) AS lifetime_gross_profit_idr
    FROM order_items
    GROUP BY customer_id
)

SELECT * FROM aggregated
