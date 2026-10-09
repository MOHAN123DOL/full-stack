import { useId, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  LifeBuoy,
  LogIn,
  Mail,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { HELP_CATEGORIES, HELP_FAQS, RETRY } from "../data/helpFAQs";
import "./HelpCenter.css";

const ALL = "All";

/* ------------------------------------------------------------
   SEARCH (client-side, case-insensitive)
   Every word typed must appear somewhere in the question,
   answer, steps, causes, category or keywords.
   ------------------------------------------------------------ */
function buildHaystack(faq) {
  return [
    faq.question,
    faq.answer,
    faq.category,
    faq.nextAction,
    ...(faq.steps || []),
    ...(faq.causes || []),
    ...(faq.keywords || []),
  ]
    .join(" ")
    .toLowerCase();
}

const INDEX = HELP_FAQS.map((faq) => ({
  faq,
  haystack: buildHaystack(faq),
  question: faq.question.toLowerCase(),
  keywords: (faq.keywords || []).join(" ").toLowerCase(),
}));

function searchFaqs(query, category) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  return INDEX.filter(
    (row) => category === ALL || row.faq.category === category
  )
    .map((row) => {
      if (!terms.every((t) => row.haystack.includes(t))) return null;
      let score = 0;
      terms.forEach((t) => {
        if (row.question.includes(t)) score += 3;
        if (row.keywords.includes(t)) score += 2;
        score += 1;
      });
      return { faq: row.faq, score };
    })
    .filter(Boolean)
    .sort((a, b) => (terms.length ? b.score - a.score : 0))
    .map((r) => r.faq);
}

/* ------------------------------------------------------------
   SMALL PIECES
   ------------------------------------------------------------ */
function RetryNotice({ retry, note }) {
  if (retry === RETRY.NA) {
    return note ? <p className="help-retry help-retry-na">{note}</p> : null;
  }

  const safe = retry === RETRY.SAFE;
  const Icon = safe ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={`help-retry ${safe ? "help-retry-safe" : "help-retry-check"}`}
    >
      <Icon size={16} aria-hidden="true" />
      <p>
        <strong>
          {safe ? "Safe to try again." : "Check before you try again."}
        </strong>{" "}
        {note ||
          (safe
            ? ""
            : "The action may already have been saved. Look in the list or history first.")}
      </p>
    </div>
  );
}

function ContactButton({ className = "" }) {
  return (
    <Link to="/contact" className={`help-btn help-btn-primary ${className}`}>
      <Mail size={16} aria-hidden="true" />
      Contact Us
    </Link>
  );
}

function FaqItem({ faq, open, onToggle }) {
  const uid = useId();
  const buttonId = `${uid}-button`;
  const panelId = `${uid}-panel`;
  const actions = faq.actions || [];

  return (
    <li className={`help-faq ${open ? "is-open" : ""}`}>
      <h3 className="help-faq-heading">
        <button
          type="button"
          id={buttonId}
          className="help-faq-question"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className="help-faq-question-text">
            <span className="help-faq-category" aria-hidden="true">
              {faq.category}
            </span>
            {faq.question}
          </span>
          <ChevronDown size={20} className="help-faq-chevron" aria-hidden="true" />
        </button>
      </h3>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          className="help-faq-panel"
        >
          <p className="help-faq-answer">{faq.answer}</p>

          {faq.steps?.length > 0 && (
            <>
              <h4 className="help-faq-subtitle">What to do</h4>
              <ol className="help-faq-steps">
                {faq.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </>
          )}

          {faq.causes?.length > 0 && (
            <>
              <h4 className="help-faq-subtitle">Common causes</h4>
              <ul className="help-faq-causes">
                {faq.causes.map((cause) => (
                  <li key={cause}>{cause}</li>
                ))}
              </ul>
            </>
          )}

          <RetryNotice retry={faq.retry} note={faq.retryNote} />

          {faq.nextAction && (
            <p className="help-faq-next">
              <strong>Next step:</strong> {faq.nextAction}
            </p>
          )}

          {actions.length > 0 && (
            <div className="help-faq-actions">
              {actions.includes("refresh") && (
                <button
                  type="button"
                  className="help-btn help-btn-secondary"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  Refresh Page
                </button>
              )}
              {actions.includes("login") && (
                <Link to="/production/login" className="help-btn help-btn-secondary">
                  <LogIn size={16} aria-hidden="true" />
                  Return to Login
                </Link>
              )}
              {actions.includes("contact") && <ContactButton />}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------
   PAGE
   ------------------------------------------------------------ */
export default function HelpCenter() {
  const navigate = useNavigate();
  const location = useLocation();
  const inputId = useId();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [openId, setOpenId] = useState(null);

  const results = useMemo(
    () => searchFaqs(query.trim(), category),
    [query, category]
  );

  const counts = useMemo(() => {
    const map = { [ALL]: HELP_FAQS.length };
    HELP_CATEGORIES.forEach((c) => {
      map[c] = HELP_FAQS.filter((f) => f.category === c).length;
    });
    return map;
  }, []);

  const searching = query.trim().length > 0;

  const handleBack = () => {
    // "default" means this page was the first one opened in this tab.
    if (location.key === "default") {
      navigate("/production/login");
    } else {
      navigate(-1);
    }
  };

  const clearAll = () => {
    setQuery("");
    setCategory(ALL);
  };

  return (
    <div className="help-page">
      <div className="help-inner">
        <button type="button" className="help-back-btn" onClick={handleBack}>
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          Back
        </button>

        <header className="help-header">
          <span className="help-header-icon" aria-hidden="true">
            <LifeBuoy size={26} />
          </span>
          <h1 className="help-title">Help Center</h1>
          <p className="help-subtitle">
            Find answers about signing in, Material Planning, Accounts, HR and
            common errors in Mugil Industries ERP.
          </p>

          <div className="help-search" role="search">
            <label htmlFor={inputId} className="help-visually-hidden">
              Search Help topics
            </label>
            <Search size={18} className="help-search-icon" aria-hidden="true" />
            <input
              id={inputId}
              type="search"
              className="help-search-input"
              placeholder="Search, for example: session expired, GRN, 403"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpenId(null);
              }}
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                className="help-search-clear"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        <nav className="help-categories" aria-label="Help categories">
          {[ALL, ...HELP_CATEGORIES].map((name) => (
            <button
              key={name}
              type="button"
              className={`help-chip ${category === name ? "is-active" : ""}`}
              aria-pressed={category === name}
              onClick={() => {
                setCategory(name);
                setOpenId(null);
              }}
            >
              {name}
              <span className="help-chip-count">{counts[name]}</span>
            </button>
          ))}
        </nav>

        <p className="help-result-count" role="status" aria-live="polite">
          {results.length === 0
            ? "No matching topics"
            : `${results.length} ${results.length === 1 ? "topic" : "topics"}${
                searching ? ` for “${query.trim()}”` : ""
              }`}
        </p>

        {results.length > 0 ? (
          <ul className="help-faq-list">
            {results.map((faq) => (
              <FaqItem
                key={faq.id}
                faq={faq}
                open={openId === faq.id}
                onToggle={() =>
                  setOpenId((current) => (current === faq.id ? null : faq.id))
                }
              />
            ))}
          </ul>
        ) : (
          <section className="help-empty" aria-labelledby="help-empty-title">
            <span className="help-empty-icon" aria-hidden="true">
              <Search size={26} />
            </span>
            <h2 id="help-empty-title">We couldn&rsquo;t find an answer to your question.</h2>
            <p>Try one of these:</p>
            <ul className="help-empty-options">
              <li>Search with different keywords.</li>
              <li>Browse all Help topics.</li>
              <li>Send your question to our support team.</li>
            </ul>
            <div className="help-empty-actions">
              <button
                type="button"
                className="help-btn help-btn-secondary"
                onClick={clearAll}
              >
                Browse all topics
              </button>
              <ContactButton />
            </div>
          </section>
        )}

        <aside className="help-cta" aria-label="Contact support">
          <div>
            <h2>Still need help?</h2>
            <p>
              Send us the page name, the exact message and the time it
              happened. Please never include your password.
            </p>
          </div>
          <ContactButton />
        </aside>
      </div>
    </div>
  );
}
