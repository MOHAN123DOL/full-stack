import { useCallback, useEffect, useMemo, useState } from "react";

import AdminCard from "./components/AdminCard";
import AdminDataTable from "./components/AdminDataTable";
import AdminStatStrip from "./components/AdminStatStrip";
import AdminStatusBadge from "./components/AdminStatusBadge";
import AdminToolbar from "./components/AdminToolbar";

import Loading from "../../components/loading";
import ErrorState from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

import { formatQuantity, matchesQuery } from "./adminUtils";

import "./AdminPoPendingGrn.css";

/* =========================================================
   ENDPOINT + CONSTANTS
   ========================================================= */

const PENDING_GRN_ENDPOINT = "/erp/admin/po-pending-grn/";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const GRN_STATUS = {
  NOT_RECEIVED: "Not Received",
  PARTIALLY_RECEIVED: "Partially Received",
};

/* =========================================================
   PREVIEW MODE
   true  = show sample data
   false = use real API data
   ========================================================= */

const PREVIEW_MODE = false;

/* =========================================================
   SAMPLE DATA (mirrors the real backend row shape)
   ========================================================= */

const SAMPLE_ROWS = [
  {
    id: "real-1",
    poItemId: 1,
    sourceType: "real",
    poNumber: "PO-2026-001",
    poType: "Regular PO",
    supplier: "ABC Traders",
    description: "MS Pipe 32mm",
    poQty: 500,
    materialReceived: 0,
    consumableReceived: 0,
    received: 0,
    balance: 500,
    unit: "KG",
    grnStatus: GRN_STATUS.NOT_RECEIVED,
  },
  {
    id: "real-2",
    poItemId: 2,
    sourceType: "real",
    poNumber: "PO-2026-002",
    poType: "Regular PO",
    supplier: "Sri Balaji Hardware",
    description: "Cement OPC 53 Grade",
    poQty: 300,
    materialReceived: 100,
    consumableReceived: 50,
    received: 150,
    balance: 150,
    unit: "Bags",
    grnStatus: GRN_STATUS.PARTIALLY_RECEIVED,
  },
  {
    id: "real-4",
    poItemId: 4,
    sourceType: "real",
    poNumber: "PO-2026-004",
    poType: "Regular PO",
    supplier: "Kaveri Enterprises",
    description: "Paint - Asian Royale",
    poQty: 200,
    materialReceived: 0,
    consumableReceived: 80,
    received: 80,
    balance: 120,
    unit: "L",
    grnStatus: GRN_STATUS.PARTIALLY_RECEIVED,
  },
  {
    id: "real-5",
    poItemId: 5,
    sourceType: "real",
    poNumber: "PO-2026-005",
    poType: "Regular PO",
    supplier: "Sri Murugan Steels",
    description: "TMT Bars 12mm",
    poQty: 2000,
    materialReceived: 1200,
    consumableReceived: 0,
    received: 1200,
    balance: 800,
    unit: "KG",
    grnStatus: GRN_STATUS.PARTIALLY_RECEIVED,
  },
];

/* =========================================================
   RESPONSE NORMALIZER
   ========================================================= */

const normalizePendingGrnRow = (row) => {
  const materialReceived = Number(row.materialReceived ?? 0);
  const consumableReceived = Number(row.consumableReceived ?? 0);
  const received = Number(row.received ?? materialReceived + consumableReceived);

  return {
    id: row.id ?? `real-${row.poItemId}`,
    poItemId: row.poItemId,
    sourceType: row.sourceType || "real",
    poNumber: row.poNumber || "",
    poType: row.poType || "Regular PO",
    supplier: row.supplier || "—",
    description: row.description || "",
    poQty: Number(row.poQty ?? 0),
    materialReceived,
    consumableReceived,
    received,
    balance: Number(row.balance ?? 0),
    unit: row.unit || "",
    grnStatus: row.grnStatus || GRN_STATUS.NOT_RECEIVED,
  };
};

/* =========================================================
   TABLE COLUMNS
   ========================================================= */

const COLUMNS = [
  {
    key: "poNumber",
    header: "PO Number",
    mono: true,

    render: (row) => (
      <span className="admin-cell-primary">
        {row.poNumber || "—"}
      </span>
    ),
  },

  {
    key: "supplier",
    header: "Vendor",

    render: (row) => (
      <span className="po-vendor-cell">
        {row.supplier || "—"}
      </span>
    ),
  },

  {
    key: "description",
    header: "Description",

    render: (row) => (
      <span className="admin-cell-wrap">
        {row.description || "—"}
      </span>
    ),
  },

  {
    key: "poQty",
    header: "Quantity",
    align: "right",

    render: (row) => {
      const sources = [];

      if (row.materialReceived > 0) {
        sources.push(`Material ${formatQuantity(row.materialReceived)}`);
      }

      if (row.consumableReceived > 0) {
        sources.push(`Consumable ${formatQuantity(row.consumableReceived)}`);
      }

      return (
        <div className="po-quantity-cell">
          <span className="admin-cell-primary">
            {formatQuantity(row.poQty)} {row.unit}
          </span>

          <span className="admin-cell-secondary">
            Received {formatQuantity(row.received)}
            {sources.length > 0 && ` (${sources.join(" · ")})`}
            {" · "}
            Balance {formatQuantity(row.balance)}
          </span>
        </div>
      );
    },
  },

  {
    key: "grnStatus",
    header: "Status",

    render: (row) => (
      <div className="po-status-cell">
        <AdminStatusBadge status={row.grnStatus} />
      </div>
    ),
  },
];

