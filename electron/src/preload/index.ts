import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("ysabelleStore", {
  platform: process.platform
});
