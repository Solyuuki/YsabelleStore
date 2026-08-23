import fs from 'node:fs';
import path from 'node:path';

const mode = process.argv[2];
if (!['tests', 'apply'].includes(mode)) {
  console.error('Usage: node phase5-ciqe-autoreview-cancel-fix.mjs <tests|apply>');
  process.exit(2);
}

const root = process.cwd();
const rootPackage = path.join(root, 'package.json');
if (!fs.existsSync(rootPackage)) {
  throw new Error(`Run this from the YsabelleStore repository root. Missing ${rootPackage}`);
}
const pkg = JSON.parse(fs.readFileSync(rootPackage, 'utf8').replace(/^\uFEFF/, ''));
if (pkg.name !== 'ysabellestore') {
  throw new Error(`Expected ysabellestore package at ${root}; found ${String(pkg.name)}`);
}

function readPreserved(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const buffer = fs.readFileSync(absolutePath);
  const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  return { absolutePath, hasBom, newline, text };
}

function writePreserved(file, text) {
  const content = `${file.hasBom ? '\uFEFF' : ''}${text}`;
  fs.writeFileSync(file.absolutePath, content, 'utf8');
}

function normalizeTemplate(template, newline) {
  return template.replace(/\n/g, newline);
}

function replaceOnce(file, beforeTemplate, afterTemplate, label) {
  const before = normalizeTemplate(beforeTemplate, file.newline);
  const after = normalizeTemplate(afterTemplate, file.newline);
  const first = file.text.indexOf(before);
  if (first < 0) {
    if (file.text.includes(after)) return false;
    throw new Error(`Could not locate ${label} in ${path.relative(root, file.absolutePath)}`);
  }
  if (file.text.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Found multiple matches for ${label} in ${path.relative(root, file.absolutePath)}`);
  }
  file.text = `${file.text.slice(0, first)}${after}${file.text.slice(first + before.length)}`;
  return true;
}

function insertBeforeOnce(file, markerTemplate, insertionTemplate, idempotencyMarker, label) {
  if (file.text.includes(idempotencyMarker)) return false;
  const marker = normalizeTemplate(markerTemplate, file.newline);
  const index = file.text.indexOf(marker);
  if (index < 0) throw new Error(`Could not locate ${label} in ${path.relative(root, file.absolutePath)}`);
  file.text = `${file.text.slice(0, index)}${normalizeTemplate(insertionTemplate, file.newline)}${file.text.slice(index)}`;
  return true;
}

function createFileIfMissing(relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  if (fs.existsSync(absolutePath)) {
    const existing = fs.readFileSync(absolutePath, 'utf8').replace(/^\uFEFF/, '');
    if (existing === content) return false;
    throw new Error(`${relativePath} already exists with unexpected content.`);
  }
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf8');
  return true;
}

function installTests() {
  const pythonTest = `from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


class CatalogImageAutoReviewTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.script = Path(__file__).resolve().parents[1] / "app" / "main.py"

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def run_engine(self, source: Path) -> dict:
        output = self.root / f"output-{source.stem}"
        completed = subprocess.run(
            [sys.executable, str(self.script)],
            input=json.dumps({"sourcePath": str(source), "outputDirectory": str(output)}),
            capture_output=True,
            check=False,
            text=True,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        result = json.loads(completed.stdout)
        result["_output"] = output
        return result

    def test_repairable_source_framing_is_auto_approved_after_normalization(self) -> None:
        source = self.root / "small-in-frame.png"
        image = Image.new("RGB", (1800, 1800), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((650, 280, 1150, 1520), fill=(25, 55, 120))
        for y in range(360, 1460, 44):
            draw.line((700, y, 1100, y), fill=(245, 245, 245), width=10)
        image.save(source)

        result = self.run_engine(source)

        self.assertEqual(result["status"], "APPROVED")
        self.assertNotIn(
            "PRODUCT_TOO_SMALL_IN_FRAME",
            {item["code"] for item in result["diagnostics"]},
        )
        self.assertTrue((result["_output"] / "processed.webp").is_file())

    def test_unresolved_post_optimization_warning_is_auto_rejected(self) -> None:
        source = self.root / "medium-resolution.png"
        image = Image.new("RGB", (300, 420), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((80, 60, 220, 360), fill=(30, 80, 180))
        for y in range(100, 340, 24):
            draw.line((95, y, 205, y), fill=(245, 245, 245), width=5)
        image.save(source)

        result = self.run_engine(source)

        self.assertEqual(result["status"], "REJECTED")
        self.assertNotEqual(result["status"], "NEEDS_REVIEW")
        self.assertIn(
            "PDP_RESOLUTION_LOW",
            {item["code"] for item in result["diagnostics"]},
        )
        self.assertTrue((result["_output"] / "processed.webp").is_file())


if __name__ == "__main__":
    unittest.main()
`;

  createFileIfMissing('catalog-image-engine/tests/test_auto_review.py', pythonTest);

  const backendTest = readPreserved('backend/test/catalog-image-latest-candidate.test.ts');
  insertBeforeOnce(
    backendTest,
    'test("latest product image candidate rejects an unknown product", async () => {',
    `test("latest product image candidate ignores manually and automatically rejected drafts", async () => {
  const service = await loadProductImageService();
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const category = await prisma.category.create({
      data: {
        dataQualityStatus: "APPROVED",
        isActive: true,
        isStorefrontVisible: false,
        name: \`Latest Recoverable \${suffix}\`,
        recordSource: "TEST_FIXTURE",
        slug: \`latest-recoverable-\${suffix}\`
      }
    });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        costPrice: "10",
        dataQualityStatus: "APPROVED",
        isStorefrontVisible: false,
        name: \`Latest Recoverable Product \${suffix}\`,
        recordSource: "TEST_FIXTURE",
        sellingPrice: "15",
        sku: \`LATEST-RECOVERABLE-\${suffix}\`,
        status: "ACTIVE",
        unit: "PIECE"
      }
    });

    const recoverable = await prisma.productImageAsset.create({
      data: {
        createdAt: new Date("2026-08-23T10:00:00.000Z"),
        originalStorageKey: \`candidates/\${suffix}/recoverable.webp\`,
        productId: product.id,
        sourceBytes: 100,
        sourceMimeType: "image/webp"
      }
    });
    await prisma.productImageAsset.create({
      data: {
        createdAt: new Date("2026-08-23T11:00:00.000Z"),
        originalStorageKey: \`candidates/\${suffix}/manual-rejected.webp\`,
        productId: product.id,
        qualityStatus: "REJECTED",
        rejectedAt: new Date("2026-08-23T11:01:00.000Z"),
        sourceBytes: 110,
        sourceMimeType: "image/webp"
      }
    });
    await prisma.productImageAsset.create({
      data: {
        createdAt: new Date("2026-08-23T12:00:00.000Z"),
        originalStorageKey: \`candidates/\${suffix}/auto-rejected.webp\`,
        productId: product.id,
        qualityStatus: "REJECTED",
        sourceBytes: 120,
        sourceMimeType: "image/webp"
      }
    });

    const latest = await service.getLatestProductImageCandidate(product.id);
    assert.equal(latest?.id, recoverable.id);
  } finally {
    await scope.cleanup();
  }
});

`
    'latest product image candidate ignores manually and automatically rejected drafts',
    'latest candidate rejected-draft regression insertion point'
  );
  writePreserved(backendTest, backendTest.text);

  const uiTest = `import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const productsSource = fs.readFileSync(path.join(root, "frontend/src/pages/ProductsPage.tsx"), "utf8");
const panelSource = fs.readFileSync(
  path.join(root, "frontend/src/components/catalog/ProductImageUploadPanel.tsx"),
  "utf8"
);

test("cancelled edit sessions discard newly uploaded image candidates", () => {
  assert.match(productsSource, /draftImageCandidateIds/);
  assert.match(productsSource, /rejectProductImage\\(product\\.id, candidateId\\)/);
  assert.match(productsSource, /onCandidateCreated=\\{\\(candidate\\) =>/);
  assert.match(productsSource, /handleCancelEditing/);
  assert.match(productsSource, /handleCloseRequest/);
});

test("owner can explicitly discard an unapproved hydrated candidate", () => {
  assert.match(panelSource, /rejectProductImage/);
  assert.match(panelSource, /handleDiscard/);
  assert.match(panelSource, /Discard upload/);
  assert.match(panelSource, /onCandidateDiscarded/);
});
`;
  createFileIfMissing('scripts/test/product-image-draft-lifecycle.test.mjs', uiTest);

  console.log('Phase 5 regression tests installed. Production files were not changed.');
}

function applyFix() {
  if (!fs.existsSync(path.join(root, 'catalog-image-engine/tests/test_auto_review.py')) ||
      !fs.existsSync(path.join(root, 'scripts/test/product-image-draft-lifecycle.test.mjs'))) {
    throw new Error('Install and run the RED regression tests first: node phase5-ciqe-autoreview-cancel-fix.mjs tests');
  }

  // 1. CIQE: final automatic decision comes from the normalized output.
  const main = readPreserved('catalog-image-engine/app/main.py');
  replaceOnce(
    main,
    `    result = analyze_image_path(source)
    diagnostic_codes = {item["code"] for item in result["diagnostics"]}
    blocking_codes = {"DECODE_FAILED", "PIXEL_LIMIT_EXCEEDED"}

    if not diagnostic_codes.intersection(blocking_codes):
        normalized = normalize_image_path(source, Path(output_directory))
        result.update(normalized)
`,
    `   source_result = analyze_image_path(source)
    diagnostic_codes = {item["code"] for item in source_result["diagnostics"]}
    blocking_codes = {"DECODE_FAILED", "PIXEL_LIMIT_EXCEEDED", "RESOLUTION_TOO_LOW"}
    result = source_result

    if not diagnostic_codes.intersection(blocking_codes):
        output = Path(output_directory)
        normalized = normalize_image_path(source, output)
        post_optimization = analyze_image_path(output / "processed.webp")
        result = {
            "status": "APPROVED" if post_optimization["status"] == "APPROVED" else "REJECTED",
            "source": source_result["source"],
            "diagnostics": post_optimization["diagnostics"],
            "metrics": post_optimization["metrics"],
        }
        result.update(normalized)
`,
    'CIQE post-normalization auto-review flow'
  );
  writePreserved(main, main.text);

  // 2. Latest-candidate hydration must not resurrect rejected drafts.
  const service = readPreserved('backend/src/modules/catalog-image/productImageService.ts');
  replaceOnce(
    service,
    `  return prisma.productImageAsset.findFirst({};
    orderBy: [{createdAt: "desc"}, {id: "desc"}],
    where: { productId }
  });
`,
    `  return prisma.productImageAsset.findFirst({
    orderBy: [{createdAt: "desc"}, {id: "desc"}],
    where: {
      productId,
      qualityStatus: { not: "REJECTED" },
      rejectedAt: null
    }
  });
`,
    'latest product image candidate filtering'
  );
  writePreserved(service, service.text);

  // 3. Product image panel: expose draft lifecycle and a recovery button for already-stuck drafts.
  const panel = readPreserved('frontend/src/components/catalog/ProductImageUploadPanel.tsx');
  replaceOnce(
    panel,
    `  getProductImageDiagnostics,
  uploadProductImage,
`,
    `  getProductImageDiagnostics,
  rejectProductImage,
  uploadProductImage,
`,
    'rejectProductImage import'
  );
  replaceOnce(
    panel,
    `  | "approving"
  | "approved"
  | "error";
`,
    `  | "approving"
  | "approved"
  | "discarding"
  | "error";
`,
    'discarding panel phase'
  );
  replaceOnce(
    panel,
    `  disabled = false,
  onApproved,
  onSelectionChange,
  productId,
  resetKey
}: {
  disabled?: boolean;
  onApproved?: (candidate: ProductImageCandidate) => void;
  onSelectionChange?: (hasSelectedImage: boolean) => void;
`,
    `  disabled = false,
  onApproved,
  onCandidateCreated,
  onCandidateDiscarded,
  onSelectionChange,
  productId,
  resetKey
}: {
  disabled?: boolean;
  onApproved?: (candidate: ProductImageCandidate) => void;
  onCandidateCreated?: (candidate: ProductImageCandidate) => void;
  onCandidateDiscarded?: (candidate: ProductImageCandidate) => void;
  onSelectionChange?: (hasSelectedImage: boolean) => void;
`,
    'draft lifecycle panel props'
  );
  replaceOnce(
    panel,
    `  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [candidate, setCandidate] = useState<ProductImageCandidate | null>(null);
`,
    `  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [candidate, setCandidate] = useState<ProductImageCandidate | null>(null);
  const [hydrationKey, setHydrationKey] = useState(0);
`,
    'hydration refresh state'
  );
  replaceOnce(
    panel,
    `  const isBusy = phase === "uploading" || phase === "approving";
`,
    `  const isBusy = phase === "uploading" || phase === "approving" || phase === "discarding";
`,
    'busy state for discard'
 );
  replaceOnce(
    panel,
    `  }, [onSelectionChange, productId, resetKey]);
`,
    `  }, [hydrationKey, onSelectionChange, productId, resetKey]);
`,
    'latest-candidate hydration dependencies'
  );
  replaceOnce(
    panel,
    `       setCandidate(response.data);
        setPhase(response.data.processingStatus === "FAILED" ? "error" : "preview");
`,
    `       setCandidate(response.data);
        onCandidateCreated?.(response.data);
        setPhase(response.data.processingStatus === "FAILED" ? "error" : "preview");
`,
    'new draft candidate callback'
  );
  insertBeforeOnce(
    panel,
    `  function openPicker() {`,
    `  async function handleDiscard() {
    if (!productId || !candidate || candidate.approvedAt || phase === "discarding") {
      return;
    }

    setPhase("discarding");
    setError(null);

    try {
      const response = await rejectProductImage(productId, candidate.id);
      if (!response.success || !response.data) {
        throw new Error(response.message || "The uploaded image could not be discarded.");
      }

      onCandidateDiscarded?.(response.data);
      clearSelection();
      setHydrationKey((current) => current + 1);
    } catch (discardError) {
      setPhase("preview");
      setError(
        discardError instanceof Error
          ? discardError.message
          : "The uploaded image could not be discarded."
    );
    }
  }

`,
    'async function handleDiscard()',
    'discard handler insertion point'
  );
  replaceOnce(
    panel,
    `          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button disabled={isBusy} onClick={openPicker} type="button" variant="secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Upload Another
            </Button>
            {canApprove && phase !== "approved" ? (
`,
    `          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button disabled={isBusy} onClick={openPicker} type="button" variant="secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Upload Another
            </Button>
            {!candidate.approvedAt ? (
              <Button
                disabled={isBusy}
                onClick={() => void handleDiscard()}
                type="button"
                variant="ghost"
              >
                {phase === "discarding" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {phase === "discarding" ? "Discarding..." : "Discard upload"}
              </Button>
            ) : null}
            {canApprove && phase !== "approved" ? (
`,
    'discard draft button'
  );
  writePreserved(panel, panel.text);

  // 4. Product edit modal: Cancel/X discards only candidates created in this edit session.
  const products = readPreserved('frontend/src/pages/ProductsPage.tsx');
  insertBeforeOnce(
    products,
    `import { formatFileSize, getImportFileType } from "@/utils/importFormatting";`,
    `import { rejectProductImage } from "@/services/productImageApi";
`,
    'from "@/services/productImageApi"',
    'product image API import insertion point'
  );
  replaceOnce(
    products,
    `  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
`,
    `  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discardingImageDrafts, setDiscardingImageDrafts] = useState(false);
  const [draftImageCandidateIds, setDraftImageCandidateIds] = useState<string[]>([]);
`,
    'edit dialog draft state'
  );
  replaceOnce(
    products,
    `    if (!product) {
      setIsEditing(false);
      return;
    }
`,
    `    if (!product) {
      setDraftImageCandidateIds([]);
      setIsEditing(false);
      return;
    }
`,
    'product-null draft reset'
  );
  replaceOnce(
    products,
    `    setIsEditing(false);
  }, [product]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
`,
    `    setDraftImageCandidateIds([]);
    setIsEditing(false);
  }, [product]);

  async function discardDraftImageCandidates() {
    if (!product || draftImageCandidateIds.length === 0) {
      return true;
    }

    setDiscardingImageDrafts(true);
    try {
      for (const candidateId of draftImageCandidateIds) {
        const response = await rejectProductImage(product.id, candidateId);
        if (!response.success) {
          throw new Error(response.message || "Image draft discard failed.");
        }
      }
      setDraftImageCandidateIds([]);
      return true;
    } catch (discardError) {
      pushToast({
        message:
          discardError instanceof Error
            ? discardError.message
            : "The uploaded image draft could not be discarded.",
        title: "Image draft not discarded",
        variant: "error"
      });
      return false;
    } finally {
      setDiscardingImageDrafts(false);
    }
  }

  async function handleCancelEditing() {
    if (draftImageCandidateIds.length > 0 && !(await discardDraftImageCandidates())) {
      return;
    }
    setIsEditing(false);
  }

  async function handleCloseRequest() {
    if (
      isEditing &&
      draftImageCandidateIds.length > 0 &&
      !(await discardDraftImageCandidates())
    ) {
      return;
    }
    onClose();
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
`,
    'draft candidate discard helpers'
  );
  replaceOnce(
    products,
    `      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
`,
    `      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          void handleCloseRequest();
        }
      }}
`,
    'dialog close draft cleanup'
  );
  replaceOnce(
    products,
    `                    <ProductImageUploadPanel
                      disabled={saving}
                      onApproved={() => {
                        pushToast({
                          message: "The optimized replacement is now active for the storefront.",
                          title: "Product image approved",
                          variant: "success"
                        });
                        onSaved();
                      }}
                      productId={product.id}
                      resetKey={\`${'${product.id}'}-${'${isEditing ? "edit" : "view"}'}\`}
                    />
`,
    `                    <ProductImageUploadPanel
                      disabled={saving || discardingImageDrafts}
                      onApproved={(candidate) => {
                        setDraftImageCandidateIds((current) =>
                          current.filter((candidateId) => candidateId !== candidate.id)
                        );
                        pushToast({
                          message: "The optimized replacement is now active for the storefront.",
                          title: "Product image approved",
                          variant: "success"
                        });
                        onSaved();
                      }}
                      onCandidateCreated={(candidate) => {
                        setDraftImageCandidateIds((current) =>
                          current.includes(candidate.id) ? current : [...current, candidate.id]
                        );
                      }}
                      onCandidateDiscarded={(candidate) => {
                        setDraftImageCandidateIds((current) =>
                          current.filter((candidateId) => candidateId !== candidate.id)
                        );
                      }}
                      productId={product.id}
                      resetKey={\`${'${product.id}'}-${'${isEditing ? "edit" : "view"}'}\`}
                    />
`,
    'product image panel draft callbacks'
  );
  replaceOnce(
    products,
    `              <Button
                disabled={saving}
                type="button"
                variant="secondary"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
`,
    `              <Button
                disabled={saving || discardingImageDrafts}
                type="button"
                variant="secondary"
                onClick={() => void handleCancelEditing()}
              >
                {discardingImageDrafts ? "Discarding image..." : "Cancel"}
              </Button>
`,
    'edit cancel draft cleanup'
  );
  // Preserve the earlier Phase 5 edit-button fix if already present; otherwise leave it for its own regression patch.
  writePreserved(products, products.text);

  console.log('Phase 5 CIQE auto-review + draft cancellation fix applied. No commit was created.');
}

if (mode === 'tests') installTests();
if (mode === 'apply') applyFix();
