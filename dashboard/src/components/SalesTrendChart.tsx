import React, { useState, useMemo, useRef, useEffect } from "react";
import { DailySalesItem } from "../types";
import { formatCompactIDR, formatIDR, formatNumber } from "../utils/format";

interface SalesTrendChartProps {
  data: DailySalesItem[];
  categoryFilter: string;
  channelFilter: string;
}

export const SalesTrendChart: React.FC<SalesTrendChartProps> = ({
  data,
  categoryFilter,
  channelFilter,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1100);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        const clientW = containerRef.current.clientWidth;
        if (clientW > 0) {
          setContainerWidth(clientW);
        }
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Filter & agregasi per tanggal
  const aggregatedSeries = useMemo(() => {
    const map = new Map<
      string,
      {
        order_date: string;
        gross_revenue: number;
        net_profit: number;
        orders: number;
      }
    >();

    for (const row of data) {
      if (categoryFilter !== "ALL" && row.category !== categoryFilter) continue;
      if (channelFilter !== "ALL" && row.channel !== channelFilter) continue;

      const existing = map.get(row.order_date);
      if (existing) {
        existing.gross_revenue += row.gross_revenue_idr;
        existing.net_profit += row.net_profit_idr;
        existing.orders += row.total_orders;
      } else {
        map.set(row.order_date, {
          order_date: row.order_date,
          gross_revenue: row.gross_revenue_idr,
          net_profit: row.net_profit_idr,
          orders: row.total_orders,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.order_date.localeCompare(b.order_date)
    );
  }, [data, categoryFilter, channelFilter]);

  // Chart dimensions & scaling (responsive 1:1, no stretching)
  const width = containerWidth;
  const height = 260;
  const paddingLeft = 72;
  const paddingRight = 24;
  const paddingTop = 25;
  const paddingBottom = 35;

  const maxVal = useMemo(() => {
    if (aggregatedSeries.length === 0) return 1;
    const m = Math.max(...aggregatedSeries.map((d) => d.gross_revenue));
    return m * 1.15; // 15% ceiling headroom
  }, [aggregatedSeries]);

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const getX = (index: number) => {
    if (aggregatedSeries.length <= 1) return paddingLeft;
    return paddingLeft + (index / (aggregatedSeries.length - 1)) * innerWidth;
  };

  const getY = (val: number) => {
    return paddingTop + innerHeight - (val / maxVal) * innerHeight;
  };

  // Build SVG Path Strings
  const { revPath, profitPath, areaPath } = useMemo(() => {
    if (aggregatedSeries.length === 0) {
      return { revPath: "", profitPath: "", areaPath: "" };
    }

    let rD = `M ${getX(0)} ${getY(aggregatedSeries[0].gross_revenue)}`;
    let pD = `M ${getX(0)} ${getY(aggregatedSeries[0].net_profit)}`;
    let aD = `M ${getX(0)} ${getY(aggregatedSeries[0].gross_revenue)}`;

    for (let i = 1; i < aggregatedSeries.length; i++) {
      const x = getX(i);
      const yRev = getY(aggregatedSeries[i].gross_revenue);
      const yProf = getY(aggregatedSeries[i].net_profit);
      rD += ` L ${x} ${yRev}`;
      pD += ` L ${x} ${yProf}`;
      aD += ` L ${x} ${yRev}`;
    }

    const lastX = getX(aggregatedSeries.length - 1);
    const bottomY = paddingTop + innerHeight;
    aD += ` L ${lastX} ${bottomY} L ${getX(0)} ${bottomY} Z`;

    return { revPath: rD, profitPath: pD, areaPath: aD };
  }, [aggregatedSeries, maxVal]);

  // Y-axis ticks (4 ticks)
  const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal];

  // X-axis label samples (every ~15 days)
  const xLabels = useMemo(() => {
    if (aggregatedSeries.length === 0) return [];
    const step = Math.max(1, Math.floor(aggregatedSeries.length / 6));
    const labels = [];
    for (let i = 0; i < aggregatedSeries.length; i += step) {
      labels.push({
        index: i,
        date: aggregatedSeries[i].order_date.slice(5), // MM-DD
      });
    }
    return labels;
  }, [aggregatedSeries]);

  const activeHover =
    hoverIndex !== null && aggregatedSeries[hoverIndex]
      ? aggregatedSeries[hoverIndex]
      : null;

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <h2 className="panel-title">Tren Omzet & Laba Harian</h2>
          <span className="label-mono">marts.fct_daily_sales</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "12px", height: "3px", backgroundColor: "var(--color-accent)", display: "inline-block", borderRadius: "2px" }} />
            <span style={{ color: "var(--color-ink-muted)" }}>Gross Revenue</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "12px", height: "3px", backgroundColor: "var(--color-success)", display: "inline-block", borderRadius: "2px" }} />
            <span style={{ color: "var(--color-ink-muted)" }}>Net Profit</span>
          </div>
        </div>
      </div>

      <div className="chart-container" ref={containerRef}>
        <svg
          key={`${categoryFilter}-${channelFilter}-${width}`}
          viewBox={`0 0 ${width} ${height}`}
          className="chart-svg"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines & Y-ticks */}
          {yTicks.map((val, idx) => {
            const y = getY(val);
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  className="chart-grid-line"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="chart-axis-text"
                >
                  {formatCompactIDR(val)}
                </text>
              </g>
            );
          })}

          {/* X Axis labels */}
          {xLabels.map((lbl, idx) => {
            const x = getX(lbl.index);
            return (
              <text
                key={idx}
                x={x}
                y={height - 8}
                textAnchor="middle"
                className="chart-axis-text"
              >
                {lbl.date}
              </text>
            );
          })}

          {/* Area & Lines */}
          <path d={areaPath} className="chart-area-fill" />
          <path d={revPath} className="chart-line-rev" />
          <path d={profitPath} className="chart-line-profit" />

          {/* Invisible hover overlay triggers */}
          {aggregatedSeries.map((_, idx) => {
            const colWidth = innerWidth / aggregatedSeries.length;
            const x = getX(idx) - colWidth / 2;
            return (
              <rect
                key={idx}
                x={x}
                y={paddingTop}
                width={colWidth}
                height={innerHeight}
                fill="transparent"
                style={{ cursor: "crosshair" }}
                onMouseEnter={() => setHoverIndex(idx)}
              />
            );
          })}

          {/* Active Hover Crosshair & Dots */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={paddingTop}
                x2={getX(hoverIndex)}
                y2={paddingTop + innerHeight}
                stroke="var(--color-ink)"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(aggregatedSeries[hoverIndex].gross_revenue)}
                r={4.5}
                fill="var(--color-accent)"
                stroke="white"
                strokeWidth={2}
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(aggregatedSeries[hoverIndex].net_profit)}
                r={4}
                fill="var(--color-success)"
                stroke="white"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {activeHover && hoverIndex !== null && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(getX(hoverIndex) / width) * 100}%`,
              top: `${(getY(activeHover.gross_revenue) / height) * 100}%`,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: "4px", color: "#93c5fd" }}>
              Tanggal: {activeHover.order_date}
            </div>
            <div>Omzet: {formatIDR(activeHover.gross_revenue)}</div>
            <div style={{ color: "#86efac" }}>Profit: {formatIDR(activeHover.net_profit)}</div>
            <div style={{ color: "#cbd5e1", fontSize: "11px", marginTop: "2px" }}>
              Total: {formatNumber(activeHover.orders)} Pesanan
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
