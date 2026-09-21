import { formatINR } from "../utils/calculations";

const PROTECTED_IDS = {
  po: ["description", "specification", "qty", "unit", "amount", "actions"],
  quote: ["description", "qty", "rate", "total", "actions"],
};

const isProtected = (variant, id) => PROTECTED_IDS[variant]?.includes(id);

const makeCol = (variant, id, label, type, extra = {}) => ({
  id,
  label,
  type,
  visible: true,
  custom: false,
  removable: !isProtected(variant, id),
  hideable: !isProtected(variant, id),
  movable: id !== "amount" && id !== "actions",
  system: id === "amount" || id === "actions",
  ...extra,
});

/** Fresh default column set for a variant. */
export function createDefaultColumns(variant = "po") {
  if (variant === "quote") {
    return [
      makeCol(variant, "description", "Description of Items", "text"),
      makeCol(variant, "sizeThickness", "Size / Thickness", "text"),
      makeCol(variant, "qty", "Qty", "number"),
      makeCol(variant, "unit", "Unit", "text"),
      makeCol(variant, "rate", "Rate per Unit (₹)", "number"),
      makeCol(variant, "total", "Total", "computed"),
      makeCol(variant, "actions", "Actions", "actions"),
    ];
  }
  // PO - Simple columns matching the image
  return [
    makeCol(variant, "description", "Description", "text"),
    makeCol(variant, "specification", "Specification", "text"),
    makeCol(variant, "qty", "Qty", "number"),
    makeCol(variant, "unit", "Unit", "text"),
    makeCol(variant, "amount", "Rate per Unit (₹)", "number"),
    makeCol(variant, "actions", "Actions", "actions"),
  ];
}

const getBuiltInMeta = (variant, id) => {
  if (id === "description")
    return {
      placeholder: "Description",
      minWidth: variant === "quote" ? 180 : 160,
    };
  const META = {
    specification: { placeholder: "Specification", minWidth: 160 },
    qty: { placeholder: "0" },
    unit: { placeholder: "Unit" },
    amount: { placeholder: "0.00" },
    sizeThickness: { placeholder: "Size / Thickness", minWidth: 160 },
    rate: { placeholder: "0.00" },
  };
  return META[id] || {};
};

const SPECIAL_DEFAULTS = { unit: "No", qty: "1" };

const buildBaseRow = (cols) => {
  const base = {};
  cols.forEach((c) => {
    if (c.system) return;
    base[c.id] =
      SPECIAL_DEFAULTS[c.id] !== undefined ? SPECIAL_DEFAULTS[c.id] : "";
  });
  return base;
};

const isMoneyCol = (id) => id === "amount" || id === "rate" || id === "total";

/**
 * variant: 'po' (simple columns) | 'quote' (simple rate x qty)
 * mode: 'form' (editable) | 'print' (static, matches the official layout)
 * columns: optional dynamic column definition.
 */
