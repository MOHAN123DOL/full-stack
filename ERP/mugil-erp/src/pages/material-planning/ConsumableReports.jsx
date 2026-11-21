import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./ConsumableReports.css";

// Direct-GRN workflow. All stock and movement grouping uses variety ID + warehouse.
const ENDPOINTS = {
  grn: "/erp/consumable-grn/direct/",
  stock: "/erp/consumable-grn/stock/",
  issue: "/erp/consumable-grn/issues/",
  return: "/erp/consumable-grn/returns/",
};
const TABS = [
  ["grn", "GRN Report"],
  ["stock", "Stock Report"],
  ["issue", "Issue Report"],
  ["return", "Return Report"],
  ["movement", "Movement History"],
];
const arr = (value) =>
  Array.isArray(value)
    ? value
    : Array.isArray(value?.data)
      ? value.data
      : Array.isArray(value?.results)
        ? value.results
        : [];
const pick = (row, ...keys) =>
  keys
    .map((k) => row?.[k])
    .find((v) => v !== undefined && v !== null && v !== "") ?? "";
const name = (v) =>
  typeof v === "object" && v !== null
    ? pick(v, "name", "categoryName", "consumableName", "label", "code")
    : (v ?? "");
const num = (v) => Number(v) || 0;
const formatQty = (v) =>
  Number(num(v).toFixed(3)).toLocaleString("en-IN", {
    maximumFractionDigits: 3,
  });
const varietyId = (r) =>
  pick(
    r,
    "varietyId",
    "variety_id",
    "consumableVarietyId",
    "consumable_variety_id",
    "consumable_variety",
  ) || pick(r?.grn, "consumable_variety_id");
const varietyName = (r) =>
  name(
    pick(r, "varietyName", "variety_name", "variety", "consumableVarietyName"),
  ) || name(r?.grn?.consumable_variety);
const warehouse = (r) => name(pick(r, "warehouse", "warehouseName"));
const consumable = (r) =>
  name(
    pick(r, "consumableName", "consumable_name", "masterName", "consumable"),
  );
const category = (r) =>
  name(pick(r, "categoryName", "category_name", "category"));
const date = (r) => {
  const raw = pick(
    r,
    "date",
    "created_at",
    "createdAt",
    "receivedDate",
    "received_date",
  );
  if (!raw) return "—";
  const d = new Date(raw);
  return Number.isNaN(d.getTime())
    ? String(raw)
    : d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};
const keyFor = (r) =>
  `${varietyId(r) || `${category(r)}|${consumable(r)}|${varietyName(r)}`}::${warehouse(r)}`;
const grnQty = (r) =>
  num(
    pick(
      r,
      "receivedQty",
      "received_qty",
      "quantity_received",
      "quantity",
      "qty",
    ),
  );
const issueQty = (r) =>
  num(pick(r, "issuedQty", "quantity", "quantity_issued", "issued_qty"));
const returnQty = (r) =>
  num(pick(r, "returnQty", "quantity", "quantity_returned", "returnedQty"));
const stockQty = (r) =>
  num(
    pick(
      r,
      "availableQty",
      "available_qty",
      "currentStock",
      "current_stock",
      "stock",
    ),
  );
const text = (v) =>
  v === undefined || v === null || v === "" ? "—" : String(name(v));
