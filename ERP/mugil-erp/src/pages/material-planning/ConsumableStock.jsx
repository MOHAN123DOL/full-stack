import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Boxes,
  Layers,
  Warehouse,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import Header from "../../components/Header";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./ConsumableStock.css";

const ENDPOINT = "/erp/consumable-grn/stock/";
const first = (obj, ...keys) =>
  keys
    .map((k) => obj?.[k])
    .find((v) => v !== undefined && v !== null && v !== "");
const label = (value) => {
  if (value == null) return "";
  if (typeof value !== "object") return String(value);
  return String(
    first(
      value,
      "name",
      "variety_name",
      "consumable_name",
      "category_name",
      "label",
      "title",
      "companyName",
      "description",
      "code",
    ) ?? "",
  );
};
const number = (value) => Number(value ?? 0) || 0;
const fmt = (value) =>
  number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
const records = (data) =>
  Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.stock)
          ? data.stock
          : [];
const errorText = (error) => {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (data && typeof data === "object")
    return (
      Object.values(data)
        .flat()
        .find((v) => typeof v === "string") || "Unable to load stock."
    );
  return error?.message || "Unable to load stock.";
};

function normalize(row) {
  const varietyObj = first(row, "consumable_variety", "variety");
  const masterObj = first(row, "consumable", "master");
  const categoryObj = first(row, "category");
  const varietyId =
    first(row, "variety_id", "consumable_variety_id") ??
    (typeof varietyObj === "object" ? varietyObj?.id : null);
  const master = label(
    first(row, "consumable_name", "consumableName", "master_name") ??
      masterObj ??
      (typeof varietyObj === "object" ? varietyObj?.consumable : null),
  );
  const category = label(
    first(row, "category_name", "categoryName") ??
      categoryObj ??
      (typeof masterObj === "object" ? masterObj?.category : null),
  );
  const variety = label(
    first(row, "variety_name", "varietyName", "variety_code", "varietyCode") ??
      varietyObj,
  );
  const code = label(
    first(row, "variety_code", "varietyCode", "code") ??
      (typeof varietyObj === "object" ? varietyObj?.code : null),
  );
  const size = label(
    first(row, "size", "variety_size") ??
      (typeof varietyObj === "object" ? varietyObj?.size : null),
  );
  const description = label(
    first(row, "description", "variety_description") ??
      (typeof varietyObj === "object" ? varietyObj?.description : null),
  );
  const warehouse = label(first(row, "warehouse", "warehouse_name"));
  const unit = label(
    first(row, "unit", "uom") ??
      (typeof masterObj === "object" ? masterObj?.unit : null),
  );
  // The stock API is the authority for available balance (receipts - issues + returns).
  const available = number(
    first(
      row,
      "available_quantity",
      "available_qty",
      "availableQty",
      "current_stock",
      "stock_quantity",
      "balance_quantity",
      "balance",
      "quantity",
    ),
  );
  const buffer = number(
    first(
      row,
      "buffer_stock",
      "buffer_stock_limit",
      "buffer_limit",
      "minimum_stock",
      "reorder_level",
    ),
  );
  const received = first(
    row,
    "total_received",
    "received_quantity",
    "receivedQty",
  );
  const issued = first(row, "total_issued", "issued_quantity", "issuedQty");
  const returned = first(
    row,
    "total_returned",
    "returned_quantity",
    "returnedQty",
  );
  const date =
    first(row, "last_received_date", "lastReceivedDate", "received_date") || "";
  // Prefer the database variety ID. Names are fallback only for older responses.
  const identity =
    varietyId != null
      ? `id:${varietyId}`
      : [category, master, variety, code, size, description]
          .map((v) => v.trim().toLowerCase())
          .join("|");
  return {
    identity,
    category,
    master,
    variety,
    code,
    size,
    description,
    warehouse,
    unit,
    available,
    buffer,
    received: received == null ? null : number(received),
    issued: issued == null ? null : number(issued),
    returned: returned == null ? null : number(returned),
    date,
  };
}

