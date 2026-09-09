# 🚀 Panduan Komprehensif CI/CD untuk Data Engineer (Dari Nol Sampai Paham)

> **Buku Saku Pemula**: Dokumen ini ditulis khusus dengan bahasa yang santai, analogi nyata, dan bedah teknis yang gamblang. Gunakan dokumen ini untuk memahami bagaimana sistem otomatisasi pengujian kode bekerja di industri Data Engineering modern dan cara menceritakannya saat wawancara kerja.

---

## 🧭 1. Apa Itu CI/CD Sebenarnya? (Analogi Bandara)

Bayangkan kamu hendak naik pesawat ke luar negeri di Bandara Internasional:

```
[Penumpang Tiba di Bandara]
            │
            ▼
    [Gate 1: Security Check]  ──► Barang berbahaya / sajam langsung disita (Linting)
            │
            ▼
    [Gate 2: Imigrasi & Tiket] ──► Paspor kadaluwarsa / tiket palsu ditolak (Unit & DAG Tests)
            │
            ▼
    [Gate 3: Boarding Gate]   ──► Kursi & manifest pesawat dicek ulang (dbt Parse Validation)
            │
            ▼
[Penumpang Masuk Pesawat (Production Airflow)]
```

Tanpa petugas bandara (pemeriksaan otomatis), siapa saja bisa masuk ke kabin pesawat—termasuk orang yang membawa barang terlarang yang bisa membahayakan seluruh penumpang di udara.

Di dunia software & data engineering:
- **Pesawat Terbang** = **Server Production** (Airflow yang menyedot data miliaran rupiah setiap hari).
- **Penumpang** = **Kode Python & SQL Baru** yang kamu tulis.
- **Petugas Bandara Otomatis** = **CI (Continuous Integration)**.

### Definisi Formal
- **CI (Continuous Integration)**: Praktik di mana setiap kali ada data engineer yang melakukan `git push` atau membuka *Pull Request* (PR), sebuah "komputer robot di cloud" (GitHub Actions) otomatis bangun, menarik kodingan tersebut, dan menjalankan serangkaian pengujian (*linting, pytest, dbt compile*). Jika ada 1 tes saja yang gagal, sistem otomatis membunyikan alarm merah dan **memblokir kode tersebut agar tidak bisa di-merge ke production**.
- **CD (Continuous Deployment / Delivery)**: Jika seluruh tes CI hijau (lulus 100%), sistem otomatis mengirimkan (*deploy*) file DAG baru tersebut ke server Airflow production tanpa ada engineer yang perlu copy-paste file manual lewat SSH/FTP.

---

## 💥 Mengapa Data Engineer Wajib Punya CI/CD?

Banyak data engineer pemula berpikir: *"Kan di laptop saya kodenya jalan mas, kenapa harus ribet bikin CI/CD?"*

Di dunia kerja nyata, inilah bencana yang sering terjadi tanpa CI/CD:

| Skenario Horor Tanpa CI/CD | Apa Akibatnya di Production? | Bagaimana CI/CD Menyelamatkannya? |
|---|---|---|
| **Typo Nama Modul** (`from taks import el_tasks`) | Seluruh Airflow Scheduler **CRASH** atau status DAG jadi *Broken DAG*. Pipeline mati total subuh-subuh. | **Job Airflow Tests** otomatis memuat `DagBag`. Typo langsung ketahuan dalam 20 detik sebelum merge. |
| **Lupa Konfigurasi Retry** (`retries: 0`) | Begitu ada gangguan koneksi internet kantor 3 detik, task langsung FAIL dan tidak pernah mencoba lagi. | **Test `test_dag_retries_configured`** otomatis menolak commit jika default args `retries < 1`. |
| **Salah Ketik Nama Model dbt** (`ref('dim_costumer')`) | Transformasi SQL gagal saat pipeline sudah berjalan 45 menit di tengah malam. Data mart tidak ter-update. | **Job dbt Validation** mengecek seluruh graf `ref()` secara statis. Typo terdeteksi instan. |
| **Kode Berantakan & Unused Imports** | Repo dipenuhi ribuan baris kode sampah yang membuat tim lain pusing membacanya. | **Job Linter (Ruff)** otomatis menandai baris kode yang melanggar standar PEP8. |

---

## 🏗️ 2. Arsitektur CI/CD Proyek "Belanja Yuk"

