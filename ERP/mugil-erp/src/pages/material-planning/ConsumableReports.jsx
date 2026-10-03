import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Boxes,
  PackageCheck,
  Send,
  Undo2,
  RefreshCw,
  Eye,
  X,
  Download,
  FileText,
  FileSpreadsheet,
  Printer,
} from "lucide-react";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./ConsumableReports.css";

// ---------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------

const GENERIC_ERROR = "Something went wrong. Please try again.";

const STOCK_ENDPOINT = "/erp/consumable-grn/stock/";
const ISSUES_ENDPOINT = "/erp/consumable-grn/returnable-issues/";
const PO_ITEMS_ENDPOINT = "/erp/consumable-grn/po-items/";
const MOVEMENT_GROUPS_ENDPOINT = "/erp/consumable-grn/movement-groups/";
const MOVEMENT_DETAIL_ENDPOINT = "/erp/consumable-grn/movements/detail/";

const REPORT_TABS = [
  { key: "grn", label: "GRN Report" },
  { key: "stock", label: "Stock Report" },
  { key: "issue", label: "Issue Report" },
  { key: "return", label: "Return Report" },
  { key: "movement", label: "Movement History" },
];

// ---------------------------------------------------------------------
// SAFE STRING
// ---------------------------------------------------------------------

function toDisplayString(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);

  if (typeof value === "object") {
    const candidate =
      value.companyName ||
      value.company_name ||
      value.name ||
      value.label ||
      value.title ||
      value.supplier ||
      value.description;

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }

    const parts = Object.values(value)
      .filter((v) => typeof v === "string" && v.trim())
      .slice(0, 2);

    return parts.join(" — ") || "—";
  }

  return String(value);
}

function getApiError(error, fallback = GENERIC_ERROR) {
  const data = error?.response?.data;

  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;

  if (data && typeof data === "object") {
    const first = Object.values(data)
      .flat()
      .find((v) => typeof v === "string");
    if (first) return first;
  }

  if (error?.message) return error.message;
  return fallback;
}

function safeArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

// ---------------------------------------------------------------------
// IST CONVERSION
// ---------------------------------------------------------------------
// The Django backend returns `created_at` in UTC. We shift it to IST
// (UTC + 5:30) here so the user always sees India Standard Time.
// ---------------------------------------------------------------------

function toIST(dateStr, timeStr) {
  if (!dateStr) return { date: "", time: "" };

  const iso = `${dateStr}T${timeStr || "00:00:00"}Z`;
  const utc = new Date(iso);

  if (isNaN(utc.getTime())) {
    return { date: dateStr, time: timeStr || "" };
  }

  const ist = new Date(utc.getTime() + 5.5 * 60 * 60 * 1000);

  const pad = (n) => String(n).padStart(2, "0");

  return {
    date: `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(
      ist.getUTCDate(),
    )}`,
    time: `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(
      ist.getUTCSeconds(),
    )}`,
  };
}

function toISTDateTime(datetimeStr) {
  if (!datetimeStr || datetimeStr === "—") return "—";

  const [datePart, timePart] = datetimeStr.split(" ");
  const ist = toIST(datePart, timePart ? `${timePart}:00` : "00:00:00");

  return `${ist.date} ${ist.time.slice(0, 5)}`;
}

// =====================================================================
// EXPORT HELPERS
// =====================================================================

const fmt = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
};

