import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";
import Header from "./Header.jsx";
import "./erpCommon.css";

/**
 * Shared shell used by every Material Management page so the module has one
 * consistent professional ERP layout: Header, breadcrumb, back button,
 * title/subtitle, search bar and filter row.
 */
export default function ErpPage({
  breadcrumb = [],
  title,
  subtitle,
  backTo = "/inventory/material",
  backLabel = "Material",
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters, // optional array of {label, value, onChange, options: [{label,value}]}
  actions, // optional right-side action buttons (node)
  children,
}) {
  return (
    <>
      <Header />
      <div className="erp-page">
        <Link to={backTo} className="erp-back">
          <ArrowLeft size={15} />
          {backLabel}
        </Link>

        <nav className="erp-breadcrumb" aria-label="Breadcrumb">
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="erp-breadcrumb-item">
              {crumb}
              {i < breadcrumb.length - 1 && (
                <ChevronRight size={13} className="erp-breadcrumb-sep" />
              )}
            </span>
          ))}
        </nav>

        <header className="erp-header">
          <div>
            <h1 className="erp-title">{title}</h1>
            {subtitle && <p className="erp-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="erp-actions">{actions}</div>}
        </header>

        {(onSearchChange || filters) && (
          <div className="erp-toolbar">
            {onSearchChange && (
              <div className="erp-search">
                <Search size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                />
              </div>
            )}

            {filters && filters.length > 0 && (
              <div className="erp-filters">
                <SlidersHorizontal size={15} className="erp-filter-icon" />
                {filters.map((f) => (
                  <select
                    key={f.label}
                    value={f.value}
                    onChange={(e) => f.onChange(e.target.value)}
                    className="erp-filter-select"
                  >
                    <option value="">{f.label}: All</option>
                    {f.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            )}
          </div>
        )}

        {children}
      </div>
    </>
  );
}
