import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import Header from "../../components/Header";
import { useAuth } from "../../context/AuthContext";

import AdminSidebar from "./components/AdminSidebar";
import { findAdminNavItem } from "./adminNav";

import "./admin.css";

const STORAGE_KEY = "admin.sidebar.collapsed";

/** Below this width the sidebar is always an icon rail so it never covers content. */
const NARROW_QUERY = "(max-width: 900px)";

function readStoredCollapsed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);

    setMatches(media.matches);

    media.addEventListener("change", onChange);

    return () => {
      media.removeEventListener("change", onChange);
    };
  }, [query]);

  return matches;
}


/**
 * AdminLayout
 *
 * Header
 *   └── Admin Shell
 *        ├── Sidebar
 *        └── Content
 *             └── Page
 *                  └── Outlet
 */
export default function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();

  const [collapsedByUser, setCollapsedByUser] =
    useState(readStoredCollapsed);

  const isNarrow = useMediaQuery(NARROW_QUERY);

  const collapsed = isNarrow || collapsedByUser;


  const toggleSidebar = useCallback(() => {
    setCollapsedByUser((previous) => {
      const next = !previous;

      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          next ? "1" : "0",
        );
      } catch {
        /* ignore */
      }

      return next;
    });
  }, []);


  // Browser tab title
  const currentItem = findAdminNavItem(location.pathname);

  useEffect(() => {
    const previous = document.title;

    document.title = `${currentItem.title} · Admin`;

    return () => {
      document.title = previous;
    };
  }, [currentItem.title]);


  // Admin access guard
  if (user?.user_type && user.user_type !== "admin") {
    return <Navigate to="/welcome" replace />;
  }


  return (
    <div className="admin-layout">

      <Header />

      <div className="admin-shell">

        <AdminSidebar
          collapsed={collapsed}
          canToggle={!isNarrow}
          onToggle={toggleSidebar}
        />

        <div className="admin-content">

          <main
            className="admin-page"
            key={location.pathname}
          >
            <Outlet />
          </main>

        </div>

      </div>

    </div>
  );
}