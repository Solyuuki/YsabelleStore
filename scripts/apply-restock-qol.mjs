import { readFileSync, writeFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function write(path, content) {
  writeFileSync(path, content, "utf8");
}

function replaceExact(path, before, after, expectedCount = 1) {
  const source = read(path);
  const count = source.split(before).length - 1;
  if (count !== expectedCount) {
    throw new Error(`${path}: expected ${expectedCount} matches, found ${count} for replacement.`);
  }
  write(path, source.split(before).join(after));
}

function removeBetween(path, startMarker, endMarker) {
  const source = read(path);
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`${path}: could not find bounded removal markers.`);
  }
  write(path, source.slice(0, start) + source.slice(end));
}

const servicePath = "backend/src/services/restockService.ts";
replaceExact(
  servicePath,
  `export async function listRestockOrders(query: RestockOrderListQuery) {
  const where = query.status ? { status: query.status } : undefined;
  const [totalItems, orders] = await prisma.$transaction([
    prisma.restockOrder.count({ where }),
    prisma.restockOrder.findMany({
      include: restockOrderInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where
    })
  ]);

  return {
    items: orders,
    meta: buildPaginationMeta(totalItems, {
      page: query.page,
      pageSize: query.pageSize
    })
  };
}`,
  `export async function listRestockOrders(query: RestockOrderListQuery) {
  const statuses = query.status ? [query.status] : query.statuses;
  const where: Prisma.RestockOrderWhereInput = {
    ...(statuses?.length
      ? { status: statuses.length === 1 ? statuses[0] : { in: statuses } }
      : {}),
    ...(query.search ? { orderNumber: { contains: query.search } } : {})
  };
  const [totalItems, orders] = await prisma.$transaction([
    prisma.restockOrder.count({ where }),
    prisma.restockOrder.findMany({
      include: restockOrderInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where
    })
  ]);

  return {
    items: orders,
    meta: buildPaginationMeta(totalItems, {
      page: query.page,
      pageSize: query.pageSize
    })
  };
}`
);

