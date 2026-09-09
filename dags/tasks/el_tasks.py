"""
=============================================================
el_tasks.py — Extract & Load Functions for Belanja Yuk DWH
=============================================================
Tasks:
  1. extract_load_customers: Baca CSV CRM -> raw.customers
  2. extract_load_products : Baca CSV Inventory -> raw.products
  3. extract_load_orders   : Query MongoDB -> raw.orders (items stored as JSONB)

Prinsip ELT:
  - Menyimpan data mentah apa adanya di schema `raw`
  - Menyimpan array `items` sebagai native PostgreSQL JSONB
  - Idempotent: TRUNCATE/re-insert ke raw table per pipeline run
  - Menambahkan metadata audit trail: `_loaded_at`
=============================================================
"""

import glob
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
import psycopg2
from psycopg2.extras import execute_values, Json
from pymongo import MongoClient

log = logging.getLogger(__name__)

# =============================================================
# DATABASE CONNECTIONS
# =============================================================

def get_dwh_conn():
    """Koneksi ke PostgreSQL Data Warehouse."""
    return psycopg2.connect(
        host=os.getenv("DWH_POSTGRES_HOST", "postgres_dwh"),
        port=int(os.getenv("DWH_POSTGRES_PORT", 5432)),
        dbname=os.getenv("DWH_POSTGRES_DB", "belanja_yuk_dwh"),
        user=os.getenv("DWH_POSTGRES_USER", "dwh_user"),
        password=os.getenv("DWH_POSTGRES_PASSWORD", "dwh_password"),
        connect_timeout=10,
    )


def get_mongo_collection(collection_name: str = "orders"):
    """Koneksi ke MongoDB Orders Collection."""
    user = os.getenv("MONGO_USER", "mongo_user")
    pwd = os.getenv("MONGO_PASSWORD", "mongo_password")
    host = os.getenv("MONGO_HOST", "mongo_orders")
    port = int(os.getenv("MONGO_PORT", 27017))
    db_name = os.getenv("MONGO_DB", "belanja_yuk_orders")

    try:
        uri = f"mongodb://{user}:{pwd}@{host}:{port}/{db_name}?authSource=admin"
        client = MongoClient(uri, serverSelectionTimeoutMS=2000)
        client.server_info()
        return client[db_name][collection_name]
    except Exception:
        uri = f"mongodb://{host}:{port}"
        client = MongoClient(uri, serverSelectionTimeoutMS=10000)
        return client[db_name][collection_name]


# =============================================================
# 1. EXTRACT & LOAD: CUSTOMERS (CSV -> Postgres raw.customers)
# =============================================================

