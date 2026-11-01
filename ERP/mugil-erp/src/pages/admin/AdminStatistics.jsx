import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  Activity,
  CalendarDays,
  CircleDollarSign,
  FolderKanban,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

import Loading from "../../components/loading";
import ErrorState from "../../components/error";

import "./AdminStatistics.css";

/* ============================================================
   CONFIGURATION
   ============================================================ */

const STATISTICS_ENDPOINT = "/erp/admin/statistics/";

const PERIOD_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom" },
];

const PERIOD_DESCRIPTIONS = {
  day: "daily",
  week: "weekly",
  month: "month-wise (last 12 months)",
  quarter: "quarterly",
  year: "yearly",
  custom: "month-wise custom range",
};

/* ============================================================
   FORMATTERS & HELPERS
   ============================================================ */

const formatCurrency = (value) => {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
};

const formatCompactCurrency = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "₹0";

  const sign = number < 0 ? "-" : "";
  const abs = Math.abs(number);

  // Thresholds sit just below each unit so rounding never produces
  // "₹100.0K" / "₹100.0L" / "₹1000.0L" style overflow.
  const trimmed = (n) => n.toFixed(1).replace(/\.0$/, "");
  if (abs >= 9995000) return `${sign}₹${trimmed(abs / 10000000)}Cr`;
  if (abs >= 99950) return `${sign}₹${trimmed(abs / 100000)}L`;
  if (abs >= 999.5) return `${sign}₹${trimmed(abs / 1000)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
};

// Signed currency for profit / loss
const formatSignedCurrency = (value) => {
  const number = Number(value || 0);
  const sign = number < 0 ? "-" : "";
  return `${sign}${formatCurrency(Math.abs(number))}`;
};

// "YYYY-MM-DD" -> local Date (avoids UTC shifting the day)
const parseISODate = (value) => {
  if (!value) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const EXPENSE_CATEGORY_COLORS = {
  Purchase: "#00d9ff",
  Transport: "#387cff",
  Salary: "#ff3fa4",
  Rent: "#9b5cff",
  Electricity: "#ff9f43",
  Maintenance: "#27d17f",
  Office: "#ffd447",
  Sales: "#ff4fd8",
  Other: "#7890a4",
};

const PO_STATUS_COLORS = {
  Pending: "#ffb020",
  "Partially Received": "#8b5cf6",
  Outstanding: "#ff4f8b",
  "Fully Received": "#27d17f",
};

/* ============================================================
   CHART: REVENUE VS EXPENSES
   ------------------------------------------------------------
   Scale rules
   - Revenue bars and expense bars ALWAYS share one scale (left
     axis) so the two bars of a period are directly comparable.
   - The purple revenue trend line can use its own zero-based
     scale (right axis) when revenue is much smaller than the
     largest bar. Both axes are labelled, both start at 0, and
     tooltips always show the real rupee values.
   - Users can switch the trend back to the shared scale.
   ============================================================ */

// Trend gets its own axis only when revenue peaks below this share of the bar scale
const SPLIT_SCALE_RATIO = 0.7;
const GRID_INTERVALS = 5;
const MIN_GROUP_WIDTH = 30; // below this the chart scrolls horizontally
const WIDE_GROUP_WIDTH = 110; // at/above this value labels stay horizontal

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const toSafeNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

// Step size (1, 2, 2.5, 5 x 10^n) so that `intervals` steps cover `max`
const getNiceStep = (max, intervals) => {
  const raw = Math.max(max, 0) / intervals;
  if (!(raw > 0)) return 0;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const niceFraction =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return niceFraction * power;
};

// Zero-based axis whose top is a "nice" number >= max
const buildAxis = (max, intervals = GRID_INTERVALS) => {
  const fallbackMax = 100000; // empty data -> a sensible 0 .. ₹1L axis
  const step = getNiceStep(max > 0 ? max : fallbackMax, intervals);
  return {
    step,
    max: step * intervals,
    ticks: Array.from({ length: intervals + 1 }, (_, index) => step * index),
  };
};

function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const update = () => {
      const next = { width: element.clientWidth, height: element.clientHeight };
      setSize((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next
      );
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function RevenueExpenseChart({ data, period }) {
  const containerRef = useRef(null);
  const { width: measuredWidth, height: measuredHeight } = useElementSize(containerRef);
  const [trendScale, setTrendScale] = useState("own"); // "own" | "shared"
  const [hoverIndex, setHoverIndex] = useState(null);

  // Defensive copy: finite numbers only. Bars cannot be drawn below zero,
  // the real (possibly negative) value is still shown in the tooltip.
  const rows = useMemo(
    () =>
      data.map((item) => {
        const revenue = toSafeNumber(item.revenue);
        const expenses = toSafeNumber(item.expenses);
        return {
          ...item,
          revenue,
          expenses,
          profit_loss: toSafeNumber(item.profit_loss ?? revenue - expenses),
          revenueDraw: Math.max(revenue, 0),
          expenseDraw: Math.max(expenses, 0),
        };
      }),
    [data]
  );

  const count = rows.length;
  const containerWidth = measuredWidth || 800;
  const containerHeight = measuredHeight || 340;
  const compact = containerWidth < 520;

  // ---------- scales ----------
  const barMax = rows.reduce((max, r) => Math.max(max, r.revenueDraw, r.expenseDraw), 0);
  const revenueMax = rows.reduce((max, r) => Math.max(max, r.revenueDraw), 0);

  const canSplitScale = count > 1 && revenueMax > 0 && revenueMax / barMax < SPLIT_SCALE_RATIO;
  const useOwnTrendScale = canSplitScale && trendScale === "own";

  const barAxis = useMemo(() => buildAxis(barMax), [barMax]);
  const trendAxis = useMemo(
    () => (useOwnTrendScale ? buildAxis(revenueMax) : barAxis),
    [useOwnTrendScale, revenueMax, barAxis]
  );

  // ---------- layout ----------
  const padding = {
    left: compact ? 50 : 70,
    right: useOwnTrendScale ? (compact ? 50 : 70) : compact ? 14 : 24,
    bottom: 44,
  };

  const availableWidth = Math.max(containerWidth - padding.left - padding.right, 120);
  const groupWidth = Math.max(availableWidth / Math.max(count, 1), MIN_GROUP_WIDTH);
  const scrolls = groupWidth * count > availableWidth + 0.5;
  const svgWidth = scrolls ? groupWidth * count + padding.left + padding.right : containerWidth;
  const svgHeight = Math.max(containerHeight - (scrolls ? 12 : 0), 240);

  const horizontalLabels = groupWidth >= WIDE_GROUP_WIDTH;
  padding.top = horizontalLabels ? 40 : 66;

  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;
  const baseline = padding.top + chartHeight;

  const barWidth = clamp(groupWidth * 0.26, 6, 34);
  const barGap = clamp(groupWidth * 0.07, 3, 9);

  const getX = (index) => padding.left + (chartWidth / Math.max(count, 1)) * index + chartWidth / Math.max(count, 1) / 2;
  const actualGroupWidth = chartWidth / Math.max(count, 1);
  const barY = (value) => baseline - (clamp(value, 0, barAxis.max) / barAxis.max) * chartHeight;
  const trendY = (value) =>
    baseline - (clamp(value, 0, trendAxis.max) / trendAxis.max) * chartHeight;

  // ---------- trend geometry (point i uses revenue of row i) ----------
  const trendPoints = rows.map((row, index) => ({ x: getX(index), y: trendY(row.revenueDraw) }));
  const linePoints = trendPoints.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  // Markers pop in when the drawn line actually reaches them
  const trendDelays = useMemo(() => {
    const cumulative = [0];
    for (let i = 1; i < trendPoints.length; i += 1) {
      const dx = trendPoints[i].x - trendPoints[i - 1].x;
      const dy = trendPoints[i].y - trendPoints[i - 1].y;
      cumulative.push(cumulative[i - 1] + Math.hypot(dx, dy));
    }
    const total = cumulative[cumulative.length - 1] || 1;
    return cumulative.map((distance) => 0.35 + (distance / total) * 1.8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linePoints]);

  // ---------- labels ----------
  const labelStep = Math.max(1, Math.ceil(56 / actualGroupWidth));

  const renderValueLabel = (x, value, drawnValue, className, delay) => {
    if (!horizontalLabels && value <= 0) return null; // no "₹0" clutter when crowded
    const y = barY(drawnValue) - 8;

    if (horizontalLabels) {
      return (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          className={`statistics-data-label ${className} statistics-fade-in`}
          style={{ "--delay": `${delay}s` }}
        >
          {formatCompactCurrency(value)}
        </text>
      );
    }

    return (
      <g transform={`rotate(-90 ${x} ${y})`}>
        <text
          x={x}
          y={y + 4}
          textAnchor="start"
          className={`statistics-data-label ${className} statistics-fade-in`}
          style={{ "--delay": `${delay}s` }}
        >
          {formatCompactCurrency(value)}
        </text>
      </g>
    );
  };

  // ---------- tooltip ----------
  const hovered = hoverIndex !== null && rows[hoverIndex] ? rows[hoverIndex] : null;
  const previous = hoverIndex !== null && hoverIndex > 0 ? rows[hoverIndex - 1] : null;
  let revenueChange = null;
  if (hovered && previous && previous.revenue > 0) {
    revenueChange = ((hovered.revenue - previous.revenue) / previous.revenue) * 100;
  }

  const handleHover = (index) => () => setHoverIndex(index);
  const handleToggleHover = (index) => () =>
    setHoverIndex((current) => (current === index ? null : index));

  const tooltipLeft = hovered
    ? clamp(getX(hoverIndex), 100, Math.max(svgWidth - 100, 100))
    : 0;

  const ariaLabel = `Revenue versus expenses chart with ${count} period${count === 1 ? "" : "s"}. ${
    useOwnTrendScale
      ? "The revenue trend line uses its own scale shown on the right axis."
      : "Bars and trend share one scale."
  }`;

  return (
    <div className="statistics-chart-shell">
      <div className="statistics-chart-header">
        <div>
          <span className="statistics-chart-eyebrow">FINANCIAL PERFORMANCE</span>
          <h2>Revenue vs Expenses</h2>
          <p>Revenue and operating expenses across the selected timeline.</p>
        </div>

        <div className="statistics-chart-legend">
          <span>
            <i className="legend-dot legend-dot-revenue" /> Revenue
          </span>
          <span>
            <i className="legend-dot legend-dot-expense" /> Expenses
          </span>
          <span>
            <i className="legend-line" /> Revenue Trend
            {useOwnTrendScale && <em className="legend-axis-note">(right axis)</em>}
          </span>
        </div>
      </div>

      {canSplitScale && (
        <div className="statistics-scale-note" role="group" aria-label="Revenue trend scale">
          <p>
            {useOwnTrendScale
              ? "Bars share the left axis. The purple trend has its own ₹0-based scale (right axis) so its movement stays visible."
              : "Bars and the purple trend share one scale (left axis). Smaller revenue values look flatter."}
          </p>
          <div className="statistics-scale-toggle">
            <button
              type="button"
              className={useOwnTrendScale ? "is-active" : ""}
              aria-pressed={useOwnTrendScale}
              onClick={() => setTrendScale("own")}
            >
              Trend: own scale
            </button>
            <button
              type="button"
              className={!useOwnTrendScale ? "is-active" : ""}
              aria-pressed={!useOwnTrendScale}
              onClick={() => setTrendScale("shared")}
            >
              Trend: shared scale
            </button>
          </div>
        </div>
      )}

      <div className="statistics-chart" ref={containerRef}>
        <div className="statistics-chart-scroll">
          <div className="statistics-chart-canvas" style={{ width: svgWidth, height: svgHeight }}>
            <svg
              width={svgWidth}
              height={svgHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              role="img"
              aria-label={ariaLabel}
              onPointerLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id="statisticsRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00eaff" />
                  <stop offset="100%" stopColor="#087df2" />
                </linearGradient>
                <linearGradient id="statisticsExpenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff52ad" />
                  <stop offset="100%" stopColor="#f45b70" />
                </linearGradient>
              </defs>

              {/* GRID + LEFT AXIS (bars) */}
              {barAxis.ticks.map((tick, index) => {
                const y = barY(tick);
                return (
                  <g key={`grid-${index}`}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={svgWidth - padding.right}
                      y2={y}
                      className="statistics-grid-line"
                    />
                    <text x={padding.left - 10} y={y + 4} textAnchor="end" className="statistics-axis-label">
                      {formatCompactCurrency(tick)}
                    </text>
                  </g>
                );
              })}

              {/* RIGHT AXIS (revenue trend, only when it has its own scale) */}
              {useOwnTrendScale &&
                trendAxis.ticks.map((tick, index) => (
                  <text
                    key={`trend-axis-${index}`}
                    x={svgWidth - padding.right + 10}
                    y={trendY(tick) + 4}
                    textAnchor="start"
                    className="statistics-axis-label statistics-axis-label-trend"
                  >
                    {formatCompactCurrency(tick)}
                  </text>
                ))}

              {/* BASELINE */}
              <line
                x1={padding.left}
                y1={baseline}
                x2={svgWidth - padding.right}
                y2={baseline}
                stroke="rgba(65,130,165,0.25)"
                strokeWidth="1"
              />

              {/* HOVER BAND */}
              {hovered && (
                <rect
                  x={getX(hoverIndex) - actualGroupWidth / 2}
                  y={padding.top - 8}
                  width={actualGroupWidth}
                  height={chartHeight + 8}
                  rx="8"
                  className="statistics-hover-band"
                />
              )}

              {/* BARS */}
              {rows.map((item, index) => {
                const center = getX(index);
                const revenueHeight = baseline - barY(item.revenueDraw);
                const expenseHeight = baseline - barY(item.expenseDraw);
                const revenueX = center - barWidth - barGap / 2;
                const expenseX = center + barGap / 2;
                const revenueDelay = Math.min(index * 0.08, 1.2);
                const expenseDelay = revenueDelay + 0.12;

                return (
                  <g key={`${item.key}-${index}`}>
                    <rect
                      x={revenueX}
                      y={baseline - revenueHeight}
                      width={barWidth}
                      height={revenueHeight}
                      rx={Math.min(5, barWidth / 2)}
                      className="statistics-bar statistics-bar-revenue statistics-rise"
                      style={{ "--delay": `${revenueDelay}s` }}
                      fill="url(#statisticsRevenueGradient)"
                    />
                    <rect
                      x={expenseX}
                      y={baseline - expenseHeight}
                      width={barWidth}
                      height={expenseHeight}
                      rx={Math.min(5, barWidth / 2)}
                      className="statistics-bar statistics-bar-expense statistics-rise"
                      style={{ "--delay": `${expenseDelay}s` }}
                      fill="url(#statisticsExpenseGradient)"
                    />

                    {renderValueLabel(
                      revenueX + barWidth / 2,
                      item.revenue,
                      item.revenueDraw,
                      "statistics-data-label-revenue",
                      revenueDelay + 0.5
                    )}
                    {renderValueLabel(
                      expenseX + barWidth / 2,
                      item.expenses,
                      item.expenseDraw,
                      "statistics-data-label-expense",
                      expenseDelay + 0.5
                    )}

                    {index % labelStep === 0 && (
                      <text
                        x={center}
                        y={baseline + 24}
                        textAnchor="middle"
                        className="statistics-axis-label statistics-x-label"
                      >
                        {item.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* REVENUE TREND LINE */}
              {count > 1 && (
                <>
                  <polyline
                    points={linePoints}
                    fill="none"
                    className="statistics-trend-line"
                    pathLength="1"
                  />
                  {trendPoints.map((point, index) => (
                    <circle
                      key={`trend-${rows[index].key}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={hoverIndex === index ? 6 : 4.5}
                      className="statistics-trend-point"
                      style={{ "--delay": `${trendDelays[index]}s` }}
                    />
                  ))}
                </>
              )}

              {/* HIT AREAS (mouse, touch and keyboard-free hover) */}
              {rows.map((item, index) => (
                <rect
                  key={`hit-${item.key}-${index}`}
                  x={getX(index) - actualGroupWidth / 2}
                  y={padding.top - 8}
                  width={actualGroupWidth}
                  height={chartHeight + padding.bottom + 8}
                  fill="transparent"
                  className="statistics-hit-area"
                  onPointerEnter={handleHover(index)}
                  onPointerMove={handleHover(index)}
                  onClick={handleToggleHover(index)}
                >
                  <title>
                    {`${item.label}: Revenue ${formatSignedCurrency(item.revenue)}, Expenses ${formatSignedCurrency(
                      item.expenses
                    )}`}
                  </title>
                </rect>
              ))}
            </svg>

            {hovered && (
              <div
                className="statistics-chart-tooltip"
                style={{ left: tooltipLeft, top: 4 }}
                role="status"
              >
                <strong>{hovered.label}</strong>
                <div className="statistics-tooltip-row">
                  <i className="legend-dot legend-dot-revenue" />
                  <span>Revenue</span>
                  <b>{formatSignedCurrency(hovered.revenue)}</b>
                </div>
                <div className="statistics-tooltip-row">
                  <i className="legend-dot legend-dot-expense" />
                  <span>Expenses</span>
                  <b>{formatSignedCurrency(hovered.expenses)}</b>
                </div>
                <div className="statistics-tooltip-row statistics-tooltip-total">
                  <span>Profit / Loss</span>
                  <b className={hovered.profit_loss < 0 ? "is-loss" : "is-profit"}>
                    {formatSignedCurrency(hovered.profit_loss)}
                  </b>
                </div>
                {revenueChange !== null && (
                  <div className="statistics-tooltip-row statistics-tooltip-trend">
                    <span>Revenue vs previous</span>
                    <b className={revenueChange < 0 ? "is-loss" : "is-profit"}>
                      {revenueChange > 0 ? "+" : ""}
                      {revenueChange.toFixed(1)}%
                    </b>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="statistics-chart-footnote">
        <Activity size={14} />
        <span>
          Showing {PERIOD_DESCRIPTIONS[period] || period} performance •{" "}
          {useOwnTrendScale
            ? "Trend uses the right axis (₹0-based) • Tap or hover a period for exact values"
            : "Tap or hover a period for exact values"}
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   TABLE: PERIOD BREAKDOWN (Month / Revenue / Expenses / P&L)
   ============================================================ */

function PeriodBreakdownTable({ data }) {
  const totals = data.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      expenses: acc.expenses + row.expenses,
      profit_loss: acc.profit_loss + row.profit_loss,
    }),
    { revenue: 0, expenses: 0, profit_loss: 0 }
  );

  const cell = {
    padding: "12px 16px",
    textAlign: "right",
    whiteSpace: "nowrap",
    borderBottom: "1px solid rgba(110, 150, 175, 0.14)",
  };
  const headCell = {
    ...cell,
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    opacity: 0.7,
    fontWeight: 600,
  };
  const firstCol = { textAlign: "left" };

  const plColor = (value) =>
    value > 0 ? "#27d17f" : value < 0 ? "#ff4f8b" : "inherit";

  return (
    <div className="statistics-chart-shell">
      <div className="statistics-chart-header">
        <div>
          <span className="statistics-chart-eyebrow">DETAILED REPORT</span>
          <h2>Profit &amp; Loss Breakdown</h2>
          <p>Revenue, expenses and profit/loss for every period in the timeline.</p>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ ...headCell, ...firstCol }}>Period</th>
              <th style={headCell}>Revenue</th>
              <th style={headCell}>Expenses</th>
              <th style={headCell}>Profit / Loss</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const empty = row.revenue === 0 && row.expenses === 0;
              return (
                <tr key={row.key} style={empty ? { opacity: 0.55 } : undefined}>
                  <td style={{ ...cell, ...firstCol }}>{row.label}</td>
                  <td style={cell}>{formatCurrency(row.revenue)}</td>
                  <td style={cell}>{formatCurrency(row.expenses)}</td>
                  <td style={{ ...cell, color: plColor(row.profit_loss), fontWeight: 600 }}>
                    {formatSignedCurrency(row.profit_loss)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {data.length > 1 && (
            <tfoot>
              <tr>
                <td style={{ ...cell, ...firstCol, fontWeight: 700, borderBottom: "none" }}>Total</td>
                <td style={{ ...cell, fontWeight: 700, borderBottom: "none" }}>
                  {formatCurrency(totals.revenue)}
                </td>
                <td style={{ ...cell, fontWeight: 700, borderBottom: "none" }}>
                  {formatCurrency(totals.expenses)}
                </td>
                <td
                  style={{
                    ...cell,
                    fontWeight: 700,
                    borderBottom: "none",
                    color: plColor(totals.profit_loss),
                  }}
                >
                  {formatSignedCurrency(totals.profit_loss)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ============================================================
   CHART: EXPENSE BREAKDOWN (DONUT)
   ============================================================ */

function ExpenseBreakdownChart({ data }) {
  const total = data.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const size = 330;
  const center = size / 2;
  const radius = 92;
  const strokeWidth = 42;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;

  const segments = data.map((item) => {
    const amount = Number(item.amount || 0);
    const fraction = total > 0 ? amount / total : 0;
    const length = fraction * circumference;

    const segment = { ...item, amount, fraction, length, offset: accumulated };
    accumulated += length;
    return segment;
  });

  return (
    <div className="statistics-donut-shell">
      <div className="statistics-donut-header">
        <div>
          <span className="statistics-donut-eyebrow">EXPENSE ANALYSIS</span>
          <h2>Expense Breakdown</h2>
          <p>Operating expense distribution across the selected timeline.</p>
        </div>
        <div className="statistics-donut-total">
          <span>Total Expenses</span>
          <strong>{formatCompactCurrency(total)}</strong>
        </div>
      </div>

      <div className="statistics-donut-content">
        <div className="statistics-donut-visual">
          <div className="statistics-donut-ball" />
          <svg className="statistics-donut-svg" viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="rgba(110, 150, 175, 0.14)"
              strokeWidth={strokeWidth}
            />
            <g className="statistics-donut-segments">
              {segments.map((segment, index) => (
                <circle
                  key={`${segment.category}-${index}`}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={EXPENSE_CATEGORY_COLORS[segment.category] || "#7890a4"}
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  strokeDasharray={`${Math.max(segment.length - 2, 0)} ${circumference}`}
                  strokeDashoffset={-segment.offset}
                  className="statistics-donut-segment"
                  style={{ "--circumference": circumference, "--delay": `${(segment.offset / circumference) * 0.6}s` }}
                />
              ))}
            </g>
          </svg>
          <div className="statistics-donut-center">
            <div className="statistics-donut-center-content">
              <span>EXPENSES</span>
              <strong>{formatCompactCurrency(total)}</strong>
            </div>
          </div>
        </div>

        <div className="statistics-donut-legend">
          {segments.map((item, index) => {
            const percentage = total > 0 ? (item.amount / total) * 100 : 0;
            return (
              <div className="statistics-donut-legend-item" key={`${item.category}-legend-${index}`}>
                <div className="statistics-donut-legend-main">
                  <i
                    className="statistics-donut-legend-dot"
                    style={{ background: EXPENSE_CATEGORY_COLORS[item.category] || "#7890a4" }}
                  />
                  <span>{item.category}</span>
                </div>
                <div className="statistics-donut-legend-value">
                  <strong>{formatCompactCurrency(item.amount)}</strong>
                  <span>{percentage.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   CHART: PURCHASE ORDER STATUS
   ============================================================ */

function PurchaseOrderStatusChart({ data }) {
  const width = 1000;
  const height = 380;
  const padding = { top: 48, right: 42, bottom: 62, left: 62 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const gridLines = 5;

  const total = data.reduce((sum, item) => sum + item.count, 0);
  const maxValue = Math.max(...data.map((item) => item.count), 1);
  const chartMax = Math.max(
    gridLines,
    Math.ceil((maxValue * 1.2) / gridLines) * gridLines
  );

  const groupWidth = chartWidth / Math.max(data.length, 1);
  const barWidth = Math.min(84, groupWidth * 0.42);
  const baseline = padding.top + chartHeight;

  const getX = (index) => padding.left + groupWidth * index + groupWidth / 2;
  const getY = (value) => baseline - (value / chartMax) * chartHeight;

  return (
    <div className="statistics-chart-shell">
      <div className="statistics-chart-header">
        <div>
          <span className="statistics-chart-eyebrow">PURCHASE ORDER ANALYSIS</span>
          <h2>Purchase Order Status</h2>
          <p>Current purchase order distribution by receiving status.</p>
        </div>
        <div className="statistics-po-total">
          <span>Total Orders</span>
          <strong>{total}</strong>
        </div>
      </div>

      <div className="statistics-chart statistics-po-chart">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Purchase order status chart">
          <defs>
            {data.map((item, index) => {
              const color = PO_STATUS_COLORS[item.status] || "#7890a4";
              return (
                <linearGradient key={`po-gradient-${item.status}`} id={`statisticsPoGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} />
                  <stop offset="100%" stopColor={color} stopOpacity="0.68" />
                </linearGradient>
              );
            })}
          </defs>

          {Array.from({ length: gridLines + 1 }).map((_, index) => {
            const value = chartMax - (chartMax / gridLines) * index;
            const y = getY(value);
            return (
              <g key={`po-grid-${index}`}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="statistics-grid-line" />
                <text x={padding.left - 14} y={y + 4} textAnchor="end" className="statistics-axis-label statistics-po-axis-label">
                  {Math.round(value)}
                </text>
              </g>
            );
          })}

          <line x1={padding.left} y1={baseline} x2={width - padding.right} y2={baseline} stroke="rgba(65,130,165,0.25)" strokeWidth="1" />

          {data.map((item, index) => {
            const color = PO_STATUS_COLORS[item.status] || "#7890a4";
            const center = getX(index);
            const barHeight = (item.count / chartMax) * chartHeight;
            const delay = index * 0.1;

            return (
              <g key={item.status}>
                <rect
                  x={center - barWidth / 2}
                  y={baseline - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx="8"
                  fill={`url(#statisticsPoGradient-${index})`}
                  className="statistics-bar statistics-rise statistics-po-bar"
                  style={{ "--delay": `${delay}s`, filter: `drop-shadow(0 5px 9px ${color}44)` }}
                />
                <text
                  x={center}
                  y={getY(item.count) - 12}
                  textAnchor="middle"
                  fill={color}
                  className="statistics-data-label statistics-data-label-po statistics-fade-in"
                  style={{ "--delay": `${delay + 0.45}s` }}
                >
                  {item.count}
                </text>
                <text
                  x={center}
                  y={baseline + 30}
                  textAnchor="middle"
                  className="statistics-axis-label statistics-x-label statistics-po-x-label"
                >
                  {item.status}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ============================================================
   KPI CARD
   ============================================================ */

function KpiCard({ title, value, subtitle, icon: Icon, theme, trend }) {
  return (
    <article className={`statistics-kpi-card statistics-kpi-${theme}`}>
      <div className="statistics-kpi-glow" />
      <div className="statistics-kpi-top">
        <div className="statistics-kpi-icon">
          <Icon size={20} strokeWidth={1.8} />
        </div>
        {trend && <span className="statistics-kpi-trend">{trend}</span>}
      </div>
      <div className="statistics-kpi-body">
        <span className="statistics-kpi-label">{title}</span>
        <strong className="statistics-kpi-value">{value}</strong>
        <span className="statistics-kpi-subtitle">{subtitle}</span>
      </div>
    </article>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function AdminStatistics() {
  const { accessToken } = useAuth();

  const [period, setPeriod] = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError("");

      // Build query string
      const params = new URLSearchParams({ period });
      if (period === "custom" && customStart && customEnd) {
        params.append("from", customStart);
        params.append("to", customEnd);
      }

      const response = await api.get(`${STATISTICS_ENDPOINT}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.data?.success) {
        throw new Error("Invalid statistics data response.");
      }

      setData(response.data.data ? { ...response.data.data, range: response.data.range } : null);
    } catch (err) {
      console.error("Failed to fetch statistics:", err);
      setError(err?.response?.data?.message || "Failed to load statistics.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, period, customStart, customEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived data with fallbacks
  const kpis = data?.kpis || { revenue: 0, expenses: 0, outstanding: 0, projects: 0 };
  const expenseBreakdown = data?.expense_breakdown || [];
  const poStatus = data?.po_status || [];

  // Normalise chart rows: numbers only, profit_loss always present
  const chartData = useMemo(() => {
    const rows = Array.isArray(data?.chart_data) ? data.chart_data : [];
    return rows.map((row, index) => {
      const revenue = Number(row.revenue) || 0;
      const expenses = Number(row.expenses) || 0;
      return {
        key: row.key || `row-${index}`,
        label: row.label || row.key || "",
        revenue,
        expenses,
        profit_loss:
          row.profit_loss !== undefined && row.profit_loss !== null
            ? Number(row.profit_loss) || 0
            : revenue - expenses,
      };
    });
  }, [data]);

  // True when at least one bucket has real money movement
  const hasActivity = chartData.some((row) => row.revenue !== 0 || row.expenses !== 0);

  const rangeLabel = useMemo(() => {
    if (!data?.range) return "—";
    const startDate = parseISODate(data.range.start);
    const endDate = parseISODate(data.range.end);
    if (!startDate || !endDate) return "—";
    const start = startDate.toLocaleDateString("en-IN");
    const end = endDate.toLocaleDateString("en-IN");
    return `${start} — ${end}`;
  }, [data]);

  return (
    <div className="statistics-page">
      {/* HERO */}
      <section className="statistics-hero">
        <div className="statistics-hero-content">
          <span className="statistics-eyebrow">ADMINISTRATIVE INTELLIGENCE</span>
          <h1>Statistics</h1>
          <p>Financial performance, project activity and outstanding business metrics in one view.</p>
        </div>
        <div className="statistics-hero-orbit statistics-orbit-one" />
        <div className="statistics-hero-orbit statistics-orbit-two" />
        <div className="statistics-hero-grid" />
      </section>

      {/* TIMELINE */}
      <section className="statistics-filter-panel">
        <div className="statistics-filter-heading">
          <div className="statistics-filter-icon">
            <CalendarDays size={18} />
          </div>
          <div>
            <span>TIME RANGE</span>
            <strong>Performance Timeline</strong>
          </div>
        </div>

        <div className="statistics-period-buttons">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={period === option.value ? "is-active" : ""}
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="statistics-custom-range">
            <label>
              <span>From</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </label>
            <label>
              <span>To</span>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="statistics-range-status">
          <span>ACTIVE RANGE</span>
          <strong>{rangeLabel}</strong>
        </div>
      </section>

      {/* STATES: LOADING / ERROR */}
      {loading ? (
        <div style={{ padding: 60, display: "flex", justifyContent: "center" }}>
          <Loading />
        </div>
      ) : error ? (
        <div style={{ padding: 40 }}>
          <ErrorState onRetry={fetchData} />
          <p style={{ textAlign: "center", marginTop: 12, color: "#ff4f8b" }}>{error}</p>
        </div>
      ) : (
        <>
          {/* KPI CARDS */}
          <section className="statistics-kpi-grid">
            <KpiCard
              title="Total Revenue"
              value={formatCurrency(kpis.revenue)}
              subtitle="Income transactions"
              icon={TrendingUp}
              theme="revenue"
              trend="IN"
            />
            <KpiCard
              title="Expenses"
              value={formatCurrency(kpis.expenses)}
              subtitle="Expense transactions"
              icon={TrendingDown}
              theme="expense"
              trend="OUT"
            />
            <KpiCard
              title="Outstanding Amount"
              value={formatCurrency(kpis.outstanding)}
              subtitle="Pending customer amount"
              icon={WalletCards}
              theme="outstanding"
            />
            <KpiCard
              title="Total Projects"
              value={kpis.projects}
              subtitle="Projects in selected period"
              icon={FolderKanban}
              theme="projects"
            />
          </section>

          {/* REVENUE VS EXPENSES + EXPENSE BREAKDOWN */}
          <section className="statistics-charts-row">
            <div className="statistics-visual-section statistics-revenue-card">
              <RevenueExpenseChart
                key={`rev-${period}-${customStart}-${customEnd}`}
                data={
                  chartData.length > 0
                    ? chartData
                    : [{ key: "empty", label: "No Data", revenue: 0, expenses: 0, profit_loss: 0 }]
                }
                period={period}
              />

              {!hasActivity && (
                <div className="statistics-chart-empty-overlay">
                  <div className="statistics-chart-empty-icon">
                    <CircleDollarSign size={18} />
                  </div>
                  <strong>No financial activity</strong>
                  <span>There are no income or expense records inside the selected period.</span>
                </div>
              )}
            </div>

            <div className="statistics-visual-section statistics-donut-card">
              <ExpenseBreakdownChart
                key={`donut-${period}-${customStart}-${customEnd}`}
                data={expenseBreakdown.length > 0 ? expenseBreakdown : [{ category: "No Expenses", amount: 0 }]}
              />
            </div>
          </section>

          {/* PERIOD-BY-PERIOD PROFIT / LOSS TABLE */}
          {chartData.length > 0 && (
            <section className="statistics-visual-section">
              <PeriodBreakdownTable data={chartData} />
            </section>
          )}

          {/* PURCHASE ORDER STATUS */}
          <section className="statistics-visual-section statistics-po-card">
            <PurchaseOrderStatusChart
              key={`po-${period}-${customStart}-${customEnd}`}
              data={poStatus.length > 0 ? poStatus : [{ status: "No POs", count: 0 }]}
            />
          </section>
        </>
      )}
    </div>
  );
}