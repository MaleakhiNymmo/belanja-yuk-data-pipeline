// ============================================================
// MongoDB Init Script — Belanja Yuk Orders
// Dijalankan otomatis saat container mongo_orders pertama start
// ============================================================

db = db.getSiblingDB("belanja_yuk_orders");

// Buat collection dengan JSON Schema validation
// (biar ada "dirty data" bisa kita sengaja bypass validator)
db.createCollection("orders", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["order_id", "customer_id", "order_date", "status", "items"],
      properties: {
        order_id:       { bsonType: "string" },
        customer_id:    { bsonType: "string" },
        order_date:     { bsonType: "string" },
        status:         { bsonType: "string", enum: ["pending", "processing", "completed", "cancelled"] },
        payment_method: { bsonType: "string" },
        items: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["product_id", "qty", "unit_price"],
            properties: {
              product_id: { bsonType: "string" },
              qty:        { bsonType: "int" },
              unit_price: { bsonType: "double" },
              discount:   { bsonType: "double" }
            }
          }
        }
      }
    }
  },
  validationAction: "warn"   // warn, bukan error — biar dirty data tetap masuk
});

// Index untuk performa query Airflow
db.orders.createIndex({ order_id: 1 }, { unique: true });
db.orders.createIndex({ customer_id: 1 });
db.orders.createIndex({ order_date: 1 });
db.orders.createIndex({ status: 1 });

print("✅ MongoDB belanja_yuk_orders initialized — collection 'orders' ready.");
