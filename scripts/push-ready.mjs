import { runAndPrint } from "./lib/run-command.mjs";

const memberIndex = process.argv.indexOf("--member");
const member = memberIndex >= 0 ? process.argv[memberIndex + 1] : null;
const args = ["run", "verify:local", ...(member ? ["--", "--member", member] : [])];

console.log("YsabelleStore Push Readiness Check (read-only)\n");
const result = runAndPrint("npm", args);
process.exit(result.status);
