import {
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { LoadingState } from "@/components/shared/LoadingState";
import { useToast } from "@/components/shared/ToastProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  approveCategoryCover,
  fetchCategoryCoverPreviewBlob,
  fetchLatestCategoryCoverCandidate,
  getCategoryImageDiagnostics,
  rejectCategoryCover,
  removeActiveCategoryCover,
  uploadCategoryCover,
  type CategoryImageCandidate
} from "@/services/categoryImageApi";

const MAX_CATEGORY_IMAGE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_CATEGORY_IMAGE_EXTENSION = /.(jpe?g|png|webp)$/i;
const SUPPORTED_CATEGORY_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type CategoryCoverPhase =
  | "idle"
  | "selected"
  | "uploading"
  | "preview"
  | "approving"
  | "approved"
  | "discarding"
  | "removing"
  | "error";

export function CategoryCoverUploadPanel({
  activeCoverAssetId,
  categoryId,
  onChanged
}: {
  activeCoverAssetId: string | null;
  categoryId: string;
  onChanged?: () => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const processedUploadKeyRef = useRef<string | null>(null);
  const selectionVersionRef = useRef(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [candidate, setCandidate] = useState<CategoryImageCandidate | null>(null);
  const [candidateRefreshKey, setCandidateRefreshKey] = useState(0);
  const [phase, setPhase] = useState<CategoryCoverPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const { pushToast } = useToast();
  const diagnostics = useMemo(
    () => (candidate ? getCategoryImageDiagnostics(candidate) : []),
    [candidate]
  );
  const candidateIsActive = Boolean(
    candidate &&
    activeCoverAssetId === candidate.id &&
    candidate.approvedAt &&
    !candidate.supersededAt
  );
  const canApprove = Boolean(
    candidate &&
    candidate.processingStatus === "READY" &&
    candidate.qualityStatus !== "REJECTED" &&
    coverPreviewUrl
  );
  const isBusy =
    phase === "uploading" ||
    phase === "approving" ||
    phase === "discarding" ||
    phase === "removing";

  useEffect(() => {
    const hydrationVersion = selectionVersionRef.current + 1;
    selectionVersionRef.current = hydrationVersion;
    processedUploadKeyRef.current = null;
    setSelectedFile(null);
    setCandidate(null);
    setOriginalPreviewUrl(null);
    setCoverPreviewUrl(null);
    setError(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";

    const controller = new AbortController();
    let originalObjectUrl: string | null = null;

    fetchLatestCategoryCoverCandidate(categoryId, controller.signal)
      .then(async (hydratedCandidate) => {
        if (
          controller.signal.aborted ||
          selectionVersionRef.current !== hydrationVersion ||
          !hydratedCandidate
        ) {
          return;
        }

        setCandidate(hydratedCandidate);
        const isActive =
          hydratedCandidate.id === activeCoverAssetId &&
          Boolean(hydratedCandidate.approvedAt) &&
          !hydratedCandidate.supersededAt;
        setPhase(
          isActive
            ? "approved"
            : hydratedCandidate.processingStatus === "FAILED"
              ? "error"
              : "preview"
        );

        if (hydratedCandidate.processingStatus === "FAILED") {
          setError("The current category cover candidate could not be processed.");
        }

        const originalBlob = await fetchCategoryCoverPreviewBlob(
          categoryId,
          hydratedCandidate.id,
          "original",
          controller.signal
        );
        if (controller.signal.aborted || selectionVersionRef.current !== hydrationVersion) return;

        originalObjectUrl = URL.createObjectURL(originalBlob);
        setOriginalPreviewUrl(originalObjectUrl);
      })
      .catch((hydrateError: unknown) => {
        if (controller.signal.aborted || selectionVersionRef.current !== hydrationVersion) return;
        setPhase("error");
        setError(
          hydrateError instanceof Error
            ? hydrateError.message
            : "The category cover candidate could not be loaded."
        );
      });

    return () => {
      controller.abort();
      if (originalObjectUrl) URL.revokeObjectURL(originalObjectUrl);
    };
  }, [activeCoverAssetId, candidateRefreshKey, categoryId]);

  useEffect(() => {
    if (!selectedFile) return;

    const url = URL.createObjectURL(selectedFile);
    setOriginalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  useEffect(() => {
    if (!candidate || candidate.processingStatus !== "READY") {
      setCoverPreviewUrl(null);
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;

    fetchCategoryCoverPreviewBlob(categoryId, candidate.id, "cover", controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setCoverPreviewUrl(objectUrl);
      })
      .catch((previewError: unknown) => {
        if (controller.signal.aborted) return;
        setCoverPreviewUrl(null);
        if (candidate.qualityStatus !== "REJECTED") {
          setError(
            previewError instanceof Error
              ? previewError.message
              : "The optimized category cover preview could not be loaded."
          );
        }
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [candidate, categoryId]);

  useEffect(() => {
    if (!selectedFile) return;

    const uploadKey = [
      categoryId,
      selectedFile.name,
      selectedFile.size,
      selectedFile.lastModified
    ].join(":");
    if (processedUploadKeyRef.current === uploadKey) return;

    processedUploadKeyRef.current = uploadKey;
    let active = true;
    setPhase("uploading");
    setError(null);
    setCandidate(null);
    setCoverPreviewUrl(null);

    uploadCategoryCover(categoryId, selectedFile)
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data) {
          throw new Error(response.message || "Category cover processing failed.");
        }

        setCandidate(response.data);
        setPhase(response.data.processingStatus === "FAILED" ? "error" : "preview");
        if (response.data.processingStatus === "FAILED") {
          setError("The image could not be processed. Upload a different source image.");
        }
        void Promise.resolve(onChanged?.()).catch(() => undefined);
      })
      .catch((uploadError: unknown) => {
        if (!active) return;
        processedUploadKeyRef.current = null;
        setCandidate(null);
        setPhase("error");
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "The category cover could not be uploaded."
        );
      });

    return () => {
      active = false;
    };
  }, [categoryId, onChanged, selectedFile]);

  function validateFile(file: File) {
    if (file.size > MAX_CATEGORY_IMAGE_BYTES) return "Image exceeds the 8 MB upload limit.";
    if (!SUPPORTED_CATEGORY_IMAGE_EXTENSION.test(file.name)) {
      return "Use a JPG, JPEG, PNG, or WebP image.";
    }
    if (file.type && !SUPPORTED_CATEGORY_IMAGE_MIME_TYPES.has(file.type)) {
      return "Use a JPG, JPEG, PNG, or WebP image.";
    }
    return null;
  }

  function handleFileSelection(file: File | null) {
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setPhase("error");
      setError(validationError);
      return;
    }

    selectionVersionRef.current += 1;
    processedUploadKeyRef.current = null;
    setSelectedFile(file);
    setCandidate(null);
    setCoverPreviewUrl(null);
    setError(null);
    setPhase("selected");
  }

  function openPicker() {
    if (isBusy) return;
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.click();
  }

  async function handleApprove() {
    if (!candidate || !canApprove || phase === "approving") return;

    setPhase("approving");
    setError(null);

    try {
      const response = await approveCategoryCover(categoryId, candidate.id);
      if (!response.success || !response.data) {
        throw new Error(response.message || "Category cover could not be approved.");
      }

      setCandidate(response.data);
      setPhase("approved");
      pushToast({
        title: "Category cover updated",
        message: "The optimized cover is now active on the storefront.",
        variant: "success"
      });
      void Promise.resolve(onChanged?.()).catch(() => undefined);
      setCandidateRefreshKey((current) => current + 1);
    } catch (approvalError) {
      setPhase("preview");
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : "Category cover could not be approved."
      );
    }
  }

  async function handleDiscard() {
    if (!candidate || candidateIsActive || phase === "discarding") return;

    setPhase("discarding");
    setError(null);

    try {
      const response = await rejectCategoryCover(categoryId, candidate.id);
      if (!response.success || !response.data) {
        throw new Error(response.message || "Category cover candidate could not be discarded.");
      }

      setSelectedFile(null);
      setCandidate(null);
      setOriginalPreviewUrl(null);
      setCoverPreviewUrl(null);
      setPhase("idle");
      void Promise.resolve(onChanged?.()).catch(() => undefined);
      setCandidateRefreshKey((current) => current + 1);
    } catch (discardError) {
      setPhase("preview");
      setError(
        discardError instanceof Error
          ? discardError.message
          : "Category cover candidate could not be discarded."
      );
    }
  }

  async function handleRemoveActive() {
    if (!activeCoverAssetId || phase === "removing") return;

    setPhase("removing");
    setError(null);

    try {
      const response = await removeActiveCategoryCover(categoryId);
      if (!response.success) {
        throw new Error(response.message || "Active category cover could not be removed.");
      }

      setRemoveConfirmOpen(false);
      setSelectedFile(null);
      setCandidate(null);
      setOriginalPreviewUrl(null);
      setCoverPreviewUrl(null);
      setPhase("idle");
      pushToast({
        title: "Category cover removed",
        message: "The category now uses the neutral missing-cover presentation.",
        variant: "success"
      });
      void Promise.resolve(onChanged?.()).catch(() => undefined);
      setCandidateRefreshKey((current) => current + 1);
    } catch (removeError) {
      setRemoveConfirmOpen(false);
      setPhase(candidateIsActive ? "approved" : "preview");
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Active category cover could not be removed."
      );
    }
  }

  return (
    <>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">Category cover</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
              Choose the merchandising image. The category-cover engine validates and optimizes it;
              product photos are never selected automatically.
            </p>
          </div>
          <Button disabled={isBusy} onClick={openPicker} type="button" variant="secondary">
            {candidate || activeCoverAssetId ? (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
            )}
            {candidate || activeCoverAssetId ? "Upload another" : "Choose image"}
          </Button>
        </div>

        <input
          accept=".jpg,.jpeg,.png,.webp"
          className="hidden"
          disabled={isBusy}
          onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
          ref={inputRef}
          type="file"
        />

        {!candidate && !selectedFile && !activeCoverAssetId && phase !== "error" ? (
          <button
            className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center transition-colors hover:border-violet-300 hover:bg-violet-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            onClick={openPicker}
            type="button"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-50 text-violet-700">
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="mt-3 text-sm font-semibold text-slate-950">
              Choose a premium category image
            </span>
            <span className="mt-1 text-xs leading-5 text-slate-500">
              JPG, PNG, or WebP · up to 8 MB · landscape recommended
            </span>
          </button>
        ) : null}

        {activeCoverAssetId && candidate && !candidateIsActive ? (
          <Alert>
            <AlertTitle>Current storefront cover stays live</AlertTitle>
            <AlertDescription>
              This replacement will not displace the active cover until you approve it.
            </AlertDescription>
          </Alert>
        ) : null}

        {phase === "uploading" ? (
          <LoadingState
            badge="Category cover"
            helper="Checking resolution, crop suitability, and preparing storefront variants."
            label="Optimizing category cover..."
          />
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Image needs attention</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {(selectedFile || candidate) &&
        ["selected", "preview", "approving", "approved", "discarding", "error"].includes(phase) ? (
          <div className="grid gap-4 md:grid-cols-2">
            <ImagePreview title="Original" url={originalPreviewUrl} />
            <ImagePreview
              loading={Boolean(
                candidate && candidate.processingStatus === "READY" && !coverPreviewUrl && !error
              )}
              title="Optimized cover"
              url={coverPreviewUrl}
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
            ) : (
              <p className="text-sm text-slate-600">
                The processed cover passed the current category-image checks.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              {!candidateIsActive ? (
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
              {canApprove && !candidateIsActive ? (
                <Button
                  disabled={phase === "approving"}
                  onClick={() => void handleApprove()}
                  type="button"
                >
                  {phase === "approving" ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  {phase === "approving" ? "Applying cover..." : "Use optimized cover"}
                </Button>
              ) : null}
              {candidateIsActive ? (
                <span className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Storefront cover active
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeCoverAssetId ? (
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <Button
              disabled={isBusy}
              onClick={() => setRemoveConfirmOpen(true)}
              type="button"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove active cover
            </Button>
          </div>
        ) : null}
      </section>

      <Dialog
        open={removeConfirmOpen}
        onOpenChange={(open) => !isBusy && setRemoveConfirmOpen(open)}
      >
        <DialogContent className="max-w-[460px] gap-0 p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle>Remove category cover?</DialogTitle>
            <DialogDescription>
              The category will return to the neutral missing-cover presentation until another image
              is approved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={phase === "removing"}
              type="button"
              variant="secondary"
              onClick={() => setRemoveConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={phase === "removing"}
              type="button"
              variant="danger"
              onClick={() => void handleRemoveActive()}
            >
              {phase === "removing" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              )}
              {phase === "removing" ? "Removing..." : "Remove cover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ImagePreview({
  loading = false,
  title,
  url
}: {
  loading?: boolean;
  title: string;
  url: string | null;
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <figcaption className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </figcaption>
      <div className="grid aspect-video place-items-center bg-slate-100">
        {url ? (
          <img alt="" className="h-full w-full object-cover" src={url} />
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

function QualityIndicator({ status }: { status: CategoryImageCandidate["qualityStatus"] }) {
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

function formatQualityStatus(status: CategoryImageCandidate["qualityStatus"]) {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return "Needs review";
}
