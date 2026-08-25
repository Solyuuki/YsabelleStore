import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ClipboardCheck,
  Database,
  LineChart,
  PackageCheck,
  ScanBarcode,
  ShoppingBasket,
  SlidersHorizontal,
  TrendingUp,
  Warehouse,
  type LucideIcon
} from "lucide-react";
import { useEffect, useRef } from "react";

type IntelligenceStage = {
  capability: "Implemented now" | "Target workflow";
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  shortTitle: string;
  title: string;
  tone: "foundation" | "forecast" | "target";
};

const stages: IntelligenceStage[] = [
  {
    capability: "Implemented now",
    eyebrow: "01 / Completed sale",
    shortTitle: "Sale",
    title: "A completed sale starts the signal.",
    description:
      "A barcode match and completed POS checkout preserve the product, quantity, and sale record.",
    icon: ShoppingBasket,
    tone: "foundation"
  },
  {
    capability: "Implemented now",
    eyebrow: "02 / Inventory update",
    shortTitle: "Stock",
    title: "The same event updates usable stock.",
    description:
      "The completed sale creates a traceable inventory movement and reduces sellable quantity.",
    icon: Boxes,
    tone: "foundation"
  },
  {
    capability: "Implemented now",
    eyebrow: "03 / Historical monthly sales",
    shortTitle: "History",
    title: "Transactions become monthly demand.",
    description:
      "Completed POS and approved historical records resolve into complete product-month observations.",
    icon: Database,
    tone: "foundation"
  },
  {
    capability: "Implemented now",
    eyebrow: "04 / SARIMA forecast",
    shortTitle: "Forecast",
    title: "Seasonality becomes a forward view.",
    description:
      "Eligible series use SARIMA; limited histories use validated fallbacks instead of forcing one model.",
    icon: LineChart,
    tone: "forecast"
  },
  {
    capability: "Target workflow",
    eyebrow: "05 / Inventory-aware decision",
    shortTitle: "Decision",
    title: "Demand meets inventory context.",
    description:
      "A planned decision layer can translate forecast demand and stock context into a base replenishment need.",
    icon: BarChart3,
    tone: "target"
  },
  {
    capability: "Target workflow",
    eyebrow: "06 / Owner review and approval",
    shortTitle: "Review",
    title: "The owner remains in control.",
    description:
      "A planned review step keeps every recommendation visible, adjustable, and explicitly approved.",
    icon: ClipboardCheck,
    tone: "target"
  },
  {
    capability: "Target workflow",
    eyebrow: "07 / Restock and supply action",
    shortTitle: "Restock",
    title: "An approved decision returns to operations.",
    description:
      "A planned supply workflow can track the handoff without implying supplier automation exists today.",
    icon: Warehouse,
    tone: "target"
  }
];

const monthSeries = [42, 38, 46, 53, 49, 61, 58, 67, 72, 64, 78, 84];
const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];
const monthPoints = monthSeries
  .map((value, index) => `${44 + index * 50},${158 - (value - 34) * 2.05}`)
  .join(" ");

const historyDots = [
  [44, 155],
  [82, 134],
  [120, 94],
  [158, 116],
  [196, 151],
  [234, 126],
  [272, 77],
  [310, 98],
  [348, 137],
  [386, 107]
] as const;

const forecastDiamonds = [
  [386, 107],
  [428, 67],
  [470, 84],
  [512, 127],
  [554, 99],
  [596, 50],
  [638, 70]
] as const;

function CapabilityBadge({ stage }: { stage: IntelligenceStage }) {
  return (
    <span
      className="story-intelligence__capability"
      data-kind={stage.tone === "target" ? "target" : "live"}
    >
      <i aria-hidden="true" />
      {stage.capability}
    </span>
  );
}

function SaleVisual() {
  return (
    <div
      className="intelligence-sale intelligence-visual"
      role="group"
      aria-label="Illustrative completed POS transaction"
    >
      <div className="intelligence-sale__scan" data-intelligence-build>
        <span className="intelligence-artifact-label">Illustrative transaction</span>
        <ScanBarcode aria-hidden="true" />
        <strong>4800 1328 1502</strong>
        <small>Barcode scanned</small>
        <div className="intelligence-sale__scanline" aria-hidden="true" data-intelligence-line />
      </div>

      <div
        className="intelligence-sale__route"
        aria-label="Barcode scan, product match, then sale recorded"
        data-intelligence-build
      >
        <span>Scan</span>
        <ArrowRight aria-hidden="true" />
        <span>Match</span>
        <ArrowRight aria-hidden="true" />
        <span>Recorded</span>
      </div>

      <div className="intelligence-sale__receipt" data-intelligence-build>
        <header>
          <span>YSABELLE POS</span>
          <span className="intelligence-status intelligence-status--live">
            <Check aria-hidden="true" /> Completed
          </span>
        </header>
        <div>
          <span>
            <strong>Classic Cola 1.5L</strong>
            <small>Qty 2 x {"\u20b1"}28.00</small>
          </span>
          <b>{"\u20b1"}56.00</b>
        </div>
        <footer>
          <span>Sale recorded</span>
          <strong>Total {"\u20b1"}56.00</strong>
        </footer>
      </div>
    </div>
  );
}

