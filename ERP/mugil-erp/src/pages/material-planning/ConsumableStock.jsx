import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Boxes,
  Layers,
  Warehouse,
  RefreshCw,
} from "lucide-react";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./ConsumableStock.css";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const STOCK_ENDPOINT = "/erp/consumable-grn/stock/";

// ---------------------------------------------------------------------
// SAFE STRING — GRN.supplier / category may be objects (JSONField leaks)
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
    const firstFieldError = Object.values(data)
      .flat()
      .find((value) => typeof value === "string");
    if (firstFieldError) return firstFieldError;
  }

  if (error?.message) return error.message;
  return fallback;
}

export default function ConsumableStock() {
  const { accessToken } = useAuth();

  const [stock, setStock] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken],
  );

  // ---------------------------------------------------------------
  // FETCH STOCK
  // ---------------------------------------------------------------
  const fetchStock = useCallback(
    async (isRefresh = false) => {
      if (!accessToken) {
        setStock([]);
        setError("Your session has expired. Please login again.");
        setIsLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError("");

        const response = await api.get(STOCK_ENDPOINT, {
          headers: authHeaders(),
        });

        const data = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.data)
            ? response.data.data
            : Array.isArray(response.data?.results)
              ? response.data.results
              : [];

        setStock(data);
      } catch (err) {
        console.error("Failed to load stock:", err);
        setStock([]);
        setError(getApiError(err, "Failed to load consumable stock."));
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, authHeaders],
  );

  useEffect(() => {
    fetchStock(false);
  }, [fetchStock]);

  // ---------------------------------------------------------------
  // FILTER OPTIONS (derived from data)
  // ---------------------------------------------------------------
  const warehouseOptions = [
    "All",
    ...new Set(
      stock
        .map((item) => toDisplayString(item.warehouse))
        .filter((v) => v && v !== "—"),
    ),
  ];

  const categoryOptions = [
    "All",
    ...new Set(
      stock
        .map((item) => toDisplayString(item.category))
        .filter((v) => v && v !== "—"),
    ),
  ];

  // Reset filters if the selected value no longer exists
  useEffect(() => {
    if (!warehouseOptions.includes(warehouseFilter)) {
      setWarehouseFilter("All");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock]);

  useEffect(() => {
    if (!categoryOptions.includes(categoryFilter)) {
      setCategoryFilter("All");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock]);

  // ---------------------------------------------------------------
  // FILTERING
  // ---------------------------------------------------------------
  const filteredStock = stock.filter((item) => {
    const term = search.trim().toLowerCase();

    const consumable = toDisplayString(item.consumableName).toLowerCase();
    const reference = toDisplayString(item.referenceNumber).toLowerCase();
    const supplier = toDisplayString(item.supplier).toLowerCase();

    const matchesSearch =
      !term ||
      consumable.includes(term) ||
      reference.includes(term) ||
      supplier.includes(term);

    const matchesWarehouse =
      warehouseFilter === "All" ||
      toDisplayString(item.warehouse) === warehouseFilter;

    const matchesCategory =
      categoryFilter === "All" ||
      toDisplayString(item.category) === categoryFilter;

    return matchesSearch && matchesWarehouse && matchesCategory;
  });

  const totalConsumables = stock.length;

  const totalQuantity = stock.reduce(
    (sum, item) => sum + (Number(item.availableQty) || 0),
    0,
  );

  const totalWarehouses = new Set(
    stock
      .map((item) => toDisplayString(item.warehouse))
      .filter((v) => v && v !== "—"),
  ).size;

  // ===============================================================
  // RENDER
  // ===============================================================
  return (
    <>
      <Header />

      <div className="cons-stock-page-shell">
        <div className="cons-stock-page-container">
          <section className="cons-stock-page-header">
            <Link
              to="/inventory/consumable"
              className="erp-back-button"
            >
              <ArrowLeft size={16} />
              Back
            </Link>

            <div className="cons-stock-page-headingblock">
              <div className="cons-stock-page-headingcontent">
                <span className="cons-stock-page-sectiontag">
                  Consumables
                </span>

                <h1 className="cons-stock-page-title">
                  Consumable Stock
                </h1>

                <p className="cons-stock-page-subtitle">
                  Live stock levels, updated automatically from every GRN.
                </p>
              </div>
            </div>
          </section>

          <section className="cons-stock-dashboard-summary">
            <div className="cons-stock-dashboard-card">
              <div className="cons-stock-dashboard-cardicon">
                <Boxes size={20} />
              </div>
              <div className="cons-stock-dashboard-cardcontent">
                <span className="cons-stock-dashboard-cardvalue">
                  {totalConsumables}
                </span>
                <span className="cons-stock-dashboard-cardlabel">
                  Total Consumables
                </span>
              </div>
            </div>

            <div className="cons-stock-dashboard-card">
              <div className="cons-stock-dashboard-cardicon">
                <Layers size={20} />
              </div>
              <div className="cons-stock-dashboard-cardcontent">
                <span className="cons-stock-dashboard-cardvalue">
                  {totalQuantity}
                </span>
                <span className="cons-stock-dashboard-cardlabel">
                  Total Quantity
                </span>
              </div>
            </div>

            <div className="cons-stock-dashboard-card">
              <div className="cons-stock-dashboard-cardicon">
                <Warehouse size={20} />
              </div>
              <div className="cons-stock-dashboard-cardcontent">
                <span className="cons-stock-dashboard-cardvalue">
                  {totalWarehouses}
                </span>
                <span className="cons-stock-dashboard-cardlabel">
                  Warehouses
                </span>
              </div>
            </div>
          </section>

          <section className="cons-stock-toolbar-panel">
            <div className="cons-stock-toolbar-searchwrapper">
              <div className="cons-stock-toolbar-searchicon">
                <Search size={16} />
              </div>

              <input
                className="cons-stock-toolbar-searchinput"
                type="text"
                placeholder="Search consumable, reference number or supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="cons-stock-toolbar-filterarea">
              <div className="cons-stock-toolbar-filteritem">
                <label className="cons-stock-toolbar-filterlabel">
                  Warehouse
                </label>
                <select
                  className="cons-stock-toolbar-filterselect"
                  value={warehouseFilter}
                  onChange={(e) =>
                    setWarehouseFilter(e.target.value)
                  }
                  disabled={isLoading}
                >
                  {warehouseOptions.map((wh) => (
                    <option key={wh} value={wh}>
                      {wh === "All" ? "All Warehouses" : wh}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cons-stock-toolbar-filteritem">
                <label className="cons-stock-toolbar-filterlabel">
                  Category
                </label>
                <select
                  className="cons-stock-toolbar-filterselect"
                  value={categoryFilter}
                  onChange={(e) =>
                    setCategoryFilter(e.target.value)
                  }
                  disabled={isLoading}
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === "All" ? "All Categories" : cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cons-stock-toolbar-filteritem">
                <label className="cons-stock-toolbar-filterlabel">
                  &nbsp;
                </label>
                <button
                  type="button"
                  className="cons-stock-refresh-button"
                  onClick={() => fetchStock(true)}
                  disabled={isLoading || refreshing}
                  title="Refresh stock"
                >
                  <RefreshCw
                    size={16}
                    className={refreshing ? "cons-stock-spin" : ""}
                  />
                  <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
                </button>
              </div>
            </div>
          </section>

          {/* ============== ERROR ============== */}

          {error && !isLoading && (
            <section className="cons-stock-error-box">
              <Error onRetry={() => fetchStock(false)} />
            </section>
          )}

          {/* ============== TABLE ============== */}

          {!error && (
            <section className="cons-stock-table-section">
              <div className="cons-stock-table-card">
                <div className="cons-stock-table-scroll">
                  <table className="cons-stock-table-grid">
                    <thead>
                      <tr>
                        <th>Reference Number</th>
                        <th>Consumable</th>
                        <th>Category</th>
                        <th>Unit</th>
                        <th>Available Qty</th>
                        <th>Warehouse</th>
                        <th>Supplier</th>
                        <th>Last Received Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {/* Loading */}
                      {isLoading && (
                        <tr>
                          <td
                            colSpan={9}
                            className="cons-stock-table-emptycell"
                          >
                            <div className="cons-stock-loading-wrapper">
                              <Loading />
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Rows */}
                      {!isLoading &&
                        filteredStock.map((item) => (
                          <tr
                            className="cons-stock-table-row"
                            key={item.id}
                          >
                            <td className="cons-stock-table-cell">
                              <span className="cons-stock-table-reference">
                                {toDisplayString(item.referenceNumber) ||
                                  "—"}
                              </span>
                            </td>

                            <td className="cons-stock-table-cell">
                              <div className="cons-stock-table-primaryblock">
                                <span className="cons-stock-table-primarytext">
                                  {toDisplayString(item.consumableName) ||
                                    "—"}
                                </span>
                              </div>
                            </td>

                            <td className="cons-stock-table-cell">
                              <span className="cons-stock-table-categorypill">
                                {toDisplayString(item.category) || "—"}
                              </span>
                            </td>

                            <td className="cons-stock-table-cell">
                              {toDisplayString(item.unit) || "—"}
                            </td>

                            <td className="cons-stock-table-cell">
                              <span className="cons-stock-table-quantityvalue">
                                {item.availableQty}
                              </span>
                            </td>

                            <td className="cons-stock-table-cell">
                              {toDisplayString(item.warehouse) || "—"}
                            </td>

                            <td className="cons-stock-table-cell">
                              {toDisplayString(item.supplier) || "—"}
                            </td>

                            <td className="cons-stock-table-cell">
                              {toDisplayString(item.lastReceivedDate) ||
                                "—"}
                            </td>

                            <td className="cons-stock-table-cell">
                              <span
                                className={`cons-stock-table-statusbadge cons-stock-table-status-${String(
                                  item.status,
                                )
                                  .replace(/\s+/g, "-")
                                  .toLowerCase()}`}
                              >
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}

                      {/* Empty state */}
                      {!isLoading && filteredStock.length === 0 && (
                        <tr>
                          <td
                            colSpan={9}
                            className="cons-stock-table-emptycell"
                          >
                            <div className="cons-stock-table-emptycontent">
                              <h3 className="cons-stock-table-emptytitle">
                                No Stock Available
                              </h3>
                              <p className="cons-stock-table-emptydescription">
                                No consumable stock has been recorded yet.
                                Once a Goods Receipt Note (GRN) is created,
                                the inventory will automatically appear
                                here.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}