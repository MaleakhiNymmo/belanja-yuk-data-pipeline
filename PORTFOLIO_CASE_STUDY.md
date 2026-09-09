# 💼 Portfolio Case Study & Engineering Decisions: "Belanja Yuk" Data Pipeline

Dokumen ini merangkum **seluruh arsitektur, keputusan teknis, trade-off, dan data modeling** yang dibangun di project ini. Gunakan dokumen ini sebagai acuan saat menulis *README GitHub*, membuat slide presentasi, atau menjawab pertanyaan teknis di interview Data Engineer.

---

## 📌 1. Project Overview & Problem Statement

| Atribut | Detail |
|---|---|
| **Nama Proyek** | Belanja Yuk Automated ELT Data Pipeline |
| **Role** | Data Engineer |
| **Tech Stack** | Python (Faker, PyMongo, Psycopg2) · Astronomer Astro Runtime 3.x (Airflow 3) · PostgreSQL 15 · MongoDB 7 · dbt Core 1.8.2 · Astro CLI · Docker Compose · Pytest |
| **Masalah Bisnis** | Data e-commerce tersebar di 3 sistem berbeda (CRM via CSV harian, Inventory via CSV harian, dan App Orders via MongoDB NoSQL). Tim Analyst kesulitan karena proses penggabungan data manual, rawan human-error, tanpa data quality check, dan tidak ada audit trail/log orkestrasi. |
| **Solusi yang Dibangun** | Pipeline ELT harian terotomasi penuh: ingestion multi-source $\rightarrow$ Postgres `raw` landing zone $\rightarrow$ transformasi modular dbt (staging $\rightarrow$ intermediate $\rightarrow$ marts) $\rightarrow$ orkestrasi Airflow dengan sensor & branching $\rightarrow$ Automated Data Quality Gate & Circuit Breaker. |

---

## 🏗️ 2. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HETEROGENEOUS DATA SOURCES                      │
│                                                                        │
│   [CRM System]                 [Inventory System]      [App Backend]   │
│   customers_*.csv              products_*.csv           MongoDB (NoSQL)│
└──────────┬─────────────────────────────┬──────────────────────┬────────┘
           │                             │                      │
           ▼                             ▼                      │
     [PythonSensor]                [PythonSensor]               │
           │                             │                      │
           └──────────────┬──────────────┘                      │
                          ▼                                     │
           [Branch: Check File Validity]                        │
                 │              │                               │
                 │ (valid)      │ (0 byte)                      │
                 ▼              ▼                               │
          [proceed_to_el]  [skip_pipeline]                      │
                 │                                              │
                 ├──────────────────────────────────────────────┘
                 ▼
    ┌──────────────────────────────────────────────┐
    │     TaskGroup: extract_and_load (Airflow)    │
    │  - el_customers_crm                          │
    │  - el_products_inventory                     │
    │  - el_orders_mongodb                         │
    └────────────────────┬─────────────────────────┘
                         ▼
           [Quality Gate: Verify Raw Counts]
                         ▼
    ┌──────────────────────────────────────────────┐
    │         POSTGRESQL DATA WAREHOUSE            │
    │                                              │
    │   SCHEMA: raw                                │
    │   ├── raw.customers                          │
    │   ├── raw.products                           │
    │   └── raw.orders (items preserved as JSONB)  │
    └────────────────────┬─────────────────────────┘
                         ▼
    ┌──────────────────────────────────────────────┐
    │     TaskGroup: dbt_transformations           │
    │                                              │
    │   dbt_run_staging                            │
    │   ├── stg_customers (Dedup + email regex)    │
    │   ├── stg_products  (Dedup + price hygiene)  │
    │   └── stg_orders    (Dedup + status hygiene) │
    │         │                                    │
    │         ▼                                    │
    │   dbt_run_intermediate                       │
    │   ├── int_order_items (JSONB unnested + COGS)│
    │   └── int_customer_metrics (Lifetime metrics)│
    │         │                                    │
    │         ▼                                    │
    │   dbt_run_marts                              │
    │   ├── dim_customers (Kimball Unknown Member) │
    │   ├── dim_products  (Stock status & margins) │
    │   ├── fact_order_items (Granular order fact) │
    │   └── fct_daily_sales (BI Executive Mart)    │
    │         │                                    │
    │         ▼                                    │
    │   dbt_test_quality_gate                      │
    │   └── 19 automated tests (circuit breaker)   │
    └────────────────────┬─────────────────────────┘
                         ▼
           [Pipeline Completion Summary]
