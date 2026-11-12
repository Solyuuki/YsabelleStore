# CHM viewer memory-error mitigation (V3)

Reported on Windows after V2 compiled successfully (59 topics, 211 local links, ~26.5 MB): double-clicking `Ysabelle_Store_Thesis.chm` showed **"There is not enough memory available for this task."**

Compilation success does not establish successful viewing. The exact Windows viewer failure cause has not been conclusively isolated.

## Safe V3 source project

Generated `Ysabelle_Store_CHM_Project_v3_SAFE.zip` in the associated conversation. The archive has not been pushed into GitHub because source assets include non-public student information.

Changes:
- Divide all **138 approved PDF pages** into one-page HTML topics so the old viewer does not load 10–31 full-page images for a single chapter.
- Retain the **29 main TOC sections**, with Previous/Next page navigation through the entire thesis.
- Preserve Word-derived readable text/tables and supporting images in separate HTML pages.
- Optimize JPEGs to reduce package size; V3 source ZIP is about **17.1 MB**.
- Remove the custom `[WINDOWS]` declaration to use the standard HTML Help viewer window.
- Replace typographic punctuation in the HHC navigation labels with ASCII for compatibility with old ANSI-oriented workshop.
- Set output to `Ysabelle_Store_Thesis_SAFE.chm` so V3 is distinguishable from V2.

Local checks passed: ZIP integrity, all 138 page images, all 167 HTML topics, 29 readable topics, all CSS/image/link target paths.

## Windows test

1. Extract ZIP to a short local directory such as `C:\Ysabelle_CHM_V3\`.
2. Open `Ysabelle_Store_Thesis.hhp` in HTML Help Workshop.
3. Compile and confirm creation of `Ysabelle_Store_Thesis_SAFE.chm`.
4. Open on the local drive. If Windows lists an `Unblock` checkbox in file Properties, only unblock if source trusted.
5. Test Title Page, Chapters 1 and 3, Appendix J, the three curriculum vitae items, and Previous/Next page buttons.
6. **Do not submit** before visual test and check that the required authentic signed certification is included.

This revision is a mitigation, not yet a verified resolution: Windows CHM compilation and viewing could not be tested from this execution environment.
