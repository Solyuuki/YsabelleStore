const annualForecast = [
  { year: "2023", value: "18.4k", state: "actual" },
  { year: "2024", value: "21.7k", state: "actual" },
  { year: "2025", value: "24.1k", state: "actual" },
  { year: "2026", value: "26.8k", state: "forecast" },
  { year: "2027", value: "29.4k", state: "forecast" },
  { year: "2028", value: "31.1k", state: "forecast" }
] as const;

export function AboutForecastMotion() {
  return (
    <div aria-hidden="true" className="about-forecast-demo">
      <div className="about-forecast-demo__topbar">
        <div>
          <span className="about-forecast-demo__eyebrow">Illustrative system preview</span>
          <strong>Annual demand forecast</strong>
        </div>
        <div className="about-forecast-demo__status">
          <span />
          SARIMA model ready
        </div>
      </div>

      <div className="about-forecast-demo__metrics">
        <article>
          <span>Forecast horizon</span>
          <strong>12 months</strong>
          <small>Rolling seasonal outlook</small>
        </article>
        <article>
          <span>Projected demand shift</span>
          <strong>+12.4%</strong>
          <small>Illustrative year-over-year</small>
        </article>
        <article>
          <span>Restock signal</span>
          <strong>Priority</strong>
          <small>Suggested from forecast trend</small>
        </article>
      </div>

      <div className="about-forecast-demo__workspace">
        <section className="about-forecast-demo__chart-panel">
          <div className="about-forecast-demo__chart-heading">
            <div>
              <span>Sales history → forecast</span>
              <strong>Illustrative annual unit demand</strong>
            </div>
            <div className="about-forecast-demo__legend">
              <span>
                <i className="is-actual" />
                Observed
              </span>
              <span>
                <i className="is-forecast" />
                Forecast
              </span>
            </div>
          </div>

          <div className="about-forecast-demo__chart-wrap">
            <svg className="about-forecast-demo__chart" viewBox="0 0 920 420" role="presentation">
              <defs>
                <linearGradient id="aboutForecastBand" x1="0" x2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.04" />
                </linearGradient>
                <linearGradient id="aboutForecastLine" x1="0" x2="1">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>

              <g className="about-forecast-demo__grid">
                <line x1="72" y1="70" x2="872" y2="70" />
                <line x1="72" y1="145" x2="872" y2="145" />
                <line x1="72" y1="220" x2="872" y2="220" />
                <line x1="72" y1="295" x2="872" y2="295" />
                <line x1="72" y1="370" x2="872" y2="370" />
              </g>

              <g className="about-forecast-demo__y-labels">
                <text x="16" y="75">
                  36k
                </text>
                <text x="16" y="150">
                  30k
                </text>
                <text x="16" y="225">
                  24k
                </text>
                <text x="16" y="300">
                  18k
                </text>
                <text x="16" y="375">
                  12k
                </text>
              </g>

              <path
                className="about-forecast-demo__confidence"
                d="M500 172 C604 132 696 112 780 105 C823 100 850 91 872 78 L872 158 C850 165 823 168 780 172 C695 180 603 202 500 246 Z"
                fill="url(#aboutForecastBand)"
              />
              <line
                className="about-forecast-demo__forecast-divider"
                x1="500"
                y1="64"
                x2="500"
                y2="370"
              />
              <text className="about-forecast-demo__forecast-label" x="516" y="88">
                FORECAST STARTS
              </text>

              <path
                className="about-forecast-demo__actual-line"
                d="M82 310 C145 292 190 270 238 255 C290 238 336 198 392 192 C438 188 470 207 500 218"
                pathLength="1"
              />
              <path
                className="about-forecast-demo__forecast-line"
                d="M500 218 C566 196 610 171 650 158 C705 140 751 136 792 128 C827 121 850 111 872 100"
                pathLength="1"
                stroke="url(#aboutForecastLine)"
              />

              <g className="about-forecast-demo__points">
                <circle cx="82" cy="310" r="7" />
                <circle cx="238" cy="255" r="7" />
                <circle cx="392" cy="192" r="7" />
                <circle className="is-forecast" cx="500" cy="218" r="7" />
                <circle className="is-forecast" cx="650" cy="158" r="7" />
                <circle className="is-forecast" cx="792" cy="128" r="7" />
                <circle className="is-forecast" cx="872" cy="100" r="7" />
              </g>
            </svg>

            {/* Phone chart redraw: same illustrative trend, fewer large labels,
                and no sideways scrolling through a 920px desktop graphic. */}
            <svg
              aria-label="Illustrative demand grows from 18.4 thousand units in 2023 to a forecast of 31.1 thousand in 2028"
              className="about-forecast-demo__chart-mobile"
              role="img"
              viewBox="0 0 320 186"
            >
              <title>Annual unit demand: observed 2023–2025, forecast 2026–2028</title>
              <g className="about-forecast-demo__grid">
                <line x1="14" y1="30" x2="306" y2="30" />
                <line x1="14" y1="76" x2="306" y2="76" />
                <line x1="14" y1="122" x2="306" y2="122" />
                <line x1="14" y1="158" x2="306" y2="158" />
              </g>
              <path
                className="about-forecast-demo__confidence"
                d="M134 95 C188 65 253 51 306 27 L306 82 C257 99 188 112 134 113 Z"
                fill="rgba(124, 92, 255, 0.12)"
              />
              <line
                className="about-forecast-demo__forecast-divider"
                x1="134"
                x2="134"
                y1="22"
                y2="159"
              />
              <path
                className="about-forecast-demo__actual-line"
                d="M16 144 L75 119 L134 95"
              />
              <path
                className="about-forecast-demo__forecast-line"
                d="M134 95 L190 74 L248 50 L304 35"
              />
              <circle cx="16" cy="144" r="4.5" fill="#23b4ae" />
              <circle cx="134" cy="95" r="4.5" fill="#23b4ae" />
              <circle cx="304" cy="35" r="5" fill="#aa91ff" />
              <g className="about-forecast-demo__mobile-chart-labels">
                <text x="16" y="166">2023</text>
                <text x="139" y="166">2025</text>
                <text x="271" y="166">2028</text>
                <text x="16" y="136">18.4k</text>
                <text x="139" y="88">24.1k</text>
                <text x="267" y="25">31.1k</text>
              </g>
            </svg>

            <div className="about-forecast-demo__years">
              {annualForecast.map((item) => (
                <div
                  className={item.state === "forecast" ? "is-forecast" : undefined}
                  key={item.year}
                >
                  <strong>{item.value}</strong>
                  <span>{item.year}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="about-forecast-demo__recommendation">
          <div className="about-forecast-demo__recommendation-head">
            <span>Next restock recommendation</span>
            <small>Demo output</small>
          </div>

          <div className="about-forecast-demo__product">
            <span className="about-forecast-demo__product-icon">CG</span>
            <div>
              <small>Priority category</small>
              <strong>Canned goods</strong>
            </div>
          </div>

          <div className="about-forecast-demo__restock-value">
            <span>Recommended quantity</span>
            <strong>
              42 <small>units</small>
            </strong>
          </div>

          <div className="about-forecast-demo__recommendation-grid">
            <div>
              <span>Demand signal</span>
              <strong>High</strong>
            </div>
            <div>
              <span>Restock window</span>
              <strong>11–14 days</strong>
            </div>
            <div>
              <span>Seasonality</span>
              <strong>Detected</strong>
            </div>
            <div>
              <span>Confidence</span>
              <strong>Stable</strong>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