```

---

## 🧠 3. Log Keputusan Desain & Trade-offs (Architectural Decision Records)

### Keputusan #1: Isolasi Infrastruktur & Port Offsetting
- **Keputusan**: Menggunakan port non-standar: Airflow UI di `8081`, Postgres DWH di `5433`, MongoDB di `27018`.
- **Alasan Teknis**: Mencegah tabrakan port (*port conflict*) dengan instance lokal existing (seperti environment Astro Airflow kantor/magang di port 8080 & 5432).
- **Hasil**: Docker containers project ini bisa berjalan berdampingan tanpa mengganggu lingkungan kerja utama.

### Keputusan #2: Simulasi Multi-Source Hybrid (CSV + MongoDB)
- **Keputusan**: Data orders diambil langsung dari database NoSQL (MongoDB), bukan hanya flat file CSV.
- **Alasan Teknis**: Merefleksikan arsitektur e-commerce nyata di mana transactional orders umumnya disimpan dalam document store ber-schema fleksibel, sementara master CRM/Inventory di-export via batch dump.
- **Hasil**: Menunjukkan kapabilitas mengintegrasikan database NoSQL ke dalam pipeline data warehousing analitik.

### Keputusan #3: Dirty Data Injection yang Terukur
- **Keputusan**: Menambahkan error sintetis pada data generator Faker:
  - 3% invalid email format (`@@`, missing domain).
  - 2% orphan customer IDs (transaksi dari customer yang tidak ada di master CRM).
  - 1.5% duplicate order IDs.
  - 1% null status pesanan.
  - Nilai stok negatif & harga produk 0.
- **Alasan Teknis**: Di dunia nyata, data mentah tidak pernah bersih. Data engineer profesional dinilai dari bagaimana pipeline mendeteksi, membersihkan, atau menandai (*flagging*) dirty data tanpa membuat pipeline crash silently.

### Keputusan #4: JSONB Preservation di Raw Layer (Schema-on-Read)
- **Keputusan**: Kolom `items` (array produk di MongoDB) disimpan apa adanya sebagai tipe data **native PostgreSQL `JSONB`** di tabel `raw.orders`, baru kemudian di-unnest oleh dbt di intermediate layer.
- **Alasan Teknis**:
  1. *Auditability*: Menjaga keutuhan raw payload asli tanpa modifikasi Python.
  2. *Separation of Concerns*: Airflow fokus pada *Extract & Load*, sedangkan logika relasional dan kalkulasi bisnis didelegasikan sepenuhnya ke SQL/dbt.

---

### 🌟 Keputusan #5: Handling Orphan Records dengan Kimball Unknown Member Pattern (KEY HIGHLIGHT!)

Kasus ini adalah **studi kasus terpenting** di proyek ini yang membuktikan kedewasaan arsitektur data (*data engineering maturity*):

#### A. The Problem (Dirty Data & Foreign Key Integrity)
- Di database pesanan (MongoDB), ada transaksi dari pelanggan yang tidak terdaftar di CRM master (misal: `CUST99251`, transaksi dari guest checkout atau POS kasir offline).
- Jika dibiarkan tanpa penanganan:
  - **Opsi Naif 1 (Discard Data)**: Membuang baris transaksi yang customer-nya tidak ada di CRM $\rightarrow$ **Fatal! Omzet penjualan di laporan keuangan hilang.**
  - **Opsi Naif 2 (Dynamic Dummy Profile)**: Setiap ada ID asing, pipeline otomatis membuat baris dummy baru di tabel dimensi pelanggan $\rightarrow$ **Anti-pattern! Tabel pelanggan dipenuhi ribuan user sampah (*ghost entities*) dan memicu race condition saat rebuild.**

#### B. The Automated Detection (Circuit Breaker via dbt Test)
- Kita memasang automated relationship test di `marts.yml`:
  ```yaml
  - name: customer_id
    tests:
      - relationships:
          to: ref('dim_customers')
          field: customer_id
  ```
- Saat `dbt test` dijalankan, alarm menyala mendeteksi anomali:
  `FAIL 5 relationships_fact_order_items_customer_id__customer_id__ref_dim_customers_`
  Ini membuktikan bahwa Automated Data Testing pipeline kita benar-benar bekerja menangkap dirty data sebelum mengotori dashboard BI!

#### C. The Architectural Solution: Kimball Unknown Dimension Member Pattern
Sesuai standar arsitektur Ralph Kimball (bapak Data Warehousing modern):
1. **Di Tabel Dimensi (`dim_customers`)**:
   Disediakan **1 universal record** khusus:
   - `customer_id = 'UNKNOWN'`
   - `full_name = 'Guest / Unregistered Customer'`
   - `customer_segment = 'guest'`
   - `is_registered_in_crm = FALSE`
2. **Di Tabel Fakta (`fact_order_items`)**:
   - Jika `customer_id` terdaftar di CRM, gunakan ID aslinya.
   - Jika orphan, arahkan Foreign Key ke `'UNKNOWN'`.
   - Tetap simpan ID mentah aslinya di kolom `raw_customer_id` untuk keperluan audit trace.
   - Tambahkan flag boolean `is_registered_customer`.

#### D. Business & Engineering Impact
- **100% Financial Revenue Preserved**: Tidak ada transaksi atau rupiah yang hilang.
- **100% Referential Integrity**: Semua query `INNER JOIN` downstream BI aman tanpa missing join.
- **Zero Dimension Bloat**: Tabel dimensi tetap bersih tanpa ribuan user dummy.
- **Actionable Business Metrics**: Tim Analis bisa menjawab: *"Berapa total omzet yang dihasilkan dari pembeli non-member (guest) vs member setia?"*

---

### Keputusan #6: Granular dbt Orchestration & In-DAG Automated Circuit Breaker
- **Keputusan**: Membagi eksekusi dbt ke dalam 4 task berurutan di dalam TaskGroup:
  `dbt_run_staging` $\rightarrow$ `dbt_run_intermediate` $\rightarrow$ `dbt_run_marts` $\rightarrow$ `dbt_test_quality_gate`.
- **Alasan Teknis**: 
  1. *Failure Isolation*: Jika terjadi error di transformasi kalkulasi profit, task staging tetap sukses sehingga mempersingkat debugging.
  2. *Automated Circuit Breaker*: Pengujian 19 data tests tidak dijalankan manual di terminal, melainkan dieksekusi otomatis oleh Airflow. Jika ada anomali data (seperti revenue negatif atau referential error), task `dbt_test_quality_gate` langsung merah (FAIL), memicu Slack alert, dan memblokir data masuk ke reporting layer!

### Keputusan #7: Production Observability & Automated Alerting (Slack Webhook + Graceful Mock)
- **Keputusan**: Mengimplementasikan `on_failure_callback` modular di seluruh DAG Airflow yang memformat rich notification (Block Kit) ke Slack Incoming Webhook, lengkap dengan direct log URL, error trace, task ID, dan DAG metadata.
- **Alasan Teknis**: Di environment produksi, data engineer tidak boleh manual refresh UI Airflow untuk melihat apakah pipeline gagal. Notifikasi real-time via Slack/Teams secara radikal memangkas MTTR (*Mean Time To Resolution*).
- **Graceful Mock Fallback**: Jika environment variable `SLACK_WEBHOOK_URL` tidak diset (misal di local dev/testing), callback otomatis beralih ke formatted terminal ASCII logging tanpa melempar fatal exception, menjaga pipeline tetap stabil.

### Keputusan #8: Production CI/CD Automated Guardrails (GitHub Actions)
- **Keputusan**: Membangun workflow GitHub Actions 3-stage (`code-quality`, `airflow-dag-tests`, `dbt-validation`) yang dieksekusi otomatis pada setiap push dan Pull Request ke branch utama.
- **Alasan Teknis**: 
  1. *Zero Broken Deployments*: Mencegah kode DAG rusak (syntax/import errors) masuk ke production Airflow instance.
  2. *Automated Slim Validation*: dbt parse & compile mengecek integritas seluruh dependency graph `ref()` tanpa memerlukan database live di runner CI.
  3. *Shift-Left Quality*: Bug data hygiene dan logika parsing tertangkap di level git commit, bukan saat DAG sudah running di production.
- **Panduan Detail**: Lihat penjelasan komprehensif & bedah teknis di [CI_CD_PIPELINE_GUIDE.md](file:///c:/personal/backup-kerjaan/porto-fake-project/CI_CD_PIPELINE_GUIDE.md).

---

## 📊 4. Skema Data Marts (Analytics-Ready)

| Model | Tipe | Grain | Deskripsi Utama |
|---|---|---|---|
| **`dim_customers`** | Dimension (Table) | 1 baris per `customer_id` | Master profile, tiering (*Platinum, Gold, Silver*), metrik lifetime spend, flag registrasi CRM, dan universal member `UNKNOWN`. |
| **`dim_products`** | Dimension (Table) | 1 baris per `product_id` | Katalog produk, margin modal vs harga jual, riwayat unit terjual, dan status kesehatan inventori (*Low Stock, Out of Stock, Healthy*). |
| **`fact_order_items`** | Fact (Table) | 1 baris per `order_item_id` | Data transaksional detail per produk per order, harga unit, diskon, revenue, COGS, gross profit margin, audit `raw_customer_id`, dan `is_registered_customer`. |
| **`fct_daily_sales`** | Fact Mart (Table) | 1 baris per tanggal + kategori + payment + channel | Mart agregasi harian untuk reporting performa penjualan dan net profitabilitas. |

---

## 🎯 5. Storytelling & Interview Talking Points (Show-off Guide)

Gunakan format **STAR (Situation, Task, Action, Result)** ini saat presentasi portofolio atau wawancara kerja:

### Pertanyaan 1: "Ceritakan tantangan Data Quality tersulit yang pernah Anda hadapi dan bagaimana Anda menyelesaikannya?"
> **Situation**: "Pada pipeline data e-commerce yang saya bangun, pesanan masuk dari aplikasi belanja (MongoDB) sementara data CRM di-update harian via CSV. Terdapat 427 transaksi dengan customer ID yatim (*orphan foreign key*) yang tidak terdaftar di CRM master."
>
> **Task**: "Tantangannya adalah: saya tidak boleh membuang transaksi tersebut karena akan menyebabkan selisih omzet dengan pembukuan tim Finance, tetapi membiarkannya juga akan merusak referential integrity dashboard BI."
>
> **Action**: "Saya memasang automated test di dbt (`dbt test relationships`) yang bertindak sebagai *circuit breaker*. Daripada membuat user dummy yang mengotori database, saya mengadopsi **Kimball Unknown Member Pattern**: menyediakan universal record `UNKNOWN` di `dim_customers` dan memetakan transaksi orphan ke ID tersebut sambil mempertahankan `raw_customer_id` untuk audit trail."
>
> **Result**: "Pipeline mencapai 100% referential integrity (19 dari 19 dbt data tests PASS), nol data transaksi hilang, dan tim bisnis sekarang dapat menganalisis proporsi belanja guest checkout secara presisi."

### Pertanyaan 2: "Bagaimana Anda menangani data nested/semi-structured dari NoSQL ke Data Warehouse?"
> **Jawab**: "Menggunakan pattern ELT modern. Data JSON dari MongoDB disimpan langsung sebagai tipe native `JSONB` di PostgreSQL schema `raw`. Di layer intermediate dbt, saya menggunakan `CROSS JOIN LATERAL jsonb_to_recordset()` untuk mengurai array tersebut menjadi baris relasional tanpa kehilangan metadata asli."

### Pertanyaan 3: "Bagaimana pipeline Anda mengatasi duplicate records dari upstream?"
> **Jawab**: "Di layer staging dbt, saya mengimplementasikan deduplikasi menggunakan window function `ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY _loaded_at DESC) WHERE row_num = 1`, sehingga pipeline selalu mempertahankan snapshot data paling mutakhir."

### Pertanyaan 4: "Bagaimana strategi incident response & monitoring pipeline Anda saat terjadi failure di production?"
> **Jawab**: "Saya mengimplementasikan automated alerting via Airflow `on_failure_callback`. Begitu ada task yang gagal, sistem langsung memicu webhook Slack dengan format Block Kit interaktif yang menyertakan direct link ke task log, execution timestamp, dan cuplikan error trace. Ini memangkas MTTR (Mean Time To Resolution) dari hitungan jam menjadi hitungan menit, tanpa perlu engineer standby memantau dashboard."

### Pertanyaan 5: "Bagaimana pengalaman Anda bekerja dengan tooling Data Engineering di level enterprise?"
> **Jawab**: "Selain Apache Airflow open-source, saya menggunakan **Astronomer Astro Runtime** — enterprise distribution dari Airflow yang digunakan oleh perusahaan Data Engineering kelas dunia. Di lokal, saya jalankan via **Astro CLI** yang memberikan tampilan UI modern ala Airflow 3, dukungan dark mode, dan kemampuan deploy langsung ke platform Astronomer Cloud hanya dengan satu perintah `astro deploy`."

### Pertanyaan 6: "Bagaimana Anda memastikan kode pipeline data tidak merusak production saat di-deploy?"
> **Jawab**: "Saya menerapkan prinsip *Shift-Left Testing* dengan pipeline **GitHub Actions CI/CD**. Sebelum kode di-merge ke branch utama, sistem otomatis menjalankan 3 quality gates: linter Ruff untuk kebersihan sintaks Python, test suite Pytest (11 tests) yang memuat Airflow `DagBag` untuk memvalidasi zero import errors, konfigurasi retry, dan tags, serta `dbt parse` untuk memvalidasi model dependency graph. Jika ada 1 test yang gagal, deployment otomatis diblokir."

---

## 🗂️ 6. Status Progress & Next Steps

| Step | Deskripsi | Status |
|---|---|---|
| **Step 1** | Foundation: Docker Compose, Dual Postgres, Airflow | ✅ Selesai |
| **Step 2** | Synthetic Data Generator (Faker, Dirty Data, MongoDB) | ✅ Selesai |
| **Step 3** | Extract & Load Pipeline (CSV + MongoDB → Postgres raw) | ✅ Selesai |
| **Step 4** | dbt Data Modeling (Staging → Intermediate → Marts) | ✅ Selesai |
| **Step 5** | Advanced Airflow Orchestration (Sensor, Branching, TaskGroup) | ✅ Selesai |
| **Step 6** | Testing & Quality Gate (19 dbt tests + 7 Pytest + dbt_test_quality_gate in DAG) | ✅ Selesai |
| **Step 7** | Error Handling & Alerting (Slack on_failure_callback + Graceful Mock) | ✅ Selesai |
| **Step 7.5** | Astro Runtime 3.x Migration (Modern UI + Airflow 3) | ✅ Selesai |
| **Step 8** | CI/CD Pipeline (GitHub Actions — DAG lint + Pytest + dbt parse on push) | ✅ Selesai |
| **Step 9** | Final Documentation & Bilingual README (English & Indonesian) | ✅ Selesai |

### 📌 Catatan Sesi Terakhir (2026-09-09)
- ✅ `dbt_test_quality_gate` berhasil dipasang sebagai task otomatis di dalam `dag_belanja_yuk_master_pipeline` (TaskGroup `dbt_transformations`).
- ✅ Migrasi ke `astrocrpublic.azurecr.io/runtime:3.3-6` (Airflow 3.3.1) sukses dan `astro dev start` berjalan lancar.
- ✅ Resolusi modul internal DAG (`PYTHONPATH=/usr/local/airflow/dags:/usr/local/airflow`) terkonfigurasi.
- ✅ Step 8 selesai: GitHub Actions CI/CD workflow (`.github/workflows/ci.yml`) aktif dengan 3 quality gates (Ruff linting, 11 Pytest tests, dan dbt parse validation).
- ✅ Step 9 selesai: Dokumentasi bilingual lengkap (`README.md` full English dan `README_ID.md` full Bahasa Indonesia) ditulis dengan standar technical humanizer bebas AI slop. Seluruh roadmap (Step 1 s.d. 9) selesai penuh!

