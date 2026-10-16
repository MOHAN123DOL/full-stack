/** Compact row of summary figures. items: [{ label, value, tone? }] */
export default function AdminStatStrip({ items }) {
  return (
    <div className="admin-stat-strip">
      {items.map((item) => (
        <div
          key={item.label}
          className={`admin-stat admin-stat--${item.tone || "neutral"}`}
        >
          <span className="admin-stat-label">{item.label}</span>
          <span className="admin-stat-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
