const STATUS_CLASS = {
  completed: "success",
  "in stock": "success",
  available: "success",
  received: "success",
  open: "info",
  pending: "warning",
  partial: "warning",
  "partially issued": "warning",
  "fully issued": "neutral",
  "issued to production": "neutral",
  sold: "neutral",
  disposed: "danger",
  rejected: "danger",
};

export default function StatusBadge({ status }) {
  const cls = STATUS_CLASS[String(status).toLowerCase()] || "neutral";
  return <span className={`status-badge status-${cls}`}>{status}</span>;
}