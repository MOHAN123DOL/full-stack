/**
 * Bordered surface. With a `title` it renders a header bar; `tone`
 * (neutral | success | warning) adds a coloured accent so two cards on one
 * page (e.g. On Leave / Present) are instantly distinguishable.
 *
 * NOTE ON `subtitle`
 * ------------------
 * `subtitle` is a ReactNode and is commonly used to pass a search
 * input (which itself renders as a <div>). A <p> can only contain
 * phrasing content, so wrapping a <div>-based subtitle in a <p>
 * produces invalid HTML and triggers React's
 * "validateDOMNesting(...): <div> cannot appear as a descendant
 * of <p>" warning. The subtitle slot therefore renders as a
 * <div>.
 */
export default function AdminCard({
  title,
  count,
  subtitle,
  tone = "neutral",
  children,
}) {
  return (
    <section className={`admin-card admin-card--${tone}`}>
      {title && (
        <header className="admin-card-header">
          <div className="admin-card-heading">
            <span className="admin-card-dot" aria-hidden="true" />

            <h2 className="admin-card-title">{title}</h2>

            {count !== undefined && (
              <span className="admin-card-count">{count}</span>
            )}
          </div>

          {subtitle && (
            <div className="admin-card-subtitle">
              {subtitle}
            </div>
          )}
        </header>
      )}

      {children}
    </section>
  );
}