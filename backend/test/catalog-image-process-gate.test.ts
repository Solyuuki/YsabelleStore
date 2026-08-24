import assert from "node:assert/strict";
import test from "node:test";

import { CatalogImageProcessGate } from "../src/modules/catalog-image/catalogImageProcessGate.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

test("catalog image process gate allows only one heavy job at a time", async () => {
  const gate = new CatalogImageProcessGate(1);
  const firstRelease = deferred<void>();
  const secondRelease = deferred<void>();
  const entered: string[] = [];

  const first = gate.run(async () => {
    entered.push("first");
    await firstRelease.promise;
    return "first-done";
  });
  const second = gate.run(async () => {
    entered.push("second");
    await secondRelease.promise;
    return "second-done";
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(entered, ["first"]);
  assert.equal(gate.activeCount, 1);
  assert.equal(gate.queuedCount, 1);

  firstRelease.resolve();
  assert.equal(await first, "first-done");
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(entered, ["first", "second"]);
  assert.equal(gate.activeCount, 1);
  assert.equal(gate.queuedCount, 0);

  secondRelease.resolve();
  assert.equal(await second, "second-done");
  assert.equal(gate.activeCount, 0);
});

test("catalog image process gate releases the next job after a failure", async () => {
  const gate = new CatalogImageProcessGate(1);
  const firstRelease = deferred<void>();
  let secondEntered = false;

  const first = gate.run(async () => {
    await firstRelease.promise;
    throw new Error("expected failure");
  });
  const second = gate.run(async () => {
    secondEntered = true;
    return "recovered";
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(secondEntered, false);

  firstRelease.resolve();
  await assert.rejects(first, /expected failure/);
  assert.equal(await second, "recovered");
  assert.equal(gate.activeCount, 0);
  assert.equal(gate.queuedCount, 0);
});
