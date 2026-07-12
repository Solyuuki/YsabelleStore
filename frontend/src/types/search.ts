import type { AppRoutePath } from "@/app/routes";

export type SearchActionResult = {
  id: string;
  label: string;
  description: string;
  path: AppRoutePath;
  badge: string;
};

export type SearchProductResult = {
  id: string;
  label: string;
  subtitle: string;
  badge: string;
  path: AppRoutePath;
};

export type SearchBatchResult = {
  id: string;
  label: string;
  subtitle: string;
  badge: string;
  path: AppRoutePath;
};

export type SearchReceiptResult = {
  id: string;
  label: string;
  subtitle: string;
  badge: string;
  path: AppRoutePath;
};

export type SearchResponseData = {
  query: string;
  hasSearchableRecords: boolean;
  counts: {
    products: number;
    batches: number;
    receipts: number;
  };
  products: SearchProductResult[];
  batches: SearchBatchResult[];
  receipts: SearchReceiptResult[];
  actions: SearchActionResult[];
};
