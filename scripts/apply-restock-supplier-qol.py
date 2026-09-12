from pathlib import Path

panel_path = Path("frontend/src/components/reports/RestockPlanningPanel.tsx")
panel = panel_path.read_text()

old_icons = '''  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PackagePlus,
  RefreshCw,
  Search,
  Settings2,
  Trash2
} from "lucide-react";'''
new_icons = '''  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  PackagePlus,
  Printer,
  RefreshCw,
  Search,
  Settings2,
  Trash2
} from "lucide-react";'''
if old_icons not in panel:
    raise SystemExit("Restock icon import marker not found")
panel = panel.replace(old_icons, new_icons, 1)

service_marker = '''} from "@/services/restockApi";
'''
utility_import = '''} from "@/services/restockApi";
import {
  downloadRestockSupplierCsv,
  printRestockSupplierCopy,
  type RestockSupplierSnapshot
} from "@/utils/restockExport";
'''
if service_marker not in panel:
    raise SystemExit("Restock service import marker not found")
panel = panel.replace(service_marker, utility_import, 1)

state_marker = '''  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(() => new Set());
'''
state_replacement = '''  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(() => new Set());
  const [supplierExportOpen, setSupplierExportOpen] = useState(false);
  const [supplierExportError, setSupplierExportError] = useState<string | null>(null);
'''
if state_marker not in panel:
    raise SystemExit("Supplier export state marker not found")
panel = panel.replace(state_marker, state_replacement, 1)

open_review_marker = '''  function openReview() {
'''
supplier_helpers = '''  function buildSupplierSnapshot(): RestockSupplierSnapshot | null {
    if (!draftOrder || draftOrder.status === "DRAFT" || draftOrder.status === "CANCELLED") {
      return null;
    }

    const exportLines = draftOrder.lines
      .filter((line) => line.isSelected && line.requestedQuantity > 0)
      .map((line) => ({
        barcode: line.product.barcode,
        notes: line.notes ?? null,
        productName: line.product.name,
        quantity: line.requestedQuantity,
        sku: line.product.sku
      }));

    if (exportLines.length === 0) return null;

    return {
      generatedAt: new Date().toISOString(),
      lines: exportLines,
      notes: draftOrder.notes,
      orderNumber: draftOrder.orderNumber,
      preparedBy: draftOrder.approvedBy?.name ?? draftOrder.createdBy?.name ?? null,
      statusLabel: statusLabel(draftOrder.status)
    };
  }

  function handleSupplierPrint() {
    setSupplierExportError(null);
    const snapshot = buildSupplierSnapshot();
    if (!snapshot) {
      setSupplierExportError("Confirm the restock before creating a supplier copy.");
      return;
    }

    if (!printRestockSupplierCopy(snapshot)) {
      setSupplierExportError(
        "Pop-up was blocked. Allow pop-ups for Ysabelle Store and try Print / Save PDF again."
      );
      return;
    }

    setSupplierExportOpen(false);
  }

  function handleSupplierCsv() {
    setSupplierExportError(null);
    const snapshot = buildSupplierSnapshot();
    if (!snapshot) {
      setSupplierExportError("Confirm the restock before creating a supplier copy.");
      return;
    }

    downloadRestockSupplierCsv(snapshot);
    setSupplierExportOpen(false);
  }

  function openReview() {
'''
if open_review_marker not in panel:
    raise SystemExit("Open review marker not found")
panel = panel.replace(open_review_marker, supplier_helpers, 1)

quantity_marker = '''                          min={0}
                          onChange={(event) =>
                            updateLine(productId, (current) => ({
                              ...current,
                              requestedQuantity: asNonNegativeInteger(event.target.value)
                            }))
                          }
                          type="number"
                          value={line.requestedQuantity}
'''
quantity_replacement = '''                          inputMode="numeric"
                          min={1}
                          onChange={(event) =>
                            updateLine(productId, (current) => ({
                              ...current,
                              requestedQuantity: asNonNegativeInteger(event.target.value)
                            }))
                          }
                          onFocus={(event) => event.currentTarget.select()}
                          step={1}
                          type="number"
                          value={line.requestedQuantity}
'''
if quantity_marker not in panel:
    raise SystemExit("Order quantity input marker not found")
panel = panel.replace(quantity_marker, quantity_replacement, 1)

approved_marker = '''              {draftOrder?.status === "APPROVED" ? (
                <Badge variant="success">Restock confirmed</Badge>
              ) : (
                <Button
                  disabled={!editable || selectedCount === 0 || busyAction !== null}
                  onClick={openReview}
                  type="button"
                >
                  Review restock
                </Button>
              )}
'''
approved_replacement = '''              {draftOrder?.status === "APPROVED" ? (
                <>
                  <Badge variant="success">Restock confirmed</Badge>
                  <Button
                    onClick={() => {
                      setSupplierExportError(null);
                      setSupplierExportOpen(true);
                    }}
                    type="button"
                  >
                    <Printer aria-hidden="true" className="h-4 w-4" />
                    Export supplier copy
                  </Button>
                </>
              ) : (
                <Button
                  disabled={!editable || selectedCount === 0 || busyAction !== null}
                  onClick={openReview}
                  type="button"
                >
                  Review restock
                </Button>
              )}
'''
if approved_marker not in panel:
    raise SystemExit("Approved restock action marker not found")
panel = panel.replace(approved_marker, approved_replacement, 1)

