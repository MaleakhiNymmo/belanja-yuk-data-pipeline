WITH source AS (
    SELECT * FROM {{ source('raw', 'orders') }}
),

deduped AS (
    SELECT
        order_id,
        customer_id,
        order_date,
        status,
        payment_method,
        channel,
        total_amount,
        items,
        _loaded_at,
        ROW_NUMBER() OVER (
            PARTITION BY order_id 
            ORDER BY _loaded_at DESC
        ) AS row_num
    FROM source
),

cleaned AS (
    SELECT
        TRIM(order_id) AS order_id,
        TRIM(customer_id) AS customer_id,
        order_date::TIMESTAMPTZ AS ordered_at,
        (order_date::TIMESTAMPTZ)::DATE AS order_date,
        COALESCE(LOWER(TRIM(status)), 'unknown') AS order_status,
        CASE WHEN status IS NOT NULL THEN TRUE ELSE FALSE END AS is_status_present,
        LOWER(TRIM(payment_method)) AS payment_method,
        LOWER(TRIM(channel)) AS channel,
        total_amount::NUMERIC AS total_amount_idr,
        items AS items_jsonb,
        _loaded_at
    FROM deduped
    WHERE row_num = 1
)

SELECT * FROM cleaned
