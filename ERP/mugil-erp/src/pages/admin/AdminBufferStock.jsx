import { useCallback, useEffect, useMemo, useState } from "react";
import AdminCard from "./components/AdminCard";
import AdminDataTable from "./components/AdminDataTable";
import Loading from "../../components/loading";
import ErrorState from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./AdminBufferStock.css";

const ENDPOINT = "/erp/admin/buffer-stock/";
const numberText = (value) =>
  Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const label = (value) =>
  value === null || value === undefined || value === "" ? "—" : String(value);
const apiMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.detail ||
  "Unable to save buffer limit.";

export default function AdminBufferStock() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [rowErrors, setRowErrors] = useState({});
  const [notice, setNotice] = useState("");

  const loadData = useCallback(
    async (initial = false) => {
      if (!accessToken) {
        setError("Please log in again.");
        setLoading(false);
        return;
      }
      if (initial) setLoading(true);
      else setRefreshing(true);
      try {
        setError("");
        const response = await api.get(ENDPOINT, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const items = response.data?.data;
        if (!response.data?.success || !Array.isArray(items)) {
          throw new Error("Unexpected buffer stock response.");
        }
        setRows(items);
        setDrafts(
          Object.fromEntries(
            items.map((row) => [String(row.id), String(row.bufferQty ?? 0)]),
          ),
        );
        setRowErrors({});
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            err.message ||
            "Failed to load buffer stock.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  const visibleRows = useMemo(
    () =>
      rows.filter((row) =>
        [
          row.category,
          row.consumableName,
          row.varietyName,
          row.description,
          row.materialCode,
          row.warehouse,
        ].some((field) =>
          String(field ?? "")
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        ),
      ),
    [rows, query],
  );

  const updateDraft = (id, value) => {
    setDrafts((previous) => ({ ...previous, [String(id)]: value }));
    setRowErrors((previous) => ({ ...previous, [String(id)]: "" }));
    setNotice("");
  };

  const saveLimit = async (row) => {
    const key = String(row.id);
    const raw = String(drafts[key] ?? "").trim();
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value < 0) {
      setRowErrors((previous) => ({
        ...previous,
        [key]: "Enter a valid number (0 or more).",
      }));
      return;
    }
    if (value === Number(row.bufferQty ?? 0)) return;
    try {
      setSavingId(key);
      setNotice("");
      const response = await api.patch(
        `${ENDPOINT}${row.id}/`,
        { buffer_stock_limit: raw },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (response.data?.success === false)
        throw new Error(response.data.message || "Save failed.");
      await loadData(false);
      setNotice(
        `Buffer limit saved for ${row.consumableName || row.description || "consumable"} (${row.warehouse || "warehouse"}).`,
      );
    } catch (err) {
      setRowErrors((previous) => ({ ...previous, [key]: apiMessage(err) }));
    } finally {
      setSavingId(null);
    }
  };

  const columns = [
    {
      key: "category",
      header: "Category",
      render: (row) => label(row.category),
    },
    {
      key: "consumableName",
      header: "Consumable",
      render: (row) => (
        <span className="admin-cell-wrap">
          {label(row.consumableName || row.description)}
        </span>
      ),
    },
    {
      key: "varietyName",
      header: "Variety",
      render: (row) => label(row.varietyName),
    },
    {
      key: "warehouse",
      header: "Warehouse",
      render: (row) => label(row.warehouse),
    },
    {
      key: "receivedQty",
      header: "Received",
      align: "right",
      render: (row) => numberText(row.receivedQty),
    },
    {
      key: "issuedQty",
      header: "Issued",
      align: "right",
      render: (row) => numberText(row.issuedQty),
    },
    {
      key: "returnedQty",
      header: "Returned",
      align: "right",
      render: (row) => numberText(row.returnedQty),
    },
    {
      key: "availableQty",
      header: "Available",
      align: "right",
      render: (row) => (
        <strong className={row.isLow ? "buffer-qty-low" : ""}>
          {numberText(row.availableQty)}{" "}
          {label(row.unit) !== "—" ? row.unit : ""}
        </strong>
      ),
    },
    {
      key: "bufferQty",
      header: "Buffer Quantity (Editable)",
      render: (row) => {
        const key = String(row.id);
        const dirty = String(drafts[key] ?? "") !== String(row.bufferQty ?? 0);
        const busy = savingId !== null;
        return (
          <div className="buffer-input-cell">
            <div className="buffer-input-actions">
              <input
                aria-label={`Buffer quantity for ${row.consumableName || row.description} ${row.varietyName || ""} ${row.warehouse || ""}`}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                className="buffer-inline-input"
                value={drafts[key] ?? ""}
                disabled={busy || refreshing}
                onChange={(event) => updateDraft(row.id, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveLimit(row);
                }}
              />
              <button
                type="button"
                className="buffer-inline-save"
                disabled={!dirty || busy || refreshing}
                onClick={() => saveLimit(row)}
              >
                {savingId === key ? "Saving…" : "Save"}
              </button>
            </div>
            {rowErrors[key] && (
              <small className="buffer-row-error" role="alert">
                {rowErrors[key]}
              </small>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span
          className={`buffer-status ${row.isLow ? "buffer-status-low" : "buffer-status-ok"}`}
        >
          {row.isLow ? "Low Stock" : "Sufficient"}
        </span>
      ),
    },
  ];

  const lowCount = rows.filter((row) => row.isLow).length;
  return (
    <div className="admin-buffer-stock-page">
      <section
        className="buffer-stock-hero"
        style={{
          backgroundImage: "url('/buffer_stock/buffer_stock_hero.png')",
        }}
      >
        <div className="buffer-stock-hero-overlay" />
        <div className="buffer-stock-hero-content">
          <span className="buffer-stock-eyebrow">INVENTORY CONTROL</span>
          <h1>Buffer Stock</h1>
          <p>
            Set alert quantities for each consumable variety and warehouse.
            Saving a buffer limit does not change available stock.
          </p>
        </div>
        <img
          src="/buffer_stock/buffer_stock_icon.png"
          alt=""
          className="buffer-stock-hero-icon"
          aria-hidden="true"
        />
      </section>
      <AdminCard>
        <div className="buffer-stock-card-header buffer-stock-header-flex">
          <div className="buffer-stock-card-heading">
            <span className="buffer-stock-card-eyebrow">
              INVENTORY REGISTER
            </span>
            <h2>Category &amp; Variety Buffer Levels</h2>
            <p>
              Combined quantities by variety and warehouse; edit the alert limit
              directly in the table.
            </p>
          </div>
          <div className="buffer-header-controls">
            <input
              className="buffer-search"
              type="search"
              placeholder="Search category, variety, warehouse…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              className="buffer-refresh"
              type="button"
              disabled={refreshing || savingId !== null}
              onClick={() => loadData(false)}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <span className="buffer-stock-record-count">
              {visibleRows.length} Records · {lowCount} Low
            </span>
          </div>
        </div>
        {notice && (
          <div className="buffer-notice" role="status">
            {notice}
          </div>
        )}
        <div className="buffer-stock-table-wrapper">
          {loading ? (
            <div className="buffer-state">
              <Loading />
            </div>
          ) : error ? (
            <div className="buffer-state">
              <p>{error}</p>
              <ErrorState onRetry={() => loadData(false)} />
            </div>
          ) : (
            <AdminDataTable
              columns={columns}
              rows={visibleRows}
              rowKey="id"
              emptyTitle="No buffer stock records found"
              minWidth={1250}
            />
          )}
        </div>
      </AdminCard>
      <div className="buffer-stock-page-note">
        Low stock is flagged when available quantity is at or below the
        configured buffer quantity. A limit of 0 disables low-stock alerts in
        the current backend.
      </div>
    </div>
  );
}
