WITH items AS (
    SELECT * FROM {{ ref('int_order_items') }}
),

customers AS (
    SELECT customer_id FROM {{ ref('stg_customers') }}
)

SELECT
    i.order_item_id,
    i.order_id,
    
    -- Kimball Unknown Member Pattern:
    -- Jika customer terdaftar di CRM gunakan ID aslinya, jika orphan map ke 'UNKNOWN'
    CASE 
        WHEN c.customer_id IS NOT NULL THEN i.customer_id 
        ELSE 'UNKNOWN' 
    END AS customer_id,
    
    -- Auditability: Pertahankan ID mentah asli dari source MongoDB
    i.customer_id AS raw_customer_id,
    
    -- Flag penanda untuk analis BI
    CASE 
        WHEN c.customer_id IS NOT NULL THEN TRUE 
        ELSE FALSE 
    END AS is_registered_customer,
    
    i.product_id,
    i.ordered_at,
    i.order_date,
    i.order_status,
    i.payment_method,
    i.channel,
    i.qty,
    i.unit_price_idr,
    i.discount_idr,
    i.gross_revenue_idr,
    i.cogs_idr,
    i.gross_profit_idr,
    
    -- Calculated margins
    ROUND(i.gross_profit_idr / NULLIF(i.gross_revenue_idr, 0) * 100, 2) AS profit_margin_percentage
FROM items i
LEFT JOIN customers c 
    ON i.customer_id = c.customer_id
