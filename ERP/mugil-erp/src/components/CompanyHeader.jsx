import "./CompanyHeader.css";
export default function CompanyHeader({ docTitle }) {
  return (
    <>
      <div className="doc-header">
        <div className="doc-header__logo">
          <img
            src="/mugil-logo.png"
            alt="Mugil Engineering Industry"
          />
        </div>

        <div className="doc-header__center">
          <h1 className="doc-header__company">
            Mugil Engineering Industry
          </h1>

          <div className="doc-header__meta">
            Udyam Reg No: UDYAM-TN-27-0010156 &nbsp;•&nbsp; GSTIN:
            33AHDPR8644K1ZX
          </div>
        </div>

        <div className="doc-header__logo--right">
          <img
            src="/globe-logo.png"
            alt="MEI"
          />
        </div>
      </div>

      <div className="doc-title">
        {docTitle}
      </div>
    </>
  );
}

