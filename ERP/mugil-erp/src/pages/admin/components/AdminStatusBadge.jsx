/**
 * Status pill. Tone is looked up from the status text, or passed explicitly.
 * Tones: neutral | info | success | warning | danger
 */
const STATUS_TONES = {
  // Attendance (labels match HR's STATUS_META)
  present: "success",
  "half day": "warning",
  "work from home": "info",
  // GRN (same vocabulary as Material Planning)
  "not received": "danger",
  "partially received": "warning",
  // Project (Project.Status)
  active: "success",
  "on hold": "warning",
  completed: "info",
};

export default function AdminStatusBadge({ status, tone }) {
  const resolved = tone || STATUS_TONES[String(status).toLowerCase()] || "neutral";

  return (
    <span className={`admin-badge admin-badge--${resolved}`}>
      <span className="admin-badge-dot" aria-hidden="true" />
      {status}
    </span>
  );
}
