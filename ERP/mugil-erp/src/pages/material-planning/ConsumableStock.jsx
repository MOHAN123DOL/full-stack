import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Boxes, Layers, Warehouse } from "lucide-react";
import Header from "../../components/Header";
import consumableStore from "../../data/consumableStore";
import "./ConsumableStock.css";

export default function ConsumableStock() {
  const [stock, setStock] = useState(consumableStore.getConsumableStock());
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  useEffect(() => {
    const unsubscribe = consumableStore.subscribe(() => {
      setStock([...consumableStore.getConsumableStock()]);
    });

    return unsubscribe;
  }, []);

  const warehouses = useMemo(
    () => ["All", ...new Set(stock.map((item) => item.warehouse))],
    [stock],
  );

  const categories = useMemo(
    () => ["All", ...new Set(stock.map((item) => item.category))],
    [stock],
  );

  const filteredStock = stock.filter((item) => {
    const term = search.trim().toLowerCase();

    const matchesSearch =
      !term ||
      item.consumableName.toLowerCase().includes(term) ||
      item.referenceNumber.toLowerCase().includes(term) ||
      item.supplier.toLowerCase().includes(term);

    const matchesWarehouse =
      warehouseFilter === "All" ||
      item.warehouse === warehouseFilter;

    const matchesCategory =
      categoryFilter === "All" ||
      item.category === categoryFilter;

    return (
      matchesSearch &&
      matchesWarehouse &&
      matchesCategory
    );
  });

  const totalConsumables = stock.length;

  const totalQuantity = stock.reduce(
    (sum, item) => sum + item.availableQty,
    0,
  );

  const totalWarehouses = new Set(
    stock.map((item) => item.warehouse),
  ).size;

  return (
    <>
      <Header />

      <div className="cons-stock-page-shell">
        <div className="cons-stock-page-container">

          <section className="cons-stock-page-header">

            <Link to="/inventory/consumable" className="erp-back-button">
  <ArrowLeft size={16} />
  Back
</Link>

            <div className="cons-stock-page-headingblock">

              <div className="cons-stock-page-headingcontent">

                <span className="cons-stock-page-sectiontag">
                  Consumables 
                </span>

                <h1 className="cons-stock-page-title">
                  Consumable Stock
                </h1>

                <p className="cons-stock-page-subtitle">
                  Live stock levels, updated automatically from every GRN.
                </p>

              </div>

            </div>

          </section>

          <section className="cons-stock-dashboard-summary">

            <div className="cons-stock-dashboard-card">

              <div className="cons-stock-dashboard-cardicon">
                <Boxes size={20} />
              </div>

              <div className="cons-stock-dashboard-cardcontent">

                <span className="cons-stock-dashboard-cardvalue">
                  {totalConsumables}
                </span>

                <span className="cons-stock-dashboard-cardlabel">
                  Total Consumables
                </span>

              </div>

            </div>

            <div className="cons-stock-dashboard-card">

              <div className="cons-stock-dashboard-cardicon">
                <Layers size={20} />
              </div>

              <div className="cons-stock-dashboard-cardcontent">

                <span className="cons-stock-dashboard-cardvalue">
                  {totalQuantity}
                </span>

                <span className="cons-stock-dashboard-cardlabel">
                  Total Quantity
                </span>

              </div>

            </div>

            <div className="cons-stock-dashboard-card">

              <div className="cons-stock-dashboard-cardicon">
                <Warehouse size={20} />
              </div>

              <div className="cons-stock-dashboard-cardcontent">

                <span className="cons-stock-dashboard-cardvalue">
                  {totalWarehouses}
                </span>

                <span className="cons-stock-dashboard-cardlabel">
                  Warehouses
                </span>

              </div>

            </div>

          </section>

          <section className="cons-stock-toolbar-panel">

            <div className="cons-stock-toolbar-searchwrapper">

              <div className="cons-stock-toolbar-searchicon">
                <Search size={16} />
              </div>

              <input
                className="cons-stock-toolbar-searchinput"
                type="text"
                placeholder="Search consumable, reference number or supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

            </div>

            <div className="cons-stock-toolbar-filterarea">

              <div className="cons-stock-toolbar-filteritem">

                <label className="cons-stock-toolbar-filterlabel">
                  Warehouse
                </label>

                <select
                  className="cons-stock-toolbar-filterselect"
                  value={warehouseFilter}
                  onChange={(e) =>
                    setWarehouseFilter(e.target.value)
                  }
                >
                  {warehouses.map((wh) => (
                    <option key={wh} value={wh}>
                      {wh === "All"
                        ? "All Warehouses"
                        : wh}
                    </option>
                  ))}
                </select>

              </div>

              <div className="cons-stock-toolbar-filteritem">

                <label className="cons-stock-toolbar-filterlabel">
                  Category
                </label>

                <select
                  className="cons-stock-toolbar-filterselect"
                  value={categoryFilter}
                  onChange={(e) =>
                    setCategoryFilter(e.target.value)
                  }
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === "All"
                        ? "All Categories"
                        : cat}
                    </option>
                  ))}
                </select>

              </div>

            </div>

          </section>

          <section className="cons-stock-table-section">

            <div className="cons-stock-table-card">

              <div className="cons-stock-table-scroll">

                <table className="cons-stock-table-grid">

                  <thead>

                    <tr>

                      <th>Reference Number</th>
                      <th>Consumable</th>
                      <th>Category</th>
                      <th>Unit</th>
                      <th>Available Qty</th>
                      <th>Warehouse</th>
                      <th>Supplier</th>
                      <th>Last Received Date</th>
                      <th>Status</th>

                    </tr>

                  </thead>

                  <tbody>

                    {filteredStock.map((item) => (
                      <tr
                        className="cons-stock-table-row"
                        key={item.id}
                      >
                                                <td className="cons-stock-table-cell">
                          <span className="cons-stock-table-reference">
                            {item.referenceNumber}
                          </span>
                        </td>

                        <td className="cons-stock-table-cell">
                          <div className="cons-stock-table-primaryblock">
                            <span className="cons-stock-table-primarytext">
                              {item.consumableName}
                            </span>
                          </div>
                        </td>

                        <td className="cons-stock-table-cell">
                          <span className="cons-stock-table-categorypill">
                            {item.category}
                          </span>
                        </td>

                        <td className="cons-stock-table-cell">
                          {item.unit}
                        </td>

                        <td className="cons-stock-table-cell">
                          <span className="cons-stock-table-quantityvalue">
                            {item.availableQty}
                          </span>
                        </td>

                        <td className="cons-stock-table-cell">
                          {item.warehouse}
                        </td>

                        <td className="cons-stock-table-cell">
                          {item.supplier}
                        </td>

                        <td className="cons-stock-table-cell">
                          {item.lastReceivedDate}
                        </td>

                        <td className="cons-stock-table-cell">
                          <span
                            className={`cons-stock-table-statusbadge cons-stock-table-status-${item.status
                              .replace(/\s+/g, "-")
                              .toLowerCase()}`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {filteredStock.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="cons-stock-table-emptycell"
                        >
                          <div className="cons-stock-table-emptycontent">

                            <h3 className="cons-stock-table-emptytitle">
                              No Stock Available
                            </h3>

                            <p className="cons-stock-table-emptydescription">
                              No consumable stock has been recorded yet.
                              Once a Goods Receipt Note (GRN) is created,
                              the inventory will automatically appear here.
                            </p>

                          </div>
                        </td>
                      </tr>
                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </section>

        </div>

      </div>

    </>
  );
}