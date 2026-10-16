import { useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Inbox,
  RefreshCw,
} from "lucide-react";

/**
 * Shared Admin table: sorting, skeleton loading, empty and error states.
 *
 * columns: [{
 *   key, header,
 *   align?: "left" | "right" | "center",
 *   render?: (row) => node,         // defaults to row[key]
 *   sortValue?: (row) => string|number,  // defaults to row[key]
 *   sortable?: boolean,             // default true
 *   mono?: boolean, width?: string,
 * }]
 */
function compare(a, b) {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1; // empty values always sink to the bottom
  if (bEmpty) return -1;

  if (typeof a === "number" && typeof b === "number") return a - b;

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export default function AdminDataTable({
  columns,
  rows,
  rowKey,
  loading = false,
  error = "",
  onRetry,
  emptyTitle = "No records",
  emptyMessage = "There is nothing to show yet.",
  totalCount,
  minWidth = 640,
  defaultSort = null, // { key, direction: "asc" | "desc" }
}) {
  const [sort, setSort] = useState(defaultSort);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;

    const read = column.sortValue || ((row) => row[column.key]);
    const factor = sort.direction === "desc" ? -1 : 1;

    // Keep empties at the bottom regardless of direction.
    return [...rows].sort((r1, r2) => {
      const a = read(r1);
      const b = read(r2);
      const aEmpty = a === null || a === undefined || a === "";
      const bEmpty = b === null || b === undefined || b === "";
      if (aEmpty || bEmpty) return compare(a, b);
      return compare(a, b) * factor;
    });
  }, [rows, columns, sort]);

  const toggleSort = (key) => {
    setSort((prev) =>
      prev && prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };

  const getRowKey = (row, index) =>
    typeof rowKey === "function" ? rowKey(row) : (row[rowKey] ?? index);

  const showState = loading || error || sortedRows.length === 0;

  return (
    <div className="admin-table-region">
      <div className="admin-table-scroll">
        <table className="admin-data-table" style={{ minWidth }}>
          <thead>
            <tr>
              {columns.map((col) => {
                const sortable = col.sortable !== false;
                const active = sort?.key === col.key;
                const Icon = !active
                  ? ChevronsUpDown
                  : sort.direction === "asc"
                    ? ChevronUp
                    : ChevronDown;

                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`admin-th admin-align-${col.align || "left"}`}
                    style={col.width ? { width: col.width } : undefined}
                    aria-sort={
                      active
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    {sortable ? (
                      <button
                        type="button"
                        className={`admin-sort${active ? " is-active" : ""}`}
                        onClick={() => toggleSort(col.key)}
                      >
                        {col.header}
                        <Icon size={13} aria-hidden="true" />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, r) => (
                <tr key={`skeleton-${r}`} className="admin-row-skeleton">
                  {columns.map((col) => (
                    <td key={col.key}>
                      <span className="admin-skeleton" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading &&
              !error &&
              sortedRows.map((row, index) => (
                <tr key={getRowKey(row, index)}>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`admin-align-${col.align || "left"}${
                        col.mono ? " admin-mono" : ""
                      }`}
                    >
                      {col.render ? col.render(row) : (row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && error && (
        <div className="admin-state admin-state--error" role="alert">
          <AlertCircle size={22} aria-hidden="true" />
          <p className="admin-state-title">Unable to load data</p>
          <p className="admin-state-text">{error}</p>
          {onRetry && (
            <button type="button" className="admin-btn" onClick={onRetry}>
              <RefreshCw size={14} aria-hidden="true" />
              Retry
            </button>
          )}
        </div>
      )}

      {!loading && !error && sortedRows.length === 0 && (
        <div className="admin-state">
          <Inbox size={22} aria-hidden="true" />
          <p className="admin-state-title">{emptyTitle}</p>
          <p className="admin-state-text">{emptyMessage}</p>
        </div>
      )}

      {!showState && (
        <footer className="admin-table-footer">
          {totalCount !== undefined && totalCount !== sortedRows.length
            ? `Showing ${sortedRows.length} of ${totalCount} records`
            : `${sortedRows.length} ${sortedRows.length === 1 ? "record" : "records"}`}
        </footer>
      )}
    </div>
  );
}
