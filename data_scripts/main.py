import os
from datetime import datetime

import altair as alt
import duckdb
from dotenv import load_dotenv

load_dotenv()

# Postgres credentials
POSTGRES_HOST = os.getenv("POSTGRES_HOST")
POSTGRES_PORT = os.getenv("POSTGRES_PORT")
POSTGRES_DATABASE = os.getenv("POSTGRES_DATABASE")
POSTGRES_USERNAME = os.getenv("POSTGRES_USERNAME")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")

# Supabase storage credentials
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION")
BUCKET_URL = os.getenv("BUCKET_URL")
ENDPOINT_URL = os.getenv("ENDPOINT_URL")

duckdb.sql(
    f"""
DROP SECRET IF EXISTS supabase_storage;
CREATE SECRET supabase_storage (
    TYPE S3,
    KEY_ID '{AWS_ACCESS_KEY_ID}',
    SECRET '{AWS_SECRET_ACCESS_KEY}', 
    ENDPOINT '{ENDPOINT_URL}', 
    REGION '{AWS_REGION}',
    URL_STYLE 'path'
)
"""
)

duckdb.sql("INSTALL postgres")

duckdb.sql(
    f"""
ATTACH 
    'dbname={POSTGRES_DATABASE} 
    user={POSTGRES_USERNAME} 
    host={POSTGRES_HOST} 
    password={POSTGRES_PASSWORD} 
    port={POSTGRES_PORT}' 
AS postgres_db (TYPE POSTGRES, READ_ONLY)
"""
)

select_pg_customers = """
SELECT
    id                              AS user_id,
    first_name                      AS user_first_name,
    last_name                       AS user_last_name,
    first_name || ' ' || last_name  AS user_full_name,
    CURRENT_DATE                    as loaded_at_date,
    CURRENT_TIMESTAMP               AS loaded_at_ts_utc
FROM 
    postgres_db.customers 
"""
duckdb.sql(select_pg_customers).df().head()


duckdb.sql(
    f"""
COPY ({select_pg_customers}) 
TO '{BUCKET_URL}/customers/{datetime.now().strftime("%Y-%m-%d")}.parquet'
"""
)


duckdb.sql(
    f"""
COPY ({select_pg_customers}) 
TO '{BUCKET_URL}/customers/{datetime.now().strftime("%Y-%m-%d")}.csv'
"""
)

duckdb.sql(
    f"""
COPY ({select_pg_customers}) 
TO 's3://postgres/customers' (
    FORMAT PARQUET,
    PARTITION_BY (loaded_at_date),
    OVERWRITE_OR_IGNORE true
)
"""
)


select_pg_orders = """
SELECT
    id                  AS order_id,
    user_id             AS user_id,
    order_date          AS order_date,
    status              AS order_status,
    CURRENT_DATE        AS loaded_at_date,
    CURRENT_TIMESTAMP   AS loaded_at_ts_utc
FROM 
    postgres_db.orders
"""
duckdb.sql(select_pg_orders).df().head()


duckdb.sql(
    f"""
COPY ({select_pg_orders}) 
TO '{BUCKET_URL}/orders/{datetime.now().strftime("%Y-%m-%d")}.parquet'
"""
)


select_pg_payments = """
SELECT
    id                  AS payment_id,
    order_id            AS order_id,
    payment_method      AS payment_method,
    amount              AS order_amount_usd,
    CURRENT_DATE        AS loaded_at_date,
    CURRENT_TIMESTAMP   AS loaded_at_ts_utc
FROM 
    postgres_db.payments
"""
duckdb.sql(select_pg_payments).df().head()


duckdb.sql(
    f"""
COPY ({select_pg_payments}) 
TO '{BUCKET_URL}/payments/{datetime.now().strftime("%Y-%m-%d")}.parquet'
"""
)


# querying

select_from_bucket = f"""
SELECT 
    filename, 
    count(*) as record_count
FROM 
    read_parquet('{BUCKET_URL}/orders/*.parquet', filename = true)
GROUP BY 
    ALL
"""
duckdb.sql(select_from_bucket).show()


join_tables = f"""
SELECT
    orders.order_date,
    orders.order_id,
    customers.user_full_name,
    orders.order_status,
    payments.payment_method,
    payments.order_amount_usd,
    customers.user_id,
    payments.payment_id
FROM
    read_parquet('{BUCKET_URL}/orders/*.parquet') AS orders 
    LEFT JOIN read_parquet('{BUCKET_URL}/customers/*.parquet') AS customers
        ON orders.user_id = customers.user_id
    LEFT JOIN read_parquet('{BUCKET_URL}/payments/*.parquet') AS payments 
        ON orders.order_id = payments.order_id
"""
orders_df = duckdb.sql(join_tables).df()

orders_df.head()
