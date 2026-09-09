"""
=============================================================
generate_data.py — Belanja Yuk Dummy Data Generator
=============================================================
Menggunakan Faker untuk generate data realistic Indonesia:
  - ~2.000 customers  → CSV  → data/raw/customers/
  - ~300  products    → CSV  → data/raw/products/
  - ~20.000 orders    → JSON → MongoDB (belanja_yuk_orders.orders)

Termasuk "data kotor" yang disengaja untuk keperluan testing
& data quality check di pipeline.

Usage:
  # Lokal (butuh install requirements dulu):
  python scripts/generate_data.py

  # Dari dalam Docker:
  docker compose exec airflow-scheduler python /opt/airflow/scripts/generate_data.py

  # Via Makefile:
  make generate-data
=============================================================
"""

import csv
import logging
import os
import random
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from faker import Faker
from pymongo import MongoClient
from pymongo import errors as mongo_errors

# =============================================================
# KONFIGURASI
# =============================================================

# Faker dengan locale Indonesia
fake = Faker("id_ID")
Faker.seed(42)  # Reproducible: jalanin 2x hasilnya sama
random.seed(42)

# Volume data
N_CUSTOMERS = 2_000
N_PRODUCTS = 300
N_ORDERS = 20_000
N_DAYS = 90  # Spread orders selama 90 hari terakhir

# "Dirty data" rates (persentase dari total)
DIRTY_RATE = {
    "invalid_email": 0.03,  # 3%  customer dengan email invalid
    "duplicate_customer": 0.01,  # 1%  customer_id duplikat
    "orphan_customer_id": 0.02,  # 2%  order dengan customer_id tidak ada
    "duplicate_order": 0.015,  # 1.5% order_id duplikat
    "null_status": 0.01,  # 1%  order dengan status null
    "zero_price": 0.02,  # 2%  item dengan unit_price = 0
    "negative_qty": 0.01,  # 1%  item dengan qty negatif
}

# Direktori output
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data" / "raw"
CUST_DIR = DATA_DIR / "customers"
PROD_DIR = DATA_DIR / "products"

# Tanggal generate (simulasi export hari ini)
RUN_DATE = datetime.now().strftime("%Y%m%d")

# MongoDB connection — baca dari env var, fallback ke default lokal
MONGO_URI = "mongodb://{user}:{pwd}@{host}:{port}".format(
    user=os.getenv("MONGO_USER", "mongo_user"),
    pwd=os.getenv("MONGO_PASSWORD", "mongo_password"),
    host=os.getenv("MONGO_HOST", "localhost"),
    port=os.getenv("MONGO_PORT", "27018"),  # 27018 dari host, 27017 dari dalam Docker
)
MONGO_DB = os.getenv("MONGO_DB", "belanja_yuk_orders")
MONGO_COLLECTION = "orders"

# =============================================================
# LOGGING SETUP
# =============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# =============================================================
# HELPER FUNCTIONS
# =============================================================


def should_dirty(rate_key: str) -> bool:
    """Return True dengan probabilitas sesuai DIRTY_RATE."""
    return random.random() < DIRTY_RATE[rate_key]


def make_invalid_email(real_email: str) -> str:
    """Rusak format email dengan berbagai cara."""
    strategies = [
        lambda e: e.replace("@", "@@"),  # double @
        lambda e: e.replace("@", ""),  # tanpa @
        lambda e: e.replace(".", ""),  # tanpa titik
        lambda e: "   " + e,  # leading whitespace
        lambda e: e + ".invalidtld",  # TLD invalid panjang
        lambda e: re.sub(r"@.*", "@", e),  # domain kosong
    ]
    return random.choice(strategies)(real_email)


def random_date_in_range(start: datetime, end: datetime) -> datetime:
    """Random datetime antara start dan end."""
    delta = end - start
    random_seconds = random.randint(0, int(delta.total_seconds()))
    return start + timedelta(seconds=random_seconds)


# =============================================================
# STEP 1 — GENERATE CUSTOMERS
# =============================================================