const COLUMNS = {
  grn: [
    ["grnNumber", "GRN Number"],
    ["date", "Date"],
    ["category", "Category"],
    ["consumable", "Consumable"],
    ["variety", "Variety"],
    ["warehouse", "Warehouse"],
    ["supplier", "Supplier"],
    ["received", "Received Qty"],
    ["unit", "Unit"],
  ],
  stock: [
    ["category", "Category"],
    ["consumable", "Consumable"],
    ["variety", "Variety"],
    ["warehouse", "Warehouse"],
    ["received", "Received"],
    ["issued", "Issued"],
    ["returned", "Returned"],
    ["available", "Available"],
    ["unit", "Unit"],
  ],
  issue: [
    ["issueNumber", "Issue Number"],
    ["date", "Date"],
    ["consumable", "Consumable"],
    ["variety", "Variety"],
    ["warehouse", "Warehouse"],
    ["department", "Department"],
    ["employee", "Employee"],
    ["jobCard", "Job Card"],
    ["issued", "Issued Qty"],
    ["returned", "Returned Qty"],
    ["unit", "Unit"],
  ],
  return: [
    ["returnNumber", "Return Number"],
    ["date", "Date"],
    ["issueNumber", "Issue Number"],
    ["consumable", "Consumable"],
    ["variety", "Variety"],
    ["warehouse", "Warehouse"],
    ["returnedBy", "Returned By"],
    ["returned", "Returned Qty"],
    ["unit", "Unit"],
  ],
  movement: [
    ["category", "Category"],
    ["consumable", "Consumable"],
    ["variety", "Variety"],
    ["warehouse", "Warehouse"],
    ["received", "Received"],
    ["issued", "Issued"],
    ["returned", "Returned"],
    ["available", "Available"],
    ["unit", "Unit"],
  ],
};
const escapeHTML = (value) =>
  text(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function download(content, filename, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function exportReport(kind, columns, rows, title) {
  const quote = (v) => `"${text(v).replace(/"/g, '""')}"`;
  if (kind === "csv") {
    const csv = [
      columns.map((c) => quote(c[1])).join(","),
      ...rows.map((r) => columns.map((c) => quote(r[c[0]])).join(",")),
    ].join("\r\n");
    download("\uFEFF" + csv, `${title}.csv`, "text/csv;charset=utf-8");
    return;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(title)}</title></head><body style="font-family:Arial,sans-serif;padding:20px"><h2>${escapeHTML(title)}</h2><table style="border-collapse:collapse;width:100%"><thead><tr>${columns.map((c) => `<th style="border:1px solid #ccc;padding:8px;background:#eee">${escapeHTML(c[1])}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td style="border:1px solid #ccc;padding:8px">${escapeHTML(r[c[0]])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  if (kind === "excel")
    download(html, `${title}.xls`, "application/vnd.ms-excel");
  else {
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    }
  }
}
export default function ConsumableReports() {
  const { accessToken } = useAuth();
  const [raw, setRaw] = useState({ grn: [], stock: [], issue: [], return: [] });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("grn");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const fetchAll = useCallback(
    async (refresh = false) => {
      if (!accessToken) {
        setErrors({ auth: "Please log in again." });
        setLoading(false);
        return;
      }
      refresh ? setRefreshing(true) : setLoading(true);
      const entries = await Promise.all(
        Object.entries(ENDPOINTS).map(async ([key, endpoint]) => {
          try {
            const response = await api.get(endpoint, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            return [key, arr(response.data), ""];
          } catch (e) {
            return [
              key,
              [],
              e.response?.data?.message ||
                e.response?.data?.detail ||
                `Could not load ${key} report (HTTP ${e.response?.status || "network error"}).`,
            ];
          }
        }),
      );
      setRaw(Object.fromEntries(entries.map(([key, rows]) => [key, rows])));
      setErrors(
        Object.fromEntries(
          entries.filter(([, , err]) => err).map(([key, , err]) => [key, err]),
        ),
      );
      setLoading(false);
      setRefreshing(false);
    },
    [accessToken],
  );
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const reports = useMemo(() => {
    const grn = raw.grn.map((r) => ({
      id: r.id,
      grnNumber: text(
        pick(
          r,
          "grnNumber",
          "grn_number",
          "referenceNumber",
          "reference_number",
        ),
      ),
      date: date(r),
      category: category(r),
      consumable: consumable(r),
      variety: varietyName(r),
      warehouse: warehouse(r),
      supplier: text(pick(r, "supplier", "supplierName", "supplier_name")),
      received: grnQty(r),
      unit: text(r.unit),
      _key: keyFor(r),
      _raw: r,
    }));
    const issues = raw.issue.map((r) => ({
      id: r.id,
      issueNumber: text(pick(r, "issueNumber", "issue_number")),
      date: date(r),
      category: category(r),
      consumable: consumable(r),
      variety: varietyName(r),
      warehouse: warehouse(r),
      department: text(r.department),
      employee: text(pick(r, "employeeName", "employee_name")),
      jobCard: text(pick(r, "jobCard", "job_card")),
      issued: issueQty(r),
      returned: num(pick(r, "returnedQuantity", "returnedQty", "returned_qty")),
      unit: text(r.unit),
      _key: keyFor(r),
      _raw: r,
    }));
    const returns = raw.return.map((r) => ({
      id: r.id,
      returnNumber: text(pick(r, "returnNumber", "return_number")),
      issueNumber: text(pick(r, "issueNumber", "issue_number")),
      date: date(r),
      category: category(r),
      consumable: consumable(r),
      variety: varietyName(r),
      warehouse: warehouse(r),
      returnedBy: text(pick(r, "returnedBy", "returned_by")),
      returned: returnQty(r),
      unit: text(r.unit),
      _key: keyFor(r),
      _raw: r,
    }));
    // The stock endpoint is the authoritative combined balance, not individual GRN rows.
    const stockMap = new Map();
    raw.stock.forEach((r) => {
      const key = keyFor(r);
      const existing = stockMap.get(key);
      const row = {
        id: key,
        category: category(r),
        consumable: consumable(r),
        variety: varietyName(r),
        warehouse: warehouse(r),
        received: num(
          pick(r, "receivedQty", "totalReceived", "total_received"),
        ),
        issued: num(pick(r, "issuedQty", "totalIssued", "total_issued")),
        returned: num(
          pick(r, "returnedQty", "totalReturned", "total_returned"),
        ),
        available: stockQty(r),
        unit: text(r.unit),
        _key: key,
      };
      if (existing) {
        ["received", "issued", "returned", "available"].forEach((f) => {
          existing[f] += row[f];
        });
      } else stockMap.set(key, row);
    });
    const stock = [...stockMap.values()];
    // Movement totals derive from transaction histories; stock comes from the stock API.
    const movementMap = new Map(
      stock.map((r) => [
        r._key,
        { ...r, received: 0, issued: 0, returned: 0, timeline: [] },
      ]),
    );
    const add = (rows, kind, field) =>
      rows.forEach((r) => {
        let item = movementMap.get(r._key);
        if (!item) {
          item = {
            ...r,
            received: 0,
            issued: 0,
            returned: 0,
            available: 0,
            timeline: [],
          };
          movementMap.set(r._key, item);
        }
        item[field] += r[field];
        item.timeline.push({ kind, ...r });
        ["category", "consumable", "variety", "warehouse", "unit"].forEach(
          (k) => {
            if ((!item[k] || item[k] === "—") && r[k]) item[k] = r[k];
          },
        );
      });
    add(grn, "GRN", "received");
    add(issues, "ISSUE", "issued");
    add(returns, "RETURN", "returned");
    const movement = [...movementMap.values()].map((r) => ({
      ...r,
      available: stockMap.has(r._key)
        ? stockMap.get(r._key).available
        : r.received - r.issued + r.returned,
      timeline: r.timeline.sort(
        (a, b) =>
          new Date(pick(a._raw, "created_at", "createdAt", "date") || 0) -
          new Date(pick(b._raw, "created_at", "createdAt", "date") || 0),
      ),
    }));
    return { grn, stock, issue: issues, return: returns, movement };
  }, [raw]);
  const visible = useMemo(
    () =>
      reports[tab].filter(
        (r) =>
          !search.trim() ||
          Object.entries(r)
            .filter(([k]) => !k.startsWith("_") && k !== "timeline")
            .some(([, v]) =>
              String(v).toLowerCase().includes(search.trim().toLowerCase()),
            ),
      ),
    [reports, tab, search],
  );
  const kpis = [
    ["Total Consumables", reports.stock.length, Boxes, "crpt-kpi-blue"],
    [
      "Available Stock",
      formatQty(reports.stock.reduce((s, r) => s + r.available, 0)),
      PackageCheck,
      "crpt-kpi-green",
    ],
    [
      "Total Issued",
      formatQty(reports.issue.reduce((s, r) => s + r.issued, 0)),
      Send,
      "crpt-kpi-orange",
    ],
    [
      "Total Returned",
      formatQty(reports.return.reduce((s, r) => s + r.returned, 0)),
      Undo2,
      "crpt-kpi-purple",
    ],
  ];
  return (
    <>
      <Header />
      <main className="crpt-page">
        <Link to="/inventory/consumable" className="crpt-back-link">
          <ArrowLeft size={17} /> Back
        </Link>
        <section className="crpt-header-card">
          <span className="crpt-eyebrow">Consumables</span>
          <h1 className="crpt-title">Consumable Reports</h1>
          <p className="crpt-subtitle">
            Direct GRN, combined variety-wise warehouse stock, issue history,
            return history and movement timeline. No purchase order required.
          </p>
        </section>
        <section className="crpt-kpi-grid">
          {kpis.map(([label, value, Icon, color]) => (
            <div className={`crpt-kpi-card ${color}`} key={label}>
              <div className="crpt-kpi-icon">
                <Icon size={24} />
              </div>
              <div className="crpt-kpi-content">
                <span className="crpt-kpi-value">{value}</span>
                <span className="crpt-kpi-label">{label}</span>
              </div>
            </div>
          ))}
        </section>
        <section className="crpt-toolbar-card">
          <div className="crpt-toolbar-top">
            <div className="crpt-search-box">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search category, consumable, variety, warehouse or reference..."
              />
            </div>
            <button
              className="crpt-refresh-button"
              onClick={() => fetchAll(true)}
              disabled={loading || refreshing}
            >
              <RefreshCw size={16} className={refreshing ? "crpt-spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div className="crpt-tabs">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                className={`crpt-tab ${tab === key ? "crpt-tab-active" : ""}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
            <div className="crpt-export-bar">
              {[
                ["pdf", "Print / PDF"],
                ["excel", "Excel"],
                ["csv", "CSV"],
              ].map(([kind, label]) => (
                <button
                  className="crpt-export-btn"
                  key={kind}
                  onClick={() =>
                    exportReport(
                      kind,
                      COLUMNS[tab],
                      visible,
                      TABS.find(([k]) => k === tab)?.[1] || "Report",
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>
        {errors.auth && <div className="crpt-error-box">{errors.auth}</div>}
        {errors[tab] && (
          <div className="crpt-error-box">
            {errors[tab]}{" "}
            {tab === "grn" &&
              "Confirm that GET /erp/consumable-grn/direct/ is enabled."}
          </div>
        )}
        {tab === "movement" &&
          (errors.grn || errors.issue || errors.return || errors.stock) && (
            <div className="crpt-error-box">
              Movement totals may be incomplete because one or more report
              endpoints failed.
            </div>
          )}
        <section className="crpt-table-card">
          {loading ? (
            <div className="crpt-loading-wrapper">
              <Loading />
            </div>
          ) : (
            <div className="crpt-table-wrapper">
              <table className="crpt-table">
                <thead>
                  <tr>
                    {COLUMNS[tab].map(([key, label]) => (
                      <th key={key}>{label}</th>
                    ))}
                    {tab === "movement" && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, index) => (
                    <tr key={`${r.id ?? r._key}-${index}`}>
                      {COLUMNS[tab].map(([key]) => (
                        <td key={key}>
                          {[
                            "received",
                            "issued",
                            "returned",
                            "available",
                          ].includes(key)
                            ? formatQty(r[key])
                            : text(r[key])}
                        </td>
                      ))}
                      {tab === "movement" && (
                        <td>
                          <button
                            type="button"
                            className="crpt-eye-btn"
                            onClick={() => setSelected(r)}
                            title="View movement timeline"
                          >
                            <Eye size={17} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!visible.length && (
                    <tr>
                      <td
                        className="crpt-empty-row"
                        colSpan={
                          COLUMNS[tab].length + (tab === "movement" ? 1 : 0)
                        }
                      >
                        No {tab} records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {selected && (
          <div className="crpt-modal-overlay" onClick={() => setSelected(null)}>
            <div className="crpt-modal" onClick={(e) => e.stopPropagation()}>
              <div className="crpt-modal-header">
                <div>
                  <h3 className="crpt-modal-title">Movement Timeline</h3>
                  <p className="crpt-modal-subtitle">
                    {selected.consumable} · {selected.variety} ·{" "}
                    {selected.warehouse}
                  </p>
                </div>
                <div className="crpt-modal-header-actions">
                  <button
                    className="crpt-download-btn"
                    onClick={() =>
                      exportReport(
                        "csv",
                        [
                          ["kind", "Type"],
                          ["date", "Date"],
                          ["grnNumber", "GRN"],
                          ["issueNumber", "Issue"],
                          ["returnNumber", "Return"],
                          ["received", "Received"],
                          ["issued", "Issued"],
                          ["returned", "Returned"],
                        ],
                        selected.timeline,
                        "Consumable_Movement_Timeline",
                      )
                    }
                  >
                    <Download size={16} /> CSV
                  </button>
                  <button
                    className="crpt-modal-close"
                    onClick={() => setSelected(null)}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="crpt-modal-body">
                <div className="crpt-modal-summary">
                  {[
                    ["Received", selected.received],
                    ["Issued", selected.issued],
                    ["Returned", selected.returned],
                    ["Available", selected.available],
                  ].map(([label, qty]) => (
                    <div className="crpt-modal-summary-item" key={label}>
                      <span className="crpt-modal-summary-label">{label}</span>
                      <span className="crpt-modal-summary-value">
                        {formatQty(qty)} {selected.unit}
                      </span>
                    </div>
                  ))}
                </div>
                <h4 className="crpt-modal-timeline-title">Transactions</h4>
                <div className="crpt-timeline">
                  {selected.timeline.map((event, i) => (
                    <div
                      key={i}
                      className={`crpt-timeline-item crpt-timeline-${event.kind.toLowerCase()}`}
                    >
                      <span className="crpt-timeline-badge">{event.kind}</span>
                      <div className="crpt-timeline-content">
                        <div className="crpt-timeline-head">
                          <strong>
                            {text(
                              event.grnNumber ||
                                event.issueNumber ||
                                event.returnNumber,
                            )}
                          </strong>
                          <span className="crpt-timeline-qty">
                            {formatQty(
                              event.received || event.issued || event.returned,
                            )}{" "}
                            {event.unit}
                          </span>
                        </div>
                        <div className="crpt-timeline-time">{event.date}</div>
                        {event.department && event.department !== "—" && (
                          <div className="crpt-timeline-meta">
                            Department: {event.department} · Employee:{" "}
                            {event.employee}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {!selected.timeline.length && (
                    <div className="crpt-empty-row">
                      No transaction history available.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
