export type PaginationInput = {
  page: number;
  pageSize: number;
};

export type PaginationMeta = PaginationInput & {
  totalItems: number;
  totalPages: number;
};

export function buildPaginationMeta(totalItems: number, input: PaginationInput): PaginationMeta {
  const totalPages = input.pageSize > 0 ? Math.max(1, Math.ceil(totalItems / input.pageSize)) : 1;

  return {
    page: input.page,
    pageSize: input.pageSize,
    totalItems,
    totalPages
  };
}
