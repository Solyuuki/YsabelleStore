#!/usr/bin/env node
import { createHash } from "node:crypto";
import { buildCanonicalSubset } from "./canonical-data-materializer.mjs";

export const CHANGESET_FORMAT_VERSION = 1;
export const RUNTIME_PRIVATE_TABLES = new Set([
  "users",
  "trusted_devices",
  "customer_accounts",
  "customer_sessions",
  "customer_cart_items",
  "customer_orders",
  "customer_order_items",
  "sales",
  "sale_items",
  "inventory",
  "inventory_batches",
  "inventory_movements"
]);

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableObject(child)])
  );
}

export function stableJson(value) {
  return JSON.stringify(stableObject(value));
}

export function digest(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function snapshotFromSubset(subset) {
  const tables = {};
  for (const [table, rows] of Object.entries(subset.rows ?? {})) {
    tables[table] = Object.fromEntries(
      [...rows]
        .sort((left, right) => String(left.id).localeCompare(String(right.id)))
        .map((row) => [
          String(row.id),
          Object.fromEntries(
            Object.entries(row).sort(([left], [right]) => left.localeCompare(right))
          )
        ])
    );
  }
  return { formatVersion: 1, tables };
}

export function buildCanonicalSnapshot({ catalogSql, release, reconciliation }) {
  return snapshotFromSubset(buildCanonicalSubset({ catalogSql, release, reconciliation }));
}

function valueAt(row, field) {
  return Object.prototype.hasOwnProperty.call(row ?? {}, field)
    ? { present: true, value: row[field] }
    : { present: false, value: null };
}

export function diffSnapshots(base, target) {
  const changes = [];
  const tables = new Set([...Object.keys(base.tables ?? {}), ...Object.keys(target.tables ?? {})]);
  for (const table of [...tables].sort()) {
    const beforeTable = base.tables?.[table] ?? {};
    const afterTable = target.tables?.[table] ?? {};
    const ids = new Set([...Object.keys(beforeTable), ...Object.keys(afterTable)]);
    for (const id of [...ids].sort()) {
      const beforeRow = beforeTable[id] ?? {};
      const afterRow = afterTable[id] ?? {};
      const fields = new Set([...Object.keys(beforeRow), ...Object.keys(afterRow)]);
      for (const field of [...fields].sort()) {
        const before = valueAt(beforeRow, field);
        const after = valueAt(afterRow, field);
        if (before.present === after.present && stableJson(before.value) === stableJson(after.value)) {
          continue;
        }
        changes.push({
          table,
          id,
          field,
          beforePresent: before.present,
          before: before.value,
          afterPresent: after.present,
          after: after.value
        });
      }
    }
  }
  return changes;
}

export function changeKey(change) {
  return [change.table, change.id, change.field].join("\u0000");
}

export function detectChangeConflicts(left, right) {
  const leftByKey = new Map(left.map((change) => [changeKey(change), change]));
  const conflicts = [];
  for (const incoming of right) {
    const current = leftByKey.get(changeKey(incoming));
    if (!current) continue;
    if (
      current.afterPresent !== incoming.afterPresent ||
      stableJson(current.after) !== stableJson(incoming.after)
    ) {
      conflicts.push({
        table: incoming.table,
        id: incoming.id,
        field: incoming.field,
        leftAfter: current.after,
        rightAfter: incoming.after
      });
    }
  }
  return conflicts;
}

export function mergeNonOverlappingChanges(left, right) {
  const conflicts = detectChangeConflicts(left, right);
  if (conflicts.length) {
    throw new Error(
      "Canonical changes conflict on " +
        conflicts.map((item) => item.table + "/" + item.id + "/" + item.field).join(", ")
    );
  }
  const merged = new Map();
  for (const change of [...left, ...right]) merged.set(changeKey(change), change);
  return [...merged.values()].sort((a, b) => changeKey(a).localeCompare(changeKey(b)));
}

export function createChangeset({
  baseCommit,
  baseState,
  targetState,
  baseSnapshot,
  targetSnapshot
}) {
  const body = {
    formatVersion: CHANGESET_FORMAT_VERSION,
    base: {
      commit: baseCommit,
      releaseId: baseState.releaseId,
      catalogVersion: baseState.catalogVersion,
      assetVersion: baseState.assetVersion,
      snapshotSha256: digest(baseSnapshot)
    },
    proposed: {
      releaseId: targetState.releaseId,
      catalogVersion: targetState.catalogVersion,
      assetVersion: targetState.assetVersion,
      snapshotSha256: digest(targetSnapshot)
    },
    changes: diffSnapshots(baseSnapshot, targetSnapshot)
  };
  return {
    changesetId: "cs-" + digest(body).slice(0, 20),
    ...body
  };
}

export function inspectChangeset(changeset, { canonicalTables, excludedRuntimeTables = [] }) {
  const findings = [];
  const allowed = new Set(canonicalTables ?? []);
  const denied = new Set([...RUNTIME_PRIVATE_TABLES, ...excludedRuntimeTables]);
  if (changeset.formatVersion !== CHANGESET_FORMAT_VERSION) {
    findings.push("BLOCK: changeset formatVersion must be 1.");
  }
  if (!/^cs-[0-9a-f]{20}$/.test(changeset.changesetId ?? "")) {
    findings.push("BLOCK: changesetId is invalid.");
  }
  if (!changeset.base?.commit || !/^[0-9a-f]{40}$/.test(changeset.base.commit)) {
    findings.push("BLOCK: changeset base commit is invalid.");
  }
  if (!Number.isInteger(changeset.base?.catalogVersion)) {
    findings.push("BLOCK: changeset base catalogVersion is invalid.");
  }
  if (!Number.isInteger(changeset.proposed?.catalogVersion)) {
    findings.push("BLOCK: changeset proposed catalogVersion is invalid.");
  }

  const changes = changeset.changes ?? [];
  const keys = changes.map(changeKey);
  if (new Set(keys).size !== keys.length) {
    findings.push("BLOCK: changeset contains duplicate fields.");
  }
  if (JSON.stringify(keys) !== JSON.stringify([...keys].sort())) {
    findings.push("BLOCK: changeset fields are not deterministically sorted.");
  }

  for (const change of changes) {
    if (!allowed.has(change.table)) {
      findings.push("BLOCK: changeset table is outside canonical scope: " + change.table + ".");
    }
    if (denied.has(change.table)) {
      findings.push("BLOCK: runtime/private table cannot be published: " + change.table + ".");
    }
    if (!change.id || !change.field) {
      findings.push("BLOCK: changeset contains an unstable row/field identity.");
    }
  }

  const { changesetId, ...body } = changeset;
  const expectedId = "cs-" + digest(body).slice(0, 20);
  if (changesetId !== expectedId) {
    findings.push("BLOCK: changesetId does not match deterministic content.");
  }
  return findings;
}
