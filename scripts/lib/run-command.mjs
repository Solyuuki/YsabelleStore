import { spawnSync } from "node:child_process";

export function commandName(command) {
  if (process.platform === "win32" && ["npm", "npx"].includes(command)) {
    return `${command}.cmd`;
  }

  return command;
}

export function runCommand(command, args = [], options = {}) {
  const isWindowsCommandShim = process.platform === "win32" && ["npm", "npx"].includes(command);
  const spawnCommand = isWindowsCommandShim ? "cmd.exe" : commandName(command);
  const spawnArgs = isWindowsCommandShim
    ? ["/d", "/s", "/c", [command, ...args].map(quoteWindowsArg).join(" ")]
    : args;
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.env ?? {})
    },
    shell: false,
    stdio: options.stdio ?? "pipe"
  });

  return {
    command: [command, ...args].join(" "),
    error: result.error,
    ok: result.status === 0,
    signal: result.signal,
    status: result.status ?? 1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? ""
  };
}

function quoteWindowsArg(value) {
  const text = String(value);

  if (!/[\s"&<>|]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '\\"')}"`;
}

export function runAndPrint(command, args = [], options = {}) {
  return runCommand(command, args, {
    ...options,
    stdio: "inherit"
  });
}

export function printTable(headers, rows) {
  const table = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell)).join(" | ")} |`)
  ].join("\n");

  console.log(table);
}
