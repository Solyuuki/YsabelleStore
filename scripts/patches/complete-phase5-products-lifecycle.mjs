import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const relativePath = "frontend/src/pages/ProductsPage.tsx";
const filePath = path.join(root, relativePath);

if (!fs.existsSync(filePath)) {
  throw new Error(`Missing ${relativePath}. Run this from the YsabelleStore repository root.`);
}

const buffer = fs.readFileSync(filePath);
const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
const raw = buffer.toString("utf8").replace(/^\uFEFF/, "");
const newline = raw.includes("\r\n") ? "\r\n" : "\n";
let text = raw.replace(/\r\n/g, "\n");

for (const required of [
  "draftImageCandidateIds",
  "rejectProductImage(product.id, candidateId)",
  "handleCancelEditing",
  "handleCloseRequest"
]) {
  if (!text.includes(required)) {
    throw new Error(`Expected earlier Phase 5 lifecycle helper is missing: ${required}`);
  }
}

const detailsStart = text.indexOf("function ProductDetailsDialog({");
if (detailsStart < 0) {
  throw new Error("Could not locate ProductDetailsDialog.");
}

function replaceInsideDetails(before, after, label) {
  if (text.includes(after)) {
    console.log(`already applied ${label}`);
    return;
  }

  const scoped = text.slice(detailsStart);
  const index = scoped.indexOf(before);
  if (index < 0) {
    throw new Error(`Could not locate ${label} inside ProductDetailsDialog.`);
  }
  if (scoped.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Multiple matches for ${label} inside ProductDetailsDialog.`);
  }

  const absolute = detailsStart + index;
  text = text.slice(0, absolute) + after + text.slice(absolute + before.length);
  console.log(`updated ${relativePath}: ${label}`);
}

replaceInsideDetails(
`      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}`,
`      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          void handleCloseRequest();
        }
      }}`,
  "dialog close request lifecycle"
);

replaceInsideDetails(
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
                      resetKey={\`${"${product.id}-${isEditing ? \"edit\" : \"view\"}"}\`}
                    />`,
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
                      resetKey={\`${"${product.id}-${isEditing ? \"edit\" : \"view\"}"}\`}
                    />`,
  "product image edit-session callbacks"
);

replaceInsideDetails(
`              <Button
                disabled={saving}
                type="button"
                variant="secondary"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>`,
`              <Button
                disabled={saving || discardingImageDrafts}
                type="button"
                variant="secondary"
                onClick={() => void handleCancelEditing()}
              >
                {discardingImageDrafts ? "Discarding image..." : "Cancel"}
              </Button>`,
  "edit cancel draft cleanup"
);

const output = text.replace(/\n/g, newline);
fs.writeFileSync(filePath, `${hasBom ? "\uFEFF" : ""}${output}`, "utf8");
console.log("Phase 5 ProductDetailsDialog lifecycle wiring applied. No commit was created.");
