# Acknowledgment placeholder cleanup (V4)

After testing V3 on Windows, the CHM viewer opened correctly. The user reviewed the thesis and identified one visible defect: the default Microsoft Word quote textbox in the **Acknowledgment** section.

The associated chat contains a downloadable local archive: `Ysabelle_Store_CHM_Project_v4_FIXED.zip` (about 17 MB).

## Fix applied
- Replaced the Acknowledgment image-display topic with a clean, document-styled HTML page using the **original four Acknowledgment paragraphs** and the three initials `J.D.S.V`, `A.R.A`, and `J.S.R`.
- Removed the same placeholder paragraph from the alternate readable Word-text topic.
- Preserved the unchanged original PDF and JPG assets in the source archive for reference; the corrected main page does not display that unchanged JPG.
- Kept all other 137 page views and the 29 main navigation sections unchanged.
- Changed the compile output filename to `Ysabelle_Store_Thesis_FIXED.chm` to avoid overwriting V3.

## Verification

- 167 HTML topics and 138 source page images were retained.
- Every local HTML image and hyperlink target resolved.
- The ZIP passed integrity checking.
- **Final Windows compilation and visual verification are still pending.**
- Genuine signed certification pages have not yet been integrated into this version; verify institution submission requirements before submitting.

Full thesis assets are not committed to the repo because they include private student details. No app/production code or deployment configuration was changed.
