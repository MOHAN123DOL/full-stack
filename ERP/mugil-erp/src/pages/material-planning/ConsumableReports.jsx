import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Boxes,
  PackageCheck,
  Send,
  Undo2,
} from "lucide-react";
import Header from "../../components/Header";
import consumableStore from "../../data/consumableStore";
import "./ConsumableReports.css";
// import { useEffect, useMemo, useState } from "react";
// import { Link } from "react-router-dom";
// import {
//   ArrowLeft,
//   Search,
//   Boxes,
//   PackageCheck,
//   Send,
//   Undo2,
// } from "lucide-react";
// import Header from "../../components/Header";
// import consumableStore from "../../store/consumableStore";

const REPORT_TABS = [
  { key: "grn", label: "GRN Report" },
  { key: "stock", label: "Stock Report" },
  { key: "issue", label: "Issue Report" },
  { key: "return", label: "Return Report" },
  { key: "movement", label: "Movement History" },
];


/* ============================================================
   CONSUMABLE REPORT EXPORT HELPERS
   Reuses the export approach from Reports.jsx
   ============================================================ */

const crptFmt = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
};

function crptToCSV(columns, rows) {
  const escape = (value) => {
    const text = crptFmt(value);
    return /[",\n]/.test(text)
      ? `"${text.replace(/"/g, '""')}"`
      : text;
  };

  const header = columns.map((column) => column.label).join(",");

  const lines = rows.map((row) =>
    columns
      .map((column) =>
        escape(
          column.render
            ? column.render(row)
            : row[column.key],
        ),
      )
      .join(","),
  );

  return [header, ...lines].join("\n");
}

function crptToHTMLTable(columns, rows, title) {
  const head = columns
    .map(
      (column) =>
        `<th style="border:1px solid #ccc;padding:6px;background:#f1f5f9;text-align:left;">${column.label}</th>`,
    )
    .join("");

  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map(
            (column) =>
              `<td style="border:1px solid #ccc;padding:6px;">${crptFmt(
                column.render
                  ? column.render(row)
                  : row[column.key],
              )}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return `
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
      </head>
      <body>
        <h2 style="font-family:sans-serif;">${title}</h2>
        <table style="border-collapse:collapse;font-family:sans-serif;font-size:12px;width:100%;">
          <thead>
            <tr>${head}</tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </body>
    </html>
  `;
}

function crptDownloadBlob(content, filename, mime) {
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

function crptExportCSV(columns, rows, title) {
  crptDownloadBlob(
    crptToCSV(columns, rows),
    `${title.replace(/\s+/g, "_")}.csv`,
    "text/csv",
  );
}

function crptExportExcel(columns, rows, title) {
  crptDownloadBlob(
    crptToHTMLTable(columns, rows, title),
    `${title.replace(/\s+/g, "_")}.xls`,
    "application/vnd.ms-excel",
  );
}

function crptExportPDFOrPrint(columns, rows, title) {
  const html = crptToHTMLTable(columns, rows, title);

  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(html);
  win.document.close();
  win.focus();

  setTimeout(() => win.print(), 300);
}

export default function ConsumableReports() {
  const [purchaseOrders, setPurchaseOrders] = useState(
    consumableStore.getPurchaseOrders(),
  );
  const [stock, setStock] = useState(consumableStore.getConsumableStock());
  const [issued, setIssued] = useState(
    consumableStore.getIssuedConsumables(),
  );
  const [returned, setReturned] = useState(
    consumableStore.getReturnedConsumables(),
  );
  const [movements, setMovements] = useState(
    consumableStore.getMovementHistory(),
  );

  const [activeTab, setActiveTab] = useState("grn");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsubscribe = consumableStore.subscribe(() => {
      setPurchaseOrders([...consumableStore.getPurchaseOrders()]);
      setStock([...consumableStore.getConsumableStock()]);
      setIssued([...consumableStore.getIssuedConsumables()]);
      setReturned([...consumableStore.getReturnedConsumables()]);
      setMovements([...consumableStore.getMovementHistory()]);
    });
    return unsubscribe;
  }, []);

  const totalConsumables = stock.length;
  const totalAvailableStock = stock.reduce(
    (sum, item) => sum + item.availableQty,
    0,
  );
  const totalIssued = issued.reduce((sum, item) => sum + item.issuedQty, 0);
  const totalReturned = returned.reduce(
    (sum, item) => sum + item.returnQty,
    0,
  );

  const term = search.trim().toLowerCase();

  const filteredGrnRows = useMemo(
    () =>
      purchaseOrders.filter((po) => {
        if (!term) return true;
        return (
          po.poNumber.toLowerCase().includes(term) ||
          po.consumableName.toLowerCase().includes(term) ||
          po.supplier.toLowerCase().includes(term) ||
          po.warehouse.toLowerCase().includes(term)
        );
      }),
    [purchaseOrders, term],
  );

  const filteredStockRows = useMemo(
    () =>
      stock.filter((item) => {
        if (!term) return true;
        return (
          item.consumableName.toLowerCase().includes(term) ||
          item.referenceNumber.toLowerCase().includes(term) ||
          item.warehouse.toLowerCase().includes(term)
        );
      }),
    [stock, term],
  );

  const filteredIssueRows = useMemo(
    () =>
      issued.filter((item) => {
        if (!term) return true;
        return (
          item.consumableName.toLowerCase().includes(term) ||
          item.issueNumber.toLowerCase().includes(term) ||
          item.department.toLowerCase().includes(term) ||
          item.employeeName.toLowerCase().includes(term) ||
          item.warehouse.toLowerCase().includes(term)
        );
      }),
    [issued, term],
  );

  const filteredReturnRows = useMemo(
    () =>
      returned.filter((item) => {
        if (!term) return true;
        return (
          item.consumableName.toLowerCase().includes(term) ||
          item.returnNumber.toLowerCase().includes(term) ||
          item.department.toLowerCase().includes(term) ||
          item.employeeName.toLowerCase().includes(term) ||
          item.warehouse.toLowerCase().includes(term)
        );
      }),
    [returned, term],
  );

  const filteredMovementRows = useMemo(
    () =>
      movements.filter((item) => {
        if (!term) return true;
        return (
          item.consumableName.toLowerCase().includes(term) ||
          item.referenceNumber.toLowerCase().includes(term) ||
          (item.department || "").toLowerCase().includes(term) ||
          (item.user || "").toLowerCase().includes(term) ||
          item.warehouse.toLowerCase().includes(term)
        );
      }),
    [movements, term],
  );

  
/* ============================================================
   REPORT EXPORT CONFIGURATION
   ============================================================ */

const exportConfigs = {
  grn: {
    title: "GRN Report",
    columns: [
      { key: "poNumber", label: "PO Number" },
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
      { key: "warehouse", label: "Warehouse" },
      { key: "availableQty", label: "Available Qty" },
      { key: "unit", label: "Unit" },
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
      { key: "issuedQty", label: "Issued Qty" },
      { key: "balanceQty", label: "Balance Qty" },
      { key: "warehouse", label: "Warehouse" },
      { key: "status", label: "Status" },
    ],
    rows: filteredIssueRows,
  },

  return: {
    title: "Return Report",
    columns: [
      { key: "returnNumber", label: "Return Number" },
      { key: "issueNumber", label: "Issue Number" },
      { key: "consumableName", label: "Consumable" },
      { key: "department", label: "Department" },
      { key: "employeeName", label: "Employee" },
      { key: "returnQty", label: "Return Qty" },
      { key: "warehouse", label: "Warehouse" },
      { key: "date", label: "Date" },
    ],
    rows: filteredReturnRows,
  },

  movement: {
    title: "Movement History",
    columns: [
      { key: "date", label: "Date" },
      { key: "time", label: "Time" },
      { key: "type", label: "Type" },
      { key: "consumableName", label: "Consumable" },
      { key: "referenceNumber", label: "Reference" },
      {
        key: "quantity",
        label: "Quantity",
        render: (row) => `${row.quantity} ${row.unit || ""}`.trim(),
      },
      { key: "department", label: "Department" },
      { key: "warehouse", label: "Warehouse" },
      { key: "user", label: "User" },
      { key: "remarks", label: "Remarks" },
    ],
    rows: filteredMovementRows,
  },
};

/* ============================================================
   EXPORT HANDLER
   ============================================================ */

const handleExport = (type) => {
  const report = exportConfigs[activeTab];

  if (!report) return;

  const { title, columns, rows } = report;

  if (type === "csv") {
    crptExportCSV(columns, rows, title);
  } else if (type === "excel") {
    crptExportExcel(columns, rows, title);
  } else {
    crptExportPDFOrPrint(columns, rows, title);
  }
};

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
            History. Nothing here is hardcoded - every row reflects the current
            state of the module.
          </p>
        </div>
      </section>

      <section className="crpt-kpi-grid">
        <div className="crpt-kpi-card crpt-kpi-blue">
          <div className="crpt-kpi-pattern"></div>

          <div className="crpt-kpi-icon">
            <Boxes size={22} />
          </div>

          <div className="crpt-kpi-content">
            <span className="crpt-kpi-value">
              {totalConsumables}
            </span>

            <span className="crpt-kpi-label">
              Total Consumables
            </span>
          </div>
        </div>

        <div className="crpt-kpi-card crpt-kpi-green">
          <div className="crpt-kpi-pattern"></div>

          <div className="crpt-kpi-icon">
            <PackageCheck size={22} />
          </div>

          <div className="crpt-kpi-content">
            <span className="crpt-kpi-value">
              {totalAvailableStock}
            </span>

            <span className="crpt-kpi-label">
              Available Stock
            </span>
          </div>
        </div>

        <div className="crpt-kpi-card crpt-kpi-orange">
          <div className="crpt-kpi-pattern"></div>

          <div className="crpt-kpi-icon">
            <Send size={22} />
          </div>

          <div className="crpt-kpi-content">
            <span className="crpt-kpi-value">
              {totalIssued}
            </span>

            <span className="crpt-kpi-label">
              Total Issued
            </span>
          </div>
        </div>

        <div className="crpt-kpi-card crpt-kpi-purple">
          <div className="crpt-kpi-pattern"></div>

          <div className="crpt-kpi-icon">
            <Undo2 size={22} />
          </div>

          <div className="crpt-kpi-content">
            <span className="crpt-kpi-value">
              {totalReturned}
            </span>

            <span className="crpt-kpi-label">
              Total Returned
            </span>
          </div>
        </div>
      </section>

      <section className="crpt-toolbar-card">
        <div className="crpt-toolbar-top">
          <div className="crpt-search-box">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search consumable, PO, department, employee, warehouse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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

  {/* ================= Export Buttons ================= */}

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

      <div className="crpt-table-card">

                {activeTab === "grn" && (
          <div className="crpt-table-wrapper">
            <table className="crpt-table">
              <thead>
                <tr>
                  <th>PO Number</th>
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
                    <td>{po.poNumber}</td>
                    <td>{po.supplier}</td>
                    <td>{po.consumableName}</td>
                    <td>{po.orderedQty}</td>
                    <td>{po.receivedQty}</td>
                    <td>{po.pendingQty}</td>
                    <td>{po.warehouse}</td>
                    <td>
                      <span className="crpt-status-chip">
                        {po.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {filteredGrnRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="crpt-empty-row"
                    >
                      No purchase orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "stock" && (
          <div className="crpt-table-wrapper">
            <table className="crpt-table">
              <thead>
                <tr>
                  <th>Reference Number</th>
                  <th>Consumable</th>
                  <th>Warehouse</th>
                  <th>Available Qty</th>
                  <th>Unit</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredStockRows.map((item) => (
                  <tr key={item.id}>
                    <td>{item.referenceNumber}</td>
                    <td>{item.consumableName}</td>
                    <td>{item.warehouse}</td>
                    <td>{item.availableQty}</td>
                    <td>{item.unit}</td>
                    <td>
                      <span className="crpt-status-chip">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {filteredStockRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="crpt-empty-row"
                    >
                      No stock records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "issue" && (
          <div className="crpt-table-wrapper">
            <table className="crpt-table">
              <thead>
                <tr>
                  <th>Issue Number</th>
                  <th>Consumable</th>
                  <th>Department</th>
                  <th>Employee</th>
                  <th>Issued Qty</th>
                  <th>Balance Qty</th>
                  <th>Warehouse</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredIssueRows.map((item) => (
                  <tr key={item.id}>
                    <td>{item.issueNumber}</td>
                    <td>{item.consumableName}</td>
                    <td>{item.department}</td>
                    <td>{item.employeeName}</td>
                    <td>{item.issuedQty}</td>
                    <td>{item.balanceQty}</td>
                    <td>{item.warehouse}</td>
                    <td>
                      <span className="crpt-status-chip">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {filteredIssueRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="crpt-empty-row">
                      No issue records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "return" && (
          <div className="crpt-table-wrapper">
            <table className="crpt-table">
              <thead>
                <tr>
                  <th>Return Number</th>
                  <th>Issue Number</th>
                  <th>Consumable</th>
                  <th>Department</th>
                  <th>Employee</th>
                  <th>Return Qty</th>
                  <th>Warehouse</th>
                  <th>Date</th>
                </tr>
              </thead>

              <tbody>
                {filteredReturnRows.map((item) => (
                  <tr key={item.id}>
                    <td>{item.returnNumber}</td>
                    <td>{item.issueNumber}</td>
                    <td>{item.consumableName}</td>
                    <td>{item.department}</td>
                    <td>{item.employeeName}</td>
                    <td>{item.returnQty}</td>
                    <td>{item.warehouse}</td>
                    <td>{item.date}</td>
                  </tr>
                ))}

                {filteredReturnRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="crpt-empty-row">
                      No return records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "movement" && (
          <div className="crpt-table-wrapper">
            <table className="crpt-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Consumable</th>
                  <th>Reference</th>
                  <th>Quantity</th>
                  <th>Department</th>
                  <th>Warehouse</th>
                  <th>User</th>
                  <th>Remarks</th>
                </tr>
              </thead>

              <tbody>
                {filteredMovementRows.map((item) => (
                  <tr key={item.id}>
                    <td>{item.date}</td>
                    <td>{item.time}</td>
                    <td>
                      <span className="crpt-status-chip">
                        {item.type}
                      </span>
                    </td>
                    <td>{item.consumableName}</td>
                    <td>{item.referenceNumber}</td>
                    <td>
                      {item.quantity} {item.unit}
                    </td>
                    <td>{item.department || "-"}</td>
                    <td>{item.warehouse}</td>
                    <td>{item.user || "-"}</td>
                    <td>{item.remarks || "-"}</td>
                  </tr>
                ))}

                {filteredMovementRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="crpt-empty-row">
                      No movement history yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  </>
);
}
