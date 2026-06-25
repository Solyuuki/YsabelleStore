export const appMetadata = Object.freeze({
  appId: "com.ysabellestore.desktop",
  appName: process.env.ELECTRON_APP_NAME?.trim() || "YsabelleStore",
  appUserModelId: "com.ysabellestore.desktop",
  productName: "YsabelleStore"
});

export const windowDefaults = Object.freeze({
  height: 800,
  minHeight: 720,
  minWidth: 1024,
  width: 1280
});
