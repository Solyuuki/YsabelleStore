export const allowedIpcChannels = [] as const;

export type AllowedIpcChannel = (typeof allowedIpcChannels)[number];
