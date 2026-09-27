import assert from "node:assert/strict";
import test from "node:test";

import { buildMysqldumpArgs, parseMysqlDatabaseUrl } from "../canonical-database-recovery.mjs";

test("mysqldump recovery ignores machine-local option files", () => {
  const connection = parseMysqlDatabaseUrl(
    "mysql://catalog_user:catalog_pass@127.0.0.1:3306/ysabelle_test"
  );
  const args = buildMysqldumpArgs(connection);

  assert.equal(args[0], "--no-defaults");
  assert.deepEqual(args.slice(1, 7), [
    "--host",
    "127.0.0.1",
    "--port",
    "3306",
    "--user",
    "catalog_user"
  ]);
  assert.equal(args.at(-1), "ysabelle_test");
  assert.ok(args.includes("--single-transaction"));
  assert.ok(args.includes("--default-character-set=utf8mb4"));
});

test("canonical pull recovery never regenerates Prisma after loading the engine", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../canonical-pull-sync.mjs", import.meta.url), "utf8")
  );
  const recoverStart = source.indexOf("async function recover(");
  const recoverEnd = source.indexOf("\nfunction blockers", recoverStart);
  assert.ok(recoverStart >= 0 && recoverEnd > recoverStart);
  const recoverSource = source.slice(recoverStart, recoverEnd);

  assert.doesNotMatch(recoverSource, /prisma:generate/);
  assert.match(source, /requiresPrismaRegeneration\(relevant, state\)/);
});
