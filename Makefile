# ============================================================
# Makefile — Belanja Yuk Data Pipeline
# Shortcuts biar gak perlu hafal command panjang
#
# Usage:
#   make up              → start semua container
#   make down            → stop semua container
#   make check           → cek koneksi Postgres & MongoDB
#   make generate-data   → generate dummy data dengan Faker
#   make logs            → lihat logs airflow scheduler
#   make ps              → lihat status container
#   make clean           → HATI-HATI: hapus semua volume (reset total)
# ============================================================

.PHONY: up down logs ps clean check generate-data fernet-key

# -- Setup awal (wajib dijalankan sekali) -------------------
setup:
	@echo "📋 Copying .env.example to .env ..."
	@cp -n .env.example .env || echo "  .env sudah ada, skip."
	@echo "🔑 Generating Fernet key ..."
	@python -c "from cryptography.fernet import Fernet; print('AIRFLOW__CORE__FERNET_KEY=' + Fernet.generate_key().decode())"
	@echo ""
	@echo "✅ Copy output di atas ke .env kamu!"

# -- Start containers ---------------------------------------
up:
	@echo "🚀 Starting Belanja Yuk pipeline ..."
	docker compose up -d --build
	@echo ""
	@echo "✅ Services running:"
	@echo "   Airflow UI  → http://localhost:8081  (admin/admin)"
	@echo "   Postgres DWH → localhost:5433"

# -- Stop containers ----------------------------------------
down:
	docker compose down

# -- Stop + hapus volumes (RESET TOTAL) ---------------------
clean:
	@echo "⚠️  WARNING: Ini akan hapus semua data di Postgres!"
	@read -p "Ketik 'yes' untuk lanjut: " confirm && [ "$$confirm" = "yes" ]
	docker compose down -v
	@echo "🧹 Clean selesai."

# -- Lihat status -------------------------------------------
ps:
	docker compose ps

# -- Logs ---------------------------------------------------
logs:
	docker compose logs -f airflow-scheduler

logs-web:
	docker compose logs -f airflow-webserver

# -- Masuk ke container Airflow -----------------------------
shell:
	docker compose exec airflow-scheduler bash

# -- Cek koneksi sebelum generate ---------------------------
check:
	@echo "🔍 Checking connections ..."
	docker compose exec airflow-scheduler python /opt/airflow/scripts/check_connections.py

# -- Generate data dummy ------------------------------------
generate-data:
	@echo "🎲 Generating dummy data dengan Faker ..."
	@echo "   (Ini bisa makan 1-2 menit untuk 20K orders)"
	docker compose exec airflow-scheduler python /opt/airflow/scripts/generate_data.py
	@echo "✅ Data tersimpan di ./data/ dan MongoDB!"

# -- Jalankan dbt secara manual -----------------------------
dbt-run:
	docker compose exec airflow-scheduler bash -c "cd /opt/airflow/dbt/belanja_yuk && dbt run"

dbt-test:
	docker compose exec airflow-scheduler bash -c "cd /opt/airflow/dbt/belanja_yuk && dbt test"

dbt-docs:
	docker compose exec airflow-scheduler bash -c "cd /opt/airflow/dbt/belanja_yuk && dbt docs generate && dbt docs serve --port 8082"

# -- Pytest -------------------------------------------------
test:
	docker compose exec airflow-scheduler python -m pytest /opt/airflow/tests/ -v