def extract_load_customers(**context) -> int:
    """
    Mencari file CSV customers terbaru di /opt/airflow/data/raw/customers/,
    membuat tabel raw.customers jika belum ada, dan me-load isinya.
    """
    data_dir = "/opt/airflow/data/raw/customers"
    csv_files = sorted(glob.glob(f"{data_dir}/customers_*.csv"))

    if not csv_files:
        raise FileNotFoundError(f"Tidak ada file CSV ditemukan di {data_dir}!")

    latest_file = csv_files[-1]
    log.info(f"📄 Membaca data customers dari: {latest_file}")

    conn = get_dwh_conn()
    cur = conn.cursor()

    try:
        # 1. DDL: Pastikan tabel raw.customers tersedia
        cur.execute("""
            CREATE TABLE IF NOT EXISTS raw.customers (
                customer_id TEXT,
                full_name TEXT,
                email TEXT,
                city TEXT,
                signup_date TEXT,
                segment TEXT,
                phone TEXT,
                gender TEXT,
                _source_file TEXT,
                _loaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 2. Idempotent: bersihkan data raw sebelumnya
        cur.execute("TRUNCATE TABLE raw.customers;")

        # 3. Baca CSV dan insert
        loaded_at = datetime.now(timezone.utc)
        source_name = Path(latest_file).name

        import csv
        records = []
        with open(latest_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                records.append((
                    row.get("customer_id"),
                    row.get("full_name"),
                    row.get("email"),
                    row.get("city"),
                    row.get("signup_date"),
                    row.get("segment"),
                    row.get("phone"),
                    row.get("gender"),
                    source_name,
                    loaded_at
                ))

        insert_query = """
            INSERT INTO raw.customers (
                customer_id, full_name, email, city, signup_date,
                segment, phone, gender, _source_file, _loaded_at
            ) VALUES %s
        """
        execute_values(cur, insert_query, records, page_size=1000)
        conn.commit()

        log.info(f"✅ Sukses me-load {len(records):,} baris ke raw.customers")
        return len(records)

    except Exception as e:
        conn.rollback()
        log.error(f"❌ Gagal me-load customers: {e}")
        raise
    finally:
        cur.close()
        conn.close()


# =============================================================
# 2. EXTRACT & LOAD: PRODUCTS (CSV -> Postgres raw.products)
# =============================================================

def extract_load_products(**context) -> int:
    """
    Mencari file CSV products terbaru di /opt/airflow/data/raw/products/,
    membuat tabel raw.products jika belum ada, dan me-load isinya.
    """
    data_dir = "/opt/airflow/data/raw/products"
    csv_files = sorted(glob.glob(f"{data_dir}/products_*.csv"))

    if not csv_files:
        raise FileNotFoundError(f"Tidak ada file CSV ditemukan di {data_dir}!")

    latest_file = csv_files[-1]
    log.info(f"📦 Membaca data products dari: {latest_file}")

    conn = get_dwh_conn()
    cur = conn.cursor()

    try:
        # 1. DDL: Pastikan tabel raw.products tersedia
        cur.execute("""
            CREATE TABLE IF NOT EXISTS raw.products (
                product_id TEXT,
                sku TEXT,
                product_name TEXT,
                category TEXT,
                price TEXT,
                cost TEXT,
                stock_qty TEXT,
                weight_gram TEXT,
                is_active TEXT,
                _source_file TEXT,
                _loaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 2. Idempotent: bersihkan data raw sebelumnya
        cur.execute("TRUNCATE TABLE raw.products;")

        # 3. Baca CSV dan insert
        loaded_at = datetime.now(timezone.utc)
        source_name = Path(latest_file).name

        import csv
        records = []
        with open(latest_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                records.append((
                    row.get("product_id"),
                    row.get("sku"),
                    row.get("product_name"),
                    row.get("category"),
                    row.get("price"),
                    row.get("cost"),
                    row.get("stock_qty"),
                    row.get("weight_gram"),
                    row.get("is_active"),
                    source_name,
                    loaded_at
                ))

        insert_query = """
            INSERT INTO raw.products (
                product_id, sku, product_name, category, price,
                cost, stock_qty, weight_gram, is_active, _source_file, _loaded_at
            ) VALUES %s
        """
        execute_values(cur, insert_query, records, page_size=1000)
        conn.commit()

        log.info(f"✅ Sukses me-load {len(records):,} baris ke raw.products")
        return len(records)

    except Exception as e:
        conn.rollback()
        log.error(f"❌ Gagal me-load products: {e}")
        raise
    finally:
        cur.close()
        conn.close()


# =============================================================
# 3. EXTRACT & LOAD: ORDERS (MongoDB -> Postgres raw.orders)
# =============================================================

def extract_load_orders(**context) -> int:
    """
    Ekstrak data pesanan dari MongoDB, simpan kolom items sebagai native JSONB
    di tabel raw.orders pada PostgreSQL.
    """
    log.info("🛒 Mengambil data orders dari MongoDB...")
    mongo_coll = get_mongo_collection("orders")

    cursor = mongo_coll.find({})
    total_docs = mongo_coll.count_documents({})
    log.info(f"  → Ditemukan {total_docs:,} dokumen di MongoDB")

    if total_docs == 0:
        log.warning("⚠️ Tidak ada dokumen orders di MongoDB untuk di-extract.")
        return 0

    conn = get_dwh_conn()
    cur = conn.cursor()

    try:
        # 1. DDL: Buat tabel raw.orders dengan kolom items bertipe JSONB
        cur.execute("""
            CREATE TABLE IF NOT EXISTS raw.orders (
                order_id TEXT,
                customer_id TEXT,
                order_date TEXT,
                status TEXT,
                payment_method TEXT,
                channel TEXT,
                total_amount NUMERIC,
                items JSONB,
                _source_system TEXT DEFAULT 'mongodb',
                _loaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 2. Idempotent: bersihkan tabel sebelum batch loading
        cur.execute("TRUNCATE TABLE raw.orders;")

        # 3. Stream & transform ke tuple batch
        loaded_at = datetime.now(timezone.utc)
        batch = []
        batch_size = 2000
        total_loaded = 0

        insert_query = """
            INSERT INTO raw.orders (
                order_id, customer_id, order_date, status, payment_method,
                channel, total_amount, items, _source_system, _loaded_at
            ) VALUES %s
        """

        for doc in cursor:
            batch.append((
                doc.get("order_id"),
                doc.get("customer_id"),
                doc.get("order_date"),
                doc.get("status"),
                doc.get("payment_method"),
                doc.get("channel"),
                doc.get("total_amount"),
                Json(doc.get("items", [])),  # psycopg2 Json adapter -> JSONB
                "mongodb",
                loaded_at
            ))

            if len(batch) >= batch_size:
                execute_values(cur, insert_query, batch, page_size=batch_size)
                total_loaded += len(batch)
                log.info(f"  → Loaded {total_loaded:,}/{total_docs:,} orders ke raw.orders ...")
                batch = []

        if batch:
            execute_values(cur, insert_query, batch, page_size=len(batch))
            total_loaded += len(batch)

        conn.commit()
        log.info(f"✅ Sukses me-load {total_loaded:,} baris ke raw.orders (JSONB preserved)")
        return total_loaded

    except Exception as e:
        conn.rollback()
        log.error(f"❌ Gagal me-load orders: {e}")
        raise
    finally:
        cur.close()
        conn.close()
