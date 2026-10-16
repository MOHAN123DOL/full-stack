import { useMemo, useState } from "react";

import {
  Activity,
  CalendarDays,
  CircleDollarSign,
  FolderKanban,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import "./AdminStatistics.css";


/* ============================================================
   CONFIGURATION
   ============================================================ */

/*
 * Keep this TRUE while designing/testing the dashboard.
 *
 * Later, when the backend is ready:
 *
 * USE_FAKE_DATA = false
 *
 * and we can reconnect this page to the journal API.
 */
const USE_FAKE_DATA = true;


/* ============================================================
   PERIOD OPTIONS
   ============================================================ */

const PERIOD_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom" },
];


/* ============================================================
   DATE HELPERS
   ============================================================ */

const startOfDay = (date) => {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  return result;
};


const endOfDay = (date) => {
  const result = new Date(date);

  result.setHours(23, 59, 59, 999);

  return result;
};


const startOfWeek = (date) => {
  const result = startOfDay(date);

  const day = result.getDay();

  const diff = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + diff);

  return result;
};


const endOfWeek = (date) => {
  const result = startOfWeek(date);

  result.setDate(result.getDate() + 6);

  return endOfDay(result);
};


const startOfMonth = (date) => {
  return startOfDay(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      1
    )
  );
};


const endOfMonth = (date) => {
  return endOfDay(
    new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0
    )
  );
};


const startOfQuarter = (date) => {
  const quarterStartMonth =
    Math.floor(date.getMonth() / 3) * 3;

  return startOfDay(
    new Date(
      date.getFullYear(),
      quarterStartMonth,
      1
    )
  );
};


const endOfQuarter = (date) => {
  const quarterStartMonth =
    Math.floor(date.getMonth() / 3) * 3;

  return endOfDay(
    new Date(
      date.getFullYear(),
      quarterStartMonth + 3,
      0
    )
  );
};


const startOfYear = (date) => {
  return startOfDay(
    new Date(
      date.getFullYear(),
      0,
      1
    )
  );
};


const endOfYear = (date) => {
  return endOfDay(
    new Date(
      date.getFullYear(),
      11,
      31
    )
  );
};


const shiftDate = (days) => {
  const result = new Date();

  result.setDate(result.getDate() + days);

  return result;
};


const shiftMonths = (months) => {
  const result = new Date();

  result.setMonth(result.getMonth() + months);

  return result;
};


const toISODate = (date) => {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};


const parseDate = (value) => {
  if (!value) return null;

  const date = new Date(
    `${String(value).slice(0, 10)}T00:00:00`
  );

  return Number.isNaN(date.getTime())
    ? null
    : date;
};


/* ============================================================
   RANGE CALCULATION
   ============================================================ */

const getPeriodRange = (
  period,
  customStart,
  customEnd
) => {
  const today = new Date();

  switch (period) {
    case "day":
      return {
        start: startOfDay(today),
        end: endOfDay(today),
      };

    case "week":
      return {
        start: startOfWeek(today),
        end: endOfWeek(today),
      };

    case "month":
      return {
        start: startOfMonth(today),
        end: endOfMonth(today),
      };

    case "quarter":
      return {
        start: startOfQuarter(today),
        end: endOfQuarter(today),
      };

    case "year":
      return {
        start: startOfYear(today),
        end: endOfYear(today),
      };

    case "custom":
      if (!customStart || !customEnd) {
        return {
          start: startOfMonth(today),
          end: endOfMonth(today),
        };
      }

      return {
        start: startOfDay(
          new Date(`${customStart}T00:00:00`)
        ),

        end: endOfDay(
          new Date(`${customEnd}T00:00:00`)
        ),
      };

    default:
      return {
        start: startOfMonth(today),
        end: endOfMonth(today),
      };
  }
};


/* ============================================================
   FORMATTERS
   ============================================================ */

const formatCurrency = (value) => {
  return `₹${Number(value || 0).toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 0,
    }
  )}`;
};


const formatCompactCurrency = (value) => {
  const number = Number(value || 0);

  if (number >= 10000000) {
    return `₹${(
      number / 10000000
    ).toFixed(1)}Cr`;
  }

  if (number >= 100000) {
    return `₹${(
      number / 100000
    ).toFixed(1)}L`;
  }

  if (number >= 1000) {
    return `₹${(
      number / 1000
    ).toFixed(1)}K`;
  }

  return `₹${number.toFixed(0)}`;
};