const panelPath = "frontend/src/components/reports/RestockPlanningPanel.tsx";
replaceExact(panelPath, "  FileSpreadsheet,\n", "");
replaceExact(panelPath, "  Printer,\n", "");
replaceExact(
  panelPath,
  'import { useCallback, useEffect, useMemo, useState } from "react";',
  'import { useCallback, useEffect, useMemo, useRef, useState } from "react";'
);
replaceExact(
  panelPath,
  `import {
  downloadRestockSupplierCsv,
  printRestockSupplierCopy,
  type RestockSupplierSnapshot
} from "@/utils/restockExport";
`,
  ""
);
replaceExact(
  panelPath,
  "export function RestockPlanningPanel() {",
  `type RestockPlanningPanelProps = {
  onOpenOrders: () => void;
  onOrdersChanged: () => void;
};

export function RestockPlanningPanel({
  onOpenOrders,
  onOrdersChanged
}: RestockPlanningPanelProps) {`
);
replaceExact(
  panelPath,
  `  const [supplierExportOpen, setSupplierExportOpen] = useState(false);
  const [supplierExportError, setSupplierExportError] = useState<string | null>(null);
`,
  ""
);
replaceExact(
  panelPath,
  `  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(() => new Set());
`,
  `  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(() => new Set());
  const confirmLockRef = useRef(false);
`
);
replaceExact(
  panelPath,
  `      setNotice(\`${"${order.orderNumber}"} saved for later. Inventory has not changed.\`);
`,
  `      setNotice(\`${"${order.orderNumber}"} saved for later. Inventory has not changed.\`);
      onOrdersChanged();
`
);
replaceExact(
  panelPath,
  `    if (validationError) {
      setError(validationError);
      return;
    }

    setBusyAction("confirm");`,
  `    if (validationError) {
      setError(validationError);
      return;
    }
    if (confirmLockRef.current) return;
    confirmLockRef.current = true;

    setBusyAction("confirm");`,
  1
);
replaceExact(
  panelPath,
  `      setNotice(
        \`${"${approved.orderNumber}"} confirmed. ${"${selectedCount}"} product${"${selectedCount === 1 ? \"\" : \"s\"}"} and ${"${requestedUnits.toLocaleString()}"} units are now on the way. Physical Inventory is unchanged.\`
      );`,
  `      setNotice(null);
      onOrdersChanged();`
);
replaceExact(
  panelPath,
  `    } finally {
      setBusyAction(null);
    }
  }

  function buildSupplierSnapshot(): RestockSupplierSnapshot | null {`,
  `    } finally {
      confirmLockRef.current = false;
      setBusyAction(null);
    }
  }

  function buildSupplierSnapshot(): RestockSupplierSnapshot | null {`
);
removeBetween(
  panelPath,
  "  function buildSupplierSnapshot(): RestockSupplierSnapshot | null {",
  "  function openReview() {"
);
replaceExact(panelPath, "        {draftOrder ? (", '        {draftOrder?.status === "DRAFT" ? (');
replaceExact(
  panelPath,
  `        {editable ? (
          <div className="flex flex-wrap items-center justify-between gap-3">`,
  `        {draftOrder && draftOrder.status !== "DRAFT" ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-emerald-600" />
                  <p className="font-semibold text-emerald-950">Restock confirmed</p>
                  <Badge variant="success">{statusLabel(draftOrder.status)}</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-950">{draftOrder.orderNumber}</p>
                <p className="mt-1 text-xs leading-5 text-emerald-800">
                  {selectedCount.toLocaleString()} product{selectedCount === 1 ? "" : "s"} ·{" "}
                  {requestedUnits.toLocaleString()} units. Physical inventory is unchanged until the
                  delivery is actually received.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busyAction !== null}
                  onClick={() => void loadRecommendations()}
                  type="button"
                  variant="secondary"
                >
                  Start new restock
                </Button>
                <Button onClick={onOpenOrders} type="button">
                  View orders
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {editable ? (
          <div className="flex flex-wrap items-center justify-between gap-3">`
);
replaceExact(
  panelPath,
  `        ) : lines.length > RESTOCK_PAGE_SIZE ? (
          <div className="flex justify-end">
            <PaginationControls
              currentPage={normalizedRestockPage}
              label={\`${"${lines.length.toLocaleString()}"} items\`}
              onNext={() => setRestockPage((current) => current + 1)}
              onPrevious={() => setRestockPage((current) => current - 1)}
              totalPages={restockPageCount}
            />
          </div>
        ) : null}`,
  `        ) : null}`
);
replaceExact(
  panelPath,
  "        {!loading && lines.length > 0 ? (",
  "        {!loading && lines.length > 0 && editable ? (",
  2
);
replaceExact(
  panelPath,
  `              {draftOrder?.status === "APPROVED" ? (
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
              )}`,
  `              <Button
                disabled={!editable || selectedCount === 0 || busyAction !== null}
                onClick={openReview}
                type="button"
              >
                Review restock
              </Button>`
);
replaceExact(
  panelPath,
  `      <Dialog onOpenChange={setReviewOpen} open={reviewOpen}>
        <DialogContent>`,
  `      <Dialog onOpenChange={setReviewOpen} open={reviewOpen}>
        <DialogContent className="max-h-[88vh] max-w-[760px] overflow-hidden">`
);
replaceExact(
  panelPath,
  `          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 pb-2">`,
  `          <div className="space-y-4 px-6 pb-2">`
);
replaceExact(
  panelPath,
  `            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">`,
  `            <div className="max-h-[36vh] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">`
);
removeBetween(
  panelPath,
  `      <Dialog
        onOpenChange={(open) => {
          setSupplierExportOpen(open);`,
  "    </Card>"
);

console.log("Applied Restock/Reports QoL backend and planner cleanup.");