/* =========================================================
   COMPONENT
   ========================================================= */

export default function AdminPoPendingGrn() {
  const { accessToken } = useAuth();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  /* =======================================================
     LOAD DATA
     ======================================================= */

  const loadRows = useCallback(async () => {
    if (PREVIEW_MODE) {
      setRows(SAMPLE_ROWS);
      setLoading(false);
      setLoadError("");
      return;
    }

    if (!accessToken) {
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError("");

      const response = await api.get(PENDING_GRN_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.data?.success) {
        throw new Error("Invalid pending GRN response.");
      }

      const results = Array.isArray(response.data.data)
        ? response.data.data
        : [];

      setRows(results.map(normalizePendingGrnRow));
    } catch (error) {
      console.error("Failed to load pending GRN rows:", error);
      setRows([]);
      setLoadError(
        error?.response?.data?.message || GENERIC_ERROR,
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  /* =======================================================
     SEARCH + FILTER
     ======================================================= */

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (status === "all" || row.grnStatus === status) &&
          matchesQuery(
            search,
            row.poNumber,
            row.supplier,
            row.description,
          ),
      ),
    [rows, search, status],
  );

  /* =======================================================
     KPI COUNTS
     ======================================================= */

  const count = (statusValue) =>
    rows.filter((row) => row.grnStatus === statusValue).length;

  const dash = loading || loadError;

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="admin-po-pending-grn-page">

      {/* =================================================
          PAGE HEADER
          ================================================= */}

      <section className="admin-po-page-header">
        <div className="admin-po-header-content">
          <span className="admin-po-header-kicker">
            PROCUREMENT CONTROL
          </span>

          <h1>PO with Pending GRN</h1>

          <p>
            Purchase order items awaiting goods receipt
          </p>
        </div>
      </section>

      {/* =================================================
          SEARCH + FILTER
          ================================================= */}

      <div className="admin-po-toolbar-wrap">
        <AdminToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search PO number, vendor or description"
        >
          <label className="admin-field admin-po-status-field">
            <span>Status</span>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All pending</option>

              <option value={GRN_STATUS.NOT_RECEIVED}>
                {GRN_STATUS.NOT_RECEIVED}
              </option>

              <option value={GRN_STATUS.PARTIALLY_RECEIVED}>
                {GRN_STATUS.PARTIALLY_RECEIVED}
              </option>
            </select>
          </label>
        </AdminToolbar>
      </div>

      {/* =================================================
          KPI CARDS
          ================================================= */}

      <div className="admin-po-kpi-wrap">
        <AdminStatStrip
          items={[
            {
              label: "Pending items",
              value: dash ? "—" : rows.length,
              tone: "info",
            },
            {
              label: GRN_STATUS.NOT_RECEIVED,
              value: dash ? "—" : count(GRN_STATUS.NOT_RECEIVED),
              tone: "danger",
            },
            {
              label: GRN_STATUS.PARTIALLY_RECEIVED,
              value: dash ? "—" : count(GRN_STATUS.PARTIALLY_RECEIVED),
              tone: "warning",
            },
          ]}
        />
      </div>

      {/* =================================================
          TABLE
          ================================================= */}

      <div className="admin-po-table-wrap">

        {loading ? (
          <div className="admin-po-loading">
            <Loading />
          </div>
        ) : loadError ? (
          <div className="admin-po-error">
            <ErrorState onRetry={loadRows} />
            <div style={{ marginTop: 8, fontSize: 13 }}>
              {loadError}
            </div>
          </div>
        ) : (
          <AdminCard>
            <div className="admin-po-table-heading">
              <div>
                <h2>Pending GRN Items</h2>
              </div>

              <span className="admin-po-table-count">
                {filteredRows.length} items
              </span>
            </div>

            <AdminDataTable
              columns={COLUMNS}
              rows={filteredRows}
              totalCount={rows.length}
              rowKey="id"
              loading={false}
              error={null}
              onRetry={loadRows}
              emptyTitle="No pending GRN"
              emptyMessage={
                rows.length
                  ? "No purchase orders match your filters."
                  : "Every purchase order line has been fully received."
              }
              minWidth={760}
              defaultSort={{
                key: "poNumber",
                direction: "asc",
              }}
            />
          </AdminCard>
        )}
      </div>
    </div>
  );
}