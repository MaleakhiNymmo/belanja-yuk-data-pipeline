import React from "react";
import { Users } from "lucide-react";
import { CustomerTierItem } from "../types";
import { formatCompactIDR, formatNumber } from "../utils/format";

interface CustomerTierBreakdownProps {
  tiers: CustomerTierItem[];
}

export const CustomerTierBreakdown: React.FC<CustomerTierBreakdownProps> = ({
  tiers,
}) => {
  const totalCustomers = tiers.reduce((acc, t) => acc + t.customer_count, 0);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "Platinum":
        return "#a855f7";
      case "Gold":
        return "#eab308";
      case "Silver":
        return "#94a3b8";
      case "Bronze":
        return "#b45309";
      default:
        return "var(--color-accent)";
    }
  };

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <h2 className="panel-title">Segmentasi Pelanggan</h2>
          <span className="label-mono">dim_customers</span>
        </div>
        <Users size={16} color="var(--color-ink-muted)" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {tiers.map((t, idx) => {
          const pct = ((t.customer_count / totalCustomers) * 100).toFixed(1);
          const barColor = getTierColor(t.customer_tier);

          return (
            <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: barColor,
                    }}
                  />
                  {t.customer_tier}
                </span>
                <span className="font-mono" style={{ color: "var(--color-ink-muted)" }}>
                  {formatNumber(t.customer_count)} ({pct}%)
                </span>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  height: "6px",
                  backgroundColor: "var(--color-paper-subtle)",
                  borderRadius: "3px",
                  overflow: "hidden",
                  border: "1px solid var(--color-rule-faint)",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    backgroundColor: barColor,
                    borderRadius: "3px",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--color-ink-muted)" }}>
                <span>Total Net Spend:</span>
                <span className="font-mono" style={{ fontWeight: 500 }}>
                  {formatCompactIDR(t.total_net_spend)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
