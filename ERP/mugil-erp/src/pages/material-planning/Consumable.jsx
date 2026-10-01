
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PackagePlus,
  Boxes,
  PackageMinus,
  Undo2,
  BarChart3,
  ArrowLeft,
} from "lucide-react";

import "./Consumable.css";

import Header from "../../components/Header";
import InventoryModuleSwitcher from "../../components/InventoryModuleSwitcher";
import Loading from "../../components/loading";
import Error from "../../components/error";

import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";


/* ============================================================
   CONSTANTS
   ============================================================ */

const CONSUMABLE_ENDPOINT = "/erp/consumable/";

const GENERIC_ERROR =
  "Something went wrong. Please try again.";


/* ============================================================
   DEFAULT ACTIONS
   Used only as fallback while API is unavailable.
   ============================================================ */

const DEFAULT_CONSUMABLE_ACTIONS = [
  {
    code: "GRN",
    title: "GRN (Goods Receipt Note)",
    description: "Receive consumables from suppliers.",
    icon: PackagePlus,
    path: "/inventory/consumable/grn",
  },
  {
    code: "STK",
    title: "Consumable Stock",
    description: "Display current consumable stock levels.",
    icon: Boxes,
    path: "/inventory/consumable/stock",
  },
  {
    code: "ISS",
    title: "Issue Consumables",
    description: "Issue consumables to departments or production.",
    icon: PackageMinus,
    path: "/inventory/consumable/issue",
  },
  {
    code: "RET",
    title: "Return Consumables",
    description: "Return unused consumables back to inventory.",
    icon: Undo2,
    path: "/inventory/consumable/return",
  },
  {
    code: "RPT",
    title: "Reports",
    description: "GRN, stock, issue, and consumption reports.",
    icon: BarChart3,
    path: "/inventory/consumable/reports",
  },
];


/* ============================================================
   ICON MAP
   API returns data, but icons remain frontend controlled.
   ============================================================ */

const ACTION_ICONS = {
  GRN: PackagePlus,
  STK: Boxes,
  ISS: PackageMinus,
  RET: Undo2,
  RPT: BarChart3,
};


/* ============================================================
   CONSUMABLE PAGE
   ============================================================ */

