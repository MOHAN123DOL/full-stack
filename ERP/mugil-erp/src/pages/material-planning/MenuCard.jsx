import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Ruler,
  ClipboardList,
  Factory,
  Truck,
  Boxes,
  BriefcaseBusiness,
  Settings,
  Combine,
  Wrench,
  Send,
  Recycle,
  BarChart3,
  Package,
  ArrowLeft,
} from "lucide-react";

import "./MenuCard.css";

import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";

import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

// ============================================================
// ICON MAP
// ============================================================

const iconMap = {
  ruler: Ruler,
  "clipboard-list": ClipboardList,
  truck: Truck,
  boxes: Boxes,
  briefcase: BriefcaseBusiness,
  factory: Factory,
  combine: Combine,
  settings: Settings,
  wrench: Wrench,
  recycle: Recycle,
  send: Send,
  "bar-chart": BarChart3,
};

// ============================================================
// MAIN MENU COMPONENT
// ============================================================

export default function MenuCard() {
  const navigate = useNavigate();

  const {
    accessToken,
    isAuthenticated,
    authLoading,
  } = useAuth();

  const [menuCards, setMenuCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // ==========================================================
  // LOAD MATERIAL MENU
  // ==========================================================

  useEffect(() => {
    const loadMaterialMenu = async () => {
      try {
        setLoading(true);
        setError(false);

        const response = await api.get(
          "/erp/inventory/material/menu/",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (response.data?.success) {
          setMenuCards(
            response.data.data?.menu_cards || []
          );
        } else {
          setError(true);
        }
      } catch (error) {
        console.error(
          "Material menu API error:",
          error
        );

        setError(true);
      } finally {
        setLoading(false);
      }
    };

    // Wait until AuthContext finishes
    // checking the HttpOnly refresh cookie.
    if (authLoading) {
      return;
    }

    // User is authenticated and access token is available.
    if (isAuthenticated && accessToken) {
      loadMaterialMenu();
    } else {
      setLoading(false);
    }
  }, [
    accessToken,
    isAuthenticated,
    authLoading,
  ]);

  // ==========================================================
  // LOADING
  // ==========================================================

  if (authLoading || loading) {
    return (
      <>
        <Header />

        <div className="consumable-page material-page">
          <div className="consumable-layout">
            <main className="consumable-main">
              <Loading />
            </main>
          </div>
        </div>
      </>
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (error) {
    return (
      <>
        <Header />

        <div className="consumable-page material-page">
          <div className="consumable-layout">
            <main className="consumable-main">
              <Error />
            </main>
          </div>
        </div>
      </>
    );
  }

  // ==========================================================
  // NO AUTHENTICATION
  // ==========================================================

  if (!isAuthenticated || !accessToken) {
    navigate("/production/login", {
      replace: true,
    });

    return null;
  }

  // ==========================================================
  // FEATURED CARD
  // ==========================================================

  const featuredCard = menuCards[0];

  const otherCards = menuCards.slice(1);

  // ==========================================================
  // MAIN UI
  // ==========================================================

  return (
    <>
      <Header />

      <div className="consumable-page material-page">
        <div className="consumable-layout">

          {/* ==================================================
              SIDEBAR
          ================================================== */}

          <aside className="consumable-sidebar">

            <div className="consumable-sidebar-brand">

              <div className="consumable-sidebar-brand-icon">
                <Package
                  size={21}
                  strokeWidth={1.8}
                />
              </div>

              <div>
                <span className="consumable-sidebar-label">
                  Inventory Module
                </span>

                <h2 className="consumable-sidebar-title">
                  Materials
                </h2>
              </div>

            </div>

            {/* ================= SIDEBAR NAV ================= */}

            <nav className="consumable-sidebar-nav">

              {menuCards.map((card) => {
                const Icon = iconMap[card.icon];

                const isActive =
                  card.code === "STK";

                return (
                  <div
                    key={card.code}
                    className={`consumable-sidebar-item ${
                      isActive
                        ? "consumable-sidebar-item-active"
                        : ""
                    }`}
                    onClick={() =>
                      navigate(card.path)
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" ||
                        e.key === " "
                      ) {
                        navigate(card.path);
                      }
                    }}
                  >

                    <span className="consumable-sidebar-item-icon">
                      {Icon && (
                        <Icon
                          size={18}
                          strokeWidth={1.8}
                        />
                      )}
                    </span>

                    <span className="consumable-sidebar-item-content">

                      <span className="consumable-sidebar-item-code">
                        {card.code}
                      </span>

                      <span className="consumable-sidebar-item-title">
                        {card.title}
                      </span>

                    </span>

                  </div>
                );
              })}

            </nav>

            {/* ================= SIDEBAR FOOTER ================= */}

            <div className="consumable-sidebar-footer">

              <div className="consumable-sidebar-footer-icon">
                <Boxes
                  size={19}
                  strokeWidth={1.8}
                />
              </div>

              <div>
                <strong>
                  Material Operations
                </strong>

                <span>
                  Inventory workflows in one place.
                </span>
              </div>

            </div>

          </aside>

          {/* ==================================================
              MAIN CONTENT
          ================================================== */}

          <main className="consumable-main">

            {/* ================= HEADER ================= */}

            <header className="consumable-header">

              <div
                className="consumable-back-link"
                onClick={() =>
                  navigate("/inventory")
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" ||
                    e.key === " "
                  ) {
                    navigate("/inventory");
                  }
                }}
              >
                <ArrowLeft size={15} />
                Inventory
              </div>

              <span className="consumable-eyebrow">
                Materials
              </span>

              <h1 className="consumable-title">
                Material Management
              </h1>

              <p className="consumable-subtitle">
                Track material from project drawings
                through BOM, purchase orders,
                receiving, stock and job work.
              </p>

            </header>

            {/* ==================================================
                FEATURED CARD
            ================================================== */}

            {featuredCard && (
              <section
                className="consumable-featured"
                onClick={() =>
                  navigate(featuredCard.path)
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" ||
                    e.key === " "
                  ) {
                    navigate(featuredCard.path);
                  }
                }}
              >

                <div className="consumable-featured-header">

                  <div className="consumable-featured-icon">

                    {(() => {
                      const Icon =
                        iconMap[
                          featuredCard.icon
                        ];

                      return Icon ? (
                        <Icon
                          size={26}
                          strokeWidth={1.8}
                        />
                      ) : null;
                    })()}

                  </div>

                  <div className="consumable-featured-heading">

                    <span className="consumable-code">
                      {featuredCard.code}
                    </span>

                    <h2 className="consumable-featured-title">
                      {featuredCard.title}
                    </h2>

                    <p className="consumable-featured-desc">
                      {featuredCard.description}
                    </p>

                  </div>

                </div>

              </section>
            )}

            {/* ==================================================
                ACTION CARDS
            ================================================== */}

            <div className="consumable-grid">

              {otherCards.map((card) => {
                const Icon = iconMap[card.icon];

                return (
                  <div
                    className="consumable-card"
                    key={card.code}
                    onClick={() =>
                      navigate(card.path)
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" ||
                        e.key === " "
                      ) {
                        navigate(card.path);
                      }
                    }}
                  >

                    <div className="consumable-card-top">

                      <div className="consumable-icon">

                        {Icon && (
                          <Icon
                            size={22}
                            strokeWidth={1.8}
                          />
                        )}

                      </div>

                      <span className="consumable-code">
                        {card.code}
                      </span>

                    </div>

                    <h3 className="consumable-card-title">
                      {card.title}
                    </h3>

                    <p className="consumable-card-desc">
                      {card.description}
                    </p>

                  </div>
                );
              })}

            </div>

          </main>

        </div>
      </div>
    </>
  );
}