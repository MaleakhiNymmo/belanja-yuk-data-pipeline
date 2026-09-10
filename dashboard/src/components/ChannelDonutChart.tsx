import React, { useState, useMemo } from "react";
import { DailySalesItem } from "../types";
import { formatCompactIDR } from "../utils/format";
import { Globe } from "lucide-react";

interface ChannelDonutChartProps {
  data: DailySalesItem[];
  selectedChannel?: string;
  onSelectChannel?: (channel: string) => void;
}

interface ChannelSlice {
  channel: string;
  label: string;
  revenue: number;
  orders: number;
  percentage: number;
  color: string;
}

const CHANNEL_CONFIG: Record<string, { label: string; color: string }> = {
  mobile_app: { label: "Mobile App", color: "#3b82f6" },
  marketplace: { label: "Marketplace", color: "#10b981" },
  website: { label: "Website", color: "#8b5cf6" },
};

export const ChannelDonutChart: React.FC<ChannelDonutChartProps> = ({
  data,
  selectedChannel = "ALL",
  onSelectChannel,
}) => {
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);

  const slices = useMemo<ChannelSlice[]>(() => {
    const map = new Map<string, { revenue: number; orders: number }>();

    for (const row of data) {
      const curr = map.get(row.channel) || { revenue: 0, orders: 0 };
      curr.revenue += row.gross_revenue_idr;
      curr.orders += row.total_orders;
      map.set(row.channel, curr);
    }

    const totalRev = Array.from(map.values()).reduce((acc, v) => acc + v.revenue, 0);

    return Array.from(map.entries())
      .map(([channel, metrics]) => {
        const config = CHANNEL_CONFIG[channel] || {
          label: channel,
          color: "#94a3b8",
        };
        const percentage = totalRev > 0 ? (metrics.revenue / totalRev) * 100 : 0;
        return {
          channel,
          label: config.label,
          revenue: metrics.revenue,
          orders: metrics.orders,
          percentage: Number(percentage.toFixed(1)),
          color: config.color,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  const totalRevenue = useMemo(
    () => slices.reduce((acc, s) => acc + s.revenue, 0),
    [slices]
  );

  // SVG Arc generator
  const size = 180;
  const center = size / 2;
  const outerRadius = 75;
  const innerRadius = 50;

  let cumulativeAngle = -Math.PI / 2; // Mulai dari atas jam 12

  const arcPaths = slices.map((slice) => {
    const sliceAngle = (slice.percentage / 100) * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + sliceAngle;
    cumulativeAngle = endAngle;

    // Koordinat outer
    const x1 = center + outerRadius * Math.cos(startAngle);
    const y1 = center + outerRadius * Math.sin(startAngle);
    const x2 = center + outerRadius * Math.cos(endAngle);
    const y2 = center + outerRadius * Math.sin(endAngle);

    // Koordinat inner
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

    const isHovered = hoveredChannel === slice.channel;
    const isSelected = selectedChannel === slice.channel;

    return {
      ...slice,
      pathData,
      isHovered,
      isSelected,
    };
  });

  const activeSlice = slices.find((s) => s.channel === hoveredChannel);

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <Globe size={17} color="var(--color-ink-muted)" />
          <h2 className="panel-title">Share Kanal Penjualan</h2>
        </div>
        <span className="label-mono">marts.fct_daily_sales</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        {/* Donut Ring SVG */}
        <div style={{ position: "relative", width: `${size}px`, height: `${size}px` }}>
          <svg
            key={`${selectedChannel}-${data.length}`}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ overflow: "visible" }}
            onMouseLeave={() => setHoveredChannel(null)}
          >
            {arcPaths.map((slice, idx) => (
              <path
                key={slice.channel}
                className="donut-slice-animated"
                d={slice.pathData}
                fill={slice.color}
                opacity={
                  hoveredChannel
                    ? slice.isHovered
                      ? 1
                      : 0.35
                    : selectedChannel !== "ALL"
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
                  animationDelay: `${idx * 120}ms`,
                }}
                onMouseEnter={() => setHoveredChannel(slice.channel)}
                onClick={() =>
                  onSelectChannel &&
                  onSelectChannel(selectedChannel === slice.channel ? "ALL" : slice.channel)
                }
              />
            ))}
          </svg>

          {/* Center Hole Text */}
          <div
            key={`${selectedChannel}-${hoveredChannel || "none"}`}
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
            <div style={{ fontSize: "11px", color: "var(--color-ink-muted)", fontWeight: 500 }}>
              {activeSlice ? activeSlice.label : "Total Omzet"}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "14px",
                fontWeight: 700,
                color: activeSlice ? activeSlice.color : "var(--color-ink)",
              }}
            >
              {activeSlice ? `${activeSlice.percentage}%` : formatCompactIDR(totalRevenue)}
            </div>
          </div>
        </div>

        {/* Legend List */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
          {slices.map((slice) => {
            const isHovered = hoveredChannel === slice.channel;
            return (
              <div
                key={slice.channel}
                onMouseEnter={() => setHoveredChannel(slice.channel)}
                onMouseLeave={() => setHoveredChannel(null)}
                onClick={() =>
                  onSelectChannel &&
                  onSelectChannel(selectedChannel === slice.channel ? "ALL" : slice.channel)
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: isHovered ? "var(--color-paper-subtle)" : "transparent",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                  fontSize: "13px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: slice.color,
                    }}
                  />
                  <span style={{ fontWeight: 600 }}>{slice.label}</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "var(--color-ink-muted)", fontSize: "12px" }}>
                    {formatCompactIDR(slice.revenue)}
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontWeight: 700,
                      color: slice.color,
                      minWidth: "42px",
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
