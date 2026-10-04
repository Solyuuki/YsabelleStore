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
              <span><i className="is-actual" />Observed</span>
              <span><i className="is-forecast" />Forecast</span>
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
                <text x="16" y="75">36k</text>
                <text x="16" y="150">30k</text>
                <text x="16" y="225">24k</text>
                <text x="16" y="300">18k</text>
                <text x="16" y="375">12k</text>
              </g>

              <path
                className="about-forecast-demo__confidence"
                d="M500 172 C604 132 696 112 780 105 C823 100 850 91 872 78 L872 158 C850 165 823 168 780 172 C695 180 603 202 500 246 Z"
                fill="url(#aboutForecastBand)"
              />
              <line className="about-forecast-demo__forecast-divider" x1="500" y1="64" x2="500" y2="370" />
              <text className="about-forecast-demo__forecast-label" x="516" y="88">FORECAST STARTS</text>

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

            <div className="about-forecast-demo__years">
              {annualForecast.map((item) => (
                <div className={item.state === "forecast" ? "is-forecast" : undefined} key={item.year}>
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
            <strong>42 <small>units</small></strong>
          </div>

          <div className="about-forecast-demo__recommendation-grid">
            <div><span>Demand signal</span><strong>High</strong></div>
            <div><span>Restock window</span><strong>11–14 days</strong></div>
            <div><span>Seasonality</span><strong>Detected</strong></div>
            <div><span>Confidence</span><strong>Stable</strong></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