const formatDateInput = (date) => {
  return toISODate(date);
};


/* ============================================================
   FAKE JOURNAL DATA
   ============================================================ */

/*
 * The dates are generated relative to today's date.
 *
 * This means the dashboard will continue to work even when
 * you open it on another date.
 */

const monthDay = (monthsBack, day) => {
  const now = new Date();

  return toISODate(
    new Date(
      now.getFullYear(),
      now.getMonth() - monthsBack,
      day
    )
  );
};

const FAKE_JOURNAL_DATA = [
  /* Current day */
  { id: 1, date: toISODate(shiftDate(0)), type: "Income", amount: 185000 },
  { id: 2, date: toISODate(shiftDate(0)), type: "Expense", amount: 72000 },

  /* Current week */
  { id: 3, date: toISODate(shiftDate(-1)), type: "Income", amount: 142000 },
  { id: 4, date: toISODate(shiftDate(-2)), type: "Expense", amount: 58000 },
  { id: 5, date: toISODate(shiftDate(-3)), type: "Income", amount: 218000 },
  { id: 6, date: toISODate(shiftDate(-4)), type: "Expense", amount: 91000 },
  { id: 7, date: toISODate(shiftDate(-5)), type: "Income", amount: 165000 },
  { id: 8, date: toISODate(shiftDate(-6)), type: "Expense", amount: 63000 },

  /* Previous month */
  { id: 9, date: toISODate(shiftMonths(-1)), type: "Income", amount: 680000 },
  { id: 10, date: monthDay(1, 8), type: "Expense", amount: 315000 },
  { id: 11, date: monthDay(1, 15), type: "Income", amount: 540000 },
  { id: 12, date: monthDay(1, 21), type: "Expense", amount: 225000 },

  /* Two months ago */
  { id: 13, date: toISODate(shiftMonths(-2)), type: "Income", amount: 590000 },
  { id: 14, date: monthDay(2, 12), type: "Expense", amount: 278000 },

  /* Three months ago */
  { id: 15, date: toISODate(shiftMonths(-3)), type: "Income", amount: 740000 },
  { id: 16, date: monthDay(3, 17), type: "Expense", amount: 332000 },

  /* Four months ago */
  { id: 17, date: toISODate(shiftMonths(-4)), type: "Income", amount: 625000 },
  { id: 18, date: monthDay(4, 13), type: "Expense", amount: 287000 },

  /* Five months ago */
  { id: 19, date: toISODate(shiftMonths(-5)), type: "Income", amount: 515000 },
  { id: 20, date: monthDay(5, 19), type: "Expense", amount: 241000 },

  /* Six months ago */
  { id: 21, date: toISODate(shiftMonths(-6)), type: "Income", amount: 580000 },
  { id: 22, date: monthDay(6, 16), type: "Expense", amount: 268000 },

  /* Seven months ago */
  { id: 23, date: toISODate(shiftMonths(-7)), type: "Income", amount: 470000 },
  { id: 24, date: monthDay(7, 14), type: "Expense", amount: 218000 },

  /* Eight months ago */
  { id: 25, date: toISODate(shiftMonths(-8)), type: "Income", amount: 525000 },
  { id: 26, date: monthDay(8, 11), type: "Expense", amount: 246000 },

  /* Nine months ago */
  { id: 27, date: toISODate(shiftMonths(-9)), type: "Income", amount: 455000 },
  { id: 28, date: monthDay(9, 18), type: "Expense", amount: 201000 },

  /* Ten months ago */
  { id: 29, date: toISODate(shiftMonths(-10)), type: "Income", amount: 490000 },
  { id: 30, date: monthDay(10, 16), type: "Expense", amount: 232000 },

  /* Eleven months ago */
  { id: 31, date: toISODate(shiftMonths(-11)), type: "Income", amount: 430000 },
  { id: 32, date: monthDay(11, 20), type: "Expense", amount: 194000 },
];


/* ============================================================
   FAKE OUTSTANDING DATA
   ============================================================ */