export default function OrderItemsTable({
  variant = "po",
  mode = "form",
  items,
  onChange,
  columns: columnsProp,
}) {
  const hasDynamicColumns = Boolean(columnsProp && columnsProp.length);
  const cols = hasDynamicColumns ? columnsProp : createDefaultColumns(variant);
  const visibleCols = cols.filter((c) => c.visible !== false);

  const updateItem = (id, key, value) => {
    onChange(items.map((it) => (it.id === id ? { ...it, [key]: value } : it)));
  };

  const addRow = () => {
    onChange([
      ...items,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ...buildBaseRow(cols),
      },
    ]);
  };

  const deleteRow = (id) => {
    if (items.length === 1) return;
    onChange(items.filter((it) => it.id !== id));
  };

  const duplicateRow = (id) => {
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) return;
    const copy = {
      ...items[idx],
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    const next = [...items];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  };

  const renderFormInput = (c, item) => {
    const value = item[c.id] ?? "";
    const meta = getBuiltInMeta(variant, c.id);
    const style = meta.minWidth ? { minWidth: meta.minWidth } : undefined;
    const handleChange = (e) => updateItem(item.id, c.id, e.target.value);

    
if (c.type === "computed") {
  const qty = Number(item.qty) || 0;
  const rate = Number(item.rate) || 0;
  const total = qty * rate;

  return (
    <span className="computed-total">
      {formatINR(total, { withSymbol: false })}
    </span>
  );
}



    if (c.type === "dropdown") {
      if (!c.options || !c.options.length) {
        return (
          <input
            value={value}
            onChange={handleChange}
            placeholder={meta.placeholder || c.label}
            style={style}
          />
        );
      }
      return (
        <select value={value} onChange={handleChange}>
          <option value="">--</option>
          {c.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    if (c.type === "date") {
      return <input type="date" value={value} onChange={handleChange} />;
    }
    if (c.type === "number") {
      return (
        <input
          className="num-input"
          type="number"
          value={value}
          onChange={handleChange}
          placeholder={meta.placeholder || "0"}
        />
      );
    }
    return (
      <input
        value={value}
        onChange={handleChange}
        placeholder={meta.placeholder || c.label}
        style={style}
      />
    );
  };

  // ---- Print / preview mode ----
  if (mode === "print") {
    if (!hasDynamicColumns) {
      return (
        <table className="doc-table">
          <thead>
            {variant === "po" ? (
              <tr>
                <th style={{ width: "5%" }}>S.No</th>
                <th style={{ width: "25%" }}>Description</th>
                <th style={{ width: "30%" }}>Specification</th>
                <th>Qty</th>
                <th>Unit</th>
                <th className="num">Amount (₹)</th>
              </tr>
            ) : (
              <tr>
                <th style={{ width: "5%" }}>S.No</th>
                <th style={{ width: "26%" }}>Description of Items</th>
                <th style={{ width: "24%" }}>Size / Thickness</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th className="num">Total (₹)</th>
              </tr>
            )}
          </thead>
          <tbody>
            {items.map((item, idx) =>
              variant === "po" ? (
                <tr key={item.id}>
                  <td className="center">{idx + 1}</td>
                  <td>{item.description}</td>
                  <td>{item.specification}</td>
                  <td className="center">{item.qty}</td>
                  <td className="center">{item.unit}</td>
                  <td className="num">
                    {item.amount
                      ? formatINR(item.amount, { withSymbol: false })
                      : "-"}
                  </td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td className="center">{idx + 1}</td>
                  <td>{item.description}</td>
                  <td>{item.sizeThickness}</td>
                  <td className="center">{item.qty}</td>
                  <td className="center">{item.unit}</td>
                  <td className="num">
                    {formatINR(item.rate * item.qty, { withSymbol: false })}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      );
    }

    // Dynamic layout
    const printCols = visibleCols.filter((c) => c.id !== "actions");
    return (
      <table className="doc-table">
        <thead>
          <tr>
            <th style={{ width: "4%" }}>S.No</th>
            {printCols.map((c) => (
              <th key={c.id} className={c.id === "amount" ? "num" : undefined}>
                {isMoneyCol(c.id) ? `${c.label}` : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id}>
              <td className="center">{idx + 1}</td>
              {printCols.map((c) => {
                if (c.id === "amount") {
                  return (
                    <td key={c.id} className="num">
                      {item.amount
                        ? formatINR(item.amount, { withSymbol: false })
                        : "-"}
                    </td>
                  );
                }
                if (c.type === "number") {
                  return (
                    <td key={c.id} className="center">
                      {item[c.id] || "-"}
                    </td>
                  );
                }
                return <td key={c.id}>{item[c.id]}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // ---- Form / editable mode ----
  return (
    <div>
      <div className="items-table-wrap">
        <table className="items-table">
          <thead>
            <tr>
              <th>#</th>
              {visibleCols.map((c) => (
                <th key={c.id}>{c.id === "actions" ? "" : c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id}>
                <td className="sno-cell">{idx + 1}</td>
                {visibleCols.map((c) => {
                  if (c.id === "actions") {
                    return (
                      <td key={c.id} className="row-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title="Duplicate row"
                          onClick={() => duplicateRow(item.id)}
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--danger"
                          title="Delete row"
                          onClick={() => deleteRow(item.id)}
                          disabled={items.length === 1}
                        >
                          ✕
                        </button>
                      </td>
                    );
                  }
                  return <td key={c.id}>{renderFormInput(c, item)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="items-table-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={addRow}
          >
            + Add Row
          </button>
        </div>
      </div>
    </div>
  );
}