export default function Consumable() {
  const navigate = useNavigate();

  const { accessToken } = useAuth();

  const [consumableActions, setConsumableActions] = useState(
    DEFAULT_CONSUMABLE_ACTIONS
  );

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");


  /* ============================================================
     AUTH HEADERS
     ============================================================ */

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken]
  );


  /* ============================================================
     LOAD CONSUMABLE DASHBOARD
     ============================================================ */

  const refresh = useCallback(async () => {
    if (!accessToken) {
      setConsumableActions([]);
      setError(
        "Your session has expired. Please login again."
      );
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const response = await api.get(
        CONSUMABLE_ENDPOINT,
        {
          headers: authHeaders(),
        }
      );

      const responseData = response.data;

      let actions = [];

      if (Array.isArray(responseData?.actions)) {
        actions = responseData.actions;
      } else if (Array.isArray(responseData?.data)) {
        actions = responseData.data;
      } else if (Array.isArray(responseData)) {
        actions = responseData;
      }

      /*
       * Convert backend action data into frontend objects.
       * Icons are intentionally controlled by the frontend.
       */

      if (actions.length > 0) {
        const formattedActions = actions.map((action) => ({
          ...action,
          icon:
            ACTION_ICONS[action.code] ||
            Boxes,
        }));

        setConsumableActions(formattedActions);
      } else {
        setConsumableActions(DEFAULT_CONSUMABLE_ACTIONS);
      }

    } catch (err) {
      console.error(
        "Failed to load consumable module:",
        err
      );

      setConsumableActions([]);
      setError(GENERIC_ERROR);

    } finally {
      setIsLoading(false);
    }
  }, [accessToken, authHeaders]);


  /* ============================================================
     INITIAL LOAD
     ============================================================ */

  useEffect(() => {
    refresh();
  }, [refresh]);


  /* ============================================================
     NAVIGATION
     ============================================================ */

  const handleNavigate = useCallback(
    (path) => {
      if (!path) return;

      navigate(path);
    },
    [navigate]
  );


  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <>
      <Header />

      <div className="consumable-page">
        <div className="consumable-layout">

          {/* ====================================================
              SIDEBAR
              ==================================================== */}

          <aside className="consumable-sidebar">

            <div className="consumable-sidebar-brand">

              <div className="consumable-sidebar-brand-icon">
                <PackagePlus
                  size={21}
                  strokeWidth={1.8}
                />
              </div>

              <div>
                <span className="consumable-sidebar-label">
                  Inventory Module
                </span>

                <h2 className="consumable-sidebar-title">
                  Consumables
                </h2>
              </div>

            </div>


            <nav className="consumable-sidebar-nav">

              {consumableActions.map((action) => {

                const Icon =
                  action.icon ||
                  ACTION_ICONS[action.code] ||
                  Boxes;

                return (
                  <div
                    key={action.code || action.title}
                    className={`consumable-sidebar-item ${
                      action.code === "STK"
                        ? "consumable-sidebar-item-active"
                        : ""
                    }`}
                    onClick={() =>
                      handleNavigate(action.path)
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" ||
                        e.key === " "
                      ) {
                        handleNavigate(action.path);
                      }
                    }}
                  >

                    <span className="consumable-sidebar-item-icon">
                      <Icon
                        size={18}
                        strokeWidth={1.8}
                      />
                    </span>

                    <span className="consumable-sidebar-item-content">

                      <span className="consumable-sidebar-item-code">
                        {action.code}
                      </span>

                      <span className="consumable-sidebar-item-title">
                        {action.title}
                      </span>

                    </span>

                  </div>
                );
              })}

            </nav>


            <div className="consumable-sidebar-footer">

              <div className="consumable-sidebar-footer-icon">
                <Boxes
                  size={19}
                  strokeWidth={1.8}
                />
              </div>

              <div>
                <strong>
                  Consumable Operations
                </strong>

                <span>
                  Inventory workflows in one place.
                </span>
              </div>

            </div>

          </aside>


          {/* ====================================================
              MAIN CONTENT
              ==================================================== */}

          <main className="consumable-main">

            <div className="inventory-top-row">

              <Link
                to="/inventory"
                className="consumable-back-link"
              >
                <ArrowLeft size={15} />
                Inventory
              </Link>

              <InventoryModuleSwitcher />

            </div>


            <header className="consumable-header">

              <span className="consumable-eyebrow">
                Consumables
              </span>

              <h1 className="consumable-title">
                Consumable Inventory
              </h1>

              <p className="consumable-subtitle">
                Manage all production consumables.
              </p>

            </header>


            {/* ==================================================
                LOADING
                ================================================== */}

            {isLoading && (
              <div className="qt-customer-loading">
                <Loading />
              </div>
            )}


            {/* ==================================================
                ERROR
                ================================================== */}

            {!isLoading && error && (
              <div className="qt-customer-error">
                <Error onRetry={refresh} />
              </div>
            )}


            {/* ==================================================
                CONTENT
                ================================================== */}

            {!isLoading &&
              !error &&
              consumableActions.length > 0 && (
                <>

                  {/* ============================================
                      FEATURED STOCK
                      ============================================ */}

                  {consumableActions
                    .filter(
                      (action) =>
                        action.code === "STK"
                    )
                    .map((action) => {

                      const Icon =
                        action.icon ||
                        Boxes;

                      return (
                        <section
                          className="consumable-featured"
                          key={action.code}
                          onClick={() =>
                            handleNavigate(
                              action.path
                            )
                          }
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" ||
                              e.key === " "
                            ) {
                              handleNavigate(
                                action.path
                              );
                            }
                          }}
                        >

                          <div className="consumable-featured-header">

                            <div className="consumable-featured-icon">
                              <Icon
                                size={26}
                                strokeWidth={1.8}
                              />
                            </div>

                            <div className="consumable-featured-heading">

                              <span className="consumable-code">
                                {action.code}
                              </span>

                              <h2 className="consumable-featured-title">
                                {action.title}
                              </h2>

                              <p className="consumable-featured-desc">
                                {action.description}
                              </p>

                            </div>

                          </div>

                        </section>
                      );
                    })}


                  {/* ============================================
                      ACTION CARDS
                      ============================================ */}

                  <div className="consumable-grid">

                    {consumableActions
                      .filter(
                        (action) =>
                          action.code !== "STK"
                      )
                      .map((action) => {

                        const Icon =
                          action.icon ||
                          Boxes;

                        return (
                          <div
                            className="consumable-card"
                            key={action.code}
                            onClick={() =>
                              handleNavigate(
                                action.path
                              )
                            }
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" ||
                                e.key === " "
                              ) {
                                handleNavigate(
                                  action.path
                                );
                              }
                            }}
                          >

                            <div className="consumable-card-top">

                              <div className="consumable-icon">
                                <Icon
                                  size={22}
                                  strokeWidth={1.8}
                                />
                              </div>

                              <span className="consumable-code">
                                {action.code}
                              </span>

                            </div>

                            <h3 className="consumable-card-title">
                              {action.title}
                            </h3>

                            <p className="consumable-card-desc">
                              {action.description}
                            </p>

                          </div>
                        );
                      })}

                  </div>

                </>
              )}


            {/* ==================================================
                EMPTY STATE
                ================================================== */}

            {!isLoading &&
              !error &&
              consumableActions.length === 0 && (
                <div className="consumable-empty-state">
                  <div className="consumable-empty-icon">
                    <Boxes
                      size={32}
                      strokeWidth={1.5}
                    />
                  </div>

                  <h3>
                    No consumable operations available
                  </h3>

                  <p>
                    There are currently no consumable
                    operations configured.
                  </p>

                  <button
                    type="button"
                    onClick={refresh}
                  >
                    Retry
                  </button>
                </div>
              )}

          </main>

        </div>
      </div>
    </>
  );
}