const FAKE_OUTSTANDING_DATA = [
  { id: "INV-1001", date: toISODate(shiftDate(0)), amount: 85000 },
  { id: "INV-1002", date: toISODate(shiftDate(-2)), amount: 126000 },
  { id: "INV-1003", date: toISODate(shiftDate(-5)), amount: 94000 },
  { id: "INV-1004", date: toISODate(shiftMonths(-1)), amount: 210000 },
  { id: "INV-1005", date: toISODate(shiftMonths(-2)), amount: 175000 },
  { id: "INV-1006", date: toISODate(shiftMonths(-3)), amount: 145000 },
  { id: "INV-1007", date: toISODate(shiftMonths(-5)), amount: 98000 },
  { id: "INV-1008", date: toISODate(shiftMonths(-7)), amount: 185000 },
];

const FAKE_EXPENSE_BREAKDOWN = [
  { category: "Purchase", amount: 420000 },
  { category: "Transport", amount: 185000 },
  { category: "Salary", amount: 310000 },
  { category: "Rent", amount: 125000 },
  { category: "Electricity", amount: 85000 },
  { category: "Maintenance", amount: 95000 },
  { category: "Office", amount: 55000 },
  { category: "Sales", amount: 70000 },
  { category: "Other", amount: 45000 },
];

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

const EXPENSE_TIMELINE_MULTIPLIERS = {
  day: 0.14,
  week: 0.32,
  month: 1,
  quarter: 2.65,
  year: 10.8,
  custom: 0.72,
};


/* ============================================================
   FAKE PURCHASE ORDER STATUS DATA
   ============================================================ */

/*
 * To add a new status, add one entry here and one colour
 * in PO_STATUS_COLORS below.
 */

const FAKE_PURCHASE_ORDER_STATUS = [
  { status: "Pending", count: 18 },
  { status: "Partially Received", count: 11 },
  { status: "Outstanding", count: 14 },
  { status: "Fully Received", count: 32 },
];

const PO_STATUS_COLORS = {
  Pending: "#ffb020",
  "Partially Received": "#8b5cf6",
  Outstanding: "#ff4f8b",
  "Fully Received": "#27d17f",
};

const PO_TIMELINE_MULTIPLIERS = {
  day: 0.14,
  week: 0.4,
  month: 1,
  quarter: 2.7,
  year: 10.5,
  custom: 0.75,
};


/* ============================================================
   FAKE PROJECT DATA
   ============================================================ */

const FAKE_PROJECT_DATA = [
  { id: "PRJ-001", date: toISODate(shiftDate(0)), name: "Industrial Warehouse" },
  { id: "PRJ-002", date: toISODate(shiftDate(-3)), name: "Factory Expansion" },
  { id: "PRJ-003", date: toISODate(shiftDate(-7)), name: "Office Development" },
  { id: "PRJ-004", date: toISODate(shiftMonths(-1)), name: "Production Block" },
  { id: "PRJ-005", date: toISODate(shiftMonths(-2)), name: "Electrical Upgrade" },
  { id: "PRJ-006", date: toISODate(shiftMonths(-3)), name: "Plant Maintenance" },
  { id: "PRJ-007", date: toISODate(shiftMonths(-4)), name: "New Assembly Unit" },
  { id: "PRJ-008", date: toISODate(shiftMonths(-5)), name: "Storage Facility" },
  { id: "PRJ-009", date: toISODate(shiftMonths(-6)), name: "Machine Installation" },
  { id: "PRJ-010", date: toISODate(shiftMonths(-7)), name: "Infrastructure Project" },
  { id: "PRJ-011", date: toISODate(shiftMonths(-8)), name: "Plant Extension" },
  { id: "PRJ-012", date: toISODate(shiftMonths(-10)), name: "Commercial Facility" },
];


/* ============================================================
   CHART GROUPING
   ============================================================ */

const getGroupKey = (date, period) => {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");


  if (period === "day") {
    return `${year}-${month}-${day}`;
  }


  if (period === "week") {
    return formatDateInput(
      startOfWeek(date)
    );
  }


  if (period === "month") {
    return `${year}-${month}`;
  }


  if (period === "quarter") {
    const quarter =
      Math.floor(date.getMonth() / 3) + 1;

    return `${year}-Q${quarter}`;
  }


  if (period === "year") {
    return String(year);
  }


  return `${year}-${month}-${day}`;
};


