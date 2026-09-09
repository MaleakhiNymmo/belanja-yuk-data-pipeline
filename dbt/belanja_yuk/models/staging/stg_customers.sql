WITH source AS (
    SELECT * FROM {{ source('raw', 'customers') }}
),

deduped AS (
    SELECT
        customer_id,
        full_name,
        email,
        city,
        signup_date,
        segment,
        phone,
        gender,
        _loaded_at,
        ROW_NUMBER() OVER (
            PARTITION BY customer_id 
            ORDER BY _loaded_at DESC
        ) AS row_num
    FROM source
),

cleaned AS (
    SELECT
        TRIM(customer_id) AS customer_id,
        TRIM(full_name) AS full_name,
        TRIM(email) AS raw_email,
        -- Regex validasi format email standar
        CASE 
            WHEN TRIM(email) ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' 
            THEN LOWER(TRIM(email))
            ELSE NULL 
        END AS email,
        CASE 
            WHEN TRIM(email) ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' 
            THEN TRUE 
            ELSE FALSE 
        END AS is_valid_email,
        TRIM(city) AS city,
        signup_date::DATE AS signup_date,
        LOWER(TRIM(segment)) AS customer_segment,
        TRIM(phone) AS phone_number,
        UPPER(TRIM(gender)) AS gender,
        _loaded_at
    FROM deduped
    WHERE row_num = 1
)

SELECT * FROM cleaned
