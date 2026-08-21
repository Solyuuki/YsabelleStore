module.exports = {
  appId: "com.ysabellestore.desktop",
  productName: "YsabelleStore",
  directories: {
    output: "release"
  },
  files: ["dist/**/*", "package.json"],
  extraResources: [
    {
      from: "../frontend/dist",
      to: "frontend"
    }
  ],
  win: {
    icon: "../frontend/public/brand/ysabelle-store-mark.png",
    target: ["nsis"]
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true
  }
};
