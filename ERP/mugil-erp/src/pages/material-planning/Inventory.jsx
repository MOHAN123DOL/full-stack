import { Link } from "react-router-dom";
import { Layers, Wrench, ArrowRight } from "lucide-react";
import "./Inventory.css";
import Header from "../../components/Header";

const inventoryModules = [
  {
    id: "material",
    code: "MOD-01 / MAT",
    title: "Materials",
    description:
      "Manage all raw materials used in manufacturing — from structural steel to finished sheet stock.",
    icon: Layers,
    accent: "steel",
    path: "/inventory/material",
    examples: [
      "Plates",
      "Pipes",
      "Channels",
      "Angles",
      "Flats",
      "Beams",
      "Sheets",
      "Rods",
      "Structural Steel",
    ],
  },
  {
    id: "consumable",
    code: "MOD-02 / CON",
    title: "Consumables",
    description:
      "Manage consumables used during production — welding, grinding, fastening, and safety supplies.",
    icon: Wrench,
    accent: "amber",
    path: "/inventory/consumable",
    examples: [
      "Welding Rods",
      "Welding Wire",
      "Grinding Wheels",
      "Cutting Discs",
      "Paint",
      "Primer",
      "Gas Cylinders",
      "Bolts",
      "Nuts",
      "Washers",
      "Safety Items",
    ],
  },
];

export default function Inventory() {
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
                Choose a module to manage stock, movements, and records across
                the manufacturing plant.
              </p>

              <div className="inventory-stats">

                <div className="inventory-stat">
                  <h3>{inventoryModules.length}</h3>
                  <span>Modules</span>
                </div>

                <div className="inventory-stat">
                  <h3>200+</h3>
                  <span>Items Managed</span>
                </div>

                <div className="inventory-stat">
                  <h3>24/7</h3>
                  <span>Operational</span>
                </div>

              </div>

            </div>

            <div className="inventory-hero-right">

              <div className="inventory-illustration">

                <div className="inventory-illustration-box">

                  <Layers size={90} strokeWidth={1.5} />

                </div>

              </div>

            </div>

          </section>

          {/* ================= MODULES ================= */}

          <section className="inventory-grid">

            {inventoryModules.map((mod) => {

              const Icon = mod.icon;

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
                        <Icon size={34} strokeWidth={1.8} />
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

                      {mod.examples.map((example) => (

                        <span
                          key={example}
                          className="inventory-tag"
                        >
                          {example}
                        </span>

                      ))}

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