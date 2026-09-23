// AuthLoading.jsx
import "./error.css";

export default function AuthLoading({ onRetry }) {
  const handleRetry = () => {
    if (typeof onRetry === "function") {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <main className="error-stage">
      <div className="my-custom-face-container">
        <svg className="face" viewBox="0 0 320 380">
          <g
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="25"
          >
            <g className="face__eyes" transform="translate(0,112.5)">
              <g transform="translate(15,0)">
                <polyline
                  className="face__eye-lid"
                  points="37,0 0,120 75,120"
                />
                <polyline
                  className="face__pupil"
                  points="55,120 55,155"
                  strokeDasharray="35 35"
                />
              </g>

              <g transform="translate(230,0)">
                <polyline
                  className="face__eye-lid"
                  points="37,0 0,120 75,120"
                />
                <polyline
                  className="face__pupil"
                  points="55,120 55,155"
                  strokeDasharray="35 35"
                />
              </g>
            </g>

            <rect
              className="face__nose"
              x="132.5"
              y="112.5"
              width="55"
              height="155"
              rx="4"
              ry="4"
            />

            <g
              transform="translate(65,334)"
              strokeDasharray="102 102"
            >
              <path
                className="face__mouth-left"
                d="M 0 30 C 0 30 40 0 95 0"
              />

              <path
                className="face__mouth-right"
                d="M 95 0 C 150 0 190 30 190 30"
              />
            </g>
          </g>
        </svg>
      </div>

      <button
        type="button"
        className="animated-button"
        onClick={handleRetry}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="arr-2"
          viewBox="0 0 24 24"
        >
          <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 18.3638L10.8076 16.9999H4V10.9999H16.1716Z" />
        </svg>

        <span className="text">TRY AGAIN</span>

        <span className="circle"></span>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="arr-1"
          viewBox="0 0 24 24"
        >
          <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 18.3638L10.8076 16.9999H4V10.9999H16.1716Z" />
        </svg>
      </button>
    </main>
  );
}