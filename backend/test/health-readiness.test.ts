import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";

type HealthBody = {
  success?: boolean;
  data?: {
    service?: string;
    status?: string;
    ready?: boolean;
    checks?: {
      database?: string;
      prisma?: string;
    };
  };
};

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function json(response: Response): Promise<HealthBody> {
  return (await response.json()) as HealthBody;
}

test("liveness reports the backend process alive without depending on database readiness", async () => {
  const originalDatabaseUrl = env.DATABASE_URL;

  try {
    env.DATABASE_URL = undefined;

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health/live`);
      const body = await json(response);

      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data?.service, "ysabellestore-backend");
      assert.equal(body.data?.status, "healthy");
    });
  } finally {
    env.DATABASE_URL = originalDatabaseUrl;
  }
});

test("readiness returns 200 healthy when critical database and configuration checks are ready", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health/ready`);
    const body = await json(response);

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data?.status, "healthy");
    assert.equal(body.data?.ready, true);
    assert.equal(body.data?.checks?.database, "connected");
  });
});

test("readiness returns 503 degraded when required authentication configuration is missing", async () => {
  const originalJwtSecret = env.JWT_SECRET;

  try {
    env.JWT_SECRET = undefined;

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health/ready`);
      const body = await json(response);

      assert.equal(response.status, 503);
      assert.equal(body.data?.status, "degraded");
      assert.equal(body.data?.ready, false);
      assert.equal(body.data?.checks?.database, "connected");
    });
  } finally {
    env.JWT_SECRET = originalJwtSecret;
  }
});

test("readiness fails with 503 unavailable when the database dependency is not configured", async () => {
  const originalDatabaseUrl = env.DATABASE_URL;

  try {
    env.DATABASE_URL = undefined;

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health/ready`);
      const body = await json(response);

      assert.equal(response.status, 503);
      assert.equal(body.data?.status, "unavailable");
      assert.equal(body.data?.ready, false);
      assert.equal(body.data?.checks?.database, "not_configured");
    });
  } finally {
    env.DATABASE_URL = originalDatabaseUrl;
  }
});

test("the existing health summary stays HTTP 200 compatible while exposing canonical health status", async () => {
  const originalDatabaseUrl = env.DATABASE_URL;

  try {
    env.DATABASE_URL = undefined;

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = await json(response);

      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data?.status, "unavailable");
      assert.equal(body.data?.ready, false);
      assert.equal(body.data?.checks?.database, "not_configured");
    });
  } finally {
    env.DATABASE_URL = originalDatabaseUrl;
  }
});