def generate_customers() -> list[dict]:
    """
    Generate ~N_CUSTOMERS customers dengan data realistis Indonesia.
    Termasuk dirty data: email invalid, duplikat customer_id.
    """
    log.info(f"📋 Generating {N_CUSTOMERS} customers ...")

    CITIES = [
        "Jakarta",
        "Bandung",
        "Surabaya",
        "Medan",
        "Semarang",
        "Makassar",
        "Palembang",
        "Tangerang",
        "Depok",
        "Bekasi",
        "Bogor",
        "Yogyakarta",
        "Malang",
        "Solo",
        "Batam",
    ]
    SEGMENTS = ["regular", "regular", "regular", "vip", "premium"]  # weighted

    customers = []
    used_ids = set()

    for i in range(1, N_CUSTOMERS + 1):
        cust_id = f"CUST{i:05d}"

        # Dirty: duplikat customer_id (pakai ID yang sudah ada)
        if should_dirty("duplicate_customer") and used_ids:
            cust_id = random.choice(list(used_ids))

        email = fake.email()

        # Dirty: email invalid
        if should_dirty("invalid_email"):
            email = make_invalid_email(email)

        # Signup date antara 2 tahun lalu s/d hari ini
        signup = random_date_in_range(
            datetime.now() - timedelta(days=730),
            datetime.now(),
        ).strftime("%Y-%m-%d")

        customers.append(
            {
                "customer_id": cust_id,
                "full_name": fake.name(),
                "email": email,
                "city": random.choice(CITIES),
                "signup_date": signup,
                "segment": random.choice(SEGMENTS),
                "phone": fake.phone_number(),  # kolom bonus
                "gender": random.choice(["M", "F", None]),  # ada null gender
            }
        )
        used_ids.add(cust_id)

    # Shuffle biar urutan gak monoton
    random.shuffle(customers)
    log.info(f"  → {len(customers)} customers generated")
    return customers


def save_customers_csv(customers: list[dict]) -> Path:
    """Simpan customers ke CSV di data/raw/customers/."""
    CUST_DIR.mkdir(parents=True, exist_ok=True)
    filepath = CUST_DIR / f"customers_{RUN_DATE}.csv"

    fieldnames = [
        "customer_id",
        "full_name",
        "email",
        "city",
        "signup_date",
        "segment",
        "phone",
        "gender",
    ]

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(customers)

    log.info(f"  ✅ Saved → {filepath}")
    return filepath


# =============================================================
# STEP 2 — GENERATE PRODUCTS
# =============================================================