const getGroupLabel = (key, period) => {
  if (period === "day") {
    const date = parseDate(key);

    if (!date) return key;

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
      }
    );
  }


  if (period === "week") {
    const date = parseDate(key);

    if (!date) return key;

    return `Wk ${date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
      }
    )}`;
  }


  if (period === "month") {
    const [year, month] =
      key.split("-");

    const date = new Date(
      Number(year),
      Number(month) - 1,
      1
    );

    return date.toLocaleDateString(
      "en-IN",
      {
        month: "short",
        year: "2-digit",
      }
    );
  }


  if (period === "quarter") {
    return key;
  }


  if (period === "year") {
    return key;
  }


  return key;
};


/* ============================================================
   REVENUE VS EXPENSES CHART
   ============================================================ */

function RevenueExpenseChart({
  data,
  period,
}) {
  const width = 1000;

  const height = 430;

  const padding = {
    top: 55,
    right: 42,
    bottom: 76,
    left: 82,
  };


  const chartWidth =
    width -
    padding.left -
    padding.right;


  const chartHeight =
    height -
    padding.top -
    padding.bottom;


  const maxValue = Math.max(
    ...data.map((item) =>
      Math.max(
        item.revenue,
        item.expenses
      )
    ),
    1
  );


  const chartMax =
    maxValue * 1.2;


  const groupWidth =
    chartWidth /
    Math.max(data.length, 1);


  const barWidth = Math.min(
    30,
    Math.max(
      14,
      groupWidth * 0.22
    )
  );


  const barGap = Math.min(
    9,
    Math.max(
      4,
      groupWidth * 0.07
    )
  );


  const baseline =
    padding.top +
    chartHeight;


  const getX = (index) => {
    return (
      padding.left +
      groupWidth * index +
      groupWidth / 2
    );
  };


  const getY = (value) => {
    return (
      padding.top +
      chartHeight -
      (value / chartMax) *
        chartHeight
    );
  };


  const linePoints = data
    .map((item, index) => {
      return `${getX(index)},${getY(
        item.revenue
      )}`;
    })
    .join(" ");


  const gridLines = 5;


  return (
    <div className="statistics-chart-shell">

      {/* =====================================================
          CHART HEADER
          ===================================================== */}

      <div className="statistics-chart-header">

        <div>
          <span className="statistics-chart-eyebrow">
            FINANCIAL PERFORMANCE
          </span>

          <h2>
            Revenue vs Expenses
          </h2>

          <p>
            Revenue and operating expenses
            across the selected timeline.
          </p>
        </div>


        <div className="statistics-chart-legend">

          <span>
            <i className="legend-dot legend-dot-revenue" />
            Revenue
          </span>

          <span>
            <i className="legend-dot legend-dot-expense" />
            Expenses
          </span>

          <span>
            <i className="legend-line" />
            Revenue Trend
          </span>

        </div>

      </div>


      {/* =====================================================
          SVG CHART
          ===================================================== */}

      <div className="statistics-chart">

        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Revenue versus expenses chart"
        >

          <defs>

            <linearGradient
              id="statisticsRevenueGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#00eaff"
              />

              <stop
                offset="100%"
                stopColor="#087df2"
              />
            </linearGradient>


            <linearGradient
              id="statisticsExpenseGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#ff52ad"
              />

              <stop
                offset="100%"
                stopColor="#f45b70"
              />
            </linearGradient>

          </defs>


          {/* GRID */}

          {Array.from({
            length: gridLines + 1,
          }).map((_, index) => {

            const value =
              chartMax -
              (chartMax / gridLines) *
                index;

            const y =
              getY(value);


            return (
              <g
                key={`grid-${index}`}
              >

                <line
                  x1={padding.left}
                  y1={y}
                  x2={
                    width -
                    padding.right
                  }
                  y2={y}
                  className="statistics-grid-line"
                />


                <text
                  x={
                    padding.left - 14
                  }
                  y={y + 4}
                  textAnchor="end"
                  className="statistics-axis-label"
                >
                  {formatCompactCurrency(
                    value
                  )}
                </text>

              </g>
            );
          })}


          {/* BASELINE */}

          <line
            x1={padding.left}
            y1={baseline}
            x2={
              width -
              padding.right
            }
            y2={baseline}
            stroke="rgba(65,130,165,0.25)"
            strokeWidth="1"
          />


          {/* BARS */}

          {data.map(
            (item, index) => {

              const center =
                getX(index);


              const revenueHeight =
                (item.revenue /
                  chartMax) *
                chartHeight;


              const expenseHeight =
                (item.expenses /
                  chartMax) *
                chartHeight;


              const revenueX =
                center -
                barWidth -
                barGap / 2;


              const expenseX =
                center +
                barGap / 2;


              const revenueDelay =
                index * 0.08;


              const expenseDelay =
                revenueDelay + 0.12;


              return (
                <g
                  key={`${item.key}-${index}`}
                >

                  <rect
                    x={revenueX}
                    y={baseline - revenueHeight}
                    width={barWidth}
                    height={revenueHeight}
                    rx="5"
                    className="statistics-bar statistics-bar-revenue statistics-rise"
                    style={{
                      "--delay": `${revenueDelay}s`,
                    }}
                    fill="url(#statisticsRevenueGradient)"
                  />


                  <rect
                    x={expenseX}
                    y={baseline - expenseHeight}
                    width={barWidth}
                    height={expenseHeight}
                    rx="5"
                    className="statistics-bar statistics-bar-expense statistics-rise"
                    style={{
                      "--delay": `${expenseDelay}s`,
                    }}
                    fill="url(#statisticsExpenseGradient)"
                  />


                  <text
                    x={
                      revenueX +
                      barWidth / 2
                    }
                    y={
                      getY(
                        item.revenue
                      ) - 10
                    }
                    textAnchor="middle"
                    className="statistics-data-label statistics-data-label-revenue statistics-fade-in"
                    style={{
                      "--delay": `${revenueDelay + 0.5}s`,
                    }}
                  >
                    {formatCompactCurrency(
                      item.revenue
                    )}
                  </text>


                  <text
                    x={
                      expenseX +
                      barWidth / 2
                    }
                    y={
                      getY(
                        item.expenses
                      ) - 10
                    }
                    textAnchor="middle"
                    className="statistics-data-label statistics-data-label-expense statistics-fade-in"
                    style={{
                      "--delay": `${expenseDelay + 0.5}s`,
                    }}
                  >
                    {formatCompactCurrency(
                      item.expenses
                    )}
                  </text>


                  <text
                    x={center}
                    y={
                      height - 31
                    }
                    textAnchor="middle"
                    className="statistics-axis-label statistics-x-label"
                  >
                    {item.label}
                  </text>

                </g>
              );
            }
          )}


          {/* REVENUE TREND LINE */}

          {data.length > 1 && (
            <>
              <polyline
                points={linePoints}
                fill="none"
                className="statistics-trend-line"
                pathLength="1"
              />


              {data.map(
                (item, index) => (
                  <circle
                    key={`trend-${item.key}-${index}`}
                    cx={getX(index)}
                    cy={getY(
                      item.revenue
                    )}
                    r="4.5"
                    className="statistics-trend-point"
                    style={{
                      "--delay": `${
                        0.35 +
                        (index /
                          (data.length - 1)) *
                          1.8
                      }s`,
                    }}
                  />
                )
              )}

            </>
          )}

        </svg>

      </div>


      {/* FOOTNOTE */}

      <div className="statistics-chart-footnote">

        <Activity size={14} />

        <span>
          Showing {period} performance •
          Bars animate from zero on load
        </span>

      </div>

    </div>
  );
}


