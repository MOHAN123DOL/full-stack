import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./PrivacyPolicy.css";

const LAST_UPDATED = "October 9, 2026";

/* Policy content is unchanged; each section now has a stable id for anchors. */
const policySections = [
  {
    id: "introduction",
    tocLabel: "Introduction",
    title: "1. Introduction",
    paragraphs: [
      "We respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how information may be collected, used, stored, and protected when you visit or use our website and services.",
    ],
  },
  {
    id: "information-we-collect",
    tocLabel: "Information We Collect",
    title: "2. Information We Collect",
    intro:
      "Depending on how you use the website, we may collect the following categories of information:",
    bullets: [
      ["Personal information", " such as your name, email address, phone number, or other details you submit through forms."],
      ["Account information", " required to create and manage an account, where applicable."],
      ["Technical information", " such as browser or device information, IP address, and usage information, where collected."],
      ["Communication information", " including messages, questions, feedback, or support requests you send to us."],
    ],
  },
  {
    id: "how-we-use-your-information",
    tocLabel: "How We Use Your Information",
    title: "3. How We Use Your Information",
    intro: "Information may be used to:",
    bullets: [
      ["Provide services", " and maintain website functionality."],
      ["Respond to enquiries", " and provide customer support."],
      ["Manage accounts", " and authentication, where applicable."],
      ["Improve our website", " and understand how its features are used."],
      ["Protect security", " and detect or investigate suspicious activity."],
      ["Meet legal obligations", " where applicable."],
    ],
  },
  {
    id: "cookies-and-similar-technologies",
    tocLabel: "Cookies and Similar Technologies",
    title: "4. Cookies and Similar Technologies",
    paragraphs: [
      "The website may use cookies or similar technologies to maintain sessions, remember preferences, improve functionality, or understand website usage. You can manage cookies through your browser settings. Disabling certain cookies may affect some features. This section should be updated to identify any analytics or advertising cookies actually used by the website.",
    ],
  },
  {
    id: "sharing-of-information",
    tocLabel: "Sharing of Information",
    title: "5. Sharing of Information",
    intro: "We may share information when reasonably necessary with:",
    bullets: [
      ["Service providers", " that host, maintain, or support the website."],
      ["Technology providers", " such as database, email, authentication, or analytics services used by the website."],
      ["Legal authorities", " when disclosure is required by applicable law."],
      ["Relevant parties", " when necessary to protect users, our rights, or website security."],
    ],
    paragraphs: [
      "We do not intend to sell personal information. The actual data-sharing practices of the website should be reflected accurately in this policy.",
    ],
  },
  {
    id: "data-security",
    tocLabel: "Data Security",
    title: "6. Data Security",
    paragraphs: [
      "We take reasonable technical and organizational measures to protect information against unauthorized access, alteration, disclosure, or destruction. However, no electronic transmission or storage method can be guaranteed to be completely secure.",
    ],
  },
  {
    id: "data-retention",
    tocLabel: "Data Retention",
    title: "7. Data Retention",
    paragraphs: [
      "We retain personal information for as long as reasonably necessary to fulfil the purposes described in this policy, meet applicable legal obligations, resolve disputes, and protect our legitimate interests. Retention periods depend on the type of information and how it is used.",
    ],
  },
  {
    id: "your-privacy-rights",
    tocLabel: "Your Privacy Rights",
    title: "8. Your Privacy Rights",
    paragraphs: [
      "Depending on applicable law, you may have the right to request access to, correction of, or deletion of your personal information. You may also have rights to object to or restrict certain processing and to withdraw consent where processing is based on consent.",
      "To make a privacy-related request, contact us using the contact details published on the website. We may need to verify your identity before processing a request.",
    ],
  },
  {
    id: "third-party-websites-and-services",
    tocLabel: "Third-Party Websites and Services",
    title: "9. Third-Party Websites and Services",
    paragraphs: [
      "The website may contain links to third-party websites or use third-party services. Those providers may have their own privacy policies and practices. We encourage you to review their policies before providing personal information. This policy does not govern services that we do not control.",
    ],
  },
  {
    id: "childrens-privacy",
    tocLabel: "Children's Privacy",
    title: "10. Children's Privacy",
    paragraphs: [
      "The website is not intended to knowingly collect personal information from children in circumstances where parental consent or other safeguards are legally required. If you believe a child has provided personal information inappropriately, contact us so that we can review the matter and take appropriate action.",
    ],
  },
  {
    id: "changes-to-this-privacy-policy",
    tocLabel: "Changes to This Privacy Policy",
    title: "11. Changes to This Privacy Policy",
    paragraphs: [
      "We may update this Privacy Policy to reflect changes to the website, services, or legal obligations. When changes are made, we will update the date shown at the top of this page. Please review this page periodically for the latest version.",
    ],
  },
  {
    id: "contact-us",
    tocLabel: "Contact Us",
    title: "12. Contact Us",
    paragraphs: [
      "If you have questions, concerns, or requests regarding this Privacy Policy or the handling of your personal information, please contact us using the contact details published on our website.",
    ],
    isContact: true,
  },
];

