# Ysabelle Store thesis — CHM E-Book

This is a **documentation-only** workstream based on `sprint/v0.13/sprint-13`.

## Scope

Convert the approved 138-page `BSCS4A_GROUP10_FINAL_final.pdf` into a navigable Microsoft Compiled HTML Help (`.chm`) E-Book, following the two-page faculty `Guide-to-Compiling-CHM.pdf`.

The source manuscript, appendices, signed certification, embedded screenshots, and curriculum vitae must remain unmodified. Do not deploy or merge these files with the customer-facing app.

## Current deliverable

A compilation-ready local ZIP was produced in the associated ChatGPT conversation. The ZIP contains:

- `Ysabelle_Store_Thesis.hhp` — HTML Help project file.
- `Table of Contents.hhc` — collapsible navigation tree.
- `HTML FILES/*.htm` — 29 individually navigable thesis sections.
- `HTML FILES/assets/page-001.jpg` through `page-138.jpg` — fidelity-preserving representations of the original PDF pages.
- `HTML FILES/style.css` and `HTML FILES/viewer.js`.
- `section_manifest.csv` and `README-WINDOWS.txt`.

**Privacy:** The source PDF and ZIP were intentionally **not** pushed into the application repository, because the thesis contains student CVs, personal contact details, and other non-public content. Download the ZIP directly from the associated conversation; do not upload the thesis assets to a public repository.

## Final Windows compilation

1. Extract the complete ZIP into a local folder.
2. Install a verified Microsoft HTML Help Workshop on Windows.
3. In HTML Help Workshop select **File > Compile**.
4. Locate `Ysabelle_Store_Thesis.hhp` in the extracted root folder.
5. Compile to produce `Ysabelle_Store_Thesis.chm`.
6. Open it locally and verify all 29 sections, all figures, Appendices A–J, and the 3 CV sections.
7. Upload the final CHM file using the institution's designated Google Form (group leader only, one upload).

## Current limitation

The execution environment used for preparation does not have a Windows HTML Help Workshop compiler installed. The local source package is generated, but successful `.chm` compilation and opening on Windows remain to be validated.

## Quality checks

- [x] 138 source PDF pages included
- [x] 29 HTML navigation sections generated
- [x] Chapter 1–4, references, Appendices A–J, three CVs
- [x] UTF-8 source pages
- [x] HTML Help project and contents files generated
- [ ] Windows compilation
- [ ] Windows CHM navigation and appearance review
- [ ] Verify all certification signatures prior to submission
