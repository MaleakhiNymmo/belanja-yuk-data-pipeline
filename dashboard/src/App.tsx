import React, { useState, useMemo } from "react";
import rawData from "./data/dashboard_data.json";
import { DashboardData, DashboardSummary } from "./types";
import { HeaderNav } from "./components/HeaderNav";
import { KpiGrid } from "./components/KpiGrid";
import { SalesTrendChart } from "./components/SalesTrendChart";
import { ChannelDonutChart } from "./components/ChannelDonutChart";
import { CategoryDonutChart } from "./components/CategoryDonutChart";
import { CustomerTierBreakdown } from "./components/CustomerTierBreakdown";
import { KimballShowcaseWidget } from "./components/KimballShowcaseWidget";
import { InventoryMartTable } from "./components/InventoryMartTable";
import { PipelineHealthDrawer } from "./components/PipelineHealthDrawer";
import { Filter, Download, RefreshCw } from "lucide-react";

export const App: React.FC = () => {
  const data: DashboardData = rawData as DashboardData;

  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState<boolean>(false);

  // Daftar unik kategori & channel
  const categories = useMemo(() => {
    const set = new Set<string>();
    data.daily_sales.forEach((d) => set.add(d.category));
    return ["ALL", ...Array.from(set)];
  }, [data]);

  const channels = useMemo(() => {
    const set = new Set<string>();
    data.daily_sales.forEach((d) => set.add(d.channel));
    return ["ALL", ...Array.from(set)];
  }, [data]);

  // Baris daily sales terfilter
  const filteredDailySales = useMemo(() => {
    return data.daily_sales.filter((row) => {
      if (categoryFilter !== "ALL" && row.category !== categoryFilter) return false;
      if (channelFilter !== "ALL" && row.channel !== channelFilter) return false;
      return true;
    });
  }, [data.daily_sales, categoryFilter, channelFilter]);

  const isFiltered = categoryFilter !== "ALL" || channelFilter !== "ALL";

  const filterLabel = useMemo(() => {
    if (!isFiltered) return "90D";
    const parts = [];
    if (categoryFilter !== "ALL") parts.push(categoryFilter);
    if (channelFilter !== "ALL") parts.push(channelFilter);
    return parts.join(" · ");
  }, [isFiltered, categoryFilter, channelFilter]);

  // Agregasi KPI dinamis mengikuti filter aktif
  const dynamicSummary = useMemo<DashboardSummary>(() => {
    if (!isFiltered) {
      return data.summary;
    }

    let grossRev = 0;
    let netRev = 0;
    let grossProfit = 0;
    let netProfit = 0;
    let totalOrders = 0;
    let completedOrders = 0;
    let totalUnits = 0;

    for (const row of filteredDailySales) {
      grossRev += row.gross_revenue_idr;
      netRev += row.net_revenue_idr;
      grossProfit += row.gross_profit_idr;
      netProfit += row.net_profit_idr;
      totalOrders += row.total_orders;
      completedOrders += row.completed_orders;
      totalUnits += row.total_units_sold;
    }

    const netMargin = netRev > 0 ? Number(((netProfit / netRev) * 100).toFixed(2)) : 0;
    const filterRatio =
      data.summary.total_gross_revenue > 0
        ? grossRev / data.summary.total_gross_revenue
        : 0;
    const preservedGuestRev = Math.round(data.summary.preserved_guest_revenue * filterRatio);

    return {
      total_gross_revenue: grossRev,
      total_net_revenue: netRev,
      total_gross_profit: grossProfit,
      total_net_profit: netProfit,
      overall_net_margin_percentage: netMargin,
      total_orders: totalOrders,
      total_completed_orders: completedOrders,
      total_units_sold: totalUnits,
      preserved_guest_revenue: preservedGuestRev,
      registered_customers_count: data.summary.registered_customers_count,
      active_products_count: data.summary.active_products_count,
    };
  }, [data.summary, filteredDailySales, isFiltered]);

  // Download snapshot JSON
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `belanja_yuk_dwh_marts_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-shell">
      {/* 1. Header Navigation */}
      <HeaderNav
        metadata={data.pipeline_metadata}
        onOpenPipelineModal={() => setIsPipelineModalOpen(true)}
      />

      <main className="container" style={{ flex: 1, paddingBottom: "var(--space-12)" }}>
        {/* 2. Hero / Header Title & Filters */}
        <section className="hero-section">
          <div className="hero-header-row">
            <div className="hero-title-area">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span className="status-pill success">
                  <span className="status-dot" />
                  <span>DWH Marts: Analytics-Ready</span>
                </span>
                <span className="label-mono">Schema: marts</span>
              </div>
              <h1>Belanja Yuk Analytics Marts</h1>
              <p className="hero-subtitle">
                Dashboard analitik performa bisnis e-commerce yang bersumber langsung dari hasil
                agregasi model <strong>dbt Core</strong> dan orkestrasi <strong>Apache Airflow 3</strong>.
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                onClick={handleExportJSON}
                className="btn btn-sm"
                title="Unduh snapshot data mart format JSON"
              >
                <Download size={14} />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Interactive Filter Bar */}
          <div className="filter-bar">
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--color-ink-muted)", fontSize: "12px", marginRight: "6px" }}>
              <Filter size={14} />
              <span style={{ fontWeight: 600 }}>Filter Mart:</span>
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="filter-select"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "ALL" ? "Semua Kategori Produk" : `Kategori: ${c}`}
                </option>
              ))}
            </select>

            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="filter-select"
            >
              {channels.map((ch) => (
                <option key={ch} value={ch}>
                  {ch === "ALL" ? "Semua Kanal Penjualan" : `Kanal: ${ch}`}
                </option>
              ))}
            </select>

            {(categoryFilter !== "ALL" || channelFilter !== "ALL") && (
              <button
                onClick={() => {
                  setCategoryFilter("ALL");
                  setChannelFilter("ALL");
                }}
                className="btn btn-sm"
                style={{ padding: "4px 8px", fontSize: "12px" }}
              >
                <RefreshCw size={12} />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </section>

        {/* 3. KPI Grid (Dinamis mengikuti filter aktif) */}
        <KpiGrid
          summary={dynamicSummary}
          isFiltered={isFiltered}
          filterLabel={filterLabel}
        />

        {/* 4. Full Width Time Series Chart (90-Day Trend) */}
        <div style={{ marginBottom: "var(--space-8)" }}>
          <SalesTrendChart
            data={data.daily_sales}
            categoryFilter={categoryFilter}
            channelFilter={channelFilter}
          />
        </div>

        {/* 5. Distribution Row: Channel Share, Category Share & Customer Tiers */}
        <div className="dashboard-grid-3col">
          <ChannelDonutChart
            data={filteredDailySales}
            selectedChannel={channelFilter}
            onSelectChannel={setChannelFilter}
          />
          <CategoryDonutChart
            data={filteredDailySales}
            selectedCategory={categoryFilter}
            onSelectCategory={setCategoryFilter}
          />
          <CustomerTierBreakdown tiers={data.customer_tiers} />
        </div>

        {/* 5. Key Architecture Showcase: Ralph Kimball Unknown Member Pattern */}
        <KimballShowcaseWidget audit={data.kimball_audit} />

        {/* 6. Product Performance & Inventory Health Mart */}
        <InventoryMartTable
          products={data.products}
          categoryFilter={categoryFilter}
        />
      </main>

      {/* 7. Footer */}
      <footer className="dashboard-footer">
        <div className="container footer-inner">
          <div>
            <strong>Belanja Yuk Data Pipeline Portfolio Showcase</strong> · End-to-End Automated ELT Architecture
          </div>
          <div className="label-mono">
            Astronomer 3.3 · dbt Core 1.8 · PostgreSQL 15 · Hallmark Design (Cobalt)
          </div>
        </div>
      </footer>

      {/* 8. Pipeline Health Modal */}
      <PipelineHealthDrawer
        isOpen={isPipelineModalOpen}
        onClose={() => setIsPipelineModalOpen(false)}
        metadata={data.pipeline_metadata}
      />
    </div>
  );
};
