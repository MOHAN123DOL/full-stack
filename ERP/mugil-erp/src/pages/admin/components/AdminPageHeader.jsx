import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { ADMIN_HOME_PATH } from "../adminNav";

/**
 * Breadcrumb + page title. Rendered once by AdminLayout from the nav config,
 * so every Admin page gets an identical header.
 *
 * `actions` (optional) renders right-aligned, for page-level buttons.
 */
export default function AdminPageHeader({ item, actions = null }) {
  const isHome = item.key === "dashboard";

  return (
    <header className="admin-page-header">
      <div className="admin-page-header-text">
        <nav className="admin-breadcrumb" aria-label="Breadcrumb">
          <Link to={ADMIN_HOME_PATH} className="admin-breadcrumb-link">
            Admin
          </Link>
          {!isHome && (
            <>
              <ChevronRight size={14} aria-hidden="true" />
              <span className="admin-breadcrumb-current" aria-current="page">
                {item.label}
              </span>
            </>
          )}
        </nav>

        <h1 className="admin-page-title">{item.title}</h1>
        {item.description && (
          <p className="admin-page-subtitle">{item.description}</p>
        )}
      </div>

      {actions && <div className="admin-page-header-actions">{actions}</div>}
    </header>
  );
}
