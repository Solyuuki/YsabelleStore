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
    icon: "build/icon-v2.ico",
    target: ["nsis"]
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true
  }
};