closing_marker = '''      </Dialog>
    </Card>
  );
}'''
supplier_dialog = '''      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          setSupplierExportOpen(open);
          if (!open) setSupplierExportError(null);
        }}
        open={supplierExportOpen}
      >
        <DialogContent className="max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Export restock order</DialogTitle>
            <DialogDescription>
              Create a supplier-facing copy of the confirmed restock. It includes only the products,
              identifiers, quantities, and ordering notes needed to fulfill the order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-6 pb-2">
            <Alert>
              <AlertTitle>Supplier copy</AlertTitle>
              <AlertDescription>
                Internal stock levels, forecasts, reorder settings, and recommendation logic are not
                included. Supplier / Manufacturer is left blank for manual entry until supplier
                management is introduced in a later phase.
              </AlertDescription>
            </Alert>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                className="h-auto min-h-24 items-start justify-start whitespace-normal p-4 text-left"
                onClick={handleSupplierPrint}
                type="button"
                variant="secondary"
              >
                <Printer className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <span className="block font-semibold text-slate-950">Print / Save PDF</span>
                  <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                    Clean A4 supplier copy with repeating table headers for long restock orders.
                  </span>
                </span>
              </Button>

              <Button
                className="h-auto min-h-24 items-start justify-start whitespace-normal p-4 text-left"
                onClick={handleSupplierCsv}
                type="button"
                variant="secondary"
              >
                <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <span className="block font-semibold text-slate-950">Excel-compatible CSV</span>
                  <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                    Spreadsheet-ready order lines for sending or further supplier processing.
                  </span>
                </span>
              </Button>
            </div>

            {supplierExportError ? (
              <Alert variant="destructive">
                <AlertTitle>Export needs attention</AlertTitle>
                <AlertDescription>{supplierExportError}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}'''
if closing_marker not in panel:
    raise SystemExit("Final dialog marker not found")
panel = panel.replace(closing_marker, supplier_dialog, 1)
panel_path.write_text(panel)

reports_path = Path("frontend/src/pages/ReportsPage.tsx")
reports = reports_path.read_text()
replacements = [
    ("Download report", "Operational snapshot"),
    ("<DialogTitle>Download report</DialogTitle>", "<DialogTitle>Internal operational snapshot</DialogTitle>"),
    (
        "Export the current live snapshot. Both formats include detailed inventory and current\n              restock recommendations without changing any store data.",
        "Export the store's internal live snapshot for management review. For a supplier-ready\n              restock document, confirm the Restock Planner and use Export supplier copy."
    ),
    ('["YSABELLE STORE", "Operational Report"]', '["YSABELLE STORE", "Internal Operational Snapshot"]'),
    ("<title>Ysabelle Store Operational Report</title>", "<title>Ysabelle Store Internal Operational Snapshot</title>"),
    ("<h1>YSABELLE STORE — Operational Report</h1>", "<h1>YSABELLE STORE — Internal Operational Snapshot</h1>"),
    (
        "Based on recent completed receipts · Full details in the downloadable report.",
        "Based on recent completed receipts · Internal details are available in Operational snapshot."
    )
]
for old, new in replacements:
    if old not in reports:
        raise SystemExit(f"Reports marker not found: {old[:60]}")
    reports = reports.replace(old, new, 1)
reports_path.write_text(reports)

contract_path = Path("scripts/restock-phase4-6-ui-contract-test.ts")
contract = contract_path.read_text()
api_marker = 'const apiSource = readFileSync(resolve(process.cwd(), "src/services/restockApi.ts"), "utf8");\n'
api_replacement = '''const apiSource = readFileSync(resolve(process.cwd(), "src/services/restockApi.ts"), "utf8");
const supplierExportSource = readFileSync(
  resolve(process.cwd(), "src/utils/restockExport.ts"),
  "utf8"
);
'''
if api_marker not in contract:
    raise SystemExit("Contract utility source marker not found")
contract = contract.replace(api_marker, api_replacement, 1)
if 'assert.match(reportsSource, /Download report/);' not in contract:
    raise SystemExit("Contract report label marker not found")
contract = contract.replace(
    'assert.match(reportsSource, /Download report/);',
    'assert.match(reportsSource, /Operational snapshot/);',
    1
)
panel_assert_marker = 'assert.match(panelSource, /Confirm restock/);\n'
panel_assert_replacement = '''assert.match(panelSource, /Confirm restock/);
assert.match(panelSource, /Export supplier copy/);
assert.match(panelSource, /Export restock order/);
assert.match(panelSource, /currentTarget\\.select\\(\\)/);
assert.match(panelSource, /Confirm the restock before creating a supplier copy/);
'''
if panel_assert_marker not in contract:
    raise SystemExit("Contract supplier panel marker not found")
contract = contract.replace(panel_assert_marker, panel_assert_replacement, 1)
final_marker = 'assert.match(apiSource, /\\/api\\/restock-orders\\/\\$\\{encodeURIComponent\\(orderId\\)\\}\\/approve/);\n'
final_replacement = '''assert.match(apiSource, /\\/api\\/restock-orders\\/\\$\\{encodeURIComponent\\(orderId\\)\\}\\/approve/);

assert.match(supplierExportSource, /RESTOCK ORDER - SUPPLIER COPY/);
assert.match(supplierExportSource, /Supplier \\/ Manufacturer/);
assert.match(supplierExportSource, /Order quantity/);
assert.match(supplierExportSource, /downloadRestockSupplierCsv/);
assert.match(supplierExportSource, /printRestockSupplierCopy/);
assert.doesNotMatch(supplierExportSource, /Forecast demand/);
assert.doesNotMatch(supplierExportSource, /Reorder level/);
'''
if final_marker not in contract:
    raise SystemExit("Contract supplier utility marker not found")
contract = contract.replace(final_marker, final_replacement, 1)
contract_path.write_text(contract)
