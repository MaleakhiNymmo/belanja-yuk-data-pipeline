import React from "react";
import { TrendingUp, DollarSign, ShoppingBag, ShieldCheck } from "lucide-react";
import { DashboardSummary } from "../types";
import { formatCompactIDR, formatIDR, formatNumber } from "../utils/format";

interface KpiGridProps {
  summary: DashboardSummary;
  isFiltered?: boolean;
  filterLabel?: string;
}

export const KpiGrid: React.FC<KpiGridProps> = ({
  summary,
  isFiltered = false,
  filterLabel = "90D",
}) => {
  const fulfillmentRate =
    summary.total_orders > 0
      ? ((summary.total_completed_orders / summary.total_orders) * 100).toFixed(1)
      : "0.0";

  return (
    <section className="kpi-grid">
      {/* 1. Gross Revenue */}
      <div className="kpi-cell">
        <div className="kpi-top">
          <span className="label-mono">
            Gross Revenue ({filterLabel})
            {isFiltered && (
              <span style={{ color: "var(--color-accent)", marginLeft: "4px" }}>
                ●
              </span>
            )}
          </span>
          <DollarSign size={16} color="var(--color-accent)" />
        </div>
        <div>
          <div key={`${filterLabel}-${summary.total_gross_revenue}`} className="kpi-value kpi-animated-val">
            {formatCompactIDR(summary.total_gross_revenue)}
          </div>
          <div className="kpi-sub">
            <span>{formatIDR(summary.total_gross_revenue)}</span>
          </div>
        </div>
      </div>

      {/* 2. Net Profit */}
      <div className="kpi-cell">
        <div className="kpi-top">
          <span className="label-mono">Net Profit (Post-COGS)</span>
          <TrendingUp size={16} color="var(--color-success)" />
        </div>
        <div>
          <div key={`${filterLabel}-${summary.total_net_profit}`} className="kpi-value kpi-animated-val">
            {formatCompactIDR(summary.total_net_profit)}
          </div>
          <div className="kpi-sub">
            <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
              {summary.overall_net_margin_percentage}% Margin
            </span>
            <span>· Net Margin Bersih</span>
          </div>
        </div>
      </div>

      {/* 3. Completed Orders */}
      <div className="kpi-cell">
        <div className="kpi-top">
          <span className="label-mono">Completed Orders</span>
          <ShoppingBag size={16} color="var(--color-ink-muted)" />
        </div>
        <div>
          <div key={`${filterLabel}-${summary.total_completed_orders}`} className="kpi-value kpi-animated-val">
            {formatNumber(summary.total_completed_orders)}
          </div>
          <div className="kpi-sub">
            <span>{fulfillmentRate}% fulfillment rate ({formatNumber(summary.total_orders)} total)</span>
          </div>
        </div>
      </div>

      {/* 4. Kimball Preserved Guest Revenue */}
      <div className="kpi-cell">
        <div className="kpi-top">
          <span className="label-mono">Kimball Preserved Omzet</span>
          <ShieldCheck size={16} color="#38bdf8" />
        </div>
        <div>
          <div key={`${filterLabel}-${summary.preserved_guest_revenue}`} className="kpi-value kpi-animated-val" style={{ color: "#0284c7" }}>
            {formatCompactIDR(summary.preserved_guest_revenue)}
          </div>
          <div className="kpi-sub">
            <span style={{ color: "var(--color-success)", fontWeight: 600 }}>0% Lost</span>
            <span>· 427 Transaksi Tamu Terselamatkan</span>
          </div>
        </div>
      </div>
    </section>
  );
};
