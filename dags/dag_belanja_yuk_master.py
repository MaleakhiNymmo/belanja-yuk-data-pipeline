"""
=============================================================
dag_belanja_yuk_master.py — Master End-to-End Data Pipeline
=============================================================
Arsitektur Orkestrasi:
  1. Sensors        : Menunggu file CSV customers & products di landing zone
  2. Branching      : Validasi file (skip pipeline jika file kosong / corrupt)
  3. TaskGroup EL   : Extract paralel (CRM, Inventory, MongoDB) -> Postgres raw
  4. Quality Gate   : Verifikasi tabel raw tidak kosong
  5. TaskGroup dbt  : Granular dbt run (staging -> intermediate -> marts)
  6. Final Summary  : Logging statistik mart & metrik bisnis
=============================================================
"""

import glob
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path

from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.empty import EmptyOperator
from airflow.operators.python import BranchPythonOperator, PythonOperator
from airflow.sensors.python import PythonSensor
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
    "retries": 2,
    "retry_delay": timedelta(minutes=1),
    "on_failure_callback": slack_alert_on_failure,
}


# =============================================================
# SENSOR CALLABLES
# =============================================================


def check_customers_file_exists() -> bool:
    """Sensor: cek apakah file CSV customers sudah ada di landing zone."""
    files = glob.glob("/opt/airflow/data/raw/customers/customers_*.csv")
    exists = len(files) > 0
    log.info(f"🔍 Sensor customers file: {'DITEMUKAN' if exists else 'BELUM ADA'}")
    return exists


def check_products_file_exists() -> bool:
    """Sensor: cek apakah file CSV products sudah ada di landing zone."""
    files = glob.glob("/opt/airflow/data/raw/products/products_*.csv")
    exists = len(files) > 0
    log.info(f"🔍 Sensor products file: {'DITEMUKAN' if exists else 'BELUM ADA'}")
    return exists


# =============================================================
# BRANCHING LOGIC
# =============================================================


def evaluate_file_validity(**context) -> str:
    """
    Branching logic: cek ukuran file CSV.
    - Jika ada file yang 0 byte (kosong) -> branch ke 'skip_pipeline'
    - Jika file valid (> 0 byte) -> branch ke 'proceed_to_el'
    """
    cust_files = glob.glob("/opt/airflow/data/raw/customers/customers_*.csv")
    prod_files = glob.glob("/opt/airflow/data/raw/products/products_*.csv")

    for fpath in [cust_files[-1], prod_files[-1]]:
        size = os.path.getsize(fpath)
        log.info(f"📏 Memeriksa {Path(fpath).name}: {size} bytes")
        if size == 0:
            log.warning(f"⚠️ File {fpath} kosong (0 byte)! Melewati pipeline...")
            return "skip_pipeline"

    log.info(
        "✅ Semua file source valid dan memiliki ukuran. Melanjutkan ke Extract & Load."
    )
    return "proceed_to_el"


# =============================================================
# QUALITY GATE & SUMMARY
# =============================================================


def verify_raw_data_quality(**context):
    """Quality gate: memastikan tabel raw terisi data."""
    conn = get_dwh_conn()
    cur = conn.cursor()
    tables = ["customers", "products", "orders"]

    try:
        for t in tables:
            cur.execute(f"SELECT COUNT(*) FROM raw.{t};")
            cnt = cur.fetchone()[0]
            log.info(f"📊 raw.{t} row count: {cnt:,}")
            if cnt == 0:
                raise ValueError(
                    f"CRITICAL: Tabel raw.{t} kosong! Pipeline dihentikan."
                )
        log.info("✅ Quality Check Passed: Data raw lengkap.")
    finally:
        cur.close()
        conn.close()


