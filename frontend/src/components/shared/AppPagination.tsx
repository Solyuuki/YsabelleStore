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
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  siblingCount?: number;
  totalItems: number;
};

type PageToken = number | "start-ellipsis" | "end-ellipsis";

export function AppPagination({
  className,
  onPageChange,
  page,
  pageSize,
  siblingCount = 1,
  totalItems
}: AppPaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1) {
    return null;
  }

  const currentPage = clampPage(page, totalPages);
  const pageTokens = getPaginationTokens(currentPage, totalPages, siblingCount);

  return (
    <Pagination className={cn("w-full", className)}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            type="button"
          />
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
                onClick={() => {
                  if (!isActive) {
                    onPageChange(token);
                  }
                }}
                type="button"
              >
                <button type="button">{token}</button>
              </PaginationLink>
            </PaginationItem>
          );
        })}

        <PaginationItem>
          <PaginationNext
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            type="button"
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
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
