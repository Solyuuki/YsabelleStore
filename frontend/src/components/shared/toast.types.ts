export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastInput = {
  message: string;
  title: string;
  variant: ToastVariant;
  durationMs?: number;
};

export type ToastItem = {
  closing: boolean;
  durationMs: number;
  id: string;
} & ToastInput;
