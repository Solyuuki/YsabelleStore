import { allowedIpcChannels, IPC_CHANNEL_NAMESPACE } from "./channels.js";

export const ipcChannelRegistry = Object.freeze({
  allowedChannels: allowedIpcChannels,
  namespace: IPC_CHANNEL_NAMESPACE
});
