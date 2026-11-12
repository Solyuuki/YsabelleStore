# Final Acknowledgment alignment correction — V5

The user supplied an institutional layout example showing the researcher's initials **aligned vertically at the bottom-right**, and identified the default Microsoft Word placeholder box on the Acknowledgment page.

## Corrections performed outside the application repository

- **Source Word document:** `BSCS4A_GROUP10_ACK_CORRECTED.docx` — removed exactly the placeholder text-box's Office `AlternateContent` shape; retained the original right-aligned initials paragraphs. The original Word source has 142 rendered pages in the available render environment. XML audit confirmed only `word/document.xml` changed, and page 5 was rendered and inspected.
- **Approved PDF:** `BSCS4A_GROUP10_FINAL_ACK_CORRECTED.pdf` — edited page 5 only, removing the placeholder text box and relocating the three original initials to the lower-right. The entire 138-page PDF is retained; all 137 other pages had identical text and sampled pages were pixel-identical. Page 5 was visually rendered and inspected.
- **CHM source:** `Ysabelle_Store_CHM_Project_v5_ACK_CORRECTED.zip` — reverted Acknowledgment to the established V3 single-image topic and replaced only `HTML FILES/assets/page-005.jpg` with an image rendered from the corrected PDF. The readable alternative now also right-aligns the three initials. Added an output filename `Ysabelle_Store_Thesis_ACK_CORRECTED.chm` so the user does not confuse it with V3/V4.

## Quality verification

- V4→V5 CHM source diff: five changed files (Acknowledgment HTML, readable Acknowledgment HTML, page-005.jpg, HHP output filename, README). No other CHM content changed.
- CHM source: **167 HTML topics**, **138 page images**, **339 archived files**, zero missing relative link/image targets, ZIP integrity passed.
- Both Word and PDF contain the same four Acknowledgment paragraphs and the three initials `J.D.S.V`, `A.R.A`, and `J.S.R` in bottom-right alignment.
- **Actual HTML Help Workshop V5 compilation and viewer QA still pending**. User should extract ZIP, open `.hhp`, compile, and verify Acknowledgment and navigation. Avoid uploading before checking institutional signed certification requirements.

**Privacy:** Corrected source ZIP/PDF/DOCX are supplied through the associated conversation rather than committed into the software repository (student CV and other confidential material). The app, Sprint 13, and Railway deployment were not changed.