/* ---------- Inline SVG icons (no extra dependency needed) ---------- */
function Icon({ children, size = 20, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const ShieldIcon = (props) => (
  <Icon {...props}>
    <path d="M12 3 4 6v5.5c0 4.6 3.2 8.2 8 9.5 4.8-1.3 8-4.9 8-9.5V6l-8-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

const LoginIcon = (props) => (
  <Icon {...props}>
    <path d="M15 3h3a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-3" />
    <path d="m10 17 5-5-5-5" />
    <path d="M15 12H3" />
  </Icon>
);

const CalendarIcon = (props) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </Icon>
);

const MailIcon = (props) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Icon>
);

const ListIcon = (props) => (
  <Icon {...props}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Icon>
);

/* ---------- Page ---------- */
export default function PrivacyPolicy() {
  const [activeId, setActiveId] = useState(policySections[0].id);

  /* Highlight the section currently in view. */
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );

    policySections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  /* Smooth-scroll to a section without touching router history. */
  const handleTocClick = useCallback((event, id) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
    setActiveId(id);
    target.focus({ preventScroll: true });
  }, []);

  return (
    <main className="privacy-policy-page">
      {/* ---------- Hero ---------- */}
      <header className="privacy-policy-hero">
        <span className="privacy-policy-shape privacy-policy-shape-1" aria-hidden="true" />
        <span className="privacy-policy-shape privacy-policy-shape-2" aria-hidden="true" />
        <span className="privacy-policy-shape privacy-policy-shape-3" aria-hidden="true" />

        <div className="privacy-policy-hero-inner">
          <span className="privacy-policy-badge">
            <ShieldIcon size={16} />
            Privacy Policy
          </span>

          <h1 className="privacy-policy-title">
            <ShieldIcon size={40} className="privacy-policy-title-icon" />
            Your Privacy Matters
          </h1>

          <p className="privacy-policy-subtitle">
            Learn how information may be collected, used, protected, and managed
            when you visit or use our website and services.
          </p>

          <div className="privacy-policy-hero-actions">
            <span className="privacy-policy-date">
              <CalendarIcon size={16} />
              Last updated: <time>{LAST_UPDATED}</time>
            </span>

            <Link to="/production/login" className="privacy-policy-login-button">
              <LoginIcon size={18} />
              Go to Login
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- Body ---------- */}
      <div className="privacy-policy-layout">
        <aside className="privacy-policy-sidebar">
          <nav className="privacy-policy-toc" aria-labelledby="privacy-policy-toc-title">
            <h2 id="privacy-policy-toc-title" className="privacy-policy-toc-title">
              <ListIcon size={16} />
              Table of Contents
            </h2>
            <ol className="privacy-policy-toc-list">
              {policySections.map((section) => {
                const isActive = activeId === section.id;
                return (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className={`privacy-policy-toc-link${isActive ? " is-active" : ""}`}
                      aria-current={isActive ? "location" : undefined}
                      onClick={(event) => handleTocClick(event, section.id)}
                    >
                      {section.tocLabel}
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>
        </aside>

        <article className="privacy-policy-content">
          {policySections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              tabIndex={-1}
              className={`privacy-policy-section${section.isContact ? " privacy-policy-section-contact" : ""}`}
              aria-labelledby={`${section.id}-heading`}
            >
              <h2 id={`${section.id}-heading`} className="privacy-policy-section-title">
                {section.isContact && <MailIcon size={22} className="privacy-policy-section-icon" />}
                {section.title}
              </h2>

              {section.intro && <p>{section.intro}</p>}

              {section.bullets && (
                <ul className="privacy-policy-list">
                  {section.bullets.map(([label, description]) => (
                    <li key={label}>
                      <strong>{label}</strong>
                      {description}
                    </li>
                  ))}
                </ul>
              )}

              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
            </section>
          ))}

          <footer className="privacy-policy-footer">
            <ShieldIcon size={18} />
            <p>
              Your trust matters to us. Please review this policy periodically
              for updates.
            </p>
          </footer>
        </article>
      </div>
    </main>
  );
}