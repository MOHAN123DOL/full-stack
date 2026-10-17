import { useCallback, useEffect, useMemo, useState } from "react";

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

/* ============================================================
   FORMATTERS & HELPERS
   ============================================================ */

const formatCurrency = (value) => {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
};

const formatCompactCurrency = (value) => {
  const number = Number(value || 0);
  if (number >= 10000000) return `₹${(number / 10000000).toFixed(1)}Cr`;
  if (number >= 100000) return `₹${(number / 100000).toFixed(1)}L`;
  if (number >= 1000) return `₹${(number / 1000).toFixed(1)}K`;
  return `₹${number.toFixed(0)}`;
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
   ============================================================ */

function RevenueExpenseChart({ data, period }) {
  const width = 1000;
  const height = 430;
  const padding = { top: 55, right: 42, bottom: 76, left: 82 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(
    ...data.map((item) => Math.max(item.revenue, item.expenses)),
    1
  );
  const chartMax = maxValue * 1.2;
  const groupWidth = chartWidth / Math.max(data.length, 1);
  const barWidth = Math.min(30, Math.max(14, groupWidth * 0.22));
  const barGap = Math.min(9, Math.max(4, groupWidth * 0.07));
  const baseline = padding.top + chartHeight;

  const getX = (index) => padding.left + groupWidth * index + groupWidth / 2;
  const getY = (value) => baseline - (value / chartMax) * chartHeight;

  const linePoints = data
    .map((item, index) => `${getX(index)},${getY(item.revenue)}`)
    .join(" ");

  const gridLines = 5;

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
          </span>
        </div>
      </div>

      <div className="statistics-chart">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue versus expenses chart">
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

          {/* GRID */}
          {Array.from({ length: gridLines + 1 }).map((_, index) => {
            const value = chartMax - (chartMax / gridLines) * index;
            const y = getY(value);
            return (
              <g key={`grid-${index}`}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="statistics-grid-line" />
                <text x={padding.left - 14} y={y + 4} textAnchor="end" className="statistics-axis-label">
                  {formatCompactCurrency(value)}
                </text>
              </g>
            );
          })}

          {/* BASELINE */}
          <line x1={padding.left} y1={baseline} x2={width - padding.right} y2={baseline} stroke="rgba(65,130,165,0.25)" strokeWidth="1" />

          {/* BARS */}
          {data.map((item, index) => {
            const center = getX(index);
            const revenueHeight = (item.revenue / chartMax) * chartHeight;
            const expenseHeight = (item.expenses / chartMax) * chartHeight;
            const revenueX = center - barWidth - barGap / 2;
            const expenseX = center + barGap / 2;
            const revenueDelay = index * 0.08;
            const expenseDelay = revenueDelay + 0.12;

            return (
              <g key={`${item.key}-${index}`}>
                <rect
                  x={revenueX}
                  y={baseline - revenueHeight}
                  width={barWidth}
                  height={revenueHeight}
                  rx="5"
                  className="statistics-bar statistics-bar-revenue statistics-rise"
                  style={{ "--delay": `${revenueDelay}s` }}
                  fill="url(#statisticsRevenueGradient)"
                />
                <rect
                  x={expenseX}
                  y={baseline - expenseHeight}
                  width={barWidth}
                  height={expenseHeight}
                  rx="5"
                  className="statistics-bar statistics-bar-expense statistics-rise"
                  style={{ "--delay": `${expenseDelay}s` }}
                  fill="url(#statisticsExpenseGradient)"
                />
                <text
                  x={revenueX + barWidth / 2}
                  y={getY(item.revenue) - 10}
                  textAnchor="middle"
                  className="statistics-data-label statistics-data-label-revenue statistics-fade-in"
                  style={{ "--delay": `${revenueDelay + 0.5}s` }}
                >
                  {formatCompactCurrency(item.revenue)}
                </text>
                <text
                  x={expenseX + barWidth / 2}
                  y={getY(item.expenses) - 10}
                  textAnchor="middle"
                  className="statistics-data-label statistics-data-label-expense statistics-fade-in"
                  style={{ "--delay": `${expenseDelay + 0.5}s` }}
                >
                  {formatCompactCurrency(item.expenses)}
                </text>
                <text x={center} y={height - 31} textAnchor="middle" className="statistics-axis-label statistics-x-label">
                  {item.label}
                </text>
              </g>
            );
          })}

          {/* REVENUE TREND LINE */}
          {data.length > 1 && (
            <>
              <polyline points={linePoints} fill="none" className="statistics-trend-line" pathLength="1" />
              {data.map((item, index) => (
                <circle
                  key={`trend-${item.key}-${index}`}
                  cx={getX(index)}
                  cy={getY(item.revenue)}
                  r="4.5"
                  className="statistics-trend-point"
                  style={{ "--delay": `${0.35 + (index / (data.length - 1)) * 1.8}s` }}
                />
              ))}
            </>
          )}
        </svg>
      </div>

      <div className="statistics-chart-footnote">
        <Activity size={14} />
        <span>Showing {period} performance • Bars animate from zero on load</span>
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

      setData(response.data.data);
    } catch (err) {
      console.error("Failed to fetch statistics:", err);
      setError(err?.response?.data?.message || "Failed to load statistics.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, period, customStart, customEnd]);

  // This useEffect runs every time the page mounts, 
  // and every time period/customStart/customEnd changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived data with fallbacks
  const kpis = data?.kpis || { revenue: 0, expenses: 0, outstanding: 0, projects: 0 };
  const chartData = data?.chart_data || [];
  const expenseBreakdown = data?.expense_breakdown || [];
  const poStatus = data?.po_status || [];

  const rangeLabel = useMemo(() => {
    if (!data?.range) return "—";
    const start = new Date(data.range.start).toLocaleDateString("en-IN");
    const end = new Date(data.range.end).toLocaleDateString("en-IN");
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
                    : [{ key: "empty", label: "No Data", revenue: 0, expenses: 0 }]
                }
                period={period}
              />

              {chartData.length === 0 && (
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