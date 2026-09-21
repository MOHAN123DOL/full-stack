import { useLocation, useNavigate } from "react-router-dom";
import "./InventoryModuleSwitcher.css";

export default function InventoryModuleSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();

  const isMaterial = location.pathname.startsWith("/inventory/material");
  const isConsumable = location.pathname.startsWith("/inventory/consumable");

  return (
    <div className="inventory-module-switcher">
      <button
        type="button"
        className={`inventory-switcher-option ${
          isMaterial ? "active material-active" : ""
        }`}
        onClick={() => navigate("/inventory/material")}
      >
        Material
      </button>

      <button
        type="button"
        className={`inventory-switcher-option ${
          isConsumable ? "active consumable-active" : ""
        }`}
        onClick={() => navigate("/inventory/consumable")}
      >
        Consumable
      </button>
    </div>
  );
}