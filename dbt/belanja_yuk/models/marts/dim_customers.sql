WITH customers AS (
    SELECT * FROM {{ ref('stg_customers') }}
),

metrics AS (
    SELECT * FROM {{ ref('int_customer_metrics') }}
),

registered_customers AS (
    SELECT
        c.customer_id,
        c.full_name,
        c.email,
        c.is_valid_email,
        c.city,
        c.signup_date,
        c.customer_segment,
        c.phone_number,
        c.gender,
        TRUE AS is_registered_in_crm,
        COALESCE(m.total_orders, 0) AS total_orders,
        COALESCE(m.total_completed_orders, 0) AS total_completed_orders,
        m.first_order_date,
        m.last_order_date,
        COALESCE(m.lifetime_gross_spend_idr, 0) AS lifetime_gross_spend_idr,
        COALESCE(m.lifetime_net_spend_idr, 0) AS lifetime_net_spend_idr,
        COALESCE(m.lifetime_gross_profit_idr, 0) AS lifetime_gross_profit_idr,
        CASE
            WHEN COALESCE(m.lifetime_net_spend_idr, 0) >= 50000000 THEN 'Platinum'
            WHEN COALESCE(m.lifetime_net_spend_idr, 0) >= 20000000 THEN 'Gold'
            WHEN COALESCE(m.lifetime_net_spend_idr, 0) >= 5000000  THEN 'Silver'
            WHEN COALESCE(m.lifetime_net_spend_idr, 0) > 0         THEN 'Bronze'
            ELSE 'No Purchases'
        END AS customer_tier
    FROM customers c
    LEFT JOIN metrics m 
        ON c.customer_id = m.customer_id
),

-- Kimball Unknown Dimension Member Pattern:
-- Menyediakan 1 default surrogate record untuk transaksi guest / orphan tanpa membuat ribuan user dummy sampah
unknown_customer AS (
    SELECT
        'UNKNOWN' AS customer_id,
        'Guest / Unregistered Customer' AS full_name,
        NULL AS email,
        FALSE AS is_valid_email,
        'Unknown' AS city,
        '2020-01-01'::DATE AS signup_date,
        'guest' AS customer_segment,
        NULL AS phone_number,
        'UNKNOWN' AS gender,
        FALSE AS is_registered_in_crm,
        0 AS total_orders,
        0 AS total_completed_orders,
        NULL::DATE AS first_order_date,
        NULL::DATE AS last_order_date,
        0::NUMERIC AS lifetime_gross_spend_idr,
        0::NUMERIC AS lifetime_net_spend_idr,
        0::NUMERIC AS lifetime_gross_profit_idr,
        'Guest / Unregistered' AS customer_tier
)

SELECT * FROM registered_customers
UNION ALL
SELECT * FROM unknown_customer