def generate_products() -> list[dict]:
    """
    Generate ~N_PRODUCTS products dengan kategori Indonesia-realistic.
    Termasuk dirty data: harga 0, stok negatif.
    """
    log.info(f"📦 Generating {N_PRODUCTS} products ...")

    CATEGORIES = {
        "Fashion": (25_000, 500_000, 0.55),  # (min_price, max_price, margin)
        "Sports": (50_000, 1_500_000, 0.45),
        "Elektronik": (75_000, 5_000_000, 0.35),
        "Kecantikan": (30_000, 300_000, 0.60),
        "Makanan": (10_000, 150_000, 0.40),
        "Rumah Tangga": (20_000, 800_000, 0.50),
        "Olahraga": (40_000, 2_000_000, 0.42),
        "Buku": (35_000, 200_000, 0.30),
    }

    PRODUCT_TEMPLATES = {
        "Fashion": [
            "Kaos Polos",
            "Celana Jeans",
            "Kemeja Flanel",
            "Rok Mini",
            "Jaket Hoodie",
            "Dress Batik",
            "Sandal Kulit",
            "Topi Snapback",
        ],
        "Sports": [
            "Sepatu Lari",
            "Raket Badminton",
            "Bola Futsal",
            "Matras Yoga",
            "Dumbbell Set",
            "Sepeda Lipat",
            "Jersey Olahraga",
            "Helm Sepeda",
        ],
        "Elektronik": [
            "Blender Mini",
            "Rice Cooker",
            "Earphone Wireless",
            "Power Bank",
            "Lampu LED",
            "Fan USB",
            "Charger Fast",
            "Smart Watch",
        ],
        "Kecantikan": [
            "Serum Vitamin C",
            "Sunscreen SPF50",
            "Lip Balm",
            "Masker Wajah",
            "Foundation Matte",
            "Parfum Lokal",
            "Body Lotion",
            "Toner Korea",
        ],
        "Makanan": [
            "Mie Instan Box",
            "Kopi Sachet",
            "Snack Pedas",
            "Teh Kotak",
            "Cokelat Premium",
            "Kerupuk Udang",
            "Granola Bar",
            "Susu UHT",
        ],
        "Rumah Tangga": [
            "Sapu Lantai",
            "Ember Plastik",
            "Gelas Tumbler",
            "Rak Sepatu",
            "Bantal Tidur",
            "Handuk Cotton",
            "Talenan Kayu",
            "Tempat Sabun",
        ],
        "Olahraga": [
            "Gloves Boxing",
            "Jump Rope",
            "Resistance Band",
            "Gym Bag",
            "Knee Support",
            "Bottle Infuser",
            "Sports Bra",
            "Sepatu Futsal",
        ],
        "Buku": [
            "Novel Terjemahan",
            "Buku Self-Help",
            "Komik Manga",
            "Buku Resep",
            "Buku Coding",
            "Agenda Bulanan",
            "Atlas Dunia",
            "Buku Anak",
        ],
    }

    products = []
    used_skus = set()

    for i in range(1, N_PRODUCTS + 1):
        prod_id = f"PROD{i:04d}"
        category = random.choice(list(CATEGORIES.keys()))
        min_p, max_p, margin = CATEGORIES[category]

        # Harga kelipatan 1000 (realistis Indonesia)
        price = round(random.randint(min_p // 1000, max_p // 1000) * 1000)
        cost = round(price * (1 - margin) * random.uniform(0.8, 1.0) / 1000) * 1000

        # Dirty: harga 0 (simulasi data entry error)
        if should_dirty("zero_price"):
            price = 0
            cost = 0

        # SKU unik
        sku = f"SKU-{category[:3].upper()}-{i:04d}"
        while sku in used_skus:
            sku = f"SKU-{category[:3].upper()}-{i:04d}-{random.randint(1, 9)}"
        used_skus.add(sku)

        template = random.choice(PRODUCT_TEMPLATES[category])
        variants = [
            "Hitam",
            "Putih",
            "Merah",
            "Biru",
            "Hijau",
            "Abu-abu",
            "XS",
            "S",
            "M",
            "L",
            "XL",
            "500ml",
            "1L",
            "Mini",
            "Pro",
        ]

        products.append(
            {
                "product_id": prod_id,
                "sku": sku,
                "product_name": f"{template} {random.choice(variants)}",
                "category": category,
                "price": price,
                "cost": cost,
                "stock_qty": random.randint(-5, 500),  # ada stok negatif (dirty)
                "weight_gram": random.choice(
                    [100, 200, 300, 500, 750, 1000, 1500, 2000]
                ),
                "is_active": random.choices([True, False], weights=[90, 10])[0],
            }
        )

    log.info(f"  → {len(products)} products generated")
    return products


def save_products_csv(products: list[dict]) -> Path:
    """Simpan products ke CSV di data/raw/products/."""
    PROD_DIR.mkdir(parents=True, exist_ok=True)
    filepath = PROD_DIR / f"products_{RUN_DATE}.csv"

    fieldnames = [
        "product_id",
        "sku",
        "product_name",
        "category",
        "price",
        "cost",
        "stock_qty",
        "weight_gram",
        "is_active",
    ]

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(products)

    log.info(f"  ✅ Saved → {filepath}")
    return filepath


# =============================================================
# STEP 3 — GENERATE ORDERS & INSERT KE MONGODB
# =============================================================


def generate_orders(
    valid_customer_ids: list[str],
    valid_product_ids: list[str],
) -> list[dict]:
    """
    Generate ~N_ORDERS orders dengan items array.
    Dirty data: customer_id orphan, duplicate order_id, null status,
                item qty negatif, item price 0.
    """
    log.info(f"🛒 Generating {N_ORDERS} orders ...")

    STATUSES = [
        "completed",
        "completed",
        "completed",
        "processing",
        "cancelled",
        "pending",
    ]
    PAYMENT_METHODS = ["e-wallet", "transfer bank", "kartu kredit", "COD", "paylater"]
    CHANNELS = ["mobile_app", "website", "marketplace"]

    end_date = datetime.now(tz=timezone.utc)
    start_date = end_date - timedelta(days=N_DAYS)

    orders = []
    used_order_ids = set()

    for i in range(1, N_ORDERS + 1):
        order_id = f"ORD{i:06d}"

        # Dirty: duplicate order_id
        if should_dirty("duplicate_order") and used_order_ids:
            order_id = random.choice(list(used_order_ids))

        # Customer ID — mostly valid, sesekali orphan
        if should_dirty("orphan_customer_id"):
            # Pakai customer_id yang tidak ada di master customers
            customer_id = f"CUST{random.randint(99000, 99999):05d}"
        else:
            customer_id = random.choice(valid_customer_ids)

        # Status — mostly valid, sesekali null (dirty)
        status = None if should_dirty("null_status") else random.choice(STATUSES)

        # Generate 1-5 items per order
        n_items = random.choices([1, 2, 3, 4, 5], weights=[30, 35, 20, 10, 5])[0]
        selected_products = random.sample(
            valid_product_ids, min(n_items, len(valid_product_ids))
        )

        items = []
        for prod_id in selected_products:
            qty = random.randint(1, 10)
            unit_price = random.choice(
                [75_000, 100_000, 150_000, 200_000, 250_000, 300_000, 350_000, 500_000]
            )
            discount = random.choices(
                [0, 5_000, 10_000, 20_000, 50_000], weights=[50, 20, 15, 10, 5]
            )[0]

            # Dirty: qty negatif
            if should_dirty("negative_qty"):
                qty = random.randint(-5, -1)

            # Dirty: unit_price = 0
            if should_dirty("zero_price"):
                unit_price = 0

            items.append(
                {
                    "product_id": prod_id,
                    "qty": qty,
                    "unit_price": float(unit_price),
                    "discount": float(discount),
                    "subtotal": float(max(0, (unit_price - discount) * qty)),
                }
            )

        order_date = random_date_in_range(start_date, end_date)

        orders.append(
            {
                "order_id": order_id,
                "customer_id": customer_id,
                "order_date": order_date.isoformat(),
                "status": status,
                "payment_method": random.choice(PAYMENT_METHODS),
                "channel": random.choice(CHANNELS),
                "items": items,
                "total_amount": float(sum(item["subtotal"] for item in items)),
                "_generated_at": datetime.now(tz=timezone.utc).isoformat(),  # metadata
            }
        )
        used_order_ids.add(order_id)

    log.info(f"  → {len(orders)} orders generated")
    return orders


def insert_orders_to_mongo(orders: list[dict]) -> dict:
    """
    Insert orders ke MongoDB.
    Return summary stats.
    """
    log.info(f"🍃 Connecting to MongoDB: {MONGO_URI.split('@')[-1]} ...")

    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3_000)
        client.admin.command("ping")  # test connection
        log.info("  → Connected!")
    except Exception:
        try:
            host = os.getenv("MONGO_HOST", "mongo_orders")
            port = os.getenv("MONGO_PORT", "27017")
            client = MongoClient(
                f"mongodb://{host}:{port}", serverSelectionTimeoutMS=10_000
            )
            client.admin.command("ping")
            log.info("  → Connected (unauth fallback)!")
        except Exception as inner_e:
            log.error(f"  ❌ Gagal connect ke MongoDB: {inner_e}")
            log.error("     Pastikan container byk_mongo_orders sudah running.")
            raise

    db = client[MONGO_DB]
    collection = db[MONGO_COLLECTION]

    # Reset collection agar idempotent & hapus unique index lama jika ada
    collection.drop()
    log.info("  → Collection di-reset.")

    # Buat index non-unique untuk performa query extract
    collection.create_index([("order_id", 1)])
    collection.create_index([("customer_id", 1)])
    collection.create_index([("order_date", 1)])

    # Batch insert untuk performa (1000 per batch)
    BATCH_SIZE = 1_000
    total_inserted = 0

    for i in range(0, len(orders), BATCH_SIZE):
        batch = orders[i : i + BATCH_SIZE]
        try:
            result = collection.insert_many(batch, ordered=False)
            total_inserted += len(result.inserted_ids)
        except mongo_errors.BulkWriteError as bwe:
            total_inserted += bwe.details.get("nInserted", 0)

        progress = min(i + BATCH_SIZE, len(orders))
        log.info(f"  → Inserted {progress:,}/{len(orders):,} orders ...")

    client.close()

    log.info(f"  ✅ Total inserted: {total_inserted:,} documents")
    return {"total_inserted": total_inserted}


# =============================================================
# STEP 4 — GENERATE SUMMARY REPORT
# =============================================================


def print_summary(customers, products, orders, mongo_result):
    """Print ringkasan statistik data yang di-generate."""

    # Hitung dirty data
    invalid_emails = sum(
        1 for c in customers if "@@" in c["email"] or "@" not in c["email"]
    )
    zero_price_prod = sum(1 for p in products if p["price"] == 0)
    neg_stock_prod = sum(1 for p in products if p["stock_qty"] < 0)
    orphan_orders = sum(1 for o in orders if o["customer_id"].startswith("CUST9"))
    null_status_ord = sum(1 for o in orders if o["status"] is None)
    dup_order_ids = len(orders) - len({o["order_id"] for o in orders})

    print("\n" + "=" * 60)
    print("📊 DATA GENERATION SUMMARY")
    print("=" * 60)
    print(
        f"  Customers  : {len(customers):,} rows → data/raw/customers/customers_{RUN_DATE}.csv"
    )
    print(
        f"  Products   : {len(products):,} rows → data/raw/products/products_{RUN_DATE}.csv"
    )
    print(
        f"  Orders     : {mongo_result['total_inserted']:,} docs → MongoDB ({MONGO_DB}.orders)"
    )
    print()
    print("🦠 DIRTY DATA YANG DISENGAJA:")
    print(f"  Customers — email invalid        : {invalid_emails:,}")
    print(f"  Products  — harga = 0            : {zero_price_prod:,}")
    print(f"  Products  — stok negatif         : {neg_stock_prod:,}")
    print(f"  Orders    — customer_id orphan   : {orphan_orders:,}")
    print(f"  Orders    — status null          : {null_status_ord:,}")
    print(f"  Orders    — order_id duplikat    : {dup_order_ids:,}")
    print()
    print("✅ Data siap! Pipeline Airflow bisa dijalankan.")
    print("=" * 60)


# =============================================================
# MAIN
# =============================================================


def main():
    log.info("🚀 Belanja Yuk — Data Generator starting ...")
    log.info(f"   Run date : {RUN_DATE}")
    log.info("   Faker seed: 42 (reproducible)")
    print()

    # 1. Generate & save customers
    customers = generate_customers()
    save_customers_csv(customers)
    print()

    # 2. Generate & save products
    products = generate_products()
    save_products_csv(products)
    print()

    # 3. Generate orders (pakai valid IDs dari customers & products)
    valid_cust_ids = [c["customer_id"] for c in customers]
    valid_prod_ids = [p["product_id"] for p in products]

    orders = generate_orders(valid_cust_ids, valid_prod_ids)
    mongo_result = insert_orders_to_mongo(orders)
    print()

    # 4. Summary
    print_summary(customers, products, orders, mongo_result)


if __name__ == "__main__":
    main()
