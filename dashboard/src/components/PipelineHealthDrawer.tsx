import React, { useEffect } from "react";
import { X, CheckCircle2, Server, Terminal } from "lucide-react";
import { PipelineMetadata } from "../types";

interface PipelineHealthDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: PipelineMetadata;
}

export const PipelineHealthDrawer: React.FC<PipelineHealthDrawerProps> = ({
  isOpen,
  onClose,
  metadata,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--color-paper-surface)",
          border: "1px solid var(--color-rule)",
          borderRadius: "var(--radius-lg)",
          width: "100%",
          maxWidth: "720px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "var(--shadow-elevated)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--color-rule)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Server size={18} color="var(--color-accent)" />
            <div>
              <h2 style={{ fontSize: "17px", fontWeight: 700 }}>
                Status Infrastruktur & Quality Gate Pipeline
              </h2>
              <span className="label-mono">{metadata.dag_name}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-sm"
            style={{ padding: "4px 8px" }}
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Metadata Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              backgroundColor: "var(--color-paper-subtle)",
              padding: "16px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-rule-faint)",
              fontSize: "13px",
            }}
          >
            <div>
              <div className="label-mono" style={{ marginBottom: "2px" }}>Orchestration Engine</div>
              <div style={{ fontWeight: 600 }}>{metadata.orchestrator}</div>
            </div>
            <div>
              <div className="label-mono" style={{ marginBottom: "2px" }}>Data Warehouse</div>
              <div style={{ fontWeight: 600 }}>{metadata.dwh}</div>
            </div>
            <div>
              <div className="label-mono" style={{ marginBottom: "2px" }}>Transformation Engine</div>
              <div style={{ fontWeight: 600 }}>{metadata.transform_engine}</div>
            </div>
            <div>
              <div className="label-mono" style={{ marginBottom: "2px" }}>Quality Gate Status</div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--color-success)", fontWeight: 700 }}>
                <CheckCircle2 size={14} />
                <span>{metadata.quality_gate_status}</span>
              </div>
            </div>
          </div>

          {/* Airflow 3 Task Flow Breakdown */}
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Terminal size={15} color="var(--color-ink-muted)" />
              Urutan Eksekusi Master Pipeline (Semua Hijau / Success)
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
              {[
                { step: "1. Sensors", desc: "Verifikasi kehadiran file customers & products di landing zone", time: "10s poke" },
                { step: "2. Branching", desc: "Cek ukuran file (> 0 bytes) untuk mencegah proses file kosong", time: "Instant" },
                { step: "3. TaskGroup: EL", desc: "Extract paralel CRM (CSV), Inventory (CSV), dan MongoDB NoSQL (JSONB)", time: "1m 12s" },
                { step: "4. Quality Gate", desc: "Verifikasi record count di skema PostgreSQL raw > 0", time: "2s" },
                { step: "5. TaskGroup: dbt", desc: "Sekuensial staging -> intermediate -> marts -> 19 dbt data tests", time: "2m 45s" },
                { step: "6. Summary Log", desc: "Ekstraksi ringkasan omzet, laba, dan metrik bisnis ke log Airflow", time: "3s" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    backgroundColor: "var(--color-paper-surface)",
                    border: "1px solid var(--color-rule)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <CheckCircle2 size={15} color="var(--color-success)" />
                    <span style={{ fontWeight: 600 }}>{item.step}:</span>
                    <span style={{ color: "var(--color-ink-muted)" }}>{item.desc}</span>
                  </div>
                  <span className="label-mono">{item.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Test Coverage Summary */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 18px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: "var(--color-success)" }}>
                30 Automated Test Suites — 100% Passed
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-ink-muted)", marginTop: "2px" }}>
                19 dbt schema/referential data tests + 11 Pytest unit & DagBag tests.
              </div>
            </div>
            <span className="badge-stock healthy">CI/CD Green</span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--color-rule)",
            display: "flex",
            justifyContent: "flex-end",
            backgroundColor: "var(--color-paper-subtle)",
          }}
        >
          <button onClick={onClose} className="btn btn-primary btn-sm">
            Tutup Panel
          </button>
        </div>
      </div>
    </div>
  );
};