def generate_pipeline_summary(**context):
    """Mencatat ringkasan performa data marts ke log."""
    conn = get_dwh_conn()
    cur = conn.cursor()

    try:
        cur.execute("SELECT COUNT(*) FROM marts.dim_customers;")
        total_customers = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM marts.dim_products;")
        total_products = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM marts.fact_order_items;")
        total_order_items = cur.fetchone()[0]

        cur.execute("""
            SELECT
                ROUND(SUM(gross_revenue_idr))::BIGINT,
                ROUND(SUM(net_profit_idr))::BIGINT
            FROM marts.fct_daily_sales;
        """)
        rev, profit = cur.fetchone()

        log.info("==================================================")
        log.info("🎉 BELANJA YUK DATA PIPELINE BERHASIL SELESAI!")
        log.info(f"  Total Customers (Dim)   : {total_customers:,}")
        log.info(f"  Total Products (Dim)    : {total_products:,}")
        log.info(f"  Total Fact Order Items  : {total_order_items:,}")
        log.info(f"  Total Gross Revenue     : Rp {rev:,}")
        log.info(f"  Total Net Profit        : Rp {profit:,}")
        log.info("==================================================")
    finally:
        cur.close()
        conn.close()


# =============================================================
# MASTER DAG DEFINITION
# =============================================================

with DAG(
    dag_id="dag_belanja_yuk_master_pipeline",
    default_args=default_args,
    description="End-to-End E-Commerce Data Pipeline with Sensors, Branching, and dbt",
    schedule="@daily",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["belanja_yuk", "master", "sensors", "branching", "dbt"],
) as dag:
    # --- 1. SENSORS ---
    sensor_customers = PythonSensor(
        task_id="sensor_wait_for_customers_csv",
        python_callable=check_customers_file_exists,
        poke_interval=10,
        timeout=120,
        mode="poke",
    )

    sensor_products = PythonSensor(
        task_id="sensor_wait_for_products_csv",
        python_callable=check_products_file_exists,
        poke_interval=10,
        timeout=120,
        mode="poke",
    )

    # --- 2. BRANCHING ---
    branch_check_files = BranchPythonOperator(
        task_id="branch_check_file_validity",
        python_callable=evaluate_file_validity,
    )

    proceed_to_el = EmptyOperator(
        task_id="proceed_to_el",
    )

    skip_pipeline = EmptyOperator(
        task_id="skip_pipeline",
    )

    # --- 3. TASKGROUP: EXTRACT & LOAD ---
    with TaskGroup(
        "extract_and_load", tooltip="Extract raw sources to Postgres"
    ) as el_group:
        task_el_cust = PythonOperator(
            task_id="el_customers_crm",
            python_callable=extract_load_customers,
        )

        task_el_prod = PythonOperator(
            task_id="el_products_inventory",
            python_callable=extract_load_products,
        )

        task_el_ord = PythonOperator(
            task_id="el_orders_mongodb",
            python_callable=extract_load_orders,
        )

    # --- 4. QUALITY GATE ---
    task_quality_gate = PythonOperator(
        task_id="verify_raw_data_quality",
        python_callable=verify_raw_data_quality,
    )

    # --- 5. TASKGROUP: DBT TRANSFORMATIONS (GRANULAR) ---
    with TaskGroup(
        "dbt_transformations", tooltip="Run dbt layer by layer"
    ) as dbt_group:
        dbt_staging = BashOperator(
            task_id="dbt_run_staging",
            bash_command="cd /opt/airflow/dbt/belanja_yuk && dbt run --select staging",
        )

        dbt_intermediate = BashOperator(
            task_id="dbt_run_intermediate",
            bash_command="cd /opt/airflow/dbt/belanja_yuk && dbt run --select intermediate",
        )

        dbt_marts = BashOperator(
            task_id="dbt_run_marts",
            bash_command="cd /opt/airflow/dbt/belanja_yuk && dbt run --select marts",
        )

        dbt_test = BashOperator(
            task_id="dbt_test_quality_gate",
            bash_command="cd /opt/airflow/dbt/belanja_yuk && dbt test",
        )

        # Chaining antar layer di dalam TaskGroup: staging -> intermediate -> marts -> automated quality tests
        dbt_staging >> dbt_intermediate >> dbt_marts >> dbt_test

    # --- 6. FINAL SUMMARY ---
    task_summary = PythonOperator(
        task_id="pipeline_completion_summary",
        python_callable=generate_pipeline_summary,
    )

    # =========================================================
    # PIPELINE DEPENDENCY GRAPH
    # =========================================================
    [sensor_customers, sensor_products] >> branch_check_files
    branch_check_files >> [proceed_to_el, skip_pipeline]

    proceed_to_el >> el_group >> task_quality_gate >> dbt_group >> task_summary
