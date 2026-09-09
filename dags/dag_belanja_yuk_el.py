"""
=============================================================
dag_belanja_yuk_el.py — Airflow Pipeline: Extract & Load (EL)
=============================================================
Deskripsi:
  Pipeline orkestrasi harian untuk meng-extract data dari 3 sumber
  (CRM CSV, Inventory CSV, MongoDB Orders) dan me-load ke schema
  `raw` di PostgreSQL Data Warehouse.

Fitur:
  - TaskGroup: extract_and_load (menjalankan EL ketiga sumber secara paralel)
  - Quality Gate: verifikasi row count di schema raw setelah proses load
  - Idempotent: safe to rerun
=============================================================
"""

import logging
from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.utils.task_group import TaskGroup
from callbacks.slack_alert import slack_alert_on_failure
from tasks.el_tasks import (
    extract_load_customers,
    extract_load_orders,
    extract_load_products,
    get_dwh_conn,
)

log = logging.getLogger(__name__)

default_args = {
    "owner": "data_engineer",
    "depends_on_past": False,
    "email_on_failure": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=2),
    "on_failure_callback": slack_alert_on_failure,
}


def verify_raw_data(**context):
    """
    Quality gate awal: pastikan data berhasil masuk ke ketiga tabel raw
    dan jumlah barisnya tidak kosong.
    """
    conn = get_dwh_conn()
    cur = conn.cursor()

    tables = ["customers", "products", "orders"]
    counts = {}

    try:
        for t in tables:
            cur.execute(f"SELECT COUNT(*) FROM raw.{t};")
            count = cur.fetchone()[0]
            counts[t] = count
            log.info(f"📊 raw.{t} row count: {count:,}")
            if count == 0:
                raise ValueError(
                    f"CRITICAL: Tabel raw.{t} kosong setelah proses Extract & Load!"
                )

        log.info("✅ Quality Check Sukses: Semua tabel raw terisi data.")
        return counts

    finally:
        cur.close()
        conn.close()


with DAG(
    dag_id="dag_belanja_yuk_el",
    default_args=default_args,
    description="Extract CSV & MongoDB data into Postgres raw schema",
    schedule="@daily",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["belanja_yuk", "raw", "extract_load"],
) as dag:
    with TaskGroup(
        "extract_and_load", tooltip="Extract from sources and load to raw"
    ) as el_group:
        task_el_customers = PythonOperator(
            task_id="el_customers_crm",
            python_callable=extract_load_customers,
        )

        task_el_products = PythonOperator(
            task_id="el_products_inventory",
            python_callable=extract_load_products,
        )

        task_el_orders = PythonOperator(
            task_id="el_orders_mongodb",
            python_callable=extract_load_orders,
        )

    task_verify = PythonOperator(
        task_id="verify_raw_data_quality",
        python_callable=verify_raw_data,
    )

    # Dependency: Ketiga proses EL berjalan paralel di TaskGroup, lalu diverifikasi
    el_group >> task_verify
