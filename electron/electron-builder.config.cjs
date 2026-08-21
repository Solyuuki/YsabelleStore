module.exports = {
  appId: "com.ysabellestore.desktop",
  productName: "YsabelleStore",
  electronVersion: "42.8.1",
  directories: {
    buildResources: "build",
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
