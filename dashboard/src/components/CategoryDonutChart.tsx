import React, { useState, useMemo } from "react";
import { DailySalesItem } from "../types";
import { formatCompactIDR } from "../utils/format";
import { Layers } from "lucide-react";

interface CategoryDonutChartProps {
  data: DailySalesItem[];
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
}

interface CategorySlice {
  category: string;
  revenue: number;
  orders: number;
  percentage: number;
  color: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Elektronik: "#3b82f6",
  Fashion: "#ec4899",
  Sports: "#06b6d4",
  Kecantikan: "#f43f5e",
  "Rumah Tangga": "#eab308",
  Olahraga: "#10b981",
  Makanan: "#f97316",
  Buku: "#8b5cf6",
};

export const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({
  data,
  selectedCategory = "ALL",
  onSelectCategory,
}) => {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const slices = useMemo<CategorySlice[]>(() => {
    const map = new Map<string, { revenue: number; orders: number }>();

    for (const row of data) {
      const curr = map.get(row.category) || { revenue: 0, orders: 0 };
      curr.revenue += row.gross_revenue_idr;
      curr.orders += row.total_orders;
      map.set(row.category, curr);
    }

    const totalRev = Array.from(map.values()).reduce((acc, v) => acc + v.revenue, 0);

    return Array.from(map.entries())
      .map(([category, metrics]) => {
        const color = CATEGORY_COLORS[category] || "#64748b";
        const percentage = totalRev > 0 ? (metrics.revenue / totalRev) * 100 : 0;
        return {
          category,
          revenue: metrics.revenue,
          orders: metrics.orders,
          percentage: Number(percentage.toFixed(1)),
          color,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [data]);


  // SVG Arc generator
  const size = 180;
  const center = size / 2;
  const outerRadius = 75;
  const innerRadius = 50;

  let cumulativeAngle = -Math.PI / 2;

  const arcPaths = slices.map((slice) => {
    const sliceAngle = (slice.percentage / 100) * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + sliceAngle;
    cumulativeAngle = endAngle;

    const x1 = center + outerRadius * Math.cos(startAngle);
    const y1 = center + outerRadius * Math.sin(startAngle);
    const x2 = center + outerRadius * Math.cos(endAngle);
    const y2 = center + outerRadius * Math.sin(endAngle);

    const x3 = center + innerRadius * Math.cos(endAngle);
    const y3 = center + innerRadius * Math.sin(endAngle);
    const x4 = center + innerRadius * Math.cos(startAngle);
    const y4 = center + innerRadius * Math.sin(startAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const pathData = `
      M ${x1} ${y1}
      A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}
      L ${x3} ${y3}
      A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
      Z
    `;

    const isHovered = hoveredCategory === slice.category;
    const isSelected = selectedCategory === slice.category;

    return {
      ...slice,
      pathData,
      isHovered,
      isSelected,
    };
  });

  const activeSlice = slices.find((s) => s.category === hoveredCategory);

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <Layers size={17} color="var(--color-ink-muted)" />
          <h2 className="panel-title">Share Kategori Produk</h2>
        </div>
        <span className="label-mono">marts.fct_daily_sales</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        {/* Donut Ring SVG */}
        <div style={{ position: "relative", width: `${size}px`, height: `${size}px` }}>
          <svg
            key={`${selectedCategory}-${data.length}`}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ overflow: "visible" }}
            onMouseLeave={() => setHoveredCategory(null)}
          >
            {arcPaths.map((slice, idx) => (
              <path
                key={slice.category}
                className="donut-slice-animated"
                d={slice.pathData}
                fill={slice.color}
                opacity={
                  hoveredCategory
                    ? slice.isHovered
                      ? 1
                      : 0.35
                    : selectedCategory !== "ALL"
                    ? slice.isSelected
                      ? 1
                      : 0.4
                    : 0.95
                }
                stroke="var(--color-paper-surface)"
                strokeWidth={2}
                style={{
                  cursor: "pointer",
                  transition: "opacity 0.2s ease, transform 0.2s ease",
                  transformOrigin: `${center}px ${center}px`,
                  transform: slice.isHovered ? "scale(1.04)" : "scale(1)",
                  animationDelay: `${idx * 60}ms`,
                }}
                onMouseEnter={() => setHoveredCategory(slice.category)}
                onClick={() =>
                  onSelectCategory &&
                  onSelectCategory(
                    selectedCategory === slice.category ? "ALL" : slice.category
                  )
                }
              />
            ))}
          </svg>

          {/* Center Hole Text */}
          <div
            key={`${selectedCategory}-${hoveredCategory || "none"}`}
            className="donut-center-animated"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              pointerEvents: "none",
              width: "90px",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--color-ink-muted)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeSlice ? activeSlice.category : "Top Category"}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "14px",
                fontWeight: 700,
                color: activeSlice ? activeSlice.color : "var(--color-ink)",
              }}
            >
              {activeSlice
                ? `${activeSlice.percentage}%`
                : slices[0]
                ? `${slices[0].category.slice(0, 8)}..`
                : "-"}
            </div>
          </div>
        </div>

        {/* Legend List (Scrollable if many categories) */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            maxHeight: "185px",
            overflowY: "auto",
            paddingRight: "4px",
          }}
        >
          {slices.map((slice) => {
            const isHovered = hoveredCategory === slice.category;
            const isSelected = selectedCategory === slice.category;
            return (
              <div
                key={slice.category}
                onMouseEnter={() => setHoveredCategory(slice.category)}
                onMouseLeave={() => setHoveredCategory(null)}
                onClick={() =>
                  onSelectCategory &&
                  onSelectCategory(
                    selectedCategory === slice.category ? "ALL" : slice.category
                  )
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: isSelected
                    ? "var(--color-accent-subtle)"
                    : isHovered
                    ? "var(--color-paper-subtle)"
                    : "transparent",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                  fontSize: "12.5px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: slice.color,
                    }}
                  />
                  <span style={{ fontWeight: isSelected ? 700 : 500 }}>
                    {slice.category}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "var(--color-ink-muted)", fontSize: "11.5px" }}>
                    {formatCompactIDR(slice.revenue)}
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontWeight: 700,
                      color: slice.color,
                      minWidth: "38px",
                      textAlign: "right",
                    }}
                  >
                    {slice.percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
