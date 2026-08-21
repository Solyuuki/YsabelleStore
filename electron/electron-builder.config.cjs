module.exports = {
  appId: "com.ysabellestore.desktop",
  productName: "YsabelleStore",
  directories: {
    buildResources: "build",
    output: "release"
  },
  files: ["dist/**/*", "package.json"],
  extraResources: [
    {
      from: "../frontend/dist",
      to: "frontend"
    },
    {
      from: "build/icon.ico",
      to: "app-icon.ico"
    }
  ],
  win: {
    icon: "build/icon.ico",
    target: ["nsis"]
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true
  }
};
