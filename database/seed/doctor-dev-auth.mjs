import { scryptSync, timingSafeEqual } from "node:crypto";

import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("Development auth doctor cannot run when NODE_ENV=production.");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for development auth diagnostics.");
}

const prisma = new PrismaClient();
const accounts = [
  {
    email: "owner@ysabellestore.local",
    password: "OwnerPass#2026"
  },
  {
    email: "staff@ysabellestore.local",
    password: "StaffPass#2026"
  }
];

function describeDatabaseTarget(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return `${parsed.protocol.replace(/:$/, "")}://${parsed.hostname}:${parsed.port || "default"}/${parsed.pathname.replace(/^\//, "") || "(not specified)"}`;
}

function verifyStoredPassword(password, passwordHash) {
  const parts = passwordHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return { supported: false, matches: false, profile: "unsupported" };
  }

  const [, nValue, rValue, pValue, salt, encodedExpected] = parts;
  const N = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  const expected = Buffer.from(encodedExpected, "base64");

  if (
    !Number.isSafeInteger(N) ||
    !Number.isSafeInteger(r) ||
    !Number.isSafeInteger(p) ||
    expected.length === 0
  ) {
    return { supported: false, matches: false, profile: "invalid" };
  }

  const actual = scryptSync(password, salt, expected.length, {
    N,
    r,
    p,
    maxmem: Math.max(256 * 1024 * 1024, 128 * N * r + 16 * 1024 * 1024)
  });

  return {
    supported: true,
    matches: actual.length === expected.length && timingSafeEqual(actual, expected),
    profile: `scrypt$${N}$${r}$${p}`
  };
}

async function inspectDatabaseAccounts() {
  const results = [];

  for (const account of accounts) {
    const user = await prisma.user.findUnique({ where: { email: account.email } });

    if (!user) {
      results.push({
        email: account.email,
        found: false,
        passwordMatches: false,
        role: null,
        status: null,
        profile: null
      });
      continue;
    }

    const verification = verifyStoredPassword(account.password, user.passwordHash);
    results.push({
      email: account.email,
      found: true,
      passwordMatches: verification.matches,
      role: user.role,
      status: user.status,
      profile: verification.profile
    });
  }

  return results;
}

async function inspectHttpAccount(apiBaseUrl, account) {
  try {
    const response = await fetch(new URL("/api/auth/login", `${apiBaseUrl}/`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(account),
      signal: AbortSignal.timeout(5_000)
    });

    const payload = await response.json().catch(() => null);
    return {
      reachable: true,
      status: response.status,
      success: Boolean(payload?.success),
      code: payload?.error?.code ?? null,
      message: payload?.message ?? null
    };
  } catch (error) {
    return {
      reachable: false,
      status: null,
      success: false,
      code: "BACKEND_UNREACHABLE",
      message: error instanceof Error ? error.message : "Unknown backend connection error."
    };
  }
}

function printDatabaseResult(result) {
  console.info(
    `[db] ${result.email} found=${result.found} role=${result.role ?? "-"} status=${result.status ?? "-"} profile=${result.profile ?? "-"} passwordMatches=${result.passwordMatches}`
  );
}

function printHttpResult(email, result) {
  console.info(
    `[http] ${email} reachable=${result.reachable} status=${result.status ?? "-"} success=${result.success} code=${result.code ?? "-"} message=${result.message ?? "-"}`
  );
}

const apiBaseUrl = (
  process.env.VITE_API_BASE_URL || `http://localhost:${process.env.PORT || "3001"}`
).replace(/\/+$/, "");

try {
  console.info(`Development auth DB: ${describeDatabaseTarget(process.env.DATABASE_URL)}`);
  console.info(`Development auth API: ${apiBaseUrl}`);

  const databaseResults = await inspectDatabaseAccounts();
  databaseResults.forEach(printDatabaseResult);

  const httpResults = [];
  for (const account of accounts) {
    const result = await inspectHttpAccount(apiBaseUrl, account);
    httpResults.push({ email: account.email, ...result });
    printHttpResult(account.email, result);
  }

  const databaseHealthy = databaseResults.every(
    (result) => result.found && result.status === "ACTIVE" && result.passwordMatches
  );
  const backendReachable = httpResults.every((result) => result.reachable);
  const backendAuthHealthy = httpResults.every((result) => result.success && result.status === 200);

  console.info("");
  if (!databaseHealthy) {
    console.info("AUTH_DIAGNOSIS=DATABASE_AUTH_RECORD_MISMATCH");
    console.info("Action: run npm run auth:dev:repair, then rerun npm run auth:dev:doctor.");
  } else if (!backendReachable) {
    console.info("AUTH_DIAGNOSIS=BACKEND_UNREACHABLE");
    console.info("Action: start npm run dev:web, then rerun npm run auth:dev:doctor.");
  } else if (!backendAuthHealthy) {
    console.info("AUTH_DIAGNOSIS=RUNNING_BACKEND_DB_OR_PROCESS_MISMATCH");
    console.info(
      "The root .env database contains valid development credentials, but the running backend rejects them. Stop all Node processes and restart npm run dev:web from this repository."
    );
  } else {
    console.info("AUTH_DIAGNOSIS=DATABASE_AND_BACKEND_AUTH_OK");
    console.info(
      "The database and live backend both accept the development credentials. Any remaining failure is in the browser/frontend state or the password value entered in the form."
    );
  }
} finally {
  await prisma.$disconnect();
}
