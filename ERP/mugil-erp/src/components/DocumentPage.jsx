import CompanyHeader from "./CompanyHeader";
import CompanyFooter from "./CompanyFooter";

export default function DocumentPage({
  docTitle,
  children,
}) {
  return (
    <section className="doc-sheet">

      {/* ======================================================
          SCREEN PREVIEW HEADER
      ====================================================== */}

      <div className="doc-page-header">

        <CompanyHeader
          docTitle={docTitle}
        />

      </div>


      {/* ======================================================
          PAGE CONTENT
      ====================================================== */}

      <main className="doc-sheet-content">

        {children}

      </main>


      {/* ======================================================
          SCREEN PREVIEW FOOTER
      ====================================================== */}

      <div className="doc-page-footer">

        <CompanyFooter />

      </div>

    </section>
  );
}