export type SearchActionResult = {
  id: string;
  label: string;
  description: string;
  path: string;
  badge: string;
};

export type SearchProductResult = {
  id: string;
  label: string;
  subtitle: string;
  badge: string;
  path: string;
};

export type SearchBatchResult = {
  id: string;
  label: string;
  subtitle: string;
  badge: string;
  path: string;
};

export type SearchReceiptResult = {
  id: string;
  label: string;
  subtitle: string;
  badge: string;
  path: string;
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
