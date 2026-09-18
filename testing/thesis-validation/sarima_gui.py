from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import tkinter as tk
    from tkinter import messagebox, ttk
except ImportError as exc:  # pragma: no cover - depends on local Python distribution.
    raise SystemExit(
        "Tkinter is required for the thesis SARIMA desktop viewer. "
        "Use a Python installation that includes Tcl/Tk."
    ) from exc

import pandas as pd
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg, NavigationToolbar2Tk
from matplotlib.figure import Figure


@dataclass
class Evidence:
    evidence_dir: Path
    summary: pd.Series
    product_metrics: pd.DataFrame
    detailed: pd.DataFrame
    exclusions: pd.DataFrame
    metadata: dict[str, Any]
    export_metadata: dict[str, Any]
    report_text: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Open the YsabelleStore SARIMA thesis validation desktop dashboard."
    )
    parser.add_argument(
        "--evidence",
        default="testing/thesis-validation/evidence/sarima",
        help="Directory containing SARIMA validation evidence.",
    )
    return parser.parse_args()


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def load_evidence(evidence_dir: Path) -> Evidence:
    required = {
        "summary_metrics.csv",
        "product_metrics.csv",
        "detailed_calculations.csv",
        "validation_metadata.json",
        "validation_report.txt",
    }
    missing = sorted(name for name in required if not (evidence_dir / name).exists())
    if missing:
        raise FileNotFoundError(
            "Missing SARIMA evidence file(s): " + ", ".join(missing)
        )

    summary_frame = pd.read_csv(evidence_dir / "summary_metrics.csv")
    if summary_frame.empty:
        raise ValueError("summary_metrics.csv is empty.")

    product_metrics = pd.read_csv(evidence_dir / "product_metrics.csv")
    detailed = pd.read_csv(evidence_dir / "detailed_calculations.csv")
    exclusions_path = evidence_dir / "excluded_products.csv"
    exclusions = (
        pd.read_csv(exclusions_path)
        if exclusions_path.exists()
        else pd.DataFrame(columns=["product_id", "product_name", "reason"])
    )
    metadata = _read_json(evidence_dir / "validation_metadata.json")

    validation_root = evidence_dir.parent.parent
    export_metadata = _read_json(validation_root / "data" / "export_metadata.json")

    return Evidence(
        evidence_dir=evidence_dir,
        summary=summary_frame.iloc[0],
        product_metrics=product_metrics,
        detailed=detailed,
        exclusions=exclusions,
        metadata=metadata,
        export_metadata=export_metadata,
        report_text=(evidence_dir / "validation_report.txt").read_text(encoding="utf-8"),
    )


