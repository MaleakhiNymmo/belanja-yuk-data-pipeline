import React, { useState, useMemo } from "react";
import { Search, Package } from "lucide-react";
import { ProductItem } from "../types";
import { formatCompactIDR, formatIDR, formatNumber } from "../utils/format";

interface InventoryMartTableProps {
  products: ProductItem[];
  categoryFilter?: string;
}

export const InventoryMartTable: React.FC<InventoryMartTableProps> = ({
  products,
  categoryFilter = "ALL",
}) => {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"revenue" | "margin" | "units">("revenue");

  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => {
      if (categoryFilter !== "ALL" && p.category !== categoryFilter) {
        return false;
      }
      return (
        p.product_name.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
      );
    });

    result.sort((a, b) => {
      if (sortBy === "revenue") {
        return b.total_revenue_generated_idr - a.total_revenue_generated_idr;
      }
      if (sortBy === "margin") {
        return b.margin_percentage - a.margin_percentage;
      }
      return b.total_units_sold - a.total_units_sold;
    });

    return result;
  }, [products, search, sortBy]);

  const getBadgeClass = (status: string) => {
    switch (status) {
      case "Healthy":
        return "badge-stock healthy";
      case "Low Stock":
        return "badge-stock low-stock";
      case "Out of Stock":
        return "badge-stock out-of-stock";
      default:
        return "badge-stock";
    }
  };

  return (
    <div className="panel-card" style={{ marginBottom: "var(--space-8)" }}>
      <div className="panel-header">
        <div className="panel-title-wrap">
          <Package size={18} color="var(--color-ink-muted)" />
          <h2 className="panel-title">Katalog Produk & Kesehatan Inventori</h2>
          <span className="label-mono">marts.dim_products</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Search box */}
          <div style={{ position: "relative" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--color-ink-muted)",
              }}
            />
            <input
              type="text"
              placeholder="Cari SKU / nama produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="filter-select"
              style={{ paddingLeft: "30px", width: "200px" }}
            />
          </div>

          {/* Sort selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={() => setSortBy("revenue")}
              className={`btn btn-sm ${sortBy === "revenue" ? "btn-primary" : ""}`}
            >
              Top Revenue
            </button>
            <button
              onClick={() => setSortBy("margin")}
              className={`btn btn-sm ${sortBy === "margin" ? "btn-primary" : ""}`}
            >
              Top Margin
            </button>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="mart-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Nama Produk</th>
              <th>Kategori</th>
              <th style={{ textAlign: "right" }}>Harga Jual</th>
              <th style={{ textAlign: "right" }}>Margin</th>
              <th style={{ textAlign: "right" }}>Terjual</th>
              <th style={{ textAlign: "right" }}>Total Revenue</th>
              <th style={{ textAlign: "center" }}>Status Stok</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => (
              <tr key={p.product_id}>
                <td className="font-mono" style={{ fontSize: "12px", color: "var(--color-ink-muted)" }}>
                  {p.sku}
                </td>
                <td style={{ fontWeight: 600 }}>{p.product_name}</td>
                <td>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      backgroundColor: "var(--color-paper-subtle)",
                      fontSize: "12px",
                      border: "1px solid var(--color-rule-faint)",
                    }}
                  >
                    {p.category}
                  </span>
                </td>
                <td style={{ textAlign: "right" }} className="font-mono">
                  {formatIDR(p.price_idr)}
                </td>
                <td style={{ textAlign: "right" }} className="font-mono">
                  <span style={{ color: p.margin_percentage >= 50 ? "var(--color-success)" : "var(--color-ink)" }}>
                    {p.margin_percentage}%
                  </span>
                </td>
                <td style={{ textAlign: "right" }} className="font-mono">
                  {formatNumber(p.total_units_sold)} unit
                </td>
                <td style={{ textAlign: "right", fontWeight: 600 }} className="font-mono">
                  {formatCompactIDR(p.total_revenue_generated_idr)}
                </td>
                <td style={{ textAlign: "center" }}>
                  <span className={getBadgeClass(p.stock_status)}>
                    {p.stock_status} ({p.stock_qty})
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