function StockVisual() {
  return (
    <div
      className="intelligence-stock intelligence-visual"
      role="group"
      aria-label="Illustrative stock update from 24 units to 22 units"
    >
      <div className="intelligence-stock__summary" data-intelligence-build>
        <span className="intelligence-artifact-label">Illustrative stock movement</span>
        <div className="intelligence-stock__equation" aria-label="24 minus 2 equals 22">
          <span>
            <small>Before</small>
            <strong>24</strong>
          </span>
          <b>-</b>
          <span className="is-sale">
            <small>Sold</small>
            <strong>2</strong>
          </span>
          <b>=</b>
          <span className="is-result">
            <small>Usable</small>
            <strong>22</strong>
          </span>
        </div>
      </div>
      <div
        className="intelligence-stock__units"
        aria-label="Twenty-four stock units with two sold units highlighted"
        data-intelligence-build
      >
        {Array.from({ length: 24 }, (_, index) => (
          <i className={index > 21 ? "is-sold" : ""} key={index} />
        ))}
      </div>
      <div className="intelligence-stock__movement" data-intelligence-build>
        <span>
          <Boxes aria-hidden="true" /> Inventory movement
        </span>
        <strong>-2 units</strong>
        <small>Completed POS sale</small>
      </div>
    </div>
  );
}

function HistoryVisual() {
  return (
    <div className="intelligence-history intelligence-visual">
      <div className="intelligence-history__event" data-intelligence-build>
        <ShoppingBasket aria-hidden="true" />
        <span>
          <small>Completed transactions</small>
          <strong>Grouped by product and month</strong>
        </span>
        <ArrowDown aria-hidden="true" />
      </div>
      <figure data-intelligence-build>
        <figcaption>
          <span>
            <strong>Jan-Dec demand</strong>
            <small>Illustrative monthly units sold</small>
          </span>
          <span className="intelligence-status intelligence-status--live">Complete months</span>
        </figcaption>
        <svg
          role="img"
          aria-label="Illustrative January through December monthly demand line chart"
          viewBox="0 0 640 190"
        >
          {[50, 90, 130, 170].map((y) => (
            <line className="chart-grid" key={y} x1="40" x2="608" y1={y} y2={y} />
          ))}
          <polyline
            className="intelligence-history__area"
            points={`44,170 ${monthPoints} 594,170`}
          />
          <polyline
            className="intelligence-history__line"
            data-intelligence-chart-path
            points={monthPoints}
          />
          {monthSeries.map((value, index) => (
            <circle
              className="intelligence-chart-dot"
              cx={44 + index * 50}
              cy={158 - (value - 34) * 2.05}
              key={monthLabels[index]}
              r="4"
            />
          ))}
          {monthLabels.map((month, index) => (
            <text key={month} x={44 + index * 50} y="184">
              {month}
            </text>
          ))}
        </svg>
      </figure>
    </div>
  );
}