Pada proyek ini, pipeline CI/CD kita deklarasikan di file [`.github/workflows/ci.yml`](file:///.github/workflows/ci.yml). 

Alur kerjanya terbagi menjadi **3 Gerbang Pertahanan (Quality Gates)** independen:

```
                  ┌──────────────────────────────┐
                  │    Git Push / Pull Request   │
                  │    (ke main atau master)     │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │ (Paralel)             │ (Paralel)             │ (Paralel)
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  GATE 1: LINT   │     │  GATE 2: TESTS  │     │  GATE 3: DBT    │
│  (Ruff Linter)  │     │     (Pytest)    │     │  (dbt Parse)    │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ • Cek sintaks   │     │ • 4 DAG Tests   │     │ • Cek ref() SQL │
│ • Cek import    │     │ • 3 Unit Tests  │     │ • Cek model DAG │
│ • Python style  │     │ • 4 Mock Tests  │     │ • Cek YAML YAML │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                   Semua Lulus (3 Hijau)?
                  ┌──────────────┴──────────────┐
                 YES                            NO
                  ▼                             ▼
        [✅ Siap Di-Merge]             [❌ Merge DIBLOKIR!]
        (Production Aman)              (Notifikasi Alarm ke PR)
```

---

## 🔬 3. Bedah File `.github/workflows/ci.yml` Baris per Baris

Mari kita pelajari isi kodingan workflow kita agar kamu paham 100% fungsinya:

### A. Kapan CI Dijalankan? (Trigger Event)
```yaml
name: Belanja Yuk Data Pipeline — CI/CD Quality Gate

on:
  push:
    branches: [ "main", "master" ]
  pull_request:
    branches: [ "main", "master" ]
```
> **Penjelasan**:
> Workflow ini hanya akan aktif jika ada yang melakukan `git push` langsung ke branch `main`/`master`, ATAU saat seorang data engineer membuat *Pull Request* (mengajukan perubahan kode untuk ditinjau oleh Senior Data Engineer).

---

### B. Gate 1: Code Quality & Linting (`ruff`)
```yaml
  code-quality:
    name: Code Quality & Linting
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"

      - name: Install linter
        run: pip install ruff

      - name: Run Ruff Linter
        run: |
          ruff check dags/ scripts/ tests/ --select E,F,W --ignore E501
```
> **Penjelasan**:
> 1. `runs-on: ubuntu-latest`: GitHub meminjamkan sebuah komputer virtual (VM Linux Ubuntu) gratis di cloud Microsoft Azure untuk menjalankan tugas ini.
> 2. `actions/checkout@v4`: Komputer virtual tersebut mendownload kode repository kamu.
> 3. `actions/setup-python@v5`: Memasang Python versi 3.11 di komputer tersebut.
> 4. `pip install ruff`: Memasang **Ruff** — linter Python paling cepat di dunia (dibuat dengan bahasa Rust, 100x lebih cepat dibanding Flake8).
> 5. `ruff check ...`: Memeriksa apakah ada variabel yang tidak terpakai, import yang salah, atau kesalahan indentasi di folder `dags/`, `scripts/`, dan `tests/`.

---

### C. Gate 2: Airflow DAG Integrity & Unit Tests (`pytest`)
```yaml
  airflow-dag-tests:
    name: Airflow DAG Integrity & Unit Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"

      - name: Install dependencies
        run: |
          pip install --upgrade pip
          pip install apache-airflow==2.9.3 --constraint "https://raw.githubusercontent.com/apache/airflow/constraints-2.9.3/constraints-3.11.txt"
          pip install pymongo psycopg2-binary faker requests pytest pytest-mock python-dotenv

      - name: Run Pytest Suite (Pillar 1 & 2)
        env:
          PYTHONPATH: .
        run: |
          pytest tests/ -v
```
> **Penjelasan & Trik Senior**:
> - Perhatikan baris `pip install apache-airflow==2.9.3 --constraint ...`. Mengapa kita tidak menyalakan Docker Compose di GitHub Actions?
> - **Alasan Desain**: Menyalakan Docker Compose butuh waktu 5–10 menit (lambat dan boros kuota CI). Dengan memasang library Airflow langsung di Python runner, pengujian `DagBag` selesai hanya dalam **15 detik**!
> - `pytest tests/ -v`: Menjalankan 11 tes:
>   - **4 DAG Integrity Tests**: Menjamin 0 import error, ada tag, ada retry, tidak ada deadlock loop.
>   - **3 Data Hygiene Tests**: Menguji regex pembersih email dan sanitasi stok minus.
>   - **4 Alerting Tests**: Menguji bahwa Slack alert Block Kit terbuat dengan benar dan mode mock berfungsi saat tidak ada internet.

---

### D. Gate 3: dbt Compile & Parse Validation
```yaml
  dbt-validation:
    name: dbt Model DAG & Schema Parse Validation
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"

      - name: Install dbt
        run: |
          pip install --upgrade pip
          pip install dbt-core dbt-postgres

      - name: Validate dbt Model References & Syntax
        run: |
          cd dbt/belanja_yuk
          dbt parse --profiles-dir .
```
> **Penjelasan & Trik Senior**:
> - Mengapa `dbt parse` dan bukan `dbt run`?
> - Untuk `dbt run`, runner GitHub harus menyalakan database PostgreSQL live dan mengisi ribuan baris data dummy (sangat berat).
> - Dengan `dbt parse`, dbt akan **mengompilasi seluruh Jinja templating, memeriksa model dependency graph `ref()`, dan mencocokkan schema file `marts.yml`**. Jika ada nama tabel yang salah ketik atau relasi yang putus, `dbt parse` langsung gagal seketika tanpa perlu database aktif! Ini adalah pola **Slim CI** standar industri.

---

## 🖥️ 4. Cara Melihat Hasil CI/CD di GitHub

Saat kamu melakukan `git push` ke repository GitHub kamu:

1. Buka browser ke halaman repositori GitHub kamu.
2. Klik tab **Actions** di menu atas:
   ```
   [Code]   [Issues]   [Pull requests]   [Actions] ◄── KLIK INI
   ```
3. Kamu akan melihat commit kamu sedang diproses dengan ikon **lingkaran kuning berputar** (*In progress*).
4. Dalam waktu ~1-2 menit, statusnya akan berubah menjadi:
   - **Centang Hijau (✅ Passed)**: Semua gerbang aman!
   - **Silang Merah (❌ Failed)**: Ada tes yang gagal. Kamu bisa mengklik baris tersebut untuk membaca log error-nya secara mendetail (misal: baris berapa yang typo atau tes mana yang assert-nya gagal).

---

## 🎤 5. Cara Menjelaskan CI/CD Ini Saat Interview (STAR Method)

Jika pewawancara bertanya: *"Pernahkah kamu membuat CI/CD untuk data pipeline?"*

Gunakan jawaban terstruktur ini:

### 🌟 Situation (Situasi)
> *"Di proyek data engineering Belanja Yuk, pipeline kami mengintegrasikan 3 sumber data heterogen dengan puluhan model dbt dan DAG Airflow. Risiko terbesar dalam kolaborasi tim adalah adanya engineer yang tanpa sengaja melakukan push kode dengan kesalahan impor Python, typo relasi SQL dbt, atau lupa menyetel retry policy pada task Airflow."*

### 🎯 Task (Tugas)
> *"Tugas saya adalah membangun sistem automated quality gate berbasis CI/CD yang mampu memverifikasi kualitas kode, keutuhan graf DAG, dan relasi transformasi data secara otomatis sebelum kode bisa di-merge ke branch utama."*

### ⚙️ Action (Tindakan)
> *"Saya merancang GitHub Actions workflow multi-stage dengan prinsip Fast-Feedback dan Slim CI:
> 1. **Linting Layer**: Menggunakan Ruff linter untuk mendeteksi unused imports dan pelanggaran sintaks Python dalam hitungan detik.
> 2. **DAG Integrity & Unit Test Layer**: Menggunakan Pytest dengan fixture `DagBag` Airflow untuk memverifikasi nol import error, konfigurasi retries, acyclic check, serta pengujian terisolasi fungsi sanitasi data dan Slack alert mock.
> 3. **dbt Parse Layer**: Menjalankan `dbt parse` secara statis untuk memastikan seluruh Jinja template dan graf relasi antar model analitik utuh tanpa membebani runner dengan database live."*

### 🏆 Result (Hasil)
> *"Hasilnya, seluruh test suite 11 pengujian dan validasi model selesai dalam waktu **kurang dari 2 menit** per commit. Kami menerapkan zero broken deployments, di mana tidak ada kode DAG cacat yang pernah sampai menghentikan scheduler di production."*

---

## 📚 6. Rangkuman Singkat (TL;DR)

1. **CI/CD** adalah satpam otomatis yang menguji kodemu di cloud setiap kali kamu push kode ke GitHub.
2. Didefinisikan di satu file YAML: [`.github/workflows/ci.yml`](file:///.github/workflows/ci.yml).
3. Terdiri dari 3 job: **Linting (Ruff)** $\rightarrow$ **Unit & DAG Tests (Pytest)** $\rightarrow$ **Model Graph (dbt parse)**.
4. Membuat portofolio kamu terlihat seperti **Senior Data Engineer** yang paham siklus hidup deployment enterprise, bukan sekadar penulis skrip Python lepas.
