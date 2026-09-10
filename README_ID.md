# Belanja Yuk Data Pipeline

[![CI Pipeline](https://github.com/MaleakhiNymmo/belanja-yuk-data-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/MaleakhiNymmo/belanja-yuk-data-pipeline/actions/workflows/ci.yml)
[![Airflow](https://img.shields.io/badge/Airflow-3.3.1-017CEE?logo=apache-airflow&logoColor=white)](https://airflow.apache.org/)
[![Astro Runtime](https://img.shields.io/badge/Astro_Runtime-3.3--6-7B42BC)](https://www.astronomer.io/)
[![dbt-core](https://img.shields.io/badge/dbt--core-1.8.2-FF694B?logo=dbt&logoColor=white)](https://www.getdbt.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12%20%7C%203.14-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

[English](README.md) | [Bahasa Indonesia](README_ID.md)

---

Pipeline data ELT otomatis dari hulu ke hilir untuk platform e-commerce fiktif ("Belanja Yuk"). Sistem ini mengekstrak data transaksi dari MongoDB dan batch master dari file CSV, memuatnya ke landing zone PostgreSQL Data Warehouse, mentransformasikannya menjadi data mart dimensional menggunakan dbt Core, menegakkan pengujian kualitas data otomatis menggunakan orkestrasi Apache Airflow 3 dan CI/CD GitHub Actions, serta menyajikan wawasan analitik dimensional melalui Web Analytics Dashboard interaktif (React + Vite).

```
                      +-------------------+
                      | Sumber Data       |
                      | - MongoDB (Orders)|
                      | - CSV (CRM/Stock) |
                      +---------+---------+
                                |
                                v
               +----------------------------------+
               | Ingesti & Validasi Awal          |
               | - PythonSensors (kehadiran file) |
               | - Branching (cek file 0-byte)    |
               | - Airflow 3 TaskGroup (Extract)  |
               +----------------+-----------------+
                                |
                                v
               +----------------------------------+
               | PostgreSQL DWH: Schema raw       |
               | - raw.customers                  |
               | - raw.products                   |
               | - raw.orders (JSONB schema-read) |
               +----------------+-----------------+
                                |
                                v
               +----------------------------------+
               | Pipeline Transformasi dbt        |
               | - staging (dedup, regex email)   |
               | - intermediate (unnest JSONB)    |
               | - marts (Kimball Unknown Member) |
               +----------------+-----------------+
                                |
                                v
               +----------------------------------+
               | Quality Gate & Circuit Breaker   |
               | - 19 dbt data tests dalam DAG    |
               | - Slack webhook on failure       |
               +----------------+-----------------+
                                |
                                v (Ekspor Snapshot Statis)
               +----------------------------------+
               | Lapisan Penyajian Hilir          |
               | - Web Analytics Dashboard        |
               | - React 18 · TypeScript · Vite   |
               | - KPI Mart, Tren & Audit Kimball |
               +----------------------------------+
```

### Tampilan eksekusi master pipeline (Airflow 3 UI)

![Eksekusi Master Pipeline Airflow](assets/screenshots/airflow_dag_run.png)

---

## Konteks bisnis dan rumusan masalah

Belanja Yuk menjalankan tiga sistem transaksional yang terpisah:
1. **Sistem CRM:** Ekspor harian data demografi pelanggan dan level keanggotaan (`customers_YYYYMMDD.csv`).
2. **Sistem inventori:** Dump harian katalog produk, harga pokok penjualan, dan sisa stok (`products_YYYYMMDD.csv`).
3. **Backend aplikasi toko:** Data transaksi pesanan tersimpan dalam koleksi dokumen MongoDB dengan volume tinggi.

Sebelum pipeline ini dibangun, proses penggabungan data analitik dilakukan secara manual melalui penggabungan spreadsheet dan script Python ad-hoc. Cara kerja ini menimbulkan tiga masalah operasional:
- **Ketidakcocokan angka omzet:** Pesanan dari pelanggan non-member langsung hilang saat di-join dengan tabel master CRM, sehingga total penjualan di laporan BI selalu lebih rendah dari pencatatan keuangan.
- **Data anomali masuk tanpa terdeteksi:** Perubahan skema atau data kotor di sistem hulu (seperti format email tidak valid, primary key duplikat, dan harga produk nol rupiah) masuk langsung ke dashboard pelaporan.
- **Tidak ada visibilitas kegagalan pipeline:** Kegagalan proses baru diketahui setelah tim bisnis mendapati laporan kosong atau keliru.

---

## Keputusan arsitektur dan trade-off teknis

Catatan keputusan arsitektur (Architecture Decision Records / ADR) lengkap dapat dibaca pada [ARCHITECTURE.md](ARCHITECTURE.md) dan [PORTFOLIO_CASE_STUDY.md](PORTFOLIO_CASE_STUDY.md). Ringkasan keputusan teknis utama:

### 1. Pola Kimball Unknown Member untuk foreign key orphan

**Konteks:** Database pesanan di MongoDB mencatat transaksi valid dari pembeli non-member atau checkout tamu (guest) yang ID-nya (`customer_id`) tidak ada di tabel master CRM.

**Pilihan yang dipertimbangkan:**
- *Menghapus baris orphan:* Transaksi dibuang saat join. Akibatnya terjadi selisih finansial fatal antara data warehouse dan general ledger tim Finance.
- *Membuat profil dummy dinamis secara otomatis:* Setiap menemukan ID baru di pesanan, sistem langsung membuat baris baru di tabel pelanggan. Pola ini mengotori tabel dimensi dengan ribuan entitas hantu dan memicu kondisi race condition saat full-refresh dbt.

**Solusi yang diterapkan:**
- Menyediakan 1 baris statis di `dim_customers` dengan `customer_id = 'UNKNOWN'` dan tanda penjelas (`is_registered_in_crm = FALSE`).
- Pada tabel `fact_order_items`, transaksi tanpa pasangan di CRM diarahkan foreign key-nya ke `'UNKNOWN'`, sementara ID aslinya tetap disimpan di kolom `raw_customer_id` untuk kebutuhan audit trail.
- Menambahkan kolom boolean `is_registered_customer` sehingga analis dapat membandingkan tren transaksi pelanggan terdaftar vs tamu secara langsung.
- Dampak: 100% nominal transaksi dan omzet terselamatkan, relasi `INNER JOIN` downstream tidak pernah kehilangan data, dan ukuran tabel dimensi tetap terukur.

### 2. Penyimpanan JSONB native schema-on-read di layer raw

**Konteks:** Dokumen order dari MongoDB memiliki array bersarang untuk daftar barang (`items: [{ product_id, quantity, unit_price }]`).

**Solusi yang diterapkan:**
- Airflow memuat data order ke PostgreSQL `raw.orders` tanpa mengubah struktur array aslinya, menggunakan tipe data native `JSONB`.
- Proses flattening dan ekstraksi kolom didelegasikan ke dbt menggunakan fungsi `jsonb_to_recordset()` pada layer intermediate (`int_order_items`).
- Alasan trade-off: Memindahkan beban komputasi dari proses worker Python ke engine database, menjaga keaslian payload hulu untuk keperluan audit atau re-run, dan membuat kode ekstraksi Airflow tetap ringkas.

### 3. Circuit breaker dbt terintegrasi di dalam DAG

**Konteks:** Pengujian data yang hanya dijalankan manual di terminal atau dipisahkan dari alur utama berisiko meloloskan data anomali ke tabel marts produksi.

**Solusi yang diterapkan:**
- Task transformasi dbt di Airflow dibagi menjadi empat tahap sekuensial di dalam TaskGroup:
  `dbt_run_staging` -> `dbt_run_intermediate` -> `dbt_run_marts` -> `dbt_test_quality_gate`.
- Jika salah satu dari 19 pengujian data gagal (misalnya nilai harga negatif atau pelanggaran relasi), task `dbt_test_quality_gate` langsung berstatus failed, memicu alert ke Slack, dan menghentikan proses pipeline sebelum data digunakan oleh sistem downstream.

### 4. Alerting dengan fallback mock

**Konteks:** Di lingkungan produksi, kegagalan DAG harus dilaporkan langsung ke tim on-call. Namun pada mesin lokal developer atau runner CI, dependensi ke webhook eksternal tidak boleh menimbulkan error impor atau unhandled exception.

**Solusi yang diterapkan:**
- Callback kegagalan (`on_failure_callback`) mengirim notifikasi Slack dengan format Block Kit interaktif (waktu eksekusi, ID task, tautan log Airflow, dan ringkasan error).
- Jika environment variable `SLACK_WEBHOOK_URL` tidak didefinisikan, fungsi callback secara otomatis beralih mencetak log berformat ke konsol terminal tanpa melempar exception fatal.

### 5. Validasi CI/CD shift-left

**Konteks:** Kesalahan impor Python, sintaks SQL dbt yang keliru, atau parameter DAG yang hilang harus terdeteksi sebelum kode masuk ke branch produksi.

**Solusi yang diterapkan:**
- GitHub Actions menjalankan tiga tahap validasi pada setiap push dan Pull Request:
  1. `code-quality`: Pemeriksaan gaya kode dan sintaks menggunakan linter Ruff.
  2. `airflow-dag-tests`: Test suite Pytest untuk memverifikasi keutuhan `DagBag` Airflow (bebas import error, DAG acyclic, konfigurasi retry).
  3. `dbt-validation`: Menjalankan `dbt parse` menggunakan profile mock untuk memverifikasi keutuhan dependency graph antar model tanpa membutuhkan koneksi database fisik di runner.

---

## Tech stack

| Komponen | Teknologi | Alasan pemilihan |
|---|---|---|
| Orkestrasi | Astronomer Astro Runtime 3.3-6 (Apache Airflow 3.3.1) | Distribusi enterprise Airflow 3 berbasis FastAPI backend dan integrasi penuh dengan Astro CLI |
| Transformasi | dbt Core 1.8.2 | Transformasi modular berbasis SQL dengan pelacakan silsilah (lineage) dan pengujian skema bawaan |
| Data warehouse | PostgreSQL 15 | Database relasional dengan performa stabil, indexing matang, dan dukungan tipe native JSONB |
| Database sumber | MongoDB 7.0 | Document store untuk simulasi transaksi microservice berbasis dokumen dinamis |
| UI Analitik | React 18 · TypeScript · Vite | Dashboard eksekutif interaktif untuk visualisasi KPI data mart, tren omzet, breakdown kategori, dan pembuktian audit Kimball Unknown Member |
| Generator data | Python Faker | Penghasil data sintetis dengan skenario data kotor terencana untuk pengujian kualitas |
| Kualitas kode | Ruff & Pytest | Linter berkecepatan tinggi dan pengujian otomatis untuk DAG, fungsi ekstraksi, dan callback |
| CI/CD | GitHub Actions | Eksekusi otomatis seluruh tahapan validasi pada setiap commit |
| Monitoring | Slack Webhook (Block Kit) | Notifikasi kegagalan secara real-time disertai tautan langsung ke log Airflow |

---

## Arsitektur model data warehouse

Data warehouse menggunakan struktur tiga skema di PostgreSQL:

```
raw (Landing Zone)  ──>  staging (Views)  ──>  intermediate (Ephemeral/Tables)  ──>  marts (Tables)
```

### Diagram silsilah model (dbt Lineage Graph)

![Diagram Silsilah dbt](assets/screenshots/dbt_lineage_graph.png)

### Model analitik (`marts` schema)

| Nama tabel | Tipe | Grain | Deskripsi |
|---|---|---|---|
| `dim_customers` | Dimensi | 1 baris per `customer_id` | Profil pelanggan, tier loyalitas (`Platinum`, `Gold`, `Silver`, `Bronze`), metrik total belanja, dan baris statis universal `UNKNOWN`. |
| `dim_products` | Dimensi | 1 baris per `product_id` | Katalog produk, perbandingan harga beli vs harga jual, status stok (`Out of Stock`, `Low Stock`, `Healthy Stock`), dan total unit terjual. |
| `fact_order_items` | Fakta | 1 baris per item pesanan | Fakta transaksional per item pesanan mencakup omzet, COGS, gross margin, audit tracking (`raw_customer_id`), dan flag keanggotaan. |
| `fct_daily_sales` | Fact Mart | 1 baris per tanggal, kategori, metode bayar, kanal | Agregasi harian untuk laporan eksekutif mencakup omzet kotor, omzet bersih, jumlah pesanan, total kuantitas, dan margin laba. |

---

## Web analytics dashboard (Lapisan penyajian hilir)

Untuk mendemonstrasikan konsumsi analitik nyata dari data mart dimensional yang telah dibangun, repositori ini menyertakan dashboard eksekutif interaktif di direktori [`dashboard/`](dashboard/).

> [!NOTE]
> **Catatan Arsitektur & Konektivitas Data:**
> Web Analytics Dashboard ini berjalan sepenuhnya di sisi klien (*client-side*) menggunakan file snapshot statis (`dashboard/src/data/dashboard_data.json`) yang diekspor langsung dari tabel mart PostgreSQL (`dim_customers`, `dim_products`, `fact_order_items`, `fct_daily_sales`).
> **Dashboard ini sengaja tidak terhubung secara live/otomatis ke database** demi kepraktisan demo lokal instan tanpa dependensi (*zero-dependency*), keamanan kredensial, serta portabilitas hosting tanpa perlu menyalakan container PostgreSQL secara terus-menerus.

**Fitur Utama Dashboard:**
- **Grid KPI Eksekutif:** Ringkasan instan omzet kotor, omzet bersih, total pesanan, unit terjual, dan margin laba kotor.
- **Analisis Tren Penjualan:** Grafik interaktif visualisasi volume transaksi dan pergerakan omzet harian.
- **Breakdown Dimensional:** Proporsi kontribusi omzet berdasarkan kanal pemasaran dan kategori produk.
- **Widget Showcase Kimball Unknown Member:** Pembuktian visual rekonsiliasi finansial bahwa 100% omzet tetap tercatat lengkap dengan audit tracking transaksi tamu (*guest checkout*).
- **Drawer Kesehatan Pipeline:** Visibilitas status eksekusi DAG Airflow dan quality gate dbt langsung dari antarmuka web.

---

## Pengujian data dan cakupan test

Repositori ini memiliki dua kategori pengujian otomatis:

### 1. dbt schema dan data tests (19 tests)

Didefinisikan di `models/staging/sources.yml` dan `models/marts/marts.yml`:
- **Keunikan (Uniqueness):** Primary key pada `dim_customers`, `dim_products`, `fact_order_items`, serta seluruh model staging.
- **Ketiadaan nilai null (Not Null):** Pengecekan kolom wajib seperti ID, tanggal pesanan, status, dan harga.
- **Nilai yang diterima (Accepted Values):** Validasi status transaksi (`completed`, `cancelled`, `pending`, `returned`) dan metode pembayaran (`credit_card`, `bank_transfer`, `e_wallet`, `qris`).
- **Integritas referensial (Relationships):** Pengecekan foreign key dari `fact_order_items` ke `dim_customers` dan `dim_products`.
- **Validasi rentang nilai:** Memastikan nilai harga beli, harga jual, dan kuantitas bernilai non-negatif.

### 2. Unit test dan integrasi Python (11 tests)

Berada di direktori `tests/` dan dijalankan dengan Pytest:
- **Integritas DAG (`tests/dags/test_dag_integrity.py`):**
  - Memastikan seluruh file DAG dapat dimuat oleh `DagBag` tanpa import error.
  - Memverifikasi topologi DAG tidak memiliki ketergantungan melingkar (acyclic).
  - Memvalidasi konfigurasi argumen default (`retries >= 1`, durasi jeda retry).
  - Memastikan tag wajib terpasang pada DAG produksi.
- **Logika ekstraksi dan pembersihan data (`tests/operators/test_el_logic.py`):**
  - Verifikasi regex pemfilteran format email valid dan penolakan email cacat.
  - Pengujian sanitasi data inventori untuk nilai stok nol atau negatif.
  - Pengujian logika deduplikasi data transaksi berdasarkan prioritas timestamp terbaru.
- **Callback notifikasi kegagalan (`tests/callbacks/test_slack_alert.py`):**
  - Memvalidasi struktur payload JSON Slack Block Kit saat task gagal.
  - Menguji pemanggilan HTTP POST ke endpoint webhook.
  - Memastikan fallback pencatatan log ke konsol aktif saat webhook URL kosong.
  - Memastikan kegagalan di dalam callback tidak membuat pipeline utama terhenti.

### Tampilan format notifikasi insiden (Slack Block Kit)

![Format Notifikasi Insiden Slack](assets/screenshots/slack_alert_notification.png)

---

## Struktur repositori

```
porto-fake-project/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Workflow CI/CD 3 tahap di GitHub Actions
├── dags/
│   ├── callbacks/
│   │   └── slack_alert.py         # Callback kegagalan dengan Slack Block Kit
│   ├── tasks/
│   │   ├── el_customers.py        # Ekstraksi dan pemuatan data CSV CRM
│   │   ├── el_products.py         # Ekstraksi dan pemuatan data CSV inventori
│   │   └── el_orders.py           # Ekstraksi MongoDB dan penyimpanan JSONB
│   ├── dag_belanja_yuk_el.py      # Standalone extract-and-load DAG
│   └── dag_belanja_yuk_master.py  # Master pipeline: sensor, branch, EL, dbt, quality gate
├── dashboard/                     # Web Analytics Dashboard interaktif (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/            # Komponen visual chart, kartu KPI, dan drawer modal
│   │   ├── data/                  # Snapshot statis data mart (dashboard_data.json)
│   │   ├── App.tsx                # Kontainer utama dashboard & manajemen state filter
│   │   └── tokens.css             # Design tokens & styling CSS
│   ├── package.json               # Dependensi Node.js & script build
│   └── vite.config.ts             # Konfigurasi bundler Vite
├── data/
│   └── raw/                       # Direktori landing file CSV sintetis
├── dbt/
│   └── belanja_yuk/
│       ├── models/
│       │   ├── staging/           # Deduplikasi dan standardisasi tipe data
│       │   ├── intermediate/      # Flattening array JSONB dan kalkulasi metrik
│       │   └── marts/             # Dimensi, fakta detail, dan mart harian
│       ├── dbt_project.yml        # Konfigurasi project dbt
│       └── profiles.yml           # Konfigurasi koneksi PostgreSQL dbt
├── infra/
│   └── sql/
│       └── init_schemas.sql       # Inisialisasi skema DWH: raw, staging, intermediate, marts
├── scripts/
│   ├── check_connections.py       # Script verifikasi koneksi antar database
│   └── generate_data.py           # Pembuat data sintetis menggunakan Faker
├── tests/
│   ├── callbacks/                 # Unit test notifikasi Slack
│   ├── dags/                      # Test integritas DagBag Airflow
│   └── operators/                 # Unit test pembersihan data dan logika EL
├── ARCHITECTURE.md                # Catatan keputusan arsitektur (ADR)
├── CI_CD_PIPELINE_GUIDE.md        # Panduan teknis arsitektur CI/CD
├── DATA_PIPELINE_TESTING_GUIDE.md # Panduan teknis strategi pengujian data
├── Dockerfile                     # Konfigurasi container Astro Runtime
├── Makefile                       # Pintasan perintah pengembangan lokal
├── packages.txt                   # Dependensi level OS
├── requirements.txt               # Dependensi package Python
├── README.md                      # Dokumentasi repositori (English)
└── README_ID.md                   # Dokumentasi repositori (Bahasa Indonesia)
```

---

## Panduan instalasi dan reproduksi lokal

### Persyaratan sistem

- [Docker Engine](https://docs.docker.com/engine/install/) (versi 24.0 atau terbaru) dan Docker Compose (versi 2.20 atau terbaru).
- [Astro CLI](https://www.astronomer.io/docs/astro/cli/install-cli/) (disarankan untuk Airflow 3 runtime) atau Docker Compose standar.
- Python 3.11 atau lebih baru (jika ingin menjalankan pengujian langsung di host).

### Alokasi port lokal

Port host dikonfigurasi secara khusus agar tidak bentrok dengan instance kerja yang sudah ada di mesin lokal:

| Layanan | Nama container | Port host | Port internal |
|---|---|---|---|
| Airflow Webserver / API | `belanja-yuk-*-webserver` | `8081` | `8080` |
| PostgreSQL DWH | `byk_postgres_dwh` | `5433` | `5432` |
| MongoDB | `byk_mongo_orders` | `27018` | `27017` |

### Langkah 1: Clone repositori dan konfigurasi environment

```bash
git clone https://github.com/your-username/belanja-yuk-pipeline.git
cd belanja-yuk-pipeline
cp .env.example .env
```

Periksa konfigurasi di file `.env`. Nilai default sudah disesuaikan dengan alokasi port di atas.

### Langkah 2: Menjalankan layanan container

**Menggunakan Astro CLI (Disarankan):**
```bash
astro dev start
```

**Atau menggunakan Docker Compose standar:**
```bash
make up
# atau: docker compose up -d --build
```

Pastikan semua kontainer berjalan normal:
```bash
# Jika menggunakan Astro CLI:
astro dev ps

# Jika menggunakan Docker Compose:
make ps
```

### Langkah 3: Mengisi database sumber dengan data sintetis

Jalankan script generator untuk mengisi ~20.000 dokumen pesanan ke MongoDB dan membuat file master CSV di folder `data/raw/`:

```bash
# Melalui Astro container:
docker exec -it belanja-yuk_6ed815-dag-processor-1 python scripts/generate_data.py

# Atau melalui Makefile Docker Compose:
make generate-data
```

### Langkah 4: Menjalankan pipeline orkestrasi

1. Buka antarmuka Airflow di browser pada tautan `http://localhost:8081` (kredensial: `admin` / `admin`).
2. Temukan DAG: `dag_belanja_yuk_master_pipeline`.
3. Aktifkan toggle DAG dan picu eksekusi manual (*Trigger DAG*).
4. Amati urutan proses:
   - `sensors`: Memastikan file `customers_*.csv` dan `products_*.csv` telah tersedia.
   - `check_file_validity`: Memverifikasi ukuran file lebih dari 0 byte.
   - `extract_and_load`: Memuat data CSV dan MongoDB ke skema `raw` PostgreSQL.
   - `dbt_transformations`: Menjalankan staging, intermediate, marts, dan quality gate secara sekuensial.

### Langkah 5: Menjalankan pengujian mandiri

**Menjalankan test suite Pytest (11 tests):**
```bash
pytest tests/ -v
```

**Menjalankan pengujian data dbt langsung (19 tests):**
```bash
# Melalui Astro container:
docker exec -it belanja-yuk_6ed815-dag-processor-1 bash -c "cd /usr/local/airflow/dbt/belanja_yuk && dbt test"

# Atau melalui Makefile Docker Compose:
make dbt-test
```

### Langkah 6: Membuat dan meninjau dokumentasi dbt

```bash
# Generate katalog dan grafik silsilah data:
docker exec -it belanja-yuk_6ed815-dag-processor-1 bash -c "cd /usr/local/airflow/dbt/belanja_yuk && dbt docs generate"
```

### Langkah 7: Menjalankan Web Analytics Dashboard

Untuk melihat visualisasi analitik data mart di antarmuka web interaktif:

```bash
cd dashboard
npm install
npm run dev
```

Buka `http://localhost:5173` di browser Anda.

*(Catatan: Sebagaimana dijelaskan pada catatan arsitektur, dashboard menggunakan snapshot data statis hasil ekspor mart, sehingga dapat dijalankan secara mandiri tanpa harus menyalakan container Docker.)*

---

## Integrasi berkelanjutan (CI/CD)

Setiap commit yang dikirim ke repositori GitHub akan secara otomatis memicu alur kerja pada `.github/workflows/ci.yml`:

```
[git push / pull_request]
          │
          ├──> Job: code-quality      (Ruff linter)
          ├──> Job: airflow-dag-tests (Pytest DagBag & unit test)
          └──> Job: dbt-validation    (dbt parse silsilah model)
```

Ketiga tahapan pengujian ini harus berstatus berhasil sebelum kode dapat di-merge ke branch utama (`main`). Untuk penjelasan mendalam mengenai arsitektur CI/CD, caching runner, dan strategi mock profile, silakan baca [CI_CD_PIPELINE_GUIDE.md](CI_CD_PIPELINE_GUIDE.md).

### Eksekusi otomatis quality gate CI/CD (Pytest & Ruff)

![Hasil Eksekusi Test Suite CI/CD](assets/screenshots/ci_test_suite.png)