function toCSV(columns, rows) {
  const escape = (value) => {
    const text = fmt(value);
    return /[",\n]/.test(text)
      ? `"${text.replace(/"/g, '""')}"`
      : text;
  };

  const header = columns.map((c) => c.label).join(",");

  const lines = rows.map((row) =>
    columns
      .map((c) => escape(c.render ? c.render(row) : row[c.key]))
      .join(","),
  );

  return [header, ...lines].join("\n");
}

function toHTMLTable(columns, rows, title) {
  const head = columns
    .map(
      (c) =>
        `<th style="border:1px solid #ccc;padding:6px;background:#f1f5f9;text-align:left;">${c.label}</th>`,
    )
    .join("");

  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map(
            (c) =>
              `<td style="border:1px solid #ccc;padding:6px;">${fmt(
                c.render ? c.render(row) : row[c.key],
              )}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return `
    <html>
      <head><meta charset="utf-8"><title>${title}</title></head>
      <body>
        <h2 style="font-family:sans-serif;">${title}</h2>
        <table style="border-collapse:collapse;font-family:sans-serif;font-size:12px;width:100%;">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </body>
    </html>
  `;
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function exportCSV(columns, rows, title) {
  downloadBlob(
    toCSV(columns, rows),
    `${title.replace(/\s+/g, "_")}.csv`,
    "text/csv",
  );
}

function exportExcel(columns, rows, title) {
  downloadBlob(
    toHTMLTable(columns, rows, title),
    `${title.replace(/\s+/g, "_")}.xls`,
    "application/vnd.ms-excel",
  );
}

function exportPDFOrPrint(columns, rows, title) {
  const html = toHTMLTable(columns, rows, title);

  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(html);
  win.document.close();
  win.focus();

  setTimeout(() => win.print(), 300);
}

// =====================================================================
// COMPONENT
// =====================================================================

export default function ConsumableReports() {
  const { accessToken } = useAuth();

  const [grnRows, setGrnRows] = useState([]);
  const [stockRows, setStockRows] = useState([]);
  const [issueRows, setIssueRows] = useState([]);
  const [movementGroups, setMovementGroups] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState("grn");

  // Filters
  const [poFilter, setPoFilter] = useState("");
  const [descriptionFilter, setDescriptionFilter] = useState("");

  // Movement drill-down
  const [selectedMovementId, setSelectedMovementId] = useState(null);
  const [movementDetail, setMovementDetail] = useState(null);
  const [movementDetailLoading, setMovementDetailLoading] = useState(false);
  const [movementDetailError, setMovementDetailError] = useState("");

  // Download dropdown inside the modal
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken],
  );

  // -------------------------------------------------------------------
  // FETCH EVERYTHING
  // -------------------------------------------------------------------
  const fetchAll = useCallback(
    async (isRefresh = false) => {
      if (!accessToken) {
        setIsLoading(false);
        setRefreshing(false);
        setError("Your session has expired. Please login again.");
        return;
      }

      try {
        if (isRefresh) setRefreshing(true);
        else setIsLoading(true);
        setError("");

        const [grnRes, stockRes, issueRes, groupRes] = await Promise.all([
          api.get(PO_ITEMS_ENDPOINT, { headers: authHeaders() }),
          api.get(STOCK_ENDPOINT, { headers: authHeaders() }),
          api.get(ISSUES_ENDPOINT, { headers: authHeaders() }),
          api.get(MOVEMENT_GROUPS_ENDPOINT, { headers: authHeaders() }),
        ]);

        setGrnRows(safeArray(grnRes.data));
        setStockRows(safeArray(stockRes.data));
        setIssueRows(safeArray(issueRes.data));
        setMovementGroups(safeArray(groupRes.data));
      } catch (err) {
        console.error("Failed to load reports:", err);
        setGrnRows([]);
        setStockRows([]);
        setIssueRows([]);
        setMovementGroups([]);
        setError(getApiError(err, "Failed to load reports."));
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, authHeaders],
  );

  useEffect(() => {
    fetchAll(false);
  }, [fetchAll]);

  // -------------------------------------------------------------------
  // RETURN ROWS
  // -------------------------------------------------------------------
  const returnRows = useMemo(
    () => issueRows.filter((row) => Number(row.returnedQty) > 0),
    [issueRows],
  );

  // -------------------------------------------------------------------
  // KPI
  // -------------------------------------------------------------------
  const totalConsumables = stockRows.length;

  const totalAvailableStock = stockRows.reduce(
    (sum, item) => sum + (Number(item.availableQty) || 0),
    0,
  );

  const totalIssued = issueRows.reduce(
    (sum, item) => sum + (Number(item.issuedQty) || 0),
    0,
  );

  const totalReturned = returnRows.reduce(
    (sum, item) => sum + (Number(item.returnedQty) || 0),
    0,
  );

  // -------------------------------------------------------------------
  // FILTER
  // -------------------------------------------------------------------
  const poTerm = poFilter.trim().toLowerCase();
  const descTerm = descriptionFilter.trim().toLowerCase();

  const matchRow = useCallback(
    (obj) => {
      if (!poTerm && !descTerm) return true;

      const poString = toDisplayString(
        obj.poNumber || obj.po_number || obj.referenceNumber || "",
      ).toLowerCase();

      const descString = toDisplayString(
        obj.poDescription ||
          obj.description ||
          obj.consumableName ||
          "",
      ).toLowerCase();

      const poOk = !poTerm || poString.includes(poTerm);
      const descOk = !descTerm || descString.includes(descTerm);

      return poOk && descOk;
    },
    [poTerm, descTerm],
  );

  const filteredGrnRows = useMemo(
    () => grnRows.filter(matchRow),
    [grnRows, matchRow],
  );

  const filteredStockRows = useMemo(
    () => stockRows.filter(matchRow),
    [stockRows, matchRow],
  );

  const filteredIssueRows = useMemo(
    () => issueRows.filter(matchRow),
    [issueRows, matchRow],
  );

  const filteredReturnRows = useMemo(
    () => returnRows.filter(matchRow),
    [returnRows, matchRow],
  );

  const filteredMovementGroups = useMemo(
    () => movementGroups.filter(matchRow),
    [movementGroups, matchRow],
  );

  // -------------------------------------------------------------------
  // MOVEMENT DETAIL
  // -------------------------------------------------------------------
  const openMovementDetail = useCallback(
    async (row) => {
      setSelectedMovementId(row.id);
      setMovementDetail(null);
      setMovementDetailError("");
      setMovementDetailLoading(true);
      setDownloadMenuOpen(false);

      try {
        const response = await api.get(MOVEMENT_DETAIL_ENDPOINT, {
          params: {
            po_number: row.poNumber === "—" ? "" : row.poNumber,
            description:
              row.poDescription === "—" ? "" : row.poDescription,
          },
          headers: authHeaders(),
        });
        setMovementDetail(response.data);
      } catch (err) {
        console.error("Failed to load movement detail:", err);
        setMovementDetailError(
          getApiError(err, "Failed to load movement detail."),
        );
      } finally {
        setMovementDetailLoading(false);
      }
    },
    [authHeaders],
  );

  const closeMovementDetail = useCallback(() => {
    setSelectedMovementId(null);
    setMovementDetail(null);
    setMovementDetailError("");
    setDownloadMenuOpen(false);
  }, []);

  // -------------------------------------------------------------------
  // EXPORT — REPORT TABS
  // -------------------------------------------------------------------
  const exportConfigs = {
    grn: {
      title: "GRN Report",
      columns: [
        { key: "poNumber", label: "PO Number" },
        { key: "itemCode", label: "Item Code" },
        { key: "supplier", label: "Supplier" },
        { key: "consumableName", label: "Consumable" },
        { key: "orderedQty", label: "Ordered Qty" },
        { key: "receivedQty", label: "Received Qty" },
        { key: "pendingQty", label: "Pending Qty" },
        { key: "warehouse", label: "Warehouse" },
        { key: "status", label: "Status" },
      ],
      rows: filteredGrnRows,
    },
    stock: {
      title: "Stock Report",
      columns: [
        { key: "referenceNumber", label: "Reference Number" },
        { key: "consumableName", label: "Consumable" },
        { key: "category", label: "Category" },
        { key: "warehouse", label: "Warehouse" },
        { key: "availableQty", label: "Available Qty" },
        { key: "unit", label: "Unit" },
        { key: "supplier", label: "Supplier" },
        { key: "status", label: "Status" },
      ],
      rows: filteredStockRows,
    },
    issue: {
      title: "Issue Report",
      columns: [
        { key: "issueNumber", label: "Issue Number" },
        { key: "consumableName", label: "Consumable" },
        { key: "department", label: "Department" },
        { key: "employeeName", label: "Employee" },
        { key: "jobCard", label: "Job Card" },
        { key: "issuedQty", label: "Issued Qty" },
        { key: "returnedQty", label: "Returned Qty" },
        { key: "balanceQty", label: "Balance Qty" },
        { key: "warehouse", label: "Warehouse" },
        { key: "status", label: "Status" },
      ],
      rows: filteredIssueRows,
    },
    return: {
      title: "Return Report",
      columns: [
        { key: "issueNumber", label: "Issue Number" },
        { key: "consumableName", label: "Consumable" },
        { key: "department", label: "Department" },
        { key: "employeeName", label: "Employee" },
        { key: "issuedQty", label: "Issued Qty" },
        { key: "returnedQty", label: "Returned Qty" },
        { key: "balanceQty", label: "Balance Qty" },
        { key: "warehouse", label: "Warehouse" },
        { key: "status", label: "Status" },
      ],
      rows: filteredReturnRows,
    },
    movement: {
      title: "Movement History",
      columns: [
        { key: "poNumber", label: "PO Number" },
        { key: "poDescription", label: "PO Description" },
        { key: "consumableName", label: "Consumable" },
        { key: "category", label: "Category" },
        {
          key: "warehouses",
          label: "Warehouse(s)",
          render: (row) =>
            Array.isArray(row.warehouses)
              ? row.warehouses.join(", ")
              : "",
        },
        { key: "receivedQty", label: "Received" },
        { key: "issuedQty", label: "Issued" },
        { key: "returnedQty", label: "Returned" },
        { key: "availableQty", label: "Available" },
        { key: "unit", label: "Unit" },
      ],
      rows: filteredMovementGroups,
    },
  };

  function handleExport(type) {
    const report = exportConfigs[activeTab];
    if (!report) return;

    const { title, columns, rows } = report;

    if (type === "csv") exportCSV(columns, rows, title);
    else if (type === "excel") exportExcel(columns, rows, title);
    else exportPDFOrPrint(columns, rows, title);
  }

  function clearFilters() {
    setPoFilter("");
    setDescriptionFilter("");
  }

  // -------------------------------------------------------------------
  // EXPORT — TIMELINE MODAL (IST-converted)
  // -------------------------------------------------------------------
  function buildTimelineExport() {
    if (!movementDetail) return null;

    const { summary, timeline } = movementDetail;

    const title = `Movement Timeline — ${summary.poNumber} — ${summary.poDescription}`;

    const summaryRows = [
      { label: "PO Number", value: summary.poNumber },
      { label: "PO Description", value: summary.poDescription },
      { label: "Consumable", value: summary.consumableName },
      { label: "Category", value: summary.category },
      { label: "Supplier", value: summary.supplier },
      {
        label: "GRN Receipts",
        value: (summary.grnNumbers || []).join(", "),
      },
      {
        label: "Warehouse(s)",
        value: (summary.warehouses || []).join(", "),
      },
      {
        label: "Received",
        value: `${summary.receivedQty} ${summary.unit}`,
      },
      {
        label: "Issued",
        value: `${summary.issuedQty} ${summary.unit}`,
      },
      {
        label: "Returned",
        value: `${summary.returnedQty} ${summary.unit}`,
      },
      {
        label: "Available",
        value: `${summary.availableQty} ${summary.unit}`,
      },
    ];

    const timelineRows = timeline.map((entry) => {
      const ist = toIST(entry.date, entry.time);

      return {
        type: entry.type,
        referenceNumber: entry.referenceNumber,
        date: ist.date,
        time: ist.time,
        quantity: `${entry.quantity} ${entry.unit || ""}`.trim(),
        user: entry.user || "",
        department: entry.department || "",
        jobCard: entry.jobCard || "",
        warehouse: entry.warehouse || "",
        remarks: entry.remarks || "",
      };
    });

    return { title, summaryRows, timelineRows };
  }

  function handleModalDownload(type) {
    const data = buildTimelineExport();
    if (!data) return;

    const { title, summaryRows, timelineRows } = data;

    // -------- CSV --------
    if (type === "csv") {
      const lines = [];

      lines.push("SUMMARY");
      lines.push("Field,Value");
      summaryRows.forEach((r) => {
        const escape = (v) =>
          /[",\n]/.test(String(v))
            ? `"${String(v).replace(/"/g, '""')}"`
            : String(v);
        lines.push(`${escape(r.label)},${escape(r.value)}`);
      });

      lines.push("");
      lines.push("TIMELINE");
      lines.push(
        "Type,Reference,Date,Time,Quantity,User,Department,Job Card,Warehouse,Remarks",
      );
      timelineRows.forEach((r) => {
        const escape = (v) =>
          /[",\n]/.test(String(v))
            ? `"${String(v).replace(/"/g, '""')}"`
            : String(v);
        lines.push(
          [
            r.type,
            r.referenceNumber,
            r.date,
            r.time,
            r.quantity,
            r.user,
            r.department,
            r.jobCard,
            r.warehouse,
            r.remarks,
          ]
            .map(escape)
            .join(","),
        );
      });

      downloadBlob(
        lines.join("\n"),
        `${title.replace(/\s+/g, "_")}.csv`,
        "text/csv",
      );
      setDownloadMenuOpen(false);
      return;
    }

    // -------- HTML table (Excel + PDF/Print) --------
    const summaryHTML = summaryRows
      .map(
        (r) =>
          `<tr><td style="border:1px solid #ccc;padding:6px;font-weight:600;background:#f8fafc;">${r.label}</td><td style="border:1px solid #ccc;padding:6px;">${r.value}</td></tr>`,
      )
      .join("");

    const timelineHead = `
      <tr>
        <th style="border:1px solid #ccc;padding:6px;background:#f1f5f9;text-align:left;">Type</th>
        <th style="border:1px solid #ccc;padding:6px;background:#f1f5f9;text-align:left;">Reference</th>
        <th style="border:1px solid #ccc;padding:6px;background:#f1f5f9;text-align:left;">Date</th>
        <th style="border:1px solid #ccc;padding:6px;background:#f1f5f9;text-align:left;">Time</th>
        <th style="border:1px solid #ccc;padding:6px;background:#f1f5f9;text-align:left;">Quantity</th>
        <th style="border:1px solid #ccc;padding:6px;background:#f1f5f9;text-align:left;">User</th>
        <th style="border:1px solid #ccc;padding:6px;background:#f1f5f9;text-align:left;">Department</th>
        <th style="border:1px solid #ccc;padding:6px;background:#f1f5f9;text-align:left;">Job Card</th>
        <th style="border:1px solid #ccc;padding:6px;background:#f1f5f9;text-align:left;">Warehouse</th>
        <th style="border:1px solid #ccc;padding:6px;background:#f1f5f9;text-align:left;">Remarks</th>
      </tr>
    `;

    const timelineHTML = timelineRows
      .map(
        (r) =>
          `<tr>${[
            r.type,
            r.referenceNumber,
            r.date,
            r.time,
            r.quantity,
            r.user,
            r.department,
            r.jobCard,
            r.warehouse,
            r.remarks,
          ]
            .map(
              (v) =>
                `<td style="border:1px solid #ccc;padding:6px;">${v}</td>`,
            )
            .join("")}</tr>`,
      )
      .join("");

    const html = `
      <html>
        <head><meta charset="utf-8"><title>${title}</title></head>
        <body style="font-family:sans-serif;padding:20px;">
          <h2>${title}</h2>

          <h3>Summary</h3>
          <table style="border-collapse:collapse;font-size:12px;width:100%;">
            ${summaryHTML}
          </table>

          <h3 style="margin-top:24px;">Timeline (IST)</h3>
          <table style="border-collapse:collapse;font-size:12px;width:100%;">
            <thead>${timelineHead}</thead>
            <tbody>${timelineHTML}</tbody>
          </table>
        </body>
      </html>
    `;

    if (type === "excel") {
      downloadBlob(
        html,
        `${title.replace(/\s+/g, "_")}.xls`,
        "application/vnd.ms-excel",
      );
    } else if (type === "pdf") {
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    }

    setDownloadMenuOpen(false);
  }

  // ===================================================================
  // RENDER
  // ===================================================================
  return (
    <>
      <Header />

      <div className="crpt-page">
        <Link to="/inventory/consumable" className="erp-back-button">
          <ArrowLeft size={16} />
          Back
        </Link>

        <section className="crpt-header-card">
          <div className="crpt-header-content">
            <span className="crpt-eyebrow">Consumables</span>
            <h1 className="crpt-title">Consumable Reports</h1>
            <p className="crpt-subtitle">
              Live reporting across GRN, Stock, Issue, Return, and Movement
              History. Every row reflects the current state of the module.
            </p>
          </div>
        </section>

        {/* ============== KPI ============== */}
        <section className="crpt-kpi-grid">
          <div className="crpt-kpi-card crpt-kpi-blue">
            <div className="crpt-kpi-pattern"></div>
            <div className="crpt-kpi-icon">
              <Boxes size={22} />
            </div>
            <div className="crpt-kpi-content">
              <span className="crpt-kpi-value">{totalConsumables}</span>
              <span className="crpt-kpi-label">Total Consumables</span>
            </div>
          </div>

          <div className="crpt-kpi-card crpt-kpi-green">
            <div className="crpt-kpi-pattern"></div>
            <div className="crpt-kpi-icon">
              <PackageCheck size={22} />
            </div>
            <div className="crpt-kpi-content">
              <span className="crpt-kpi-value">{totalAvailableStock}</span>
              <span className="crpt-kpi-label">Available Stock</span>
            </div>
          </div>

          <div className="crpt-kpi-card crpt-kpi-orange">
            <div className="crpt-kpi-pattern"></div>
            <div className="crpt-kpi-icon">
              <Send size={22} />
            </div>
            <div className="crpt-kpi-content">
              <span className="crpt-kpi-value">{totalIssued}</span>
              <span className="crpt-kpi-label">Total Issued</span>
            </div>
          </div>

          <div className="crpt-kpi-card crpt-kpi-purple">
            <div className="crpt-kpi-pattern"></div>
            <div className="crpt-kpi-icon">
              <Undo2 size={22} />
            </div>
            <div className="crpt-kpi-content">
              <span className="crpt-kpi-value">{totalReturned}</span>
              <span className="crpt-kpi-label">Total Returned</span>
            </div>
          </div>
        </section>

        {/* ============== TOOLBAR ============== */}
        <section className="crpt-toolbar-card">
          <div className="crpt-toolbar-top">
            <div className="crpt-filter-group">
              <div className="crpt-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Filter by PO number..."
                  value={poFilter}
                  onChange={(e) => setPoFilter(e.target.value)}
                  disabled={isLoading}
                />
                {poFilter && (
                  <button
                    type="button"
                    className="crpt-filter-clear"
                    onClick={() => setPoFilter("")}
                    aria-label="Clear PO filter"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="crpt-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Filter by description..."
                  value={descriptionFilter}
                  onChange={(e) =>
                    setDescriptionFilter(e.target.value)
                  }
                  disabled={isLoading}
                />
                {descriptionFilter && (
                  <button
                    type="button"
                    className="crpt-filter-clear"
                    onClick={() => setDescriptionFilter("")}
                    aria-label="Clear description filter"
                  >
                    ×
                  </button>
                )}
              </div>

              {(poFilter || descriptionFilter) && (
                <button
                  type="button"
                  className="crpt-clear-all-btn"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>

            <button
              type="button"
              className="crpt-refresh-button"
              onClick={() => fetchAll(true)}
              disabled={isLoading || refreshing}
              title="Refresh reports"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "crpt-spin" : ""}
              />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>

          <div className="crpt-tabs">
            {REPORT_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={
                  activeTab === tab.key
                    ? "crpt-tab crpt-tab-active"
                    : "crpt-tab"
                }
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}

            <div className="crpt-export-bar">
              <button
                type="button"
                className="crpt-export-btn"
                onClick={() => handleExport("pdf")}
              >
                Export PDF
              </button>
              <button
                type="button"
                className="crpt-export-btn"
                onClick={() => handleExport("excel")}
              >
                Export Excel
              </button>
              <button
                type="button"
                className="crpt-export-btn"
                onClick={() => handleExport("csv")}
              >
                Export CSV
              </button>
              <button
                type="button"
                className="crpt-export-btn"
                onClick={() => handleExport("print")}
              >
                Print
              </button>
            </div>
          </div>
        </section>

        {/* ============== ERROR ============== */}
        {error && !isLoading && (
          <div className="crpt-error-box">
            <Error onRetry={() => fetchAll(false)} />
          </div>
        )}

        {/* ============== TABLE ============== */}
        {!error && (
          <div className="crpt-table-card">
            {isLoading && (
              <div className="crpt-loading-wrapper">
                <Loading />
              </div>
            )}

            {/* ---------- GRN ---------- */}
            {!isLoading && activeTab === "grn" && (
              <div className="crpt-table-wrapper">
                <table className="crpt-table">
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Item Code</th>
                      <th>Supplier</th>
                      <th>Consumable</th>
                      <th>Ordered Qty</th>
                      <th>Received Qty</th>
                      <th>Pending Qty</th>
                      <th>Warehouse</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGrnRows.map((po) => (
                      <tr key={po.id}>
                        <td>{toDisplayString(po.poNumber) || "—"}</td>
                        <td>{toDisplayString(po.itemCode) || "—"}</td>
                        <td>{toDisplayString(po.supplier) || "—"}</td>
                        <td>{toDisplayString(po.consumableName) || "—"}</td>
                        <td>{po.orderedQty}</td>
                        <td>{po.receivedQty}</td>
                        <td>{po.pendingQty}</td>
                        <td>{toDisplayString(po.warehouse) || "—"}</td>
                        <td>
                          <span className="crpt-status-chip">
                            {po.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredGrnRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="crpt-empty-row">
                          No GRN records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ---------- STOCK ---------- */}
            {!isLoading && activeTab === "stock" && (
              <div className="crpt-table-wrapper">
                <table className="crpt-table">
                  <thead>
                    <tr>
                      <th>Reference Number</th>
                      <th>Consumable</th>
                      <th>Category</th>
                      <th>Warehouse</th>
                      <th>Available Qty</th>
                      <th>Unit</th>
                      <th>Supplier</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStockRows.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {toDisplayString(item.referenceNumber) || "—"}
                        </td>
                        <td>
                          {toDisplayString(item.consumableName) || "—"}
                        </td>
                        <td>{toDisplayString(item.category) || "—"}</td>
                        <td>{toDisplayString(item.warehouse) || "—"}</td>
                        <td>{item.availableQty}</td>
                        <td>{toDisplayString(item.unit) || "—"}</td>
                        <td>{toDisplayString(item.supplier) || "—"}</td>
                        <td>
                          <span className="crpt-status-chip">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredStockRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="crpt-empty-row">
                          No stock records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ---------- ISSUE ---------- */}
            {!isLoading && activeTab === "issue" && (
              <div className="crpt-table-wrapper">
                <table className="crpt-table">
                  <thead>
                    <tr>
                      <th>Issue Number</th>
                      <th>Consumable</th>
                      <th>Department</th>
                      <th>Employee</th>
                      <th>Job Card</th>
                      <th>Issued Qty</th>
                      <th>Returned Qty</th>
                      <th>Balance Qty</th>
                      <th>Warehouse</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssueRows.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {toDisplayString(item.issueNumber) || "—"}
                        </td>
                        <td>
                          {toDisplayString(item.consumableName) || "—"}
                        </td>
                        <td>
                          {toDisplayString(item.department) || "—"}
                        </td>
                        <td>
                          {toDisplayString(item.employeeName) || "—"}
                        </td>
                        <td>{toDisplayString(item.jobCard) || "-"}</td>
                        <td>{item.issuedQty}</td>
                        <td>{item.returnedQty}</td>
                        <td>{item.balanceQty}</td>
                        <td>
                          {toDisplayString(item.warehouse) || "—"}
                        </td>
                        <td>
                          <span className="crpt-status-chip">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredIssueRows.length === 0 && (
                      <tr>
                        <td colSpan={10} className="crpt-empty-row">
                          No issue records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ---------- RETURN ---------- */}
            {!isLoading && activeTab === "return" && (
              <div className="crpt-table-wrapper">
                <table className="crpt-table">
                  <thead>
                    <tr>
                      <th>Issue Number</th>
                      <th>Consumable</th>
                      <th>Department</th>
                      <th>Employee</th>
                      <th>Issued Qty</th>
                      <th>Returned Qty</th>
                      <th>Balance Qty</th>
                      <th>Warehouse</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReturnRows.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {toDisplayString(item.issueNumber) || "—"}
                        </td>
                        <td>
                          {toDisplayString(item.consumableName) || "—"}
                        </td>
                        <td>
                          {toDisplayString(item.department) || "—"}
                        </td>
                        <td>
                          {toDisplayString(item.employeeName) || "—"}
                        </td>
                        <td>{item.issuedQty}</td>
                        <td>{item.returnedQty}</td>
                        <td>{item.balanceQty}</td>
                        <td>
                          {toDisplayString(item.warehouse) || "—"}
                        </td>
                        <td>
                          <span className="crpt-status-chip">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredReturnRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="crpt-empty-row">
                          No return records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ---------- MOVEMENT ---------- */}
            {!isLoading && activeTab === "movement" && (
              <div className="crpt-table-wrapper">
                <table className="crpt-table">
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>PO Description</th>
                      <th>Consumable</th>
                      <th>Category</th>
                      <th>Warehouse(s)</th>
                      <th>Received</th>
                      <th>Issued</th>
                      <th>Returned</th>
                      <th>Available</th>
                      <th>Unit</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovementGroups.map((row) => (
                      <tr key={row.id}>
                        <td>{toDisplayString(row.poNumber) || "—"}</td>
                        <td>
                          {toDisplayString(row.poDescription) || "—"}
                        </td>
                        <td>
                          {toDisplayString(row.consumableName) || "—"}
                        </td>
                        <td>{toDisplayString(row.category) || "—"}</td>
                        <td>
                          {Array.isArray(row.warehouses) &&
                          row.warehouses.length > 0
                            ? row.warehouses.join(", ")
                            : "—"}
                        </td>
                        <td>{row.receivedQty}</td>
                        <td>{row.issuedQty}</td>
                        <td>{row.returnedQty}</td>
                        <td>
                          <span className="crpt-status-chip">
                            {row.availableQty}
                          </span>
                        </td>
                        <td>{toDisplayString(row.unit) || "—"}</td>
                        <td>
                          <button
                            type="button"
                            className="crpt-eye-btn"
                            onClick={() => openMovementDetail(row)}
                            title="View full movement timeline"
                            aria-label="View movement timeline"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredMovementGroups.length === 0 && (
                      <tr>
                        <td colSpan={11} className="crpt-empty-row">
                          No PO description records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============== MOVEMENT DETAIL MODAL ============== */}
        {selectedMovementId && (
          <div
            className="crpt-modal-overlay"
            onClick={closeMovementDetail}
          >
            <div
              className="crpt-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="crpt-modal-header">
                <div className="crpt-modal-header-left">
                  <h3 className="crpt-modal-title">
                    Movement Timeline
                  </h3>
                  {movementDetail?.summary && (
                    <p className="crpt-modal-subtitle">
                      {toDisplayString(
                        movementDetail.summary.poNumber,
                      )}{" "}
                      —{" "}
                      {toDisplayString(
                        movementDetail.summary.poDescription,
                      )}
                    </p>
                  )}
                </div>

                <div className="crpt-modal-header-actions">
                  {movementDetail && (
                    <div className="crpt-download-wrap">
                      <button
                        type="button"
                        className="crpt-download-btn"
                        onClick={() =>
                          setDownloadMenuOpen((v) => !v)
                        }
                      >
                        <Download size={16} />
                        <span>Download</span>
                      </button>

                      {downloadMenuOpen && (
                        <div className="crpt-download-menu">
                          <button
                            type="button"
                            onClick={() =>
                              handleModalDownload("csv")
                            }
                          >
                            <FileText size={14} />
                            <span>Download CSV</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleModalDownload("excel")
                            }
                          >
                            <FileSpreadsheet size={14} />
                            <span>Download Excel</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleModalDownload("pdf")
                            }
                          >
                            <Printer size={14} />
                            <span>Print / PDF</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    className="crpt-modal-close"
                    onClick={closeMovementDetail}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="crpt-modal-body">
                {movementDetailLoading && (
                  <div className="crpt-loading-wrapper">
                    <Loading />
                  </div>
                )}

                {!movementDetailLoading && movementDetailError && (
                  <div className="crpt-modal-error">
                    {movementDetailError}
                  </div>
                )}

                {!movementDetailLoading && movementDetail && (
                  <>
                    <div className="crpt-modal-summary">
                      <div className="crpt-modal-summary-item">
                        <span className="crpt-modal-summary-label">
                          Received
                        </span>
                        <span className="crpt-modal-summary-value">
                          {movementDetail.summary.receivedQty}{" "}
                          {movementDetail.summary.unit}
                        </span>
                      </div>

                      <div className="crpt-modal-summary-item">
                        <span className="crpt-modal-summary-label">
                          Issued
                        </span>
                        <span className="crpt-modal-summary-value">
                          {movementDetail.summary.issuedQty}{" "}
                          {movementDetail.summary.unit}
                        </span>
                      </div>

                      <div className="crpt-modal-summary-item">
                        <span className="crpt-modal-summary-label">
                          Returned
                        </span>
                        <span className="crpt-modal-summary-value">
                          {movementDetail.summary.returnedQty}{" "}
                          {movementDetail.summary.unit}
                        </span>
                      </div>

                      <div className="crpt-modal-summary-item crpt-modal-summary-highlight">
                        <span className="crpt-modal-summary-label">
                          Available
                        </span>
                        <span className="crpt-modal-summary-value">
                          {movementDetail.summary.availableQty}{" "}
                          {movementDetail.summary.unit}
                        </span>
                      </div>
                    </div>

                    <div className="crpt-modal-meta">
                      <div>
                        <span className="crpt-modal-meta-label">
                          GRN Receipts
                        </span>
                        <span className="crpt-modal-meta-value">
                          {movementDetail.summary.grnNumbers?.join(
                            ", ",
                          ) || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="crpt-modal-meta-label">
                          Warehouse(s)
                        </span>
                        <span className="crpt-modal-meta-value">
                          {movementDetail.summary.warehouses?.join(
                            ", ",
                          ) || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="crpt-modal-meta-label">
                          Supplier
                        </span>
                        <span className="crpt-modal-meta-value">
                          {toDisplayString(
                            movementDetail.summary.supplier,
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="crpt-modal-meta-label">
                          Category
                        </span>
                        <span className="crpt-modal-meta-value">
                          {toDisplayString(
                            movementDetail.summary.category,
                          )}
                        </span>
                      </div>
                    </div>

                    <h4 className="crpt-modal-timeline-title">
                      Timeline (IST)
                    </h4>

                    <div className="crpt-timeline">
                      {movementDetail.timeline.map((entry, idx) => {
                        const ist = toIST(entry.date, entry.time);
                        const typeClass = String(
                          entry.type || "",
                        ).toLowerCase();

                        return (
                          <div
                            key={`${entry.referenceNumber}-${idx}`}
                            className={`crpt-timeline-item crpt-timeline-${typeClass}`}
                          >
                            <div className="crpt-timeline-badge">
                              {entry.type}
                            </div>

                            <div className="crpt-timeline-content">
                              <div className="crpt-timeline-head">
                                <span className="crpt-timeline-ref">
                                  {entry.referenceNumber}
                                </span>
                                <span className="crpt-timeline-qty">
                                  {entry.quantity} {entry.unit}
                                </span>
                              </div>

                              <div className="crpt-timeline-time">
                                {ist.date} · {ist.time}
                              </div>

                              <div className="crpt-timeline-meta">
                                {entry.user && (
                                  <span>
                                    By: <strong>{entry.user}</strong>
                                  </span>
                                )}
                                {entry.department && (
                                  <span>
                                    Dept:{" "}
                                    <strong>
                                      {entry.department}
                                    </strong>
                                  </span>
                                )}
                                {entry.jobCard && (
                                  <span>
                                    Job Card:{" "}
                                    <strong>{entry.jobCard}</strong>
                                  </span>
                                )}
                                {entry.warehouse && (
                                  <span>
                                    Warehouse:{" "}
                                    <strong>
                                      {entry.warehouse}
                                    </strong>
                                  </span>
                                )}
                              </div>

                              {entry.remarks && (
                                <div className="crpt-timeline-remarks">
                                  “{entry.remarks}”
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {movementDetail.timeline.length === 0 && (
                        <div className="crpt-empty-row">
                          No movements recorded yet.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}