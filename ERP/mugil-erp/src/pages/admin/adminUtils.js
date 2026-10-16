/* ==========================================================================
   ADMIN UTILITIES — small, dependency-free helpers
   ========================================================================== */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 118000 -> "₹1,18,000.00" (Indian digit grouping, matches the rest of the ERP). */
export function formatCurrency(amount) {
  const n = Number(amount);
  return inrFormatter.format(Number.isFinite(n) ? n : 0);
}

/** 12 -> "12", 12.5 -> "12.5", 12.3400 -> "12.34" (same rule as ReceiveGRN.jsx). */
export function formatQuantity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

/** Today as YYYY-MM-DD in the user's LOCAL timezone (not UTC). */
export function todayISO() {
  const d = new Date();
  const pad = (v) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-06-10" -> "10 Jun 2026" */
export function formatDisplayDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Case-insensitive "does any of these fields contain the query". */
export function matchesQuery(query, ...fields) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => String(f ?? "").toLowerCase().includes(q));
}
