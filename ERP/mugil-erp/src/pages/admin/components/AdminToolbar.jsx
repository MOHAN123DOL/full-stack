import { Search } from "lucide-react";

/**
 * Search box (left) + any filters/controls passed as children (right).
 * Search is controlled by the page and filters the already-loaded rows.
 */
export default function AdminToolbar({
  search,
  onSearchChange,
  placeholder = "Search…",
  children,
}) {
  return (
    <div className="admin-toolbar">
      <label className="admin-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
      </label>

      {children && <div className="admin-toolbar-controls">{children}</div>}
    </div>
  );
}
