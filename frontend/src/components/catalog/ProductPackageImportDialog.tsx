import {
  CheckCircle2,
  FileArchive,
  FolderSearch2,
  HardDrive,
  Link2,
  LoaderCircle,
  ShieldCheck,
  Upload,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatFileSize } from "@/utils/importFormatting";
import {
  importGoogleDriveProductPackage,
  importLocalProductPackage,
  previewGoogleDriveProductPackage,
  previewLocalProductPackage,
  type ProductPackagePreview,
  type ProductPackageSummary
} from "@/services/productPackageApi";

const MAX_PACKAGE_SIZE_BYTES = 100 * 1024 * 1024;
const PACKAGE_SUFFIXES = [
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".tar.gz",
  ".tgz",
  ".tar.bz2",
  ".tar.xz"
] as const;
const PACKAGE_ACCEPT = PACKAGE_SUFFIXES.join(",");

type ImportSource = "LOCAL" | "GOOGLE_DRIVE";
type ImportPhase = "idle" | "scanning" | "preview-ready" | "importing" | "success" | "error";

export function ProductPackageImportDialog({
  isOpen,
  onClose,
  onImported,
  triggerRef
}: {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void | Promise<void>;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState<ImportSource>("LOCAL");
  const [file, setFile] = useState<File | null>(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [preview, setPreview] = useState<ProductPackagePreview | null>(null);
  const [summary, setSummary] = useState<ProductPackageSummary | null>(null);
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const sessionRef = useRef(0);

  const isBusy = phase === "scanning" || phase === "importing";
  const canScan =
    !isBusy &&
    ((source === "LOCAL" && Boolean(file)) ||
      (source === "GOOGLE_DRIVE" && driveUrl.trim().length > 0));
  const canImport = Boolean(
    preview &&
      preview.invalidRows === 0 &&
      preview.errors.length === 0 &&
      phase === "preview-ready"
  );
  const visibleIssues = useMemo(() => {
    if (!preview) return [];
    return preview.errors.slice(0, 10);
  }, [preview]);

  useEffect(() => {
    if (!isOpen) return;
    sessionRef.current += 1;
    setSource("LOCAL");
    setFile(null);
    setDriveUrl("");
    setPreview(null);
    setSummary(null);
    setPhase("idle");
    setError(null);
    setIsDragging(false);
    setShowGuide(false);
    if (inputRef.current) inputRef.current.value = "";
  }, [isOpen]);

  function close() {
    if (isBusy) return;
    onClose();
  }

  function validatePackageFile(candidate: File) {
    const name = candidate.name.trim().toLowerCase();
    if (!name) return "Package file name is invalid.";
    if (!PACKAGE_SUFFIXES.some((suffix) => name.endsWith(suffix))) {
      return "Unsupported package type. Use ZIP, RAR, 7Z, TAR, TAR.GZ/TGZ, TAR.BZ2, or TAR.XZ.";
    }
    if (candidate.size === 0) return "Package file is empty.";
    if (candidate.size > MAX_PACKAGE_SIZE_BYTES) return "Product package exceeds 100 MB.";
    return null;
  }

  function selectFile(candidate: File | null) {
    if (!candidate) {
      setFile(null);
      setPreview(null);
      setSummary(null);
      setError(null);
      setPhase("idle");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const validationError = validatePackageFile(candidate);
    if (validationError) {
      setFile(null);
      setPreview(null);
      setSummary(null);
      setPhase("error");
      setError(validationError);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(candidate);
    setPreview(null);
    setSummary(null);
    setError(null);
    setPhase("idle");
  }

  function openFilePicker() {
    if (isBusy) return;
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.click();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (isBusy) return;
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function scanPackage() {
    if (!canScan) return;
    const sessionId = ++sessionRef.current;
    setPhase("scanning");
    setPreview(null);
    setSummary(null);
    setError(null);

    try {
      const response =
        source === "LOCAL" && file
          ? await previewLocalProductPackage(file)
          : await previewGoogleDriveProductPackage(driveUrl.trim());
      if (sessionId !== sessionRef.current) return;
      if (!response.success || !response.data) {
        setPhase("error");
        setError(response.message || "Product package scan failed.");
        return;
      }
      setPreview(response.data);
      setPhase("preview-ready");
    } catch (scanError) {
      if (sessionId !== sessionRef.current) return;
      setPhase("error");
      setError(scanError instanceof Error ? scanError.message : "Product package scan failed.");
    }
  }

  async function confirmImport() {
    if (!canImport || !preview) return;
    const sessionId = sessionRef.current;
    setPhase("importing");
    setError(null);

    try {
      const response =
        source === "LOCAL" && file
          ? await importLocalProductPackage(file)
          : await importGoogleDriveProductPackage(driveUrl.trim());
      if (sessionId !== sessionRef.current) return;
      if (!response.success || !response.data) {
        setPhase("preview-ready");
        setError(response.message || "Product package import failed.");
        return;
      }
      setSummary(response.data);
      setPhase("success");
      await onImported();
    } catch (importError) {
      if (sessionId !== sessionRef.current) return;
      setPhase("preview-ready");
      setError(importError instanceof Error ? importError.message : "Product package import failed.");
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close();
      }}
    >
      <DialogContent
        aria-describedby="product-package-import-description"
        className="flex max-h-[88vh] w-[calc(100vw-40px)] max-w-[760px] flex-col overflow-hidden p-0"
        onEscapeKeyDown={(event) => {
          if (isBusy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (isBusy) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef?.current?.focus();
        }}
      >
        <DialogHeader className="relative border-b border-slate-200 px-6 py-6 pr-14">
          <DialogClose asChild>
            <Button
              aria-label="Close product package import"
              className="absolute right-4 top-4"
              disabled={isBusy}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DialogClose>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <DialogTitle>Import products</DialogTitle>
              <Button
                aria-expanded={showGuide}
                aria-controls="product-package-guide"
                className="h-7 gap-1.5 rounded-full px-2.5 text-xs"
                disabled={isBusy}
                onClick={() => setShowGuide((current) => !current)}
                type="button"
                variant="secondary"
              >
                <span
                  aria-hidden="true"
                  className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-bold"
                >
                  ?
                </span>
                Guide
              </Button>
            </div>
            <DialogDescription id="product-package-import-description" className="max-w-prose">
              Import a product package from your computer or Google Drive. The system scans folders,
              validates catalog data, matches product images, and rejects blocking issues before import.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {showGuide ? (
              <section
                className="rounded-2xl border border-violet-200 bg-violet-50/70 p-5"
                id="product-package-guide"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Product package requirements</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      A package may contain one or many products. Include exactly one product data file;
                      product images are optional.
                    </p>
                  </div>
                  <Button
                    aria-label="Hide product package guide"
                    className="shrink-0"
                    onClick={() => setShowGuide(false)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Hide
                  </Button>
                </div>

                <div className="mt-4 grid gap-4 text-sm text-slate-700 md:grid-cols-2">
                  <div className="rounded-xl border border-violet-100 bg-white/80 p-4">
                    <p className="font-semibold text-slate-950">1. Product data file</p>
                    <p className="mt-2 leading-6">Use one CSV or XLSX file with these required columns:</p>
                    <p className="mt-2 break-words font-mono text-xs leading-5 text-slate-600">
                      name, sku, category, unit, costPrice, sellingPrice, reorderLevel, initialStock
                    </p>
                    <p className="mt-3 leading-6">
                      Optional: targetStockLevel, status, description, imageUrl, barcode.
                    </p>
                  </div>

                  <div className="rounded-xl border border-violet-100 bg-white/80 p-4">
                    <p className="font-semibold text-slate-950">2. Product images (optional)</p>
                    <p className="mt-2 leading-6">Supported: JPG, JPEG, PNG, and WebP.</p>
                    <p className="mt-2 leading-6">
                      Name each image using the product SKU or product name so the system can match it.
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Example package</p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre text-xs leading-5 text-slate-700">{`products.zip
├── products.xlsx
└── images/
    ├── SARIMA-P218.jpg
    └── SARIMA-P261.png`}</pre>
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Nested folders are supported. The package is scanned and validated first; nothing is
                  written to the catalog until you confirm the import.
                </p>
              </section>
            ) : null}

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <Button
                className="justify-center"
                disabled={isBusy}
                onClick={() => {
                  setSource("LOCAL");
                  setPreview(null);
                  setSummary(null);
                  setError(null);
                  setPhase("idle");
                }}
                type="button"
                variant={source === "LOCAL" ? "default" : "ghost"}
              >
                <HardDrive className="h-4 w-4" aria-hidden="true" />
                Local package
              </Button>
              <Button
                className="justify-center"
                disabled={isBusy}
                onClick={() => {
                  setSource("GOOGLE_DRIVE");
                  setPreview(null);
                  setSummary(null);
                  setError(null);
                  setPhase("idle");
                }}
                type="button"
                variant={source === "GOOGLE_DRIVE" ? "default" : "ghost"}
              >
                <Link2 className="h-4 w-4" aria-hidden="true" />
                Google Drive
              </Button>
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Package rejected</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {source === "LOCAL" ? (
              <div
                aria-label="Upload product package"
                className={[
                  "cursor-pointer rounded-2xl border border-dashed p-7 text-center transition-colors focus-visible:outline-none focus-visible:ring-2",
                  isDragging
                    ? "border-violet-600 bg-violet-100 ring-violet-200"
                    : "border-violet-300 bg-violet-50/70 hover:border-violet-400 hover:bg-violet-50 focus-visible:border-violet-500 focus-visible:ring-violet-200"
                ].join(" ")}
                onClick={openFilePicker}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!isBusy) setIsDragging(true);
                }}
                onDrop={handleDrop}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openFilePicker();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="mx-auto flex max-w-[580px] flex-col items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-violet-300 bg-white text-violet-700 shadow-sm">
                    <Upload className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-slate-950">
                    Drop a product package here
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    or choose an archive from your computer
                  </p>
                  <Button
                    className="mt-4"
                    disabled={isBusy}
                    onClick={(event) => {
                      event.stopPropagation();
                      openFilePicker();
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Choose package
                  </Button>
                  <p className="mt-4 max-w-lg text-xs font-medium leading-5 text-slate-500">
                    ZIP, RAR, 7Z, TAR, TAR.GZ/TGZ, TAR.BZ2, or TAR.XZ · up to 100 MB
                  </p>
                </div>
                <input
                  accept={PACKAGE_ACCEPT}
                  className="hidden"
                  onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                  ref={inputRef}
                  type="file"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-violet-700 shadow-sm">
                    <HardDrive className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-950">Shared Google Drive package</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Paste a shared Google Drive file link to one supported archive. Private Drive
                      folders require a separate Google OAuth connection and are not silently accessed.
                    </p>
                    <Input
                      className="mt-4 bg-white"
                      disabled={isBusy}
                      onChange={(event) => {
                        setDriveUrl(event.target.value);
                        setPreview(null);
                        setSummary(null);
                        setError(null);
                        setPhase("idle");
                      }}
                      placeholder="https://drive.google.com/file/d/.../view"
                      value={driveUrl}
                    />
                  </div>
                </div>
              </div>
            )}

            {source === "LOCAL" && file ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileArchive className="h-4 w-4 shrink-0 text-violet-700" aria-hidden="true" />
                      <p className="truncate text-sm font-semibold text-slate-950">{file.name}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{formatFileSize(file.size)}</p>
                  </div>
                  <Button disabled={isBusy} onClick={() => selectFile(null)} type="button" variant="ghost">
                    Remove
                  </Button>
                </div>
              </div>
            ) : null}

            {phase === "scanning" ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <LoadingState
                  badge="Package scan"
                  helper="Recursively discovering files, reading product data, matching images, checking duplicates, and running image quality validation. Nothing is written to the catalog during this scan."
                  label={source === "GOOGLE_DRIVE" ? "Downloading and scanning package..." : "Scanning package..."}
                />
                <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <ScanStep icon={FolderSearch2} label="Discover folders and files" />
                  <ScanStep icon={ShieldCheck} label="Validate catalog records" />
                  <ScanStep icon={CheckCircle2} label="Match and inspect images" />
                  <ScanStep icon={CheckCircle2} label="Build final import preview" />
                </div>
              </div>
            ) : null}

            {preview && (phase === "preview-ready" || phase === "importing") ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Package scan complete</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {preview.package.filesScanned} files across {preview.package.foldersScanned} folders ·{" "}
                      {preview.totalRows} product records
                    </p>
                  </div>
                  <StatusBadge variant={preview.invalidRows === 0 && preview.errors.length === 0 ? "success" : "error"}>
                    {preview.invalidRows === 0 && preview.errors.length === 0 ? "Ready" : "Rejected"}
                  </StatusBadge>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Metric label="Valid products" value={preview.validRows} />
                  <Metric label="Invalid products" value={preview.invalidRows} />
                  <Metric label="Images matched" value={preview.package.imagesMatched} />
                  <Metric label="Images approved" value={preview.package.imagesApproved} />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <p>
                    Data file: <span className="font-medium text-slate-900">{preview.package.dataFileName}</span>
                  </p>
                  <p className="mt-1">
                    Archive: {preview.package.archiveType.toUpperCase()} · extractor {preview.package.extractionEngine}
                  </p>
                  <p className="mt-1">
                    Images found {preview.package.imagesFound} · unmatched {preview.package.unmatchedImages} · ignored files {preview.package.ignoredFiles}
                  </p>
                </div>

                {preview.errors.length > 0 ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-semibold text-red-900">
                      Import blocked · {preview.errors.length} blocking issue{preview.errors.length === 1 ? "" : "s"}
                    </p>
                    <div className="mt-2 space-y-2">
                      {visibleIssues.map((issue, index) => (
                        <div className="text-sm text-red-800" key={`${issue.code}-${issue.rowNumber ?? 0}-${index}`}>
                          {issue.rowNumber ? `Row ${issue.rowNumber}: ` : ""}
                          {issue.message}
                          {issue.value ? ` (${issue.value})` : ""}
                        </div>
                      ))}
                    </div>
                    {preview.errors.length > visibleIssues.length ? (
                      <p className="mt-2 text-xs font-medium text-red-700">
                        +{preview.errors.length - visibleIssues.length} more blocking issues
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
                    <p className="text-sm font-medium text-violet-950">All blocking validations passed.</p>
                    <p className="mt-1 text-sm leading-6 text-violet-800">
                      Products remain in catalog review after import. Final storefront approval stays separate.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {phase === "success" && summary ? (
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-violet-700" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-violet-950">Import complete</p>
                    <p className="mt-1 text-sm leading-6 text-violet-800">
                      {summary.importedRows} products created, {summary.inventoryRowsCreated} inventory records created,
                      and {summary.imagesImported} validated images attached.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-slate-200 bg-slate-50/90 px-6 py-4 backdrop-blur">
          {phase === "success" ? (
            <Button onClick={close} type="button">Close</Button>
          ) : phase === "importing" ? (
            <>
              <Button disabled type="button" variant="secondary">Cancel</Button>
              <Button disabled type="button">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Importing validated products...
              </Button>
            </>
          ) : preview && phase === "preview-ready" ? (
            <>
              <Button disabled={isBusy} onClick={() => {
                setPreview(null);
                setError(null);
                setPhase("idle");
              }} type="button" variant="secondary">
                Change source
              </Button>
              <Button disabled={!canImport} onClick={() => void confirmImport()} type="button">
                Import products
              </Button>
            </>
          ) : (
            <>
              <Button disabled={isBusy} onClick={close} type="button" variant="secondary">Cancel</Button>
              <Button disabled={!canScan} onClick={() => void scanPackage()} type="button">
                {phase === "scanning" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {phase === "scanning" ? "Scanning package..." : "Scan package"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function ScanStep({ icon: Icon, label }: { icon: typeof FolderSearch2; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
      <Icon className="h-4 w-4 text-violet-700" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}