import { LoaderCircle } from "lucide-react";
import { useMemo } from "react";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

type AppPaginationProps = {
  className?: string;
  isLoading?: boolean;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  page: number;
  pageSize: number;
  pageSizeOptions?: readonly number[];
  siblingCount?: number;
  totalItems: number;
  totalPages?: number;
};

type PageToken = number | "start-ellipsis" | "end-ellipsis";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export function AppPagination({
  className,
  isLoading = false,
  itemLabel = "items",
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  siblingCount = 1,
  totalItems,
  totalPages
}: AppPaginationProps) {
  const normalizedPageSize = Math.max(pageSize, 1);
  const derivedTotalPages =
    totalItems === 0 ? 0 : Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const resolvedTotalPages = Math.max(0, totalPages ?? derivedTotalPages);
  const currentPage = resolvedTotalPages === 0 ? 1 : clampPage(page, resolvedTotalPages);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * normalizedPageSize + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(currentPage * normalizedPageSize, totalItems);
  const pageTokens = useMemo(
    () =>
      resolvedTotalPages > 0
        ? getPaginationTokens(currentPage, resolvedTotalPages, siblingCount)
        : [],
    [currentPage, resolvedTotalPages, siblingCount]
  );
  const showPageControls = resolvedTotalPages > 0;
  const showPageSizeSelector =
    Boolean(onPageSizeChange) && pageSizeOptions.length > 0 && totalItems > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-indigo-100/80 bg-white/90 px-4 py-3 shadow-[0_10px_30px_rgba(79,70,229,0.06)] backdrop-blur-sm",
        "sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p className="text-sm text-slate-600">
        {totalItems === 0
          ? `Showing 0 ${itemLabel}`
          : `Showing ${startItem}-${endItem} of ${totalItems} ${itemLabel}`}
        {isLoading ? (
          <span className="ml-3 inline-flex items-center gap-1 font-medium text-indigo-700">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Updating...
          </span>
        ) : null}
      </p>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {showPageSizeSelector ? (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="whitespace-nowrap font-medium">Rows per page</span>
            <select
              aria-label="Rows per page"
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition-all hover:border-indigo-200 focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              value={pageSize}
              onChange={(event) => {
                onPageSizeChange?.(Number(event.target.value));
              }}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {showPageControls ? (
          <Pagination aria-label={`${itemLabel} pagination`} className="w-auto justify-end">
            <PaginationContent className="flex-wrap gap-1">
              <PaginationItem>
                <PaginationPrevious
                  aria-label="Previous page"
                  disabled={isLoading || currentPage === 1}
                  size="icon"
                  onClick={() => {
                    if (!isLoading && currentPage > 1) {
                      onPageChange(currentPage - 1);
                    }
                  }}
                  type="button"
                >
                  <span className="sr-only">Previous page</span>
                </PaginationPrevious>
              </PaginationItem>

              {pageTokens.map((token) => {
                if (token === "start-ellipsis" || token === "end-ellipsis") {
                  return (
                    <PaginationItem key={token}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }

                const isActive = token === currentPage;

                return (
                  <PaginationItem key={token}>
                    <PaginationLink
                      asChild
                      isActive={isActive}
                      onClick={(event) => {
                        event.preventDefault();

                        if (!isLoading && !isActive) {
                          onPageChange(token);
                        }
                      }}
                      type="button"
                    >
                      <button
                        aria-label={`Page ${token}`}
                        disabled={isLoading || isActive}
                        type="button"
                      >
                        {token}
                      </button>
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              <PaginationItem>
                <PaginationNext
                  aria-label="Next page"
                  disabled={isLoading || currentPage === resolvedTotalPages}
                  size="icon"
                  onClick={() => {
                    if (!isLoading && currentPage < resolvedTotalPages) {
                      onPageChange(currentPage + 1);
                    }
                  }}
                  type="button"
                >
                  <span className="sr-only">Next page</span>
                </PaginationNext>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        ) : null}
      </div>
    </div>
  );
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), totalPages);
}

function getPaginationTokens(
  currentPage: number,
  totalPages: number,
  siblingCount: number
): PageToken[] {
  if (totalPages <= 1) {
    return totalPages === 1 ? [1] : [];
  }

  const totalPageNumbers = siblingCount * 2 + 5;

  if (totalPageNumbers >= totalPages) {
    return range(1, totalPages);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);
  const showLeftEllipsis = leftSiblingIndex > 2;
  const showRightEllipsis = rightSiblingIndex < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = 3 + siblingCount * 2;
    return [...range(1, leftItemCount), "end-ellipsis", totalPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = 3 + siblingCount * 2;
    return [1, "start-ellipsis", ...range(totalPages - rightItemCount + 1, totalPages)];
  }

  return [
    1,
    "start-ellipsis",
    ...range(leftSiblingIndex, rightSiblingIndex),
    "end-ellipsis",
    totalPages
  ];
}

function range(start: number, end: number) {
  const safeStart = Math.min(start, end);
  const safeEnd = Math.max(start, end);

  return Array.from({ length: safeEnd - safeStart + 1 }, (_, index) => safeStart + index);
}
