"""
check_connections.py — Verifikasi semua koneksi sebelum pipeline jalan.

Usage:
  python scripts/check_connections.py
  make check         (via Makefile)
"""

import os
import sys


# ── Postgres DWH ────────────────────────────────────────────
def check_postgres():
    try:
        import psycopg2

        conn = psycopg2.connect(
            host=os.getenv("DWH_POSTGRES_HOST", "localhost"),
            port=os.getenv("DWH_POSTGRES_PORT", "5433"),
            dbname=os.getenv("DWH_POSTGRES_DB", "belanja_yuk_dwh"),
            user=os.getenv("DWH_POSTGRES_USER", "dwh_user"),
            password=os.getenv("DWH_POSTGRES_PASSWORD", "dwh_password"),
            connect_timeout=5,
        )
        cur = conn.cursor()
        cur.execute("SELECT current_database(), current_schema();")
        db, _schema = cur.fetchone()
        cur.execute(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('raw','staging','marts');"
        )
        schemas = [r[0] for r in cur.fetchall()]
        conn.close()
        print(f"  ✅ Postgres DWH  → OK (db={db}, schemas={schemas})")
        return True
    except Exception as e:
        print(f"  ❌ Postgres DWH  → FAILED: {e}")
        return False


# ── MongoDB ─────────────────────────────────────────────────
def check_mongo():
    try:
        from pymongo import MongoClient

        uri = "mongodb://{user}:{pwd}@{host}:{port}".format(
            user=os.getenv("MONGO_USER", "mongo_user"),
            pwd=os.getenv("MONGO_PASSWORD", "mongo_password"),
            host=os.getenv("MONGO_HOST", "localhost"),
            port=os.getenv("MONGO_PORT", "27018"),
        )
        client = MongoClient(uri, serverSelectionTimeoutMS=5_000)
        client.admin.command("ping")
        db = client[os.getenv("MONGO_DB", "belanja_yuk_orders")]
        collections = db.list_collection_names()
        client.close()
        print(
            f"  ✅ MongoDB        → OK (db=belanja_yuk_orders, collections={collections})"
        )
        return True
    except Exception as e:
        print(f"  ❌ MongoDB        → FAILED: {e}")
        return False


# ── Main ────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n🔍 Checking connections ...\n")
    results = [check_postgres(), check_mongo()]
    print()

    if all(results):
        print("✅ Semua koneksi OK! Aman untuk generate data.\n")
        sys.exit(0)
    else:
        print("❌ Ada koneksi yang gagal. Cek docker compose ps.\n")
        sys.exit(1)