/* ============================================================
   EXPENSE BREAKDOWN CHART
   ============================================================ */

function ExpenseBreakdownChart({ data }) {
  const total = data.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

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

    const segment = {
      ...item,
      amount,
      fraction,
      length,
      offset: accumulated,
    };

    accumulated += length;

    return segment;
  });

  return (
    <div className="statistics-donut-shell">
      <div className="statistics-donut-header">
        <div>
          <span className="statistics-donut-eyebrow">
            EXPENSE ANALYSIS
          </span>

          <h2>Expense Breakdown</h2>

          <p>
            Operating expense distribution across the selected timeline.
          </p>
        </div>

        <div className="statistics-donut-total">
          <span>Total Expenses</span>
          <strong>{formatCompactCurrency(total)}</strong>
        </div>
      </div>

      <div className="statistics-donut-content">
        <div className="statistics-donut-visual">
          <div className="statistics-donut-ball" />

          <svg
            className="statistics-donut-svg"
            viewBox={`0 0 ${size} ${size}`}
          >
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
                  stroke={
                    EXPENSE_CATEGORY_COLORS[segment.category] ||
                    "#7890a4"
                  }
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  strokeDasharray={`${Math.max(
                    segment.length - 2,
                    0
                  )} ${circumference}`}
                  strokeDashoffset={-segment.offset}
                  className="statistics-donut-segment"
                  style={{
                    "--circumference": circumference,
                    "--delay": `${
                      (segment.offset / circumference) * 0.6
                    }s`,
                  }}
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
            const percentage =
              total > 0 ? (item.amount / total) * 100 : 0;

            return (
              <div
                className="statistics-donut-legend-item"
                key={`${item.category}-legend-${index}`}
              >
                <div className="statistics-donut-legend-main">
                  <i
                    className="statistics-donut-legend-dot"
                    style={{
                      background:
                        EXPENSE_CATEGORY_COLORS[item.category] ||
                        "#7890a4",
                    }}
                  />

                  <span>{item.category}</span>
                </div>

                <div className="statistics-donut-legend-value">
                  <strong>
                    {formatCompactCurrency(item.amount)}
                  </strong>

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
   PURCHASE ORDER STATUS CHART
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
          <span className="statistics-chart-eyebrow">
            PURCHASE ORDER ANALYSIS
          </span>

          <h2>Purchase Order Status</h2>

          <p>Current purchase order distribution by receiving status.</p>
        </div>

        <div className="statistics-po-total">
          <span>Total Orders</span>
          <strong>{total}</strong>
        </div>
      </div>

      <div className="statistics-chart statistics-po-chart">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Purchase order status chart"
        >
          <defs>
            {data.map((item, index) => {
              const color = PO_STATUS_COLORS[item.status] || "#7890a4";

              return (
                <linearGradient
                  key={`po-gradient-${item.status}`}
                  id={`statisticsPoGradient-${index}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
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
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  className="statistics-grid-line"
                />

                <text
                  x={padding.left - 14}
                  y={y + 4}
                  textAnchor="end"
                  className="statistics-axis-label statistics-po-axis-label"
                >
                  {Math.round(value)}
                </text>
              </g>
            );
          })}

          <line
            x1={padding.left}
            y1={baseline}
            x2={width - padding.right}
            y2={baseline}
            stroke="rgba(65,130,165,0.25)"
            strokeWidth="1"
          />

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
                  style={{
                    "--delay": `${delay}s`,
                    filter: `drop-shadow(0 5px 9px ${color}44)`,
                  }}
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

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  theme,
  trend,
}) {
  return (
    <article
      className={
        `statistics-kpi-card statistics-kpi-${theme}`
      }
    >

      <div className="statistics-kpi-glow" />


      <div className="statistics-kpi-top">

        <div className="statistics-kpi-icon">
          <Icon
            size={20}
            strokeWidth={1.8}
          />
        </div>


        {trend && (
          <span className="statistics-kpi-trend">
            {trend}
          </span>
        )}

      </div>


      <div className="statistics-kpi-body">

        <span className="statistics-kpi-label">
          {title}
        </span>

        <strong className="statistics-kpi-value">
          {value}
        </strong>

        <span className="statistics-kpi-subtitle">
          {subtitle}
        </span>

      </div>

    </article>
  );
}


/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function AdminStatistics() {

  const [period, setPeriod] =
    useState("month");


  const [customStart, setCustomStart] =
    useState("");


  const [customEnd, setCustomEnd] =
    useState("");


  /* CURRENT RANGE */

  const currentRange = useMemo(() => {
    return getPeriodRange(
      period,
      customStart,
      customEnd
    );
  }, [
    period,
    customStart,
    customEnd,
  ]);


  /* JOURNAL DATA */

  const records = USE_FAKE_DATA
    ? FAKE_JOURNAL_DATA
    : [];


  /* FILTER JOURNAL */

  const filteredRecords =
    useMemo(() => {

      return records.filter(
        (record) => {

          const date =
            parseDate(
              record.date
            );

          if (!date) {
            return false;
          }


          return (
            date >=
              currentRange.start &&
            date <=
              currentRange.end
          );
        }
      );

    }, [
      records,
      currentRange,
    ]);


  /* FINANCIAL TOTALS */

  const totals = useMemo(() => {

    return filteredRecords.reduce(
      (result, record) => {

        const amount =
          Number(
            record.amount || 0
          );


        if (
          record.type ===
          "Income"
        ) {
          result.revenue +=
            amount;
        }


        if (
          record.type ===
          "Expense"
        ) {
          result.expenses +=
            amount;
        }


        return result;

      },
      {
        revenue: 0,
        expenses: 0,
      }
    );

  }, [filteredRecords]);


  /* OUTSTANDING AMOUNT */

  const outstandingAmount =
    useMemo(() => {

      return FAKE_OUTSTANDING_DATA
        .filter((item) => {

          const date =
            parseDate(
              item.date
            );

          return (
            date &&
            date >=
              currentRange.start &&
            date <=
              currentRange.end
          );
        })
        .reduce(
          (
            total,
            item
          ) =>
            total +
            Number(
              item.amount || 0
            ),
          0
        );

    }, [currentRange]);


  /* PROJECT COUNT */

  const totalProjects =
    useMemo(() => {

      return FAKE_PROJECT_DATA
        .filter((project) => {

          const date =
            parseDate(
              project.date
            );

          return (
            date &&
            date >=
              currentRange.start &&
            date <=
              currentRange.end
          );
        })
        .length;

    }, [currentRange]);


  /* CHART DATA */

  const chartData = useMemo(() => {

    const grouped =
      new Map();


    filteredRecords.forEach(
      (record) => {

        const date =
          parseDate(
            record.date
          );

        if (!date) {
          return;
        }


        const key =
          getGroupKey(
            date,
            period
          );


        if (
          !grouped.has(key)
        ) {
          grouped.set(
            key,
            {
              key,
              revenue: 0,
              expenses: 0,
            }
          );
        }


        const item =
          grouped.get(key);


        const amount =
          Number(
            record.amount || 0
          );


        if (
          record.type ===
          "Income"
        ) {
          item.revenue +=
            amount;
        }


        if (
          record.type ===
          "Expense"
        ) {
          item.expenses +=
            amount;
        }

      }
    );


    return Array.from(
      grouped.values()
    )
      .sort(
        (a, b) =>
          a.key.localeCompare(
            b.key
          )
      )
      .map((item) => ({
        ...item,

        label:
          getGroupLabel(
            item.key,
            period
          ),
      }));

  }, [
    filteredRecords,
    period,
  ]);


  /* EXPENSE BREAKDOWN DATA */

  const expenseBreakdownData = useMemo(() => {
    const multiplier = EXPENSE_TIMELINE_MULTIPLIERS[period] || 1;

    return FAKE_EXPENSE_BREAKDOWN.map((item) => ({
      ...item,
      amount: Math.round(item.amount * multiplier),
    }));
  }, [period]);


  /* PURCHASE ORDER STATUS DATA */

  const purchaseOrderData = useMemo(() => {
    const multiplier = PO_TIMELINE_MULTIPLIERS[period] || 1;

    return FAKE_PURCHASE_ORDER_STATUS.map((item) => ({
      ...item,
      count: Math.max(1, Math.round(item.count * multiplier)),
    }));
  }, [period]);


  /* RANGE LABEL */

  const rangeLabel =
    useMemo(() => {

      return `${currentRange.start.toLocaleDateString(
        "en-IN"
      )} — ${currentRange.end.toLocaleDateString(
        "en-IN"
      )}`;

    }, [
      currentRange,
    ]);


  /* RENDER */

  return (
    <div className="statistics-page">

      {/* HERO */}

      <section className="statistics-hero">

        <div className="statistics-hero-content">

          <span className="statistics-eyebrow">
            ADMINISTRATIVE INTELLIGENCE
          </span>


          <h1>
            Statistics
          </h1>


          <p>
            Financial performance,
            project activity and
            outstanding business
            metrics in one view.
          </p>

        </div>


        <div
          className="statistics-hero-orbit statistics-orbit-one"
        />


        <div
          className="statistics-hero-orbit statistics-orbit-two"
        />


        <div className="statistics-hero-grid" />

      </section>


      {/* TIMELINE */}

      <section className="statistics-filter-panel">

        <div className="statistics-filter-heading">

          <div className="statistics-filter-icon">
            <CalendarDays size={18} />
          </div>


          <div>

            <span>
              TIME RANGE
            </span>

            <strong>
              Performance Timeline
            </strong>

          </div>

        </div>


        <div className="statistics-period-buttons">

          {PERIOD_OPTIONS.map(
            (option) => (

              <button
                key={option.value}
                type="button"
                className={
                  period ===
                  option.value
                    ? "is-active"
                    : ""
                }
                onClick={() =>
                  setPeriod(
                    option.value
                  )
                }
              >
                {option.label}
              </button>

            )
          )}

        </div>


        {period ===
          "custom" && (

          <div className="statistics-custom-range">

            <label>

              <span>
                From
              </span>

              <input
                type="date"
                value={
                  customStart
                }
                onChange={(
                  event
                ) =>
                  setCustomStart(
                    event.target
                      .value
                  )
                }
              />

            </label>


            <label>

              <span>
                To
              </span>

              <input
                type="date"
                value={
                  customEnd
                }
                min={
                  customStart ||
                  undefined
                }
                onChange={(
                  event
                ) =>
                  setCustomEnd(
                    event.target
                      .value
                  )
                }
              />

            </label>

          </div>
        )}


        <div className="statistics-range-status">

          <span>
            ACTIVE RANGE
          </span>

          <strong>
            {rangeLabel}
          </strong>

        </div>

      </section>


      {/* KPI CARDS */}

      <section className="statistics-kpi-grid">

        <KpiCard
          title="Total Revenue"
          value={formatCurrency(
            totals.revenue
          )}
          subtitle="Income transactions"
          icon={TrendingUp}
          theme="revenue"
          trend="IN"
        />


        <KpiCard
          title="Expenses"
          value={formatCurrency(
            totals.expenses
          )}
          subtitle="Expense transactions"
          icon={TrendingDown}
          theme="expense"
          trend="OUT"
        />


        <KpiCard
          title="Outstanding Amount"
          value={formatCurrency(
            outstandingAmount
          )}
          subtitle="Pending customer amount"
          icon={WalletCards}
          theme="outstanding"
        />


        <KpiCard
          title="Total Projects"
          value={totalProjects}
          subtitle="Projects in selected period"
          icon={FolderKanban}
          theme="projects"
        />

      </section>


      {/* REVENUE VS EXPENSES + EXPENSE BREAKDOWN */}

      <section className="statistics-charts-row">

        <div className="statistics-visual-section statistics-revenue-card">

          <RevenueExpenseChart
            key={`${period}-${customStart}-${customEnd}`}
            data={
              chartData.length > 0
                ? chartData
                : [
                    {
                      key: "empty",
                      label: "No Data",
                      revenue: 0,
                      expenses: 0,
                    },
                  ]
            }
            period={period}
          />


          {chartData.length === 0 && (

            <div className="statistics-chart-empty-overlay">

              <div className="statistics-chart-empty-icon">
                <CircleDollarSign
                  size={18}
                />
              </div>


              <strong>
                No financial activity
              </strong>


              <span>
                There are no income
                or expense records
                inside the selected
                period.
              </span>

            </div>

          )}

        </div>


        <div className="statistics-visual-section statistics-donut-card">

          <ExpenseBreakdownChart
            key={`donut-${period}-${customStart}-${customEnd}`}
            data={expenseBreakdownData}
          />

        </div>

      </section>


      {/* PURCHASE ORDER STATUS */}

      <section className="statistics-visual-section statistics-po-card">

        <PurchaseOrderStatusChart
          key={`po-${period}-${customStart}-${customEnd}`}
          data={purchaseOrderData}
        />

      </section>

    </div>
  );
}