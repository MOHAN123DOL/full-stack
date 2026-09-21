import CompanyHeader from "./CompanyHeader";
import CompanyFooter from "./CompanyFooter";

export default function PrintLayout({ title, onBack, children }) {
  const handlePrint = () => window.print();

  return (
    <div className="doc-scene">

      {/* ======================================================
          TOOLBAR
      ====================================================== */}

      <div className="doc-toolbar no-print">

        <div className="doc-toolbar__left">

          <button
            className="btn btn-secondary"
            onClick={onBack}
          >
            ← Back to Edit
          </button>

        </div>

        <div className="doc-toolbar__title">
          {title}
        </div>

        <div className="doc-toolbar__right">

          <button
            className="btn btn-secondary"
            onClick={handlePrint}
          >
            Save as PDF
          </button>

          <button
            className="btn btn-primary"
            onClick={handlePrint}
          >
            🖨 Print
          </button>

        </div>

      </div>


      {/* ======================================================
          PRINT DOCUMENT

          THEAD = repeating header
          TBODY = flowing quotation content
          TFOOT = repeating footer
      ====================================================== */}

      <table className="doc-print-table">

        <thead>

          <tr>

            <td className="doc-print-table-header">

              <CompanyHeader
                docTitle="QUOTATION"
              />

            </td>

          </tr>

        </thead>


        <tbody>

          <tr>

            <td className="doc-print-table-body">

              {children}

            </td>

          </tr>

        </tbody>


        <tfoot>

          <tr>

            <td className="doc-print-table-footer">

              <CompanyFooter />

            </td>

          </tr>

        </tfoot>

      </table>

    </div>
  );
}