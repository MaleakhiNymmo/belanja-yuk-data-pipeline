import React, { useState } from "react";
import { ShieldCheck, AlertTriangle, Code2, Check } from "lucide-react";
import { KimballAuditItem } from "../types";
import { formatCompactIDR, formatNumber } from "../utils/format";

interface KimballShowcaseWidgetProps {
  audit: KimballAuditItem[];
}

export const KimballShowcaseWidget: React.FC<KimballShowcaseWidgetProps> = ({
  audit,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "sql" | "impact">("overview");

  const guestItem = audit.find((a) => !a.is_registered_customer) || audit[1];
  const registeredItem = audit.find((a) => a.is_registered_customer) || audit[0];

  return (
    <section className="kimball-spotlight-band">
      <div className="kimball-header">
        <div>
          <div className="kimball-title-badge">
            <ShieldCheck size={13} />
            <span>Key Architectural Decision · Ralph Kimball Pattern</span>
          </div>
          <h2 style={{ fontSize: "24px", color: "white", marginBottom: "6px" }}>
            Penyelamatan Omzet: Kimball Unknown Dimension Member
          </h2>
          <p style={{ color: "var(--color-graphite-muted)", fontSize: "14px", maxWidth: "780px" }}>
            Mencegah hilangnya transaksi guest checkout dan foreign key orphan tanpa mengotori tabel dimensi dengan data sampah.
          </p>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => setActiveTab("overview")}
            className="btn btn-sm"
            style={{
              backgroundColor: activeTab === "overview" ? "var(--color-accent)" : "rgba(255,255,255,0.08)",
              color: "white",
              borderColor: activeTab === "overview" ? "var(--color-accent)" : "rgba(255,255,255,0.15)",
            }}
          >
            Audit Matrix
          </button>
          <button
            onClick={() => setActiveTab("sql")}
            className="btn btn-sm"
            style={{
              backgroundColor: activeTab === "sql" ? "var(--color-accent)" : "rgba(255,255,255,0.08)",
              color: "white",
              borderColor: activeTab === "sql" ? "var(--color-accent)" : "rgba(255,255,255,0.15)",
            }}
          >
            <Code2 size={13} />
            dbt SQL Solution
          </button>
          <button
            onClick={() => setActiveTab("impact")}
            className="btn btn-sm"
            style={{
              backgroundColor: activeTab === "impact" ? "var(--color-accent)" : "rgba(255,255,255,0.08)",
              color: "white",
              borderColor: activeTab === "impact" ? "var(--color-accent)" : "rgba(255,255,255,0.15)",
            }}
          >
            Business Trade-Off
          </button>
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="kimball-grid">
          {/* Box 1: Registered CRM */}
          <div className="kimball-box">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="label-mono" style={{ color: "var(--color-graphite-muted)" }}>
                CRM Registered Customers
              </span>
              <span className="status-pill success" style={{ padding: "2px 8px" }}>
                Normal Join
              </span>
            </div>
            <div className="kimball-stat-val">
              {registeredItem ? formatCompactIDR(registeredItem.total_revenue) : "-"}
            </div>
            <p style={{ color: "var(--color-graphite-muted)", fontSize: "13px" }}>
              {registeredItem ? formatNumber(registeredItem.total_items) : "-"} item pesanan dari pelanggan terdaftar di CRM master.
            </p>
          </div>

          {/* Box 2: Preserved Unknown */}
          <div className="kimball-box" style={{ borderColor: "#38bdf8", backgroundColor: "rgba(56, 189, 248, 0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="label-mono" style={{ color: "#38bdf8" }}>
                Guest Checkout (Terselamatkan)
              </span>
              <span className="status-pill accent" style={{ padding: "2px 8px" }}>
                100% Preserved
              </span>
            </div>
            <div className="kimball-stat-val" style={{ color: "#38bdf8" }}>
              {guestItem ? formatCompactIDR(guestItem.total_revenue) : "-"}
            </div>
            <p style={{ color: "var(--color-graphite-muted)", fontSize: "13px" }}>
              <strong>{guestItem ? formatNumber(guestItem.total_items) : "427"} item</strong> transaksi tanpa akun CRM dipetakan ke <code>UNKNOWN</code>. Omzet 100% terjaga di General Ledger.
            </p>
          </div>
        </div>
      )}

      {activeTab === "sql" && (
        <div
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            border: "1px solid var(--color-graphite-rule)",
            borderRadius: "8px",
            padding: "16px",
            fontFamily: "var(--font-mono)",
            fontSize: "12.5px",
            lineHeight: 1.6,
            color: "#e2e8f0",
            overflowX: "auto",
          }}
        >
          <div style={{ color: "#94a3b8", marginBottom: "8px" }}>
            -- dbt/belanja_yuk/models/marts/fact_order_items.sql
          </div>
          <div>
            <span style={{ color: "#f472b6" }}>CASE</span>
          </div>
          <div style={{ paddingLeft: "16px" }}>
            <span style={{ color: "#38bdf8" }}>WHEN</span> c.customer_id <span style={{ color: "#38bdf8" }}>IS NOT NULL THEN</span> i.customer_id
          </div>
          <div style={{ paddingLeft: "16px" }}>
            <span style={{ color: "#38bdf8" }}>ELSE</span> <span style={{ color: "#a7f3d0" }}>'UNKNOWN'</span> <span style={{ color: "#94a3b8" }}>-- Kimball Unknown Dimension Member</span>
          </div>
          <div>
            <span style={{ color: "#f472b6" }}>END AS</span> customer_id,
          </div>
          <div style={{ marginTop: "6px" }}>
            i.customer_id <span style={{ color: "#f472b6" }}>AS</span> raw_customer_id, <span style={{ color: "#94a3b8" }}>-- Pertahankan original NoSQL ID untuk audit trail</span>
          </div>
          <div>
            (c.customer_id <span style={{ color: "#38bdf8" }}>IS NOT NULL</span>) <span style={{ color: "#f472b6" }}>AS</span> is_registered_customer
          </div>
        </div>
      )}

      {activeTab === "impact" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div
            style={{
              padding: "14px",
              borderRadius: "6px",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f87171", fontWeight: 600, marginBottom: "6px" }}>
              <AlertTriangle size={15} />
              <span>Jika Menggunakan Pendekatan Naif:</span>
            </div>
            <ul style={{ fontSize: "12.5px", color: "var(--color-graphite-muted)", paddingLeft: "16px", lineHeight: 1.6 }}>
              <li><strong>Discard Orphan:</strong> Menghapus baris transaksi tanpa CRM = Omzet di data warehouse tekor ratusan juta rupiah dibanding rekening riil bank/pembukuan Finance.</li>
              <li><strong>Dynamic Dummy User:</strong> Otomatis membuat profil user baru = Tabel dimensi kotor oleh ribuan entitas hantu (ghost users) dan memicu race condition.</li>
            </ul>
          </div>

          <div
            style={{
              padding: "14px",
              borderRadius: "6px",
              backgroundColor: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#4ade80", fontWeight: 600, marginBottom: "6px" }}>
              <Check size={15} />
              <span>Solusi Arsitektural Ralph Kimball:</span>
            </div>
            <ul style={{ fontSize: "12.5px", color: "var(--color-graphite-muted)", paddingLeft: "16px", lineHeight: 1.6 }}>
              <li>Disediakan tepat <strong>1 baris statis 'UNKNOWN'</strong> di <code>dim_customers</code>.</li>
              <li>Tabel fakta mengarahkan foreign key ke 'UNKNOWN' dan menyimpan ID mentah di kolom <code>raw_customer_id</code>.</li>
              <li><strong>100% data transaksi dan nominal uang selamat</strong>, relasi join integritas terjaga.</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