function combineStock(rows) {
  const groups = new Map();
  for (const raw of rows) {
    const row = normalize(raw);
    const key = `${row.identity}::${row.warehouse.trim().toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, { ...row, receipts: 1 });
    } else {
      const current = groups.get(key);
      current.available += row.available;
      current.buffer = Math.max(current.buffer, row.buffer);
      for (const field of ["received", "issued", "returned"]) {
        if (row[field] != null)
          current[field] = (current[field] ?? 0) + row[field];
      }
      if (row.date > current.date) current.date = row.date;
      current.receipts += 1;
    }
  }
  return [...groups.values()].sort((a, b) =>
    `${a.category}|${a.master}|${a.variety}|${a.warehouse}`.localeCompare(
      `${b.category}|${b.master}|${b.variety}|${b.warehouse}`,
    ),
  );
}

export default function ConsumableStock() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [warehouse, setWarehouse] = useState("All");
  const [category, setCategory] = useState("All");

  const load = useCallback(
    async (refresh = false) => {
      if (!accessToken) {
        setError("Session expired. Please log in again.");
        setLoading(false);
        return;
      }
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      try {
        const response = await api.get(ENDPOINT, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setRows(records(response.data));
      } catch (err) {
        setError(errorText(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken],
  );
  useEffect(() => {
    load();
  }, [load]);

  const stock = useMemo(() => combineStock(rows), [rows]);
  const warehouses = useMemo(
    () => [...new Set(stock.map((s) => s.warehouse).filter(Boolean))].sort(),
    [stock],
  );
  const categories = useMemo(
    () => [...new Set(stock.map((s) => s.category).filter(Boolean))].sort(),
    [stock],
  );
  const filtered = useMemo(
    () =>
      stock.filter((s) => {
        const haystack = [
          s.category,
          s.master,
          s.variety,
          s.code,
          s.size,
          s.description,
          s.warehouse,
        ]
          .join(" ")
          .toLowerCase();
        return (
          haystack.includes(search.trim().toLowerCase()) &&
          (warehouse === "All" || warehouse === s.warehouse) &&
          (category === "All" || category === s.category)
        );
      }),
    [stock, search, warehouse, category],
  );
  const total = stock.reduce((sum, s) => sum + s.available, 0);
  const low = stock.filter((s) => s.available <= s.buffer).length;
  const status = (s) =>
    s.available <= 0
      ? "Out of Stock"
      : s.available <= s.buffer
        ? "Low Stock"
        : "In Stock";

  return (
    <>
      <Header />
      <main className="cons-stock-page-shell">
        <div className="cons-stock-page-container">
          <Link to="/inventory/consumable" className="cons-stock-page-backlink">
            <ArrowLeft size={16} /> Back
          </Link>
          <header className="cons-stock-page-headingblock">
            <span className="cons-stock-page-sectiontag">
              INVENTORY / LIVE BALANCES
            </span>
            <h1 className="cons-stock-page-title">Consumable Material Stock</h1>
            <p className="cons-stock-page-subtitle">
              One combined stock balance per variety and warehouse. Individual
              GRNs remain in the GRN history.
            </p>
          </header>
          <section className="cons-stock-dashboard-summary">
            <div className="cons-stock-dashboard-card">
              <span className="cons-stock-dashboard-cardicon">
                <Boxes size={23} />
              </span>
              <div>
                <strong className="cons-stock-dashboard-cardvalue">
                  {stock.length}
                </strong>
                <div className="cons-stock-dashboard-cardlabel">
                  Variety / Warehouse Stock Lines
                </div>
              </div>
            </div>
            <div className="cons-stock-dashboard-card">
              <span className="cons-stock-dashboard-cardicon">
                <Layers size={23} />
              </span>
              <div>
                <strong className="cons-stock-dashboard-cardvalue">
                  {fmt(total)}
                </strong>
                <div className="cons-stock-dashboard-cardlabel">
                  Total Available Quantity (all units)
                </div>
              </div>
            </div>
            <div className="cons-stock-dashboard-card">
              <span className="cons-stock-dashboard-cardicon">
                <Warehouse size={23} />
              </span>
              <div>
                <strong className="cons-stock-dashboard-cardvalue">
                  {warehouses.length}
                </strong>
                <div className="cons-stock-dashboard-cardlabel">Warehouses</div>
              </div>
            </div>
            <div className="cons-stock-dashboard-card">
              <span className="cons-stock-dashboard-cardicon">
                <AlertTriangle size={23} />
              </span>
              <div>
                <strong className="cons-stock-dashboard-cardvalue">
                  {low}
                </strong>
                <div className="cons-stock-dashboard-cardlabel">
                  Low / Out of Stock
                </div>
              </div>
            </div>
          </section>
          <section className="cons-stock-toolbar-panel">
            <div className="cons-stock-toolbar-searchwrapper">
              <Search size={18} />
              <input
                className="cons-stock-toolbar-searchinput"
                placeholder="Search category, consumable, variety, size..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="cons-stock-toolbar-filterarea">
              <select
                aria-label="Warehouse"
                className="cons-stock-toolbar-filterselect"
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
              >
                <option value="All">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
              <select
                aria-label="Category"
                className="cons-stock-toolbar-filterselect"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <button
                type="button"
                className="cons-stock-refresh-button"
                onClick={() => load(true)}
                disabled={loading || refreshing}
              >
                <RefreshCw
                  size={17}
                  className={refreshing ? "cons-stock-spin" : ""}
                />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </section>
          {error && (
            <div className="cons-stock-error-box" role="alert">
              {error} <button onClick={() => load()}>Retry</button>
            </div>
          )}
          <section className="cons-stock-table-card">
            <div className="cons-stock-table-heading">
              <h2>Combined Stock Register</h2>
              <span>{filtered.length} stock lines</span>
            </div>
            <div className="cons-stock-table-scroll">
              <table className="cons-stock-table-grid">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Consumable</th>
                    <th>Variety</th>
                    <th>Size</th>
                    <th>Description</th>
                    <th>Warehouse</th>
                    <th>Received</th>
                    <th>Issued</th>
                    <th>Returned</th>
                    <th>Available Stock</th>
                    <th>Unit</th>
                    <th>Buffer</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={13} className="cons-stock-table-emptycell">
                        Loading stock...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="cons-stock-table-emptycell">
                        No stock found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s) => (
                      <tr
                        key={`${s.identity}-${s.warehouse}`}
                        className="cons-stock-table-row"
                      >
                        <td className="cons-stock-table-cell">
                          <span className="cons-stock-table-categorypill">
                            {s.category || "—"}
                          </span>
                        </td>
                        <td className="cons-stock-table-cell">
                          <strong>{s.master || "—"}</strong>
                        </td>
                        <td className="cons-stock-table-cell">
                          <strong>{s.variety || s.code || "—"}</strong>
                          {s.code && s.code !== s.variety && (
                            <small className="cons-stock-subline">
                              {s.code}
                            </small>
                          )}
                        </td>
                        <td className="cons-stock-table-cell">
                          {s.size || "—"}
                        </td>
                        <td className="cons-stock-table-cell">
                          {s.description || "—"}
                        </td>
                        <td className="cons-stock-table-cell">
                          {s.warehouse || "—"}
                        </td>
                        <td className="cons-stock-table-cell">
                          {s.received == null ? "—" : fmt(s.received)}
                        </td>
                        <td className="cons-stock-table-cell">
                          {s.issued == null ? "—" : fmt(s.issued)}
                        </td>
                        <td className="cons-stock-table-cell">
                          {s.returned == null ? "—" : fmt(s.returned)}
                        </td>
                        <td className="cons-stock-table-cell">
                          <span className="cons-stock-table-quantityvalue">
                            {fmt(s.available)}
                          </span>
                        </td>
                        <td className="cons-stock-table-cell">
                          {s.unit || "—"}
                        </td>
                        <td className="cons-stock-table-cell">
                          {fmt(s.buffer)}
                        </td>
                        <td className="cons-stock-table-cell">
                          <span
                            className={`cons-stock-table-statusbadge cons-stock-table-status-${status(s).toLowerCase().replaceAll(" ", "-")}`}
                          >
                            {status(s)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <p className="cons-stock-note">
            Available stock is taken from the stock API, which must calculate
            received − issued + returned. Totals across different units (Nos,
            Kg, etc.) are displayed only as a numerical overview.
          </p>
        </div>
      </main>
    </>
  );
}
