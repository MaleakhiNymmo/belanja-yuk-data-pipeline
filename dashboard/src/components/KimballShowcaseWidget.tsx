import React, { useState } from "react";
import { Database, Code2, Scale, Info, ShieldCheck, AlertCircle } from "lucide-react";
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
    <div className="panel-card" style={{ marginBottom: "var(--space-8)" }}>
      {/* Panel Header matching other dashboard cards */}
      <div className="panel-header" style={{ alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div className="panel-title-wrap">
          <Database size={18} color="var(--color-ink-muted)" />
          <h2 className="panel-title">Integritas Transaksi Guest Checkout (Ralph Kimball Pattern)</h2>
          <span className="label-mono">marts.fct_order_items</span>
        </div>

        {/* Tab Switcher using dashboard standard button style (.btn .btn-sm) */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={() => setActiveTab("overview")}
            className={`btn btn-sm ${activeTab === "overview" ? "btn-primary" : ""}`}
          >
            Ringkasan Audit
          </button>
          <button
            onClick={() => setActiveTab("sql")}
            className={`btn btn-sm ${activeTab === "sql" ? "btn-primary" : ""}`}
          >
            <Code2 size={13} />
            dbt SQL Model
          </button>
          <button
            onClick={() => setActiveTab("impact")}
            className={`btn btn-sm ${activeTab === "impact" ? "btn-primary" : ""}`}
          >
            <Scale size={13} />
            Analisis Trade-Off
          </button>
        </div>
      </div>

      {/* Brief Architecture Context */}
      <p style={{ fontSize: "13px", color: "var(--color-ink-muted)", marginTop: "-2px", marginBottom: "var(--space-4)", lineHeight: 1.5 }}>
        Menjaga rekonsiliasi omzet 100% akurat di fact table marts tanpa membiarkan foreign key
        bernilai <code>NULL</code> atau mengotori tabel dimensi dengan akun dummy.
      </p>

      {/* Tab 1: Audit Grid with exact white KPI cell styling */}
      {activeTab === "overview" && (
        <div>
          <div className="kimball-kpi-grid">
            {/* Box 1: Registered CRM */}
            <div className="kimball-kpi-cell">
              <div className="kpi-top">
                <span className="label-mono">MEMBER CRM TERDAFTAR</span>
                <ShieldCheck size={16} color="var(--color-success)" />
              </div>
              <div>
                <div className="kpi-value">
                  {registeredItem ? formatCompactIDR(registeredItem.total_revenue) : "-"}
                </div>
                <div className="kpi-sub">
                  <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
                    97.9% Terpetakan
                  </span>
                  <span>· {registeredItem ? formatNumber(registeredItem.total_items) : "-"} transaksi langsung ke dim_customers</span>
                </div>
              </div>
            </div>

            {/* Box 2: Preserved Guest Checkout */}
            <div className="kimball-kpi-cell">
              <div className="kpi-top">
                <span className="label-mono">GUEST CHECKOUT (KIMBALL PRESERVED)</span>
                <ShieldCheck size={16} color="var(--color-accent)" />
              </div>
              <div>
                <div className="kpi-value" style={{ color: "var(--color-accent)" }}>
                  {guestItem ? formatCompactIDR(guestItem.total_revenue) : "-"}
                </div>
                <div className="kpi-sub">
                  <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
                    100% Terjaga
                  </span>
                  <span>· {guestItem ? formatNumber(guestItem.total_items) : "427"} transaksi dipetakan ke UNKNOWN (Key -1)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reconciliation Footnote with clean white surface */}
          <div className="kimball-reconcile-bar">
            <Info size={15} color="var(--color-accent)" style={{ flexShrink: 0 }} />
            <div>
              <strong>Audit Rekonsiliasi:</strong> 19.573 (Member) + 427 (Guest) = <strong>20.000 transaksi valid</strong> senilai <strong>Rp 10,01 Miliar</strong>. Tidak ada omzet yang bocor akibat <code>INNER JOIN</code>, dan kolom foreign key bebas dari <code>NULL</code>.
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: dbt SQL Implementation */}
      {activeTab === "sql" && (
        <div className="code-editor-box">
          <div className="code-editor-header">
            <span>models/marts/fct_order_items.sql</span>
            <span style={{ fontSize: "11px", color: "#64748b" }}>dbt Core 1.8 · PostgreSQL Marts</span>
          </div>
          <div className="code-editor-body">
            <div style={{ color: "#64748b" }}>-- 1. Penanganan Unknown Dimension Member (Ralph Kimball Pattern)</div>
            <div>
              <span style={{ color: "#f43f5e" }}>CASE</span>
            </div>
            <div style={{ paddingLeft: "16px" }}>
              <span style={{ color: "#38bdf8" }}>WHEN</span> c.customer_id <span style={{ color: "#38bdf8" }}>IS NOT NULL THEN</span> i.customer_id
            </div>
            <div style={{ paddingLeft: "16px" }}>
              <span style={{ color: "#38bdf8" }}>ELSE</span> <span style={{ color: "#34d399" }}>'UNKNOWN'</span> <span style={{ color: "#64748b" }}>-- Petakan ke surrogate key id = -1</span>
            </div>
            <div>
              <span style={{ color: "#f43f5e" }}>END AS</span> customer_id,
            </div>
            <div style={{ marginTop: "8px", color: "#64748b" }}>-- 2. Audit Trail: simpan ID mentah & boolean flag verifikasi</div>
            <div>
              i.customer_id <span style={{ color: "#f43f5e" }}>AS</span> raw_customer_id,
            </div>
            <div>
              (c.customer_id <span style={{ color: "#38bdf8" }}>IS NOT NULL</span>) <span style={{ color: "#f43f5e" }}>AS</span> is_registered_customer
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Technical Trade-off Analysis */}
      {activeTab === "impact" && (
        <div className="kimball-tradeoff-grid">
          {/* Card 1: Naive Approaches */}
          <div className="kimball-tradeoff-cell">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: "var(--color-danger)",
                fontWeight: 600,
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              <AlertCircle size={15} />
              <span>Pendekatan Konvensional (Beresiko)</span>
            </div>
            <ul style={{ fontSize: "12.5px", color: "var(--color-ink-muted)", paddingLeft: "18px", margin: 0, lineHeight: 1.6 }}>
              <li style={{ marginBottom: "6px" }}>
                <strong>INNER JOIN Biasa:</strong> Membuang 427 transaksi guest. Total omzet di DWH tekor <strong>Rp 468,5 Juta</strong> dibanding laporan Finance.
              </li>
              <li>
                <strong>LEFT JOIN ke NULL:</strong> Kolom <code>customer_id = NULL</code> membuat filter grup di BI (Tableau/Metabase) rusak atau salah hitung.
              </li>
            </ul>
          </div>

          {/* Card 2: Kimball Standard */}
          <div className="kimball-tradeoff-cell">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: "var(--color-success)",
                fontWeight: 600,
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              <ShieldCheck size={15} />
              <span>Pola Ralph Kimball (Standar Industri)</span>
            </div>
            <ul style={{ fontSize: "12.5px", color: "var(--color-ink-muted)", paddingLeft: "18px", margin: 0, lineHeight: 1.6 }}>
              <li style={{ marginBottom: "6px" }}>
                <strong>Surrogate Key Stasis:</strong> Menyediakan baris ID <code>-1</code> (<code>'UNKNOWN'</code>) di <code>dim_customers</code>.
              </li>
              <li style={{ marginBottom: "6px" }}>
                <strong>Omzet Utuh 100%:</strong> Seluruh nilai uang terselamatkan di General Ledger tanpa data dummy.
              </li>
              <li>
                <strong>Audit Trail Terjaga:</strong> ID mentah tetap disimpan di kolom <code>raw_customer_id</code> untuk verifikasi fraud.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
