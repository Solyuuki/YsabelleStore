import {
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { LoadingState } from "@/components/shared/LoadingState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  approveProductImage,
  fetchLatestProductImageCandidate,
  fetchProductImagePreviewBlob,
  getProductImageDiagnostics,
  rejectProductImage,
  uploadProductImage,
  type ProductImageCandidate
} from "@/services/productImageApi";

const MAX_PRODUCT_IMAGE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_PRODUCT_IMAGE_EXTENSION = /\.(jpe?g|png|webp)$/i;
const SUPPORTED_PRODUCT_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ProductImagePanelPhase =
  | "idle"
  | "selected"
  | "uploading"
  | "preview"
  | "approving"
  | "approved"
  | "discarding"
  | "error";

export function ProductImageUploadPanel({
  disabled = false,
  onApproved,
  onCandidateCreated,
  onCandidateDiscarded,
  onSelectionChange,
  productId,
  resetKey
}: {
  disabled?: boolean;
  onApproved?: (candidate: ProductImageCandidate) => void;
  onCandidateCreated?: (candidate: ProductImageCandidate) => void;
  onCandidateDiscarded?: (candidate: ProductImageCandidate) => void;
  onSelectionChange?: (hasSelectedImage: boolean) => void;
  productId: string | null;
  resetKey?: string | number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const processedUploadKeyRef = useRef<string | null>(null);
  const selectionVersionRef = useRef(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [candidate, setCandidate] = useState<ProductImageCandidate | null>(null);
  const [candidateRefreshKey, setCandidateRefreshKey] = useState(0);
  const [phase, setPhase] = useState<ProductImagePanelPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [optimizedPreviewUrl, setOptimizedPreviewUrl] = useState<string | null>(null);
  const diagnostics = useMemo(
    () => (candidate ? getProductImageDiagnostics(candidate) : []),
    [candidate]
  );
  const canApprove = Boolean(
    candidate && candidate.qualityStatus === "APPROVED" && candidate.processingStatus === "READY"
  );
  const isBusy = phase === "uploading" || phase === "approving" || phase === "discarding";

  useEffect(() => {
    const hydrationVersion = selectionVersionRef.current + 1;
    selectionVersionRef.current = hydrationVersion;
    processedUploadKeyRef.current = null;
    setSelectedFile(null);
    setCandidate(null);
    setOriginalPreviewUrl(null);
    setOptimizedPreviewUrl(null);
    setError(null);
    setPhase("idle");
    onSelectionChange?.(false);
    if (inputRef.current) inputRef.current.value = "";

    if (!productId) {
      return;
    }

    const controller = new AbortController();
    let originalObjectUrl: string | null = null;

    fetchLatestProductImageCandidate(productId, controller.signal)
      .then(async (hydratedCandidate) => {
        if (
          controller.signal.aborted ||
          selectionVersionRef.current !== hydrationVersion ||
          !hydratedCandidate
        ) {
          return;
        }

        setCandidate(hydratedCandidate);
        setPhase(
          hydratedCandidate.approvedAt
            ? "approved"
            : hydratedCandidate.processingStatus === "FAILED"
              ? "error"
              : "preview"
        );
        if (hydratedCandidate.processingStatus === "FAILED") {
          setError(
            "The existing image candidate could not be processed. Upload a different source image."
          );
        }

        const originalBlob = await fetchProductImagePreviewBlob(
          productId,
          hydratedCandidate.id,
          "original",
          controller.signal
        );
        if (controller.signal.aborted || selectionVersionRef.current !== hydrationVersion) {
          return;
        }

        originalObjectUrl = URL.createObjectURL(originalBlob);
        setOriginalPreviewUrl(originalObjectUrl);
      })
      .catch((hydrationError: unknown) => {
        if (controller.signal.aborted || selectionVersionRef.current !== hydrationVersion) return;
        setPhase("error");
        setError(
          hydrationError instanceof Error
            ? hydrationError.message
            : "The existing product image candidate could not be loaded."
        );
      });

    return () => {
      controller.abort();
      if (originalObjectUrl) URL.revokeObjectURL(originalObjectUrl);
    };
  }, [candidateRefreshKey, onSelectionChange, productId, resetKey]);

  useEffect(() => {
    if (!selectedFile) {
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setOriginalPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  useEffect(() => {
    if (!productId || !candidate || candidate.processingStatus !== "READY") {
      setOptimizedPreviewUrl(null);
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;

    fetchProductImagePreviewBlob(productId, candidate.id, "processed", controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setOptimizedPreviewUrl(objectUrl);
      })
      .catch((previewError: unknown) => {
        if (controller.signal.aborted) return;
        setOptimizedPreviewUrl(null);
        setError(
          previewError instanceof Error
            ? previewError.message
            : "The optimized image preview could not be loaded."
        );
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [candidate, productId]);

  useEffect(() => {
    if (!productId || !selectedFile) {
      return;
    }

    const uploadKey = [
      productId,
      selectedFile.name,
      selectedFile.size,
      selectedFile.lastModified
    ].join(":");

    if (processedUploadKeyRef.current === uploadKey) {
      return;
    }

    processedUploadKeyRef.current = uploadKey;
    let active = true;
    setPhase("uploading");
    setError(null);
    setCandidate(null);
    setOptimizedPreviewUrl(null);

    uploadProductImage(productId, selectedFile)
      .then((response) => {
        if (!active) return;

        if (!response.success || !response.data) {
          throw new Error(response.message || "Product image processing failed.");
        }

        setCandidate(response.data);
        onCandidateCreated?.(response.data);
        setPhase(response.data.processingStatus === "FAILED" ? "error" : "preview");
        if (response.data.processingStatus === "FAILED") {
          setError("The image could not be processed. Upload a different source image.");
        }
      })
      .catch((uploadError: unknown) => {
        if (!active) return;
        processedUploadKeyRef.current = null;
        setCandidate(null);
        setPhase("error");
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "The product image could not be uploaded."
        );
      });

    return () => {
      active = false;
    };
  }, [onCandidateCreated, productId, selectedFile]);

  function validateFile(file: File) {
    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      return "Image exceeds the 8 MB upload limit.";
    }
    if (!SUPPORTED_PRODUCT_IMAGE_EXTENSION.test(file.name)) {
      return "Use a JPG, JPEG, PNG, or WebP image.";
    }
    if (file.type && !SUPPORTED_PRODUCT_IMAGE_MIME_TYPES.has(file.type)) {
      return "Use a JPG, JPEG, PNG, or WebP image.";
    }
    return null;
  }

  function handleFileSelection(file: File | null) {
    if (!file) {
      clearSelection();
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      clearSelection();
      setPhase("error");
      setError(validationError);
      return;
    }

    selectionVersionRef.current += 1;
    processedUploadKeyRef.current = null;
    setSelectedFile(file);
    setCandidate(null);
    setOptimizedPreviewUrl(null);
    setError(null);
    setPhase("selected");
    onSelectionChange?.(true);
  }

  function clearSelection() {
    selectionVersionRef.current += 1;
    processedUploadKeyRef.current = null;
    setSelectedFile(null);
    setCandidate(null);
    setOriginalPreviewUrl(null);
    setOptimizedPreviewUrl(null);
    setError(null);
    setPhase("idle");
    onSelectionChange?.(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleDiscard() {
    if (!productId || !candidate || candidate.approvedAt || phase === "discarding") {
      return;
    }

    setPhase("discarding");
    setError(null);

    try {
      const response = await rejectProductImage(productId, candidate.id);
      if (!response.success || !response.data) {
        throw new Error(response.message || "The uploaded image could not be discarded.");
      }

      onCandidateDiscarded?.(response.data);
      clearSelection();
      setCandidateRefreshKey((current) => current + 1);
    } catch (discardError) {
      setPhase(candidate.processingStatus === "FAILED" ? "error" : "preview");
      setError(
        discardError instanceof Error
          ? discardError.message
          : "The uploaded image could not be discarded."
      );
    }
  }

  async function handleApprove() {
    if (!productId || !candidate || !canApprove || phase === "approving") {
      return;
    }

    setPhase("approving");
    setError(null);

    try {
      const response = await approveProductImage(productId, candidate.id);
      if (!response.success || !response.data) {
        throw new Error(response.message || "The optimized image could not be approved.");
      }

      setCandidate(response.data);
      setPhase("approved");
      onApproved?.(response.data);
    } catch (approvalError) {
      setPhase("preview");
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : "The optimized image could not be approved."
      );
    }
  }

  function openPicker() {
    if (disabled || isBusy) return;
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.click();
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950">Product image</p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
            Upload a normal product photo. CIQE automatically optimizes and re-checks the processed
            result, then only allows an approved optimized image to be published.
          </p>
        </div>
        <Button
          disabled={disabled || isBusy}
          onClick={openPicker}
          type="button"
          variant="secondary"
        >
          {selectedFile || candidate ? (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Upload className="h-4 w-4" aria-hidden="true" />
          )}
          {selectedFile || candidate ? "Upload Another" : "Choose image"}
        </Button>
      </div>

      <input
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        disabled={disabled || isBusy}
        onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
        ref={inputRef}
        type="file"
      />

      {!selectedFile && !candidate && phase !== "error" ? (
        <button
          className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center transition-colors hover:border-violet-300 hover:bg-violet-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled || isBusy}
          onClick={openPicker}
          type="button"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-50 text-violet-700">
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="mt-3 text-sm font-semibold text-slate-950">Choose a product photo</span>
          <span className="mt-1 text-xs leading-5 text-slate-500">
            JPG, PNG, or WebP · up to 8 MB
          </span>
        </button>
      ) : null}

      {selectedFile && !productId ? (
        <Alert>
          <AlertTitle>Image ready after product save</AlertTitle>
          <AlertDescription>
            Product details will be saved first. Image processing starts automatically as soon as
            this product has an ID.
          </AlertDescription>
        </Alert>
      ) : null}

      {phase === "uploading" ? (
        <LoadingState
          badge="Catalog image"
          helper="Checking quality and preparing card and product-detail variants."
          label="Optimizing product image..."
        />
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Image needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {(selectedFile || candidate) &&
      (phase === "selected" ||
        phase === "preview" ||
        phase === "approving" ||
        phase === "approved" ||
        phase === "discarding" ||
        phase === "error") ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ImagePreview title="Original" url={originalPreviewUrl} />
          <ImagePreview
            loading={Boolean(
              candidate && candidate.processingStatus === "READY" && !optimizedPreviewUrl && !error
            )}
            title="Optimized"
            url={optimizedPreviewUrl}
          />
        </div>
      ) : null}

      {candidate ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Image quality
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                {formatQualityStatus(candidate.qualityStatus)}
              </p>
            </div>
            <QualityIndicator status={candidate.qualityStatus} />
          </div>

          {diagnostics.length > 0 ? (
            <ul className="space-y-2 text-sm text-slate-700">
              {diagnostics.map((diagnostic, index) => (
                <li className="flex items-start gap-2" key={`${diagnostic.code}-${index}`}>
                  {diagnostic.severity === "error" ? (
                    <ShieldAlert
                      className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
                      aria-hidden="true"
                    />
                  )}
                  <span>{diagnostic.message}</span>
                </li>
              ))}
            </ul>
          ) : candidate.qualityStatus === "APPROVED" ? (
            <p className="text-sm text-slate-600">
              The processed image passed the current catalog quality checks.
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button disabled={isBusy} onClick={openPicker} type="button" variant="secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Upload Another
            </Button>
            {!candidate.approvedAt ? (
              <Button
                disabled={isBusy}
                onClick={() => void handleDiscard()}
                type="button"
                variant="ghost"
              >
                {phase === "discarding" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {phase === "discarding" ? "Discarding..." : "Discard upload"}
              </Button>
            ) : null}
            {canApprove && phase !== "approved" ? (
              <Button
                disabled={phase === "approving" || !optimizedPreviewUrl}
                onClick={() => void handleApprove()}
                type="button"
              >
                {phase === "approving" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                )}
                {phase === "approving" ? "Applying image..." : "Use Optimized Image"}
              </Button>
            ) : null}
            {phase === "approved" ? (
              <span className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Storefront image updated
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ImagePreview({
  loading = false,
  title,
  url
}: {
  loading?: boolean;
  title: "Original" | "Optimized";
  url: string | null;
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <figcaption className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </figcaption>
      <div className="grid aspect-square place-items-center bg-slate-50 p-4">
        {url ? (
          <img
            alt={`${title} product preview`}
            className="max-h-full max-w-full object-contain"
            src={url}
          />
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            Preparing preview...
          </div>
        ) : (
          <span className="text-sm text-slate-400">Preview unavailable</span>
        )}
      </div>
    </figure>
  );
}

function QualityIndicator({ status }: { status: ProductImageCandidate["qualityStatus"] }) {
  const className =
    status === "APPROVED"
      ? "bg-emerald-50 text-emerald-800"
      : status === "REJECTED"
        ? "bg-red-50 text-red-800"
        : "bg-amber-50 text-amber-800";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {formatQualityStatus(status)}
    </span>
  );
}

function formatQualityStatus(status: ProductImageCandidate["qualityStatus"]) {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return "Needs review";
}
