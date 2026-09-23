export function resolveNpmInvocation(
  args,
  { env = process.env, platform = process.platform, execPath = process.execPath } = {}
) {
  const npmExecPath = env.npm_execpath?.trim();
  if (npmExecPath) {
    return {
      command: execPath,
      args: [npmExecPath, ...args],
      shell: false
    };
  }

  if (platform === "win32") {
    return {
      command: "npm",
      args,
      shell: true
    };
  }

  return {
    command: "npm",
    args,
    shell: false
  };
}
