import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  Database,
  LineChart,
  MousePointerClick,
  ShoppingBasket,
  Warehouse,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type PreviewStage = {
  description: string;
  icon: LucideIcon;
  id: string;
  label: string;
  status: string;
  title: string;
};

const previewStages: PreviewStage[] = [
  {
    id: "sale",
    label: "Sale",
    title: "Completed sale",
    description: "A finished POS transaction becomes a traceable sales record.",
    icon: ShoppingBasket,
    status: "Live module"
  },
  {
    id: "stock",
    label: "Stock",
    title: "Inventory movement",
    description: "The same sale updates usable inventory and stock visibility.",
    icon: Boxes,
    status: "Live module"
  },
  {
    id: "history",
    label: "History",
    title: "Monthly sales history",
    description: "Completed transactions resolve into clean product-month observations.",
    icon: Database,
    status: "Live module"
  },
  {
    id: "forecast",
    label: "Forecast",
    title: "Forecast intelligence",
    description: "Historical demand extends into a seasonal forward-looking view.",
    icon: LineChart,
    status: "Live module"
  },
  {
    id: "decision",
    label: "Decision",
    title: "Restock decision support",
    description:
      "Forecast and inventory context are summarized into a reviewable replenishment signal.",
    icon: BarChart3,
    status: "Decision support"
  },
  {
    id: "review",
    label: "Review",
    title: "Owner review",
    description: "Recommendations remain visible and reviewable before operational action.",
    icon: ClipboardCheck,
    status: "Owner controlled"
  },
  {
    id: "restock",
    label: "Restock",
    title: "Restock pipeline",
    description: "Approved replenishment can be followed through receiving and inventory updates.",
    icon: Warehouse,
    status: "Live module"
  }
];

const historySeries = [42, 38, 46, 53, 49, 61, 58, 67, 72, 64, 78, 84];
const historyPoints = historySeries
  .map((value, index) => `${36 + index * 48},${152 - (value - 34) * 1.95}`)
  .join(" ");

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="system-preview__metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

function SalePanel() {
  return (
    <div className="system-preview__body">
      <div className="system-preview__metrics">
        <Metric label="Today's sales" value="₱2,993.00" note="Demo value" />
        <Metric label="Transactions" value="3" />
        <Metric label="Units sold" value="50" />
      </div>

      <div className="system-preview__table-card">
        <div className="system-preview__card-head">
          <div>
            <span>Recent POS activity</span>
            <strong>Completed transaction</strong>
          </div>
          <span className="system-preview__badge system-preview__badge--live">Completed</span>
        </div>
        <div className="system-preview__table system-preview__table--sale">
          <span>Product</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span>Total</span>
          <span>Status</span>
          <strong>Classic Cola 1.5L</strong>
          <strong>2</strong>
          <strong>₱28.00</strong>
          <strong>₱56.00</strong>
          <strong>Recorded</strong>
        </div>
      </div>
    </div>
  );
}

function StockPanel() {
  return (
    <div className="system-preview__body">
      <div className="system-preview__metrics">
        <Metric label="Available items" value="53" />
        <Metric label="Low stock" value="0" note="No immediate alerts" />
        <Metric label="Near expiry" value="0" />
      </div>

      <div className="system-preview__table-card">
        <div className="system-preview__card-head">
          <div>
            <span>Inventory movement</span>
            <strong>Classic Cola 1.5L</strong>
          </div>
          <span className="system-preview__badge">Sale posted</span>
        </div>
        <div className="system-preview__inventory-row">
          <div>
            <span>Before</span>
            <strong>24</strong>
          </div>
          <div>
            <span>Sold</span>
            <strong>−2</strong>
          </div>
          <div>
            <span>Usable stock</span>
            <strong>22</strong>
          </div>
          <div className="system-preview__stock-bar">
            <i style={{ width: "91.6%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryPanel() {
  return (
    <div className="system-preview__body">
      <div className="system-preview__metrics">
        <Metric label="Complete months" value="12" />
        <Metric label="Latest month" value="84 units" />
        <Metric label="Year trend" value="+8.3%" />
      </div>

      <figure className="system-preview__chart-card">
        <figcaption>
          <div>
            <span>Monthly sales history</span>
            <strong>Classic Cola 1.5L</strong>
          </div>
          <span className="system-preview__badge">Product-month view</span>
        </figcaption>
        <svg viewBox="0 0 590 190" role="img" aria-label="Illustrative monthly sales history">
          {[48, 88, 128, 168].map((y) => (
            <line className="system-preview__gridline" key={y} x1="34" x2="566" y1={y} y2={y} />
          ))}
          <polyline className="system-preview__history-line" points={historyPoints} />
          {historySeries.map((value, index) => (
            <circle
              className="system-preview__history-dot"
              cx={36 + index * 48}
              cy={152 - (value - 34) * 1.95}
              key={index}
              r="3.5"
            />
          ))}
        </svg>
        <div className="system-preview__chart-labels">
          <span>Jan</span>
          <span>Mar</span>
          <span>May</span>
          <span>Jul</span>
          <span>Sep</span>
          <span>Nov</span>
          <span>Dec</span>
        </div>
      </figure>
    </div>
  );
}

function ForecastPanel() {
  return (
    <div className="system-preview__body">
      <div className="system-preview__metrics">
        <Metric label="Forecast horizon" value="12 months" />
        <Metric label="Forecast units" value="3,226" />
        <Metric label="Seasonality" value="Detected" />
      </div>

      <figure className="system-preview__chart-card">
        <figcaption>
          <div>
            <span>Demand outlook</span>
            <strong>Observed history → forecast</strong>
          </div>
          <div className="system-preview__legend">
            <span>
              <i className="is-history" />
              History
            </span>
            <span>
              <i className="is-forecast" />
              Forecast
            </span>
          </div>
        </figcaption>
        <svg
          viewBox="0 0 590 190"
          role="img"
          aria-label="Illustrative historical demand and SARIMA forecast"
        >
          <defs>
            <linearGradient id="systemForecastBand" x1="0" x2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {[48, 88, 128, 168].map((y) => (
            <line className="system-preview__gridline" key={y} x1="34" x2="566" y1={y} y2={y} />
          ))}
          <path
            className="system-preview__forecast-band"
            d="M342 104 C394 78 445 65 500 60 C529 57 548 51 566 43 L566 105 C538 111 512 114 488 116 C440 120 390 133 342 151 Z"
            fill="url(#systemForecastBand)"
          />
          <path
            className="system-preview__history-path"
            d="M36 144 C86 131 130 114 176 119 S250 84 296 94 S323 108 342 111"
          />
          <path
            className="system-preview__forecast-path"
            d="M342 111 C388 94 420 77 456 72 S518 67 566 51"
          />
          <line className="system-preview__divider" x1="342" x2="342" y1="36" y2="164" />
        </svg>
        <div className="system-preview__chart-labels">
          <span>Observed</span>
          <span>Forecast starts</span>
          <span>+3 mo</span>
          <span>+6 mo</span>
          <span>+9 mo</span>
          <span>+12 mo</span>
        </div>
      </figure>
    </div>
  );
}

function DecisionPanel() {
  const rows = [
    ["Forecast demand", "48"],
    ["Usable inventory", "22"],
    ["Confirmed incoming", "6"],
    ["Safety buffer", "8"]
  ];

  return (
    <div className="system-preview__body system-preview__body--decision">
      <div className="system-preview__recommendation">
        <div className="system-preview__card-head">
          <div>
            <span>Restock recommendation</span>
            <strong>Classic Cola 1.5L</strong>
          </div>
          <span className="system-preview__badge">Decision support</span>
        </div>
        <div className="system-preview__decision-grid">
          <div className="system-preview__decision-inputs">
            {rows.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="system-preview__decision-result">
            <span>Recommended restock</span>
            <strong>
              28 <small>units</small>
            </strong>
            <p>
              Projected demand exceeds available inventory during the next replenishment window.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewPanel() {
  const [decision, setDecision] = useState<"adjusted" | "approved" | "hold" | "ready">("ready");
  const [adjustedQuantity, setAdjustedQuantity] = useState(30);

  const statusLabel =
    decision === "approved"
      ? "Approved"
      : decision === "hold"
        ? "On hold"
        : decision === "adjusted"
          ? "Adjusted"
          : "Review required";

  const decisionLabel =
    decision === "approved"
      ? `Approved · ${adjustedQuantity} units`
      : decision === "hold"
        ? "Held for review"
        : decision === "adjusted"
          ? `Adjusted to ${adjustedQuantity} units`
          : "Ready for approval";

  const handleAdjust = () => {
    setAdjustedQuantity((current) => (current === 30 ? 28 : 30));
    setDecision("adjusted");
  };

  return (
    <div className="system-preview__body">
      <div className="system-preview__review-card">
        <div className="system-preview__card-head">
          <div>
            <span>Owner review</span>
            <strong>Restock recommendation</strong>
          </div>
          <span
            className={[
              "system-preview__badge",
              "system-preview__badge--review",
              decision === "approved" ? "is-approved" : "",
              decision === "hold" ? "is-held" : ""
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {statusLabel}
          </span>
        </div>
        <div className="system-preview__review-summary">
          <div>
            <span>Product</span>
            <strong>Classic Cola 1.5L</strong>
          </div>
          <div>
            <span>Suggested quantity</span>
            <strong>28 units</strong>
          </div>
          <div>
            <span>Owner adjustment</span>
            <strong>{adjustedQuantity} units</strong>
          </div>
          <div>
            <span>Decision</span>
            <strong>{decisionLabel}</strong>
          </div>
        </div>
        <div className="system-preview__actions" aria-label="Interactive demo review actions">
          <button
            aria-pressed={decision === "adjusted"}
            className={decision === "adjusted" ? "is-selected" : ""}
            onClick={handleAdjust}
            type="button"
          >
            Adjust
          </button>
          <button
            aria-pressed={decision === "approved"}
            className={decision === "approved" ? "is-primary is-selected" : "is-primary"}
            onClick={() => setDecision("approved")}
            type="button"
          >
            Approve {adjustedQuantity}
          </button>
          <button
            aria-pressed={decision === "hold"}
            className={decision === "hold" ? "is-selected" : ""}
            onClick={() => setDecision("hold")}
            type="button"
          >
            Hold
          </button>
        </div>
        <p className="system-preview__action-feedback" role="status">
          {decision === "approved"
            ? "Demo approved. No live restock order was created."
            : decision === "hold"
              ? "Demo recommendation placed on hold."
              : decision === "adjusted"
                ? "Quantity adjusted for this preview only."
                : "Try the controls — this is an interactive public demo."}
        </p>
      </div>
    </div>
  );
}

function RestockPanel() {
  const steps = ["Draft", "Approved", "Sent", "Incoming", "Received"];

  return (
    <div className="system-preview__body">
      <div className="system-preview__metrics">
        <Metric label="Ready" value="1" />
        <Metric label="Drafts" value="1" />
        <Metric label="Open" value="2" />
      </div>

      <div className="system-preview__table-card">
        <div className="system-preview__card-head">
          <div>
            <span>Restock order</span>
            <strong>RO-OCT-2026</strong>
          </div>
          <span className="system-preview__badge">Demo order</span>
        </div>
        <div className="system-preview__order-meta">
          <div>
            <span>Requested units</span>
            <strong>30</strong>
          </div>
          <div>
            <span>Received</span>
            <strong>0%</strong>
          </div>
          <div>
            <span>Source</span>
            <strong>Forecast-driven plan</strong>
          </div>
        </div>
        <div className="system-preview__status-track">
          {steps.map((step, index) => (
            <div className={index < 2 ? "is-done" : index === 2 ? "is-current" : ""} key={step}>
              <i />
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StageContent({ stageIndex }: { stageIndex: number }) {
  if (stageIndex === 0) return <SalePanel />;
  if (stageIndex === 1) return <StockPanel />;
  if (stageIndex === 2) return <HistoryPanel />;
  if (stageIndex === 3) return <ForecastPanel />;
  if (stageIndex === 4) return <DecisionPanel />;
  if (stageIndex === 5) return <ReviewPanel />;
  return <RestockPanel />;
}

export function SystemIntelligenceScene({
  hideSectionNumber = false
}: {
  hideSectionNumber?: boolean;
}) {
  const sceneRef = useRef<HTMLElement>(null);
  const hasStageInteractionRef = useRef(false);
  const [activeStage, setActiveStage] = useState(0);
  const [showStageHint, setShowStageHint] = useState(false);
  const stage = previewStages[activeStage]!;
  const StageIcon = stage.icon;

  const activeLabel = useMemo(
    () => `${String(activeStage + 1).padStart(2, "0")} / ${stage.label}`,
    [activeStage, stage.label]
  );

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const handleStageHint = () => {
      if (!hasStageInteractionRef.current) setShowStageHint(true);
    };

    scene.addEventListener("story:intelligence-hint", handleStageHint);
    scene.dispatchEvent(new CustomEvent("story:intelligence-ready", { bubbles: true }));

    return () => scene.removeEventListener("story:intelligence-hint", handleStageHint);
  }, []);

  const selectStage = (index: number) => {
    hasStageInteractionRef.current = true;
    setShowStageHint(false);
    setActiveStage(index);
  };

  return (
    <section
      className="story-scene story-intelligence story-intelligence--interactive"
      id="discover-smarter"
      ref={sceneRef}
    >
      <div className="customer-container story-intelligence__stage" data-story-motion>
        <div className="story-intelligence__heading">
          <span className="story-kicker">
            {hideSectionNumber ? "System intelligence" : "05 / System intelligence"}
          </span>
          <div className="story-intelligence__heading-grid">
            <h2 className="story-display-safe">
              <span className="story-mask">
                <span className="story-mask__line">Sales Become Signals.</span>
              </span>
              <span className="story-mask">
                <span className="story-mask__line story-mask__line--mint">
                  One System, Clearer Decisions.
                </span>
              </span>
            </h2>
            <p>
              Explore how commerce, inventory, forecasting, and replenishment connect inside one
              retail operating system.
            </p>
          </div>
        </div>

        <div className="system-preview">
          <aside className="system-preview__nav" aria-label="System intelligence preview">
            <header>
              <span>System flow</span>
              <strong>{String(activeStage + 1).padStart(2, "0")} / 07</strong>
            </header>

            <ol>
              {previewStages.map(({ icon: Icon, label, title }, index) => (
                <li className={index === 0 ? "system-preview__first-stage" : undefined} key={title}>
                  <button
                    aria-current={index === activeStage ? "step" : undefined}
                    aria-describedby={
                      index === 0 && showStageHint ? "system-preview-stage-hint" : undefined
                    }
                    className={[
                      index === activeStage ? "is-active" : "",
                      index === 0 && showStageHint ? "is-hint-target" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => selectStage(index)}
                    type="button"
                  >
                    <span className="system-preview__nav-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <small>{String(index + 1).padStart(2, "0")}</small>
                    <strong>{label}</strong>
                  </button>

                  {index === 0 && showStageHint ? (
                    <div
                      className="system-preview__coachmark"
                      id="system-preview-stage-hint"
                      role="status"
                    >
                      <MousePointerClick aria-hidden="true" />
                      <span>
                        <strong>Click a stage</strong>
                        <small>Preview it on the right</small>
                      </span>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>

            <p>Each stage updates the workspace on the right.</p>
          </aside>

          <div className="system-preview__workspace">
            <header className="system-preview__workspace-bar">
              <div>
                <span className="system-preview__workspace-icon">
                  <StageIcon aria-hidden="true" />
                </span>
                <span>
                  <small>{activeLabel}</small>
                  <strong>{stage.title}</strong>
                </span>
              </div>
              <span className="system-preview__status">{stage.status}</span>
            </header>

            <div className="system-preview__workspace-copy">
              <p>{stage.description}</p>
              <span>Illustrative public preview</span>
            </div>

            <div className="system-preview__content" key={stage.id}>
              <StageContent stageIndex={activeStage} />
            </div>

            <footer className="system-preview__workspace-footer">
              <span>Ysabelle Store · System intelligence preview</span>
              <span>Demo values only</span>
            </footer>
          </div>
        </div>
      </div>
    </section>
  );
}