class SarimaDashboard:
    def __init__(self, root: tk.Tk, evidence: Evidence) -> None:
        self.root = root
        self.evidence = evidence
        self.product_metrics = evidence.product_metrics.copy()
        self.detailed = evidence.detailed.copy()

        self.root.title("YsabelleStore — SARIMA Thesis Validation")
        self.root.geometry("1320x860")
        self.root.minsize(1100, 720)

        self.style = ttk.Style()
        self.style.configure("Title.TLabel", font=("Segoe UI", 18, "bold"))
        self.style.configure("Subtitle.TLabel", font=("Segoe UI", 10))
        self.style.configure("MetricName.TLabel", font=("Segoe UI", 10))
        self.style.configure("MetricValue.TLabel", font=("Segoe UI", 22, "bold"))
        self.style.configure("Section.TLabel", font=("Segoe UI", 12, "bold"))
        self.style.configure("Status.TLabel", font=("Segoe UI", 10, "bold"))

        self.selected_product = tk.StringVar()
        self.product_display_to_id: dict[str, str] = {}
        self.product_id_to_display: dict[str, str] = {}

        self._build_product_lookup()
        self._build_layout()
        self._set_initial_product()

    def _build_product_lookup(self) -> None:
        rows = self.product_metrics.sort_values(["product_name", "product_id"])
        for _, row in rows.iterrows():
            product_id = str(row["product_id"])
            product_name = str(row["product_name"])
            display = f"{product_name} [{product_id}]"
            self.product_display_to_id[display] = product_id
            self.product_id_to_display[product_id] = display

    def _build_layout(self) -> None:
        outer = ttk.Frame(self.root, padding=16)
        outer.pack(fill="both", expand=True)

        header = ttk.Frame(outer)
        header.pack(fill="x", pady=(0, 10))
        ttk.Label(
            header,
            text="YsabelleStore SARIMA Forecast Accuracy",
            style="Title.TLabel",
        ).pack(anchor="w")

        protocol = self.evidence.metadata.get(
            "validation_protocol",
            "Chronological retrospective hold-out validation.",
        )
        ttk.Label(
            header,
            text=protocol,
            style="Subtitle.TLabel",
            wraplength=1200,
        ).pack(anchor="w", pady=(2, 0))

        self._build_metric_cards(outer)

        notebook = ttk.Notebook(outer)
        notebook.pack(fill="both", expand=True, pady=(12, 0))

        self.summary_tab = ttk.Frame(notebook, padding=12)
        self.forecast_tab = ttk.Frame(notebook, padding=12)
        self.residual_tab = ttk.Frame(notebook, padding=12)
        self.products_tab = ttk.Frame(notebook, padding=12)
        self.validation_tab = ttk.Frame(notebook, padding=12)

        notebook.add(self.summary_tab, text="Summary")
        notebook.add(self.forecast_tab, text="Actual vs Forecast")
        notebook.add(self.residual_tab, text="Residual Analysis")
        notebook.add(self.products_tab, text="Product Results")
        notebook.add(self.validation_tab, text="Validation Info")

        self._build_summary_tab()
        self._build_forecast_tab()
        self._build_residual_tab()
        self._build_products_tab()
        self._build_validation_tab()

        footer = ttk.Frame(outer)
        footer.pack(fill="x", pady=(10, 0))
        ttk.Label(
            footer,
            text=f"Evidence: {self.evidence.evidence_dir}",
            style="Subtitle.TLabel",
        ).pack(side="left")
        ttk.Button(footer, text="Close", command=self.root.destroy).pack(side="right")

    def _build_metric_cards(self, parent: ttk.Frame) -> None:
        cards = ttk.Frame(parent)
        cards.pack(fill="x")
        for index in range(3):
            cards.columnconfigure(index, weight=1)

        summary = self.evidence.summary
        values = [
            ("MAE", f"{float(summary['mae']):.4f}", "units of monthly quantity sold"),
            (
                "MAPE",
                "N/A" if pd.isna(summary["mape"]) else f"{float(summary['mape']):.4f}%",
                f"{int(summary['mape_valid_observations'])} valid observations",
            ),
            ("RMSE", f"{float(summary['rmse']):.4f}", "units of monthly quantity sold"),
        ]

        for column, (name, value, note) in enumerate(values):
            card = ttk.LabelFrame(cards, padding=14)
            card.grid(row=0, column=column, sticky="nsew", padx=6)
            ttk.Label(card, text=name, style="MetricName.TLabel").pack(anchor="w")
            ttk.Label(card, text=value, style="MetricValue.TLabel").pack(anchor="w", pady=(2, 0))
            ttk.Label(card, text=note, style="Subtitle.TLabel").pack(anchor="w")

    def _embed_figure(self, parent: ttk.Frame, figure: Figure) -> FigureCanvasTkAgg:
        canvas = FigureCanvasTkAgg(figure, master=parent)
        canvas.draw()
        canvas.get_tk_widget().pack(fill="both", expand=True)
        toolbar = NavigationToolbar2Tk(canvas, parent, pack_toolbar=False)
        toolbar.update()
        toolbar.pack(fill="x")
        return canvas

    def _build_summary_tab(self) -> None:
        summary = self.evidence.summary

        split = ttk.Panedwindow(self.summary_tab, orient="horizontal")
        split.pack(fill="both", expand=True)

        left = ttk.Frame(split)
        right = ttk.Frame(split)
        split.add(left, weight=1)
        split.add(right, weight=1)

        fig_units = Figure(figsize=(6, 4.5), dpi=100)
        ax_units = fig_units.add_subplot(111)
        labels = ["MAE", "RMSE"]
        values = [float(summary["mae"]), float(summary["rmse"])]
        bars = ax_units.bar(labels, values)
        ax_units.set_ylabel("Units of monthly quantity sold")
        ax_units.set_title("SARIMA Forecast Error — MAE and RMSE")
        ax_units.bar_label(bars, fmt="%.4f")
        fig_units.tight_layout()
        self._embed_figure(left, fig_units)

        fig_mape = Figure(figsize=(6, 4.5), dpi=100)
        ax_mape = fig_mape.add_subplot(111)
        if pd.isna(summary["mape"]):
            ax_mape.text(
                0.5,
                0.5,
                "MAPE unavailable\n(no non-zero actual observations)",
                ha="center",
                va="center",
            )
            ax_mape.set_axis_off()
        else:
            bars = ax_mape.bar(["MAPE"], [float(summary["mape"])])
            ax_mape.set_ylabel("Percentage error (%)")
            ax_mape.set_title("Mean Absolute Percentage Error")
            ax_mape.bar_label(bars, fmt="%.4f%%")
        fig_mape.tight_layout()
        self._embed_figure(right, fig_mape)

    def _product_selector(self, parent: ttk.Frame) -> ttk.Combobox:
        controls = ttk.Frame(parent)
        controls.pack(fill="x", pady=(0, 8))
        ttk.Label(controls, text="Product:", style="Section.TLabel").pack(side="left")
        selector = ttk.Combobox(
            controls,
            textvariable=self.selected_product,
            values=list(self.product_display_to_id.keys()),
            state="readonly",
            width=72,
        )
        selector.pack(side="left", padx=(8, 0))
        selector.bind("<<ComboboxSelected>>", self._on_product_changed)
        return selector

    def _build_forecast_tab(self) -> None:
        self._product_selector(self.forecast_tab)

        pane = ttk.Panedwindow(self.forecast_tab, orient="vertical")
        pane.pack(fill="both", expand=True)

        overall_frame = ttk.LabelFrame(pane, text="All Validated Products", padding=6)
        product_frame = ttk.LabelFrame(pane, text="Selected Product", padding=6)
        pane.add(overall_frame, weight=1)
        pane.add(product_frame, weight=1)

        overall = (
            self.detailed.groupby("period", as_index=False)[["actual", "forecast"]]
            .sum()
            .sort_values("period")
        )
        fig = Figure(figsize=(10, 3.6), dpi=100)
        ax = fig.add_subplot(111)
        ax.plot(overall["period"], overall["actual"], marker="o", label="Actual")
        ax.plot(overall["period"], overall["forecast"], marker="o", label="SARIMA Forecast")
        ax.set_ylabel("Aggregated quantity sold")
        ax.set_title("Actual vs Forecasted Demand")
        ax.legend()
        ax.tick_params(axis="x", rotation=30)
        fig.tight_layout()
        self._embed_figure(overall_frame, fig)

        self.product_forecast_figure = Figure(figsize=(10, 3.6), dpi=100)
        self.product_forecast_ax = self.product_forecast_figure.add_subplot(111)
        self.product_forecast_canvas = self._embed_figure(
            product_frame, self.product_forecast_figure
        )

    def _build_residual_tab(self) -> None:
        self._product_selector(self.residual_tab)

        pane = ttk.Panedwindow(self.residual_tab, orient="horizontal")
        pane.pack(fill="both", expand=True)

        product_frame = ttk.LabelFrame(pane, text="Selected Product Residuals", padding=6)
        distribution_frame = ttk.LabelFrame(pane, text="All Product-Month Residuals", padding=6)
        pane.add(product_frame, weight=1)
        pane.add(distribution_frame, weight=1)

        self.residual_figure = Figure(figsize=(6, 5), dpi=100)
        self.residual_ax = self.residual_figure.add_subplot(111)
        self.residual_canvas = self._embed_figure(product_frame, self.residual_figure)

        fig = Figure(figsize=(6, 5), dpi=100)
        ax = fig.add_subplot(111)
        residuals = self.detailed["residual"].astype(float)
        bins = min(20, max(5, len(residuals) // 100))
        ax.hist(residuals, bins=bins)
        ax.axvline(0, linewidth=1)
        ax.set_xlabel("Residual (Actual - Forecast)")
        ax.set_ylabel("Observation count")
        ax.set_title("Residual Distribution")
        fig.tight_layout()
        self._embed_figure(distribution_frame, fig)

    def _build_products_tab(self) -> None:
        controls = ttk.Frame(self.products_tab)
        controls.pack(fill="x", pady=(0, 8))

        ttk.Label(controls, text="Search:", style="Section.TLabel").pack(side="left")
        self.product_search = tk.StringVar()
        search = ttk.Entry(controls, textvariable=self.product_search, width=44)
        search.pack(side="left", padx=(8, 0))
        self.product_search.trace_add("write", lambda *_: self._refresh_product_table())

        columns = (
            "product",
            "category",
            "mae",
            "mape",
            "rmse",
            "order",
            "seasonal",
            "aic",
            "converged",
        )
        table_frame = ttk.Frame(self.products_tab)
        table_frame.pack(fill="both", expand=True)

        self.product_table = ttk.Treeview(
            table_frame,
            columns=columns,
            show="headings",
            height=20,
        )
        headings = {
            "product": "Product",
            "category": "Category",
            "mae": "MAE",
            "mape": "MAPE (%)",
            "rmse": "RMSE",
            "order": "Order",
            "seasonal": "Seasonal Order",
            "aic": "AIC",
            "converged": "Converged",
        }
        widths = {
            "product": 300,
            "category": 140,
            "mae": 85,
            "mape": 90,
            "rmse": 85,
            "order": 100,
            "seasonal": 140,
            "aic": 90,
            "converged": 85,
        }
        for column in columns:
            self.product_table.heading(column, text=headings[column])
            self.product_table.column(column, width=widths[column], anchor="w")

        scroll_y = ttk.Scrollbar(
            table_frame, orient="vertical", command=self.product_table.yview
        )
        scroll_x = ttk.Scrollbar(
            table_frame, orient="horizontal", command=self.product_table.xview
        )
        self.product_table.configure(
            yscrollcommand=scroll_y.set,
            xscrollcommand=scroll_x.set,
        )

        self.product_table.grid(row=0, column=0, sticky="nsew")
        scroll_y.grid(row=0, column=1, sticky="ns")
        scroll_x.grid(row=1, column=0, sticky="ew")
        table_frame.rowconfigure(0, weight=1)
        table_frame.columnconfigure(0, weight=1)

        self._refresh_product_table()

    def _build_validation_tab(self) -> None:
        stats = ttk.Frame(self.validation_tab)
        stats.pack(fill="x", pady=(0, 10))
        for index in range(4):
            stats.columnconfigure(index, weight=1)

        cards = [
            ("Validated products", self.evidence.metadata.get("successful_products", "N/A")),
            ("Excluded products", self.evidence.metadata.get("excluded_products", "N/A")),
            (
                "Held-out observations",
                self.evidence.summary.get("validated_product_month_observations", "N/A"),
            ),
            (
                "Forecast input",
                self.evidence.export_metadata.get("forecastInputSource", "N/A"),
            ),
        ]
        for index, (label, value) in enumerate(cards):
            frame = ttk.LabelFrame(stats, padding=10)
            frame.grid(row=0, column=index, sticky="nsew", padx=5)
            ttk.Label(frame, text=label, style="MetricName.TLabel").pack(anchor="w")
            ttk.Label(frame, text=str(value), style="Status.TLabel").pack(anchor="w")

        content = ttk.Panedwindow(self.validation_tab, orient="horizontal")
        content.pack(fill="both", expand=True)

        left = ttk.LabelFrame(content, text="Validation Report", padding=8)
        right = ttk.LabelFrame(content, text="Metadata", padding=8)
        content.add(left, weight=1)
        content.add(right, weight=1)

        report = tk.Text(left, wrap="word", font=("Consolas", 10))
        report.insert("1.0", self.evidence.report_text)
        report.configure(state="disabled")
        report.pack(fill="both", expand=True)

        metadata_text = (
            "VALIDATION METADATA\n"
            + json.dumps(self.evidence.metadata, indent=2)
            + "\n\nEXPORT METADATA\n"
            + json.dumps(self.evidence.export_metadata, indent=2)
        )
        metadata = tk.Text(right, wrap="word", font=("Consolas", 9))
        metadata.insert("1.0", metadata_text)
        metadata.configure(state="disabled")
        metadata.pack(fill="both", expand=True)

    def _set_initial_product(self) -> None:
        representative_id = str(
            self.evidence.metadata.get("representative_product_id", "")
        )
        display = self.product_id_to_display.get(representative_id)
        if not display and self.product_display_to_id:
            display = next(iter(self.product_display_to_id))
        if display:
            self.selected_product.set(display)
            self._update_selected_product_plots()

    def _on_product_changed(self, _event: tk.Event | None = None) -> None:
        self._update_selected_product_plots()

    def _selected_product_id(self) -> str | None:
        return self.product_display_to_id.get(self.selected_product.get())

    def _update_selected_product_plots(self) -> None:
        product_id = self._selected_product_id()
        if not product_id:
            return

        rows = self.detailed[self.detailed["product_id"].astype(str) == product_id].sort_values(
            "period"
        )
        if rows.empty:
            return

        product_name = str(rows.iloc[0]["product_name"])

        self.product_forecast_ax.clear()
        self.product_forecast_ax.plot(
            rows["period"], rows["actual"], marker="o", label="Actual"
        )
        self.product_forecast_ax.plot(
            rows["period"], rows["forecast"], marker="o", label="SARIMA Forecast"
        )
        self.product_forecast_ax.set_ylabel("Quantity sold")
        self.product_forecast_ax.set_title(f"Actual vs Forecast — {product_name}")
        self.product_forecast_ax.legend()
        self.product_forecast_ax.tick_params(axis="x", rotation=30)
        self.product_forecast_figure.tight_layout()
        self.product_forecast_canvas.draw_idle()

        self.residual_ax.clear()
        self.residual_ax.axhline(0, linewidth=1)
        self.residual_ax.plot(rows["period"], rows["residual"], marker="o")
        self.residual_ax.set_xlabel("Testing month")
        self.residual_ax.set_ylabel("Residual (Actual - Forecast)")
        self.residual_ax.set_title(f"Residual Behavior — {product_name}")
        self.residual_ax.tick_params(axis="x", rotation=30)
        self.residual_figure.tight_layout()
        self.residual_canvas.draw_idle()

    def _refresh_product_table(self) -> None:
        query = self.product_search.get().strip().lower() if hasattr(self, "product_search") else ""
        rows = self.product_metrics.sort_values(["product_name", "product_id"])
        if query:
            mask = (
                rows["product_name"].astype(str).str.lower().str.contains(query, regex=False)
                | rows["product_id"].astype(str).str.lower().str.contains(query, regex=False)
                | rows["category"].astype(str).str.lower().str.contains(query, regex=False)
            )
            rows = rows[mask]

        for item in self.product_table.get_children():
            self.product_table.delete(item)

        for _, row in rows.iterrows():
            mape = "N/A" if pd.isna(row["mape"]) else f"{float(row['mape']):.4f}"
            self.product_table.insert(
                "",
                "end",
                values=(
                    str(row["product_name"]),
                    str(row["category"]),
                    f"{float(row['mae']):.4f}",
                    mape,
                    f"{float(row['rmse']):.4f}",
                    str(row["order"]),
                    str(row["seasonal_order"]),
                    f"{float(row['aic']):.4f}",
                    str(row["converged"]),
                ),
            )


def main() -> int:
    args = parse_args()
    evidence_dir = Path(args.evidence).resolve()

    try:
        evidence = load_evidence(evidence_dir)
    except Exception as exc:  # noqa: BLE001 - user-facing startup validation.
        try:
            root = tk.Tk()
            root.withdraw()
            messagebox.showerror("SARIMA Validation Viewer", str(exc))
            root.destroy()
        finally:
            print(f"SARIMA GUI error: {exc}", file=sys.stderr)
        return 1

    root = tk.Tk()
    SarimaDashboard(root, evidence)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
