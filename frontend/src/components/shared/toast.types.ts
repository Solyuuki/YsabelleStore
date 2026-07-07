export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastInput = {
  durationMs?: number;
  message: string;
  persistent?: boolean;
  scope?: string;
  title: string;
  variant: ToastVariant;
};

export type ToastItem = {
  closing: boolean;
  createdAt: number;
  durationMs: number;
  id: string;
} & ToastInput;
