import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layers, Wrench, ArrowRight } from "lucide-react";

import "./Inventory.css";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

export default function Inventory() {
  const { accessToken } = useAuth();

  const [inventoryModules, setInventoryModules] = useState([]);

  const [stats, setStats] = useState({
    totalModules: 0,
    totalItems: 0,
    operational: "24/7",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadInventory = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/erp/inventory/", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        console.log("Inventory API response:", response.data);

        if (response.data?.success) {
          const data = response.data.data;

          setInventoryModules(data.modules || []);

          setStats({
            totalModules: data.total_modules || 0,
            totalItems: data.total_items || 0,
            operational: data.operational || "24/7",
          });
        } else {
          setError(
            response.data?.message ||
              "Unable to load inventory."
          );
        }
      } catch (error) {
        console.error("Inventory API error:", error);

        if (error.response) {
          if (error.response.status === 401) {
            setError(
              "Your session has expired. Please login again."
            );
          } else if (error.response.status === 403) {
            setError(
              "You are not authorized to access Inventory."
            );
          } else {
            setError(
              error.response.data?.detail ||
                error.response.data?.message ||
                "Unable to load inventory."
            );
          }
        } else if (error.request) {
          setError(
            "Unable to connect to the server."
          );
        } else {
          setError(
            "Something went wrong. Please try again."
          );
        }
      } finally {
        setLoading(false);
      }
    };

    if (accessToken) {
      loadInventory();
    } else {
      setLoading(false);
      setError("Please login to access Inventory.");
    }
  }, [accessToken]);

  const iconMap = {
    material: Layers,
    consumable: Wrench,
  };

  // ================= LOADING =================

  if (loading) {
    return (
      <>
        <Header />

        <div className="inventory-page">
          <div className="inventory-container inventory-loading-container">
            <Loading />
          </div>
        </div>
      </>
    );
  }

  // ================= ERROR =================

  if (error) {
    return (
      <>
        <Header />

        <div className="inventory-page">
          <div className="inventory-container">
            <div className="inventory-error">
              {error}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ================= MAIN =================

  return (
    <>
      <Header />

      <div className="inventory-page">
        <div className="inventory-container">

          {/* ================= HERO ================= */}

          <section className="inventory-hero">

            <div className="inventory-hero-left">

              <span className="inventory-eyebrow">
                Inventory
              </span>

              <h1 className="inventory-title">
                Inventory Control Center
              </h1>

              <p className="inventory-subtitle">
                Choose a module to manage stock,
                movements, and records across
                the manufacturing plant.
              </p>

              <div className="inventory-stats">

                <div className="inventory-stat">
                  <h3>
                    {stats.totalModules}
                  </h3>
                  <span>
                    Modules
                  </span>
                </div>

                <div className="inventory-stat">
                  <h3>
                    {stats.totalItems}
                  </h3>
                  <span>
                    Items Managed
                  </span>
                </div>

                <div className="inventory-stat">
                  <h3>
                    {stats.operational}
                  </h3>
                  <span>
                    Operational
                  </span>
                </div>

              </div>

            </div>

            <div className="inventory-hero-right">

              <div className="inventory-illustration">

                <div className="inventory-illustration-box">
                  <Layers
                    size={90}
                    strokeWidth={1.5}
                  />
                </div>

              </div>

            </div>

          </section>

          {/* ================= MODULES ================= */}

          <section className="inventory-grid">

            {inventoryModules.map((mod) => {

              const Icon =
                iconMap[mod.id] || Layers;

              return (
                <Link
                  to={mod.path}
                  key={mod.id}
                  className={`inventory-card inventory-card--${mod.accent}`}
                >

                  <div className="inventory-card-header">

                    <div className="inventory-card-icon">

                      <div
                        className={`inventory-icon inventory-icon--${mod.accent}`}
                      >
                        <Icon
                          size={34}
                          strokeWidth={1.8}
                        />
                      </div>

                    </div>

                    <div className="inventory-card-heading">

                      <span className="inventory-code">
                        {mod.code}
                      </span>

                      <h2 className="inventory-card-title">
                        {mod.title}
                      </h2>

                    </div>

                  </div>

                  <div className="inventory-card-content">

                    <p className="inventory-card-desc">
                      {mod.description}
                    </p>

                    <div className="inventory-tags">

                      {(mod.examples || []).map(
                        (example) => (
                          <span
                            key={example}
                            className="inventory-tag"
                          >
                            {example}
                          </span>
                        )
                      )}

                    </div>

                  </div>

                  <div className="inventory-card-footer">

                    <div className="inventory-footer-text">

                      <span className="inventory-footer-label">
                        Open Module
                      </span>

                      <small>
                        View inventory records
                      </small>

                    </div>

                    <div className="inventory-footer-action">

                      <ArrowRight
                        size={20}
                        className="inventory-arrow"
                      />

                    </div>

                  </div>

                </Link>
              );
            })}

          </section>

        </div>
      </div>
    </>
  );
}