"""
=============================================================
test_dag_integrity.py — Automated Airflow DAG Integrity Tests
=============================================================
Memverifikasi:
  1. Semua file DAG berhasil di-import tanpa syntax / import error.
  2. Semua DAG memiliki retries policy (minimal 1 retry).
  3. Semua DAG memiliki tags untuk pengelompokan di UI.
  4. Tidak ada siklus / deadlock (DAG acyclic check).
=============================================================
"""

import pytest
from airflow.models import DagBag


@pytest.fixture(scope="session")
def dag_bag():
    """Load semua DAG dari folder dags (Astro, Docker, atau CI host)."""
    import os

    for folder in ["/usr/local/airflow/dags", "/opt/airflow/dags", "dags"]:
        if os.path.exists(folder):
            return DagBag(dag_folder=folder, include_examples=False)
    return DagBag(dag_folder="dags", include_examples=False)


def test_no_import_errors(dag_bag):
    """Pastikan 0 import error di seluruh file DAG."""
    assert len(dag_bag.import_errors) == 0, (
        f"Ditemukan import errors di DAGs: {dag_bag.import_errors}"
    )


def test_dags_loaded(dag_bag):
    """Pastikan minimal 2 DAG utama ter-load (EL DAG & Master Pipeline)."""
    assert len(dag_bag.dags) >= 2, f"DAG ter-load hanya {len(dag_bag.dags)}"
    expected_dags = [
        "dag_belanja_yuk_el",
        "dag_belanja_yuk_master_pipeline",
    ]
    for dag_id in expected_dags:
        assert dag_id in dag_bag.dags, f"DAG '{dag_id}' tidak ditemukan di DagBag!"


def test_dag_retries_configured(dag_bag):
    """Pastikan seluruh DAG memiliki konfigurasi retry untuk resilience."""
    for dag_id, dag in dag_bag.dags.items():
        retries = dag.default_args.get("retries", 0)
        assert retries >= 1, (
            f"DAG '{dag_id}' belum memiliki retries policy di default_args (saat ini: {retries})"
        )


def test_dag_has_tags(dag_bag):
    """Pastikan seluruh DAG memiliki minimal 1 tag untuk observability."""
    for dag_id, dag in dag_bag.dags.items():
        assert dag.tags, f"DAG '{dag_id}' tidak memiliki tags!"
