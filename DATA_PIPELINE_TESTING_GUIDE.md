# 🧪 Panduan Praktis Automated Testing untuk Data Engineer
### *Comprehensive Testing Guide: Pytest (DAG & Unit Test) + dbt Core (Data Quality & Referential Integrity)*

Dokumen ini adalah panduan lengkap cara melakukan **testing di dunia Data Engineering modern**. Simpan file ini sebagai referensi kerja di kantor, tempat magang, maupun acuan teknis saat interview portofolio.

---

## 🎯 1. Mengapa Testing di Data Engineering Berbeda dengan Software Engineering?

Di Software Engineering biasa (Backend/Frontend), pengujian biasanya hanya menguji **Code Logic** (misal: "apakah fungsi hitung diskon mengembalikan angka yang benar?").

Di Data Engineering, kita menghadapi tantangan ganda:
1. **Code Testing**: Apakah kode DAG Airflow bebas dari syntax error, circular dependency, atau konfigurasi retry yang salah?
2. **Data Testing (Silent Data Corruption)**: Pipeline Airflow bisa saja berstatus **HIJAU (SUCCESS)**, tetapi data di dalamnya **RUSAK PARAH** (misalnya: omzet bernilai negatif, ada pesanan tanpa pelanggan terdaftar, atau stok barang minus).

> **Konsekuensi Tanpa Testing:**
> Laporan dashboard Direktur / C-Level salah, keputusan bisnis keliru, dan tim Data Engineering baru tahu berbulan-bulan kemudian saat tim Finance komplain adanya selisih saldo!

---

## 🏛️ 2. Piramida Pengujian Data Engineering (The 3 Pillars)

```
                       ▲
                      / \
                     /   \     Layer 3: dbt Singular Tests
                    /     \    (Custom Business Logic Assertions)
                   /───────\
                  /         \   Layer 2: dbt Generic / Schema Tests
                 /           \  (Not Null, Unique, Relationships, FK)
                /─────────────\
               /               \ Layer 1: Pytest Suite
              /                 \(DAG Integrity + Python Unit Logic)
             /───────────────────\
```

---

## 🟢 PILLAR 1: DAG Integrity Testing (Pytest + Airflow DagBag)

### Apa tujuannya?
Memastikan bahwa **sebelum file DAG di-deploy ke server production**, DAG tersebut:
1. Bebas dari syntax error dan python import error.
2. Memiliki konfigurasi *retries* (wajib di production agar tahan transient network error).
3. Memiliki tag pengelompokan (*metadata tags*).
4. Tidak memiliki siklus buntu (*deadlock / cycle*).

