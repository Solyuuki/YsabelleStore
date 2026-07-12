export const IPC_CHANNEL_NAMESPACE = "ysabellestore";

export const receiptPrintRequestChannel = createIpcChannelName("request", "receipt-print");
export const receiptPrintDataChannel = createIpcChannelName("request", "receipt-print-data");
export const receiptPrintReadyChannel = createIpcChannelName("request", "receipt-print-ready");

export const allowedIpcChannels = [
  receiptPrintRequestChannel,
  receiptPrintDataChannel,
  receiptPrintReadyChannel
] as const;

export type AllowedIpcChannel = (typeof allowedIpcChannels)[number];

export function createIpcChannelName(scope: "event" | "request", feature: string): string {
  return `${IPC_CHANNEL_NAMESPACE}:${scope}:${feature}`;
}

export function isAllowedIpcChannel(channel: string): channel is AllowedIpcChannel {
  return (allowedIpcChannels as readonly string[]).includes(channel);
}
