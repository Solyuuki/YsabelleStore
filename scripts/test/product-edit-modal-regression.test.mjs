import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

const productsSource = fs.readFileSync(
  path.join(root, "frontend/src/pages/ProductsPage.tsx"),
  "utf8"
);

const notificationSource = fs.readFileSync(
  path.join(root, "frontend/src/components/shared/NotificationStack.tsx"),
  "utf8"
);

const dialogSource = fs.readFileSync(
  path.join(root, "frontend/src/components/ui/dialog.tsx"),
  "utf8"
);

test("entering edit mode cannot reuse the clicked button as the save submit", () => {
  assert.match(
    productsSource,
    /key="product-edit-enter"[\s\S]{0,240}type="button"[\s\S]{0,240}event\.preventDefault\(\)[\s\S]{0,160}setIsEditing\(true\)/
  );

  assert.match(
    productsSource,
    /key="product-edit-save"[\s\S]{0,240}form="product-edit-form"[\s\S]{0,120}type="submit"/
  );
});

test("blank optional edit cost price is omitted from the update payload", () => {
  assert.match(productsSource, /costPrice:\s*form\.costPrice\.trim\(\)\s*\|\|\s*undefined/);
});

test("notifications render above the dialog overlay", () => {
  const toastZ = notificationSource.match(/fixed right-4 top-4 z-\[(\d+)\]/);

  const dialogZ = dialogSource.match(/fixed inset-0 z-(\d+)/);

  assert.ok(toastZ, "notification stack must use an explicit z-index above modal layers");

  assert.ok(dialogZ, "dialog overlay z-index must be discoverable");

  assert.ok(
    Number(toastZ[1]) > Number(dialogZ[1]),
    `toast z-index ${toastZ[1]} must exceed dialog z-index ${dialogZ[1]}`
  );
});