### Lokasi File di Proyek Ini:
📂 [`tests/dags/test_dag_integrity.py`](file:///c:/personal/backup-kerjaan/porto-fake-project/tests/dags/test_dag_integrity.py)

### Contoh Template Kode yang Bisa Kamu Pakai di Kantor:
```python
import pytest
from airflow.models import DagBag

@pytest.fixture(scope="session")
def dag_bag():
    # Memuat semua DAG tanpa menjalankan task-nya
    return DagBag(dag_folder="dags/", include_examples=False)

def test_no_import_errors(dag_bag):
    """Memastikan 0 file DAG yang gagal di-parse oleh Airflow scheduler"""
    assert len(dag_bag.import_errors) == 0, f"Ada DAG import error: {dag_bag.import_errors}"

def test_dag_retries_configured(dag_bag):
    """Memastikan setiap DAG di kantor memiliki minimal 1x retry otomatis"""
    for dag_id, dag in dag_bag.dags.items():
        retries = dag.default_args.get("retries", 0)
        assert retries >= 1, f"DAG '{dag_id}' wajib memiliki default_args retries >= 1!"
```

### Cara Menjalankannya:
```powershell
docker compose exec airflow-scheduler python -m pytest /opt/airflow/tests/dags/ -v
```

---

## 🟡 PILLAR 2: Python Unit Logic Testing (Pytest)

### Apa tujuannya?
Menguji fungsi Python murni (*pure functions*) yang digunakan di dalam `PythonOperator` atau task ELT secara terisolasi tanpa harus menyalakan database atau network.

### Lokasi File di Proyek Ini:
📂 [`tests/operators/test_el_logic.py`](file:///c:/personal/backup-kerjaan/porto-fake-project/tests/operators/test_el_logic.py)

### Contoh Kasus yang Diuji:
1. **Validasi Regex Email**: Memastikan fungsi pembersih data bisa membedakan email valid (`budi@gmail.com`) vs email kotor sintesis (`invalid@@domain..com`).
2. **Sanitasi Stok Negatif**: Memastikan fungsi `GREATEST(stock, 0)` berhasil mengubah stok kotor `-5` menjadi `0`.

### Cara Menjalankannya:
```powershell
docker compose exec airflow-scheduler python -m pytest /opt/airflow/tests/operators/ -v
```

---

## 🔵 PILLAR 3: dbt Data Quality & Referential Integrity Tests

Ini adalah pengujian **isi data aktual** yang ada di dalam PostgreSQL Data Warehouse. Terdiri dari 2 tipe:

### A. Generic Tests (Didefinisikan di YAML)
Dideklarasikan di file [`dbt/belanja_yuk/models/marts/marts.yml`](file:///c:/personal/backup-kerjaan/porto-fake-project/dbt/belanja_yuk/models/marts/marts.yml).

| Tipe Test | Fungsi Bisnis | Contoh Penerapan di Proyek Kita |
|---|---|---|
| `not_null` | Memastikan kolom penting tidak boleh kosong. | `order_id`, `product_id`, `order_date` |
| `unique` | Memastikan tidak ada duplikasi Primary Key. | `order_item_id` di fact, `customer_id` di dim |
| `relationships` | **Referential Integrity**: Memastikan setiap Foreign Key di tabel fakta ada induknya di tabel dimensi. | `fact_order_items.customer_id` $\rightarrow$ `dim_customers.customer_id` |

#### Cara Menulisnya di `marts.yml`:
```yaml
models:
  - name: fact_order_items
    columns:
      - name: customer_id
        tests:
          - not_null
          - relationships:
              to: ref('dim_customers')
              field: customer_id
```

---

### B. Singular Tests (Custom SQL Assertions)
Disimpan sebagai query SQL murni di folder [`dbt/belanja_yuk/tests/`](file:///c:/personal/backup-kerjaan/porto-fake-project/dbt/belanja_yuk/tests/).

> 💡 **Aturan Emas Singular Test di dbt:**
> Tulis query SQL yang **mencari baris yang salah (anomali)**.
> - Jika query mengembalikan **0 baris** $\rightarrow$ Test **PASS** (data bersih).
> - Jika query mengembalikan **> 0 baris** $\rightarrow$ Test **FAIL** (dbt membunyikan alarm dan menampilkan baris data yang rusak).

#### 1. Uji Anti-Revenue Negatif (`assert_no_negative_revenue.sql`)
```sql
-- Test GAGAL jika ada gross revenue atau modal bernilai di bawah 0
SELECT
    order_item_id,
    order_id,
    gross_revenue_idr,
    cogs_idr
FROM {{ ref('fact_order_items') }}
WHERE gross_revenue_idr < 0 
   OR cogs_idr < 0
```

#### 2. Uji Integritas Tanggal Order (`assert_valid_order_dates.sql`)
```sql
-- Test GAGAL jika ada pesanan di masa depan atau tahun anomali sebelum 2020
SELECT
    order_id,
    order_date
FROM {{ ref('fact_order_items') }}
WHERE order_date > CURRENT_DATE + INTERVAL '1 day'
   OR order_date < '2020-01-01'
```

#### 3. Uji Data Hygiene Stok (`assert_positive_stock_in_dim_products.sql`)
```sql
-- Test GAGAL jika data cleaning staging gagal mengubah stok minus menjadi 0
SELECT product_id, stock_qty
FROM {{ ref('dim_products') }}
WHERE stock_qty < 0
```

### Cara Menjalankan dbt Test:
```powershell
docker compose exec airflow-scheduler bash -c "cd /opt/airflow/dbt/belanja_yuk && dbt test"
```

---

## 🛠️ 3. Studi Kasus Nyata: Debugging Saat Test Gagal (Kasus 5 Baris Orphan)

Berikut alur berpikir (*troubleshooting framework*) yang baru saja kita lalui bersama saat `dbt test` sempat gagal:

```
[1. dbt test dijalankan]
          │
          ▼
[FAIL: relationships_fact_order_items... (Got 5 results)]
          │
          ▼
[2. Investigasi SQL: Siapa 5 baris yang melanggar?]
Query: SELECT customer_id, count(*) FROM fact_order_items 
       WHERE customer_id NOT IN (SELECT customer_id FROM dim_customers);
Hasil: CUST99251 (3 items) & CUST99325 (2 items)
          │
          ▼
[3. Root Cause Analysis]
- ID berawalan CUST99... adalah dirty data transaksi dari non-member.
- Tabel fakta memiliki transaksi mereka, tapi tabel dimensi pelanggan menolaknya.
          │
          ▼
[4. Architectural Decision: Kimball Unknown Member Pattern]
- Tambahkan 1 record universal 'UNKNOWN' di dim_customers.
- Map orphan customer ID di fact_order_items ke 'UNKNOWN' sambil mempertahankan raw_customer_id.
          │
          ▼
[5. Re-run dbt run & dbt test]
Hasil: Done. PASS=19 WARN=0 ERROR=0 TOTAL=19 (100% HIJAU!)
```

---

## 📋 4. Cheat Sheet Command Pengujian

| Tindakan | Command Terminal |
|---|---|
| **Jalankan Semua Pytest** | `docker compose exec airflow-scheduler python -m pytest /opt/airflow/tests/ -v` |
| **Jalankan Uji DAG Saja** | `docker compose exec airflow-scheduler python -m pytest /opt/airflow/tests/dags/ -v` |
| **Jalankan Semua dbt Test** | `docker compose exec airflow-scheduler bash -c "cd /opt/airflow/dbt/belanja_yuk && dbt test"` |
| **Jalankan 1 Model Test dbt** | `docker compose exec airflow-scheduler bash -c "cd /opt/airflow/dbt/belanja_yuk && dbt test --select fact_order_items"` |
| **Debug Compile SQL Test** | Cek file di `dbt/belanja_yuk/target/compiled/belanja_yuk/...` |

---

## 💼 5. Cara Menerapkan Ilmu Ini di Tempat Magang / Kerja

Jika di tempat kerjamu sekarang belum ada testing seperti ini, kamu bisa berinisiatif menawarkannya ke Senior/Lead Data Engineer kamu:
1. **Langkah 1 (Quick Win):** Buat 1 file `test_dag_integrity.py` di folder repo Airflow kantor. Pasang di local development sebelum deploy.
2. **Langkah 2:** Tambahkan `not_null` dan `unique` pada primary key di setiap model dbt kantor.
3. **Langkah 3:** Masukkan `dbt test` dan `pytest` ke dalam pipeline CI/CD (GitHub Actions / GitLab CI) sehingga jika ada engineer yang push kode rusak, sistem otomatis menolaknya (*automated quality gate*).
