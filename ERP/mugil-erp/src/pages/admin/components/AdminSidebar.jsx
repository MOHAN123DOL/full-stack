import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { ADMIN_NAV, adminHref } from "../adminNav";

/**
 * The ONE sidebar used by all Admin pages.
 *
 * - Active item comes from the URL (<NavLink>), never from a hardcoded prop.
 * - Expanded  : icon + label.
 * - Collapsed : icon only; the name appears in a tooltip on hover / focus.
 *
 * Tooltips are rendered with position: fixed (coordinates measured from the
 * hovered element) so they are never clipped by the sidebar's overflow.
 */
export default function AdminSidebar({ collapsed, canToggle = true, onToggle }) {
  const [tip, setTip] = useState(null); // { label, top, left }

  // A tooltip left over from the collapsed state must not survive expanding.
  useEffect(() => {
    setTip(null);
  }, [collapsed]);

  const showTip = (label, element) => {
    if (!collapsed) return;
    const rect = element.getBoundingClientRect();
    const sidebar = element.closest(".admin-sidebar");
    const edge = sidebar ? sidebar.getBoundingClientRect().right : rect.right;
    setTip({ label, top: rect.top + rect.height / 2, left: edge + 10 });
  };

  const hideTip = () => setTip(null);

  const tipHandlers = (label) => ({
    onMouseEnter: (e) => showTip(label, e.currentTarget),
    onMouseLeave: hideTip,
    onFocus: (e) => showTip(label, e.currentTarget),
    onBlur: hideTip,
  });

  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={`admin-sidebar${collapsed ? " is-collapsed" : ""}`}
      aria-label="Admin sidebar"
    >
      <div className="admin-sidebar-inner">
        <div className="admin-sidebar-top">
          <span className="admin-sidebar-heading">Administration</span>

          {canToggle && (
            <button
              type="button"
              className="admin-sidebar-toggle"
              onClick={onToggle}
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
              {...tipHandlers(toggleLabel)}
            >
              <ToggleIcon size={18} aria-hidden="true" />
            </button>
          )}
        </div>

        <nav className="admin-sidebar-nav" aria-label="Admin navigation">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.key}
                to={adminHref(item)}
                className={({ isActive }) =>
                  `admin-sidebar-item${isActive ? " is-active" : ""}`
                }
                aria-label={item.label}
                {...tipHandlers(item.label)}
              >
                <Icon
                  className="admin-sidebar-icon"
                  size={18}
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
                <span className="admin-sidebar-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {collapsed && tip && (
        <div
          className="admin-sidebar-tooltip"
          role="tooltip"
          style={{ top: tip.top, left: tip.left }}
        >
          {tip.label}
        </div>
      )}
    </aside>
  );
}