function ForecastVisual() {
  return (
    <div className="intelligence-sarima intelligence-visual">
      <div className="intelligence-sarima__facts" data-intelligence-build>
        <span>
          <strong>24+</strong>
          <small>complete months</small>
        </span>
        <span>
          <strong>12</strong>
          <small>month seasonality</small>
        </span>
        <span>
          <strong>Chronological</strong>
          <small>validation</small>
        </span>
        <span>
          <strong>MAE / MAPE / RMSE</strong>
          <small>accuracy report</small>
        </span>
      </div>
      <figure data-intelligence-build>
        <figcaption>
          <span>
            <i className="is-history" /> Historical, solid with circles
          </span>
          <span>
            <i className="is-forecast" /> Forecast, dashed with diamonds
          </span>
        </figcaption>
        <svg
          role="img"
          aria-label="Historical sales shown as a solid line with circles and forecast demand shown as a dashed line with diamonds"
          viewBox="0 0 680 190"
        >
          {[45, 85, 125, 165].map((y) => (
            <line className="chart-grid" key={y} x1="36" x2="648" y1={y} y2={y} />
          ))}
          <path
            className="intelligence-sarima__history"
            data-intelligence-chart-path
            d="M44 155 C78 136 88 118 120 94 S170 125 196 151 S244 122 272 77 S326 112 348 137 S372 121 386 107"
          />
          <path
            className="intelligence-sarima__forecast"
            data-intelligence-chart-path
            d="M386 107 C414 82 420 65 428 67 S460 76 470 84 S502 119 512 127 S544 107 554 99 S582 57 596 50 S624 63 638 70"
          />
          <line className="intelligence-sarima__divider" x1="386" x2="386" y1="30" y2="166" />
          <text className="is-period-label" x="48" y="24">
            Observed history
          </text>
          <text className="is-period-label" x="408" y="24">
            12-month horizon
          </text>
          {historyDots.map(([x, y]) => (
            <circle
              className="intelligence-sarima__history-dot"
              cx={x}
              cy={y}
              key={`${x}-${y}`}
              r="3.7"
            />
          ))}
          {forecastDiamonds.map(([x, y]) => (
            <rect
              className="intelligence-sarima__forecast-dot"
              height="7"
              key={`${x}-${y}`}
              transform={`rotate(45 ${x} ${y})`}
              width="7"
              x={x - 3.5}
              y={y - 3.5}
            />
          ))}
        </svg>
      </figure>
      <p data-intelligence-build>SARIMA is a seasonal statistical model, not a generic AI label.</p>
    </div>
  );
}

