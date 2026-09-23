import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

import "./AccountsHome.css";
const MODULE_ICONS = {
  "purchase-order": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="20" r="1.3" fill="currentColor" />
      <circle cx="18" cy="20" r="1.3" fill="currentColor" />
    </svg>
  ),

  quotation: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 3h9l4 4v14H6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M15 3v5h4M9 12h6M9 15h6M9 18h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),

  "tax-invoice": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 3h9l4 4v14H6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M15 3v5h4M9 12h6M9 15h4M9 18h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),

  "delivery-challan": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="19" r="1.5" fill="currentColor" />
      <circle cx="18" cy="19" r="1.5" fill="currentColor" />
    </svg>
  ),

  "proforma-invoice": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 3h9l4 4v14H6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M15 3v5h4M9 12h6M9 15h6M9 18h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),

  report: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 4h16v16H4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 16v-4M12 16V8M16 16v-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),

  journal: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 19V5M4 19h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 15l4-4 3 2 5-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};
export default function AccountsHome() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ============================================================
  // LOAD ACCOUNTS MODULES FROM API
  // ============================================================
  const fetchAccountsModules = useCallback(async () => {
    if (!accessToken) {
      setMenus([]);
      setError("Your session has expired. Please login again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await api.get("/erp/accounts/modules/", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log("Accounts Modules API:", response.data);

      const result = response.data;

      if (!result || !Array.isArray(result.modules)) {
        throw new Error("Invalid Accounts modules response.");
      }

      setMenus(result.modules);
    } catch (err) {
      console.error("Accounts Modules Error:", err);

      if (err.response) {
        if (err.response.status === 401) {
          setError("Your session has expired. Please login again.");
        } else if (err.response.status === 403) {
          setError("You are not authorized to access Accounts.");
        } else {
          setError(
            err.response.data?.detail ||
              err.response.data?.message ||
              "Unable to load Accounts modules.",
          );
        }
      } else if (err.request) {
        setError(
          "Unable to connect to the server. Please check whether the backend is running.",
        );
      } else {
        setError(err.message || "Something went wrong while loading Accounts.");
      }

      setMenus([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // ============================================================
  // INITIAL LOAD
  // ============================================================
  useEffect(() => {
    fetchAccountsModules();
  }, [fetchAccountsModules]);

  // ============================================================
  // NAVIGATION
  // ============================================================
  const handleOpen = (path) => {
    navigate(path);
  };

  const handleKeyDown = (e, path) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate(path);
    }
  };

  // ============================================================
  // LOADING
  // ============================================================
  if (loading) {
    return (
      <>
        <Header />

        <main className="accounts-page">
          <Loading />
        </main>
      </>
    );
  }

  // ============================================================
  // ERROR
  // ============================================================
  if (error) {
    return (
      <>
        <Header />

        <main className="accounts-page">
          <Error onRetry={fetchAccountsModules} />
        </main>
      </>
    );
  }

  // ============================================================
  // YOUR ORIGINAL UI — UNCHANGED
  // ============================================================
  return (
    <>
      <Header />

      <main className="accounts-page">
        <div className="accounts-container">
          {/* Page heading */}
          <div className="accounts-heading">
            <h1>Accounts Module</h1>
            <p>Manage your accounting documents and transactions</p>
          </div>

          {/* Large module tiles */}
          <div className="accounts-grid">
            {menus.map((item) => (
              <div
                key={item.title}
                className="accounts-card"
                style={{ backgroundColor: item.color }}
                onClick={() => handleOpen(item.path)}
                onKeyDown={(e) => handleKeyDown(e, item.path)}
                role="button"
                tabIndex={0}
              >
                <div className="accounts-card-icon">
                  {MODULE_ICONS[item.icon]}
                </div>

                <div className="accounts-card-short">{item.short}</div>

                <h2>{item.title}</h2>

                <div className="card-divider" />

                <div className="card-open">
                  <span>Open</span>
                  <span className="card-arrow">→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
