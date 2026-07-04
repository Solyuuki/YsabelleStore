export const appMetadata = Object.freeze({
  appId: "com.ysabellestore.desktop",
  appName: process.env.ELECTRON_APP_NAME?.trim() || "YsabelleStore",
  appUserModelId: "com.ysabellestore.desktop",
  productName: "YsabelleStore"
});

export const windowDefaults = Object.freeze({
  height: 800,
  minHeight: 760,
  minWidth: 1200,
  width: 1280
});