function DecisionVisual() {
  const inputs = [
    ["Forecast demand", "48"],
    ["Safety stock", "+ 8"],
    ["Usable stock", "- 22"],
    ["Confirmed incoming", "- 6"]
  ];

  return (
    <div
      className="intelligence-decision intelligence-visual"
      role="group"
      aria-label="Illustrative planned inventory-aware calculation"
    >
      <span className="intelligence-artifact-label" data-intelligence-build>
        Illustrative planning example / not implemented
      </span>
      <div className="intelligence-decision__engine">
        <div className="intelligence-decision__inputs">
          {inputs.map(([label, value]) => (
            <div data-intelligence-build key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="intelligence-decision__lines" aria-hidden="true" data-intelligence-build>
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="intelligence-decision__result" data-intelligence-build>
          <TrendingUp aria-hidden="true" />
          <span>
            <small>Base need</small>
            <strong>28</strong>
            <em>units</em>
          </span>
        </div>
      </div>
      <p data-intelligence-build>
        <strong>Planned computation:</strong> forecast + safety stock - usable stock - incoming =
        base need.
      </p>
    </div>
  );
}

function OwnerVisual() {
  return (
    <div className="intelligence-owner intelligence-visual">
      <span className="intelligence-artifact-label" data-intelligence-build>
        Illustrative review / target workflow
      </span>
      <div className="intelligence-owner__review" data-intelligence-build>
        <header>
          <span>
            <TrendingUp aria-hidden="true" />
            <span>
              <small>Recommendation</small>
              <strong>Classic Cola 1.5L</strong>
            </span>
          </span>
          <span className="intelligence-status intelligence-status--target">Awaiting owner</span>
        </header>
        <div className="intelligence-owner__row">
          <span>
            <small>Suggested quantity</small>
            <strong>28 units</strong>
          </span>
          <span>
            <small>Owner adjustment</small>
            <span className="intelligence-owner__stepper">
              <i>-</i>
              <b>28</b>
              <i>+</i>
            </span>
          </span>
          <span>
            <small>Decision</small>
            <strong>Review required</strong>
          </span>
        </div>
        <footer aria-label="Illustrative owner controls">
          <span>
            <SlidersHorizontal aria-hidden="true" /> Adjust
          </span>
          <span className="is-approved">
            <Check aria-hidden="true" /> Approve 28
          </span>
        </footer>
      </div>
      <p data-intelligence-build>
        Decision support stays reviewable. No replenishment action is automatic.
      </p>
    </div>
  );
}

function RestockVisual() {
  const statuses = [
    ["Draft", ClipboardCheck],
    ["Approved", Check],
    ["Sent", ArrowRight],
    ["Incoming", Warehouse],
    ["Received", PackageCheck]
  ] as const;

  return (
    <div className="intelligence-restock intelligence-visual">
      <span className="intelligence-artifact-label" data-intelligence-build>
        Planned supply workflow concept
      </span>
      <div className="intelligence-restock__flow" data-intelligence-build>
        {statuses.map(([label, Icon], index) => (
          <div className={index < 2 ? "is-ready" : ""} key={label}>
            <span>
              <Icon aria-hidden="true" />
            </span>
            <strong>{label}</strong>
            <small>{String(index + 1).padStart(2, "0")}</small>
          </div>
        ))}
      </div>
      <div className="intelligence-restock__return" data-intelligence-build>
        <PackageCheck aria-hidden="true" />
        <span>
          <small>Once received</small>
          <strong>Return to inventory visibility</strong>
        </span>
        <ArrowRight aria-hidden="true" />
        <Boxes aria-hidden="true" />
      </div>
      <p data-intelligence-build>
        Supplier integrations are not implemented; this shows the intended owner-controlled status
        path.
      </p>
    </div>
  );
}

function StageVisual({ index }: { index: number }) {
  if (index === 0) return <SaleVisual />;
  if (index === 1) return <StockVisual />;
  if (index === 2) return <HistoryVisual />;
  if (index === 3) return <ForecastVisual />;
  if (index === 4) return <DecisionVisual />;
  if (index === 5) return <OwnerVisual />;
  return <RestockVisual />;
}

export function SystemIntelligenceScene() {
  const sceneRef = useRef<HTMLElement>(null);

  useEffect(() => {
    sceneRef.current?.dispatchEvent(new CustomEvent("story:intelligence-ready", { bubbles: true }));
  }, []);

  return (
    <section className="story-scene story-intelligence" id="discover-smarter" ref={sceneRef}>
      <div className="customer-container story-intelligence__stage" data-story-motion>
        <div className="story-intelligence__heading">
          <span className="story-kicker">05 / System intelligence</span>
          <div className="story-intelligence__heading-grid">
            <h2 className="story-display-safe">
              <span className="story-mask">
                <span className="story-mask__line">Sales Become Signals.</span>
              </span>
              <span className="story-mask">
                <span className="story-mask__line story-mask__line--mint">
                  SARIMA Finds the Season.
                </span>
              </span>
            </h2>
            <p>
              Validated seasonal forecasting transforms historical grocery demand into
              decision-support for inventory planning.
            </p>
          </div>
        </div>

        <div className="story-intelligence__system">
          <aside className="story-intelligence__index" aria-label="Retail intelligence stages">
            <header>
              <span>Signal path</span>
              <strong>01-07</strong>
            </header>
            <div className="story-intelligence__rail">
              <span aria-hidden="true" className="story-intelligence__track" />
              <span aria-hidden="true" className="story-intelligence__progress" />
              <ol>
                {stages.map(({ icon: Icon, shortTitle, title }, index) => (
                  <li className="story-intelligence__step" data-intelligence-step key={title}>
                    <span>
                      <Icon aria-hidden="true" />
                    </span>
                    <small>{String(index + 1).padStart(2, "0")}</small>
                    <strong>{shortTitle}</strong>
                  </li>
                ))}
              </ol>
            </div>
            <footer>
              <i aria-hidden="true" /> Implemented <i aria-hidden="true" /> Target
            </footer>
          </aside>

          <div className="story-intelligence__console">
            <header className="story-intelligence__console-bar">
              <span>
                <i />
                <i />
                <i />
              </span>
              <strong>YS / RETAIL SIGNAL SYSTEM</strong>
              <small>Product-level monthly demand</small>
            </header>

            <div className="story-intelligence__panels">
              {stages.map((stage, index) => {
                const Icon = stage.icon;
                return (
                  <article
                    className={`story-intelligence__panel story-intelligence__panel--${index + 1}`}
                    data-intelligence-panel
                    data-tone={stage.tone}
                    key={stage.title}
                  >
                    <header>
                      <span className="story-intelligence__panel-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <div>
                        <small>{stage.eyebrow}</small>
                        <h3>{stage.title}</h3>
                      </div>
                      <CapabilityBadge stage={stage} />
                    </header>
                    <p>{stage.description}</p>
                    <StageVisual index={index} />
                  </article>
                );
              })}
            </div>

            <footer className="story-intelligence__boundary">
              <span>
                <i /> Live system
              </span>
              <strong>Forecasting and inventory events are implemented.</strong>
              <span>
                <i /> Target layer
              </span>
              <strong>Recommendations, approval, and supply workflow are planned.</strong>
            </footer>
          </div>
        </div>
      </div>
      <span aria-hidden="true" className="story-intelligence__handoff" />
    </section>
  );
}
