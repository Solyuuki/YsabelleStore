# Supported Data Formats

> **Baseline:** `sprint/v0.10/sprint-10`

## Data Exchange and Import Formats

| Format / Representation | Support                                    | Primary Use / Boundary                                                                                              |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| JSON                    | Supported                                  | Frontend/backend HTTP payloads; normalized backend-to-Python forecast process contract                              |
| CSV                     | Supported where importer/validator exists  | Historical/inventory-oriented data workflows                                                                        |
| XLSX                    | Supported where importer/validator exists  | Historical/inventory-oriented spreadsheet imports; backend uses `read-excel-file`                                   |
| Multipart form data     | Supported where upload routes exist        | File/image upload through Multer-backed backend boundaries                                                          |
| Product image files     | Supported subject to upload/quality policy | Catalog imagery pipeline and governed product image assets                                                          |
| PDF                     | Processing dependency available            | `pdfjs-dist` is present; user-facing support must follow actual source implementation                               |
| Generated PDF           | Capability dependency available            | `jspdf`/`jspdf-autotable` are present on frontend; specific export claims require corresponding UI/source evidence  |
| OCR input               | Processing dependency available            | `tesseract.js` is present; dependency presence alone is not treated as proof of a complete user-facing OCR workflow |

## Historical-Sales Data Requirements

Historical sales enter a validation-oriented workflow with product identity, period, duplicate/overlap and row-level diagnostics before forecast-ready monthly records are persisted. Import modes and row statuses are represented in the Prisma schema.

## Forecast Data Contract

The backend normalizes product/month series and sends JSON to the Python forecasting service through standard input. The Python process emits structured JSON on standard output. Diagnostics/failures use standard error and are translated by the backend.

Forecasting is based on monthly demand series. The current service documentation states that only 24 monthly observations are available per product in the documented dataset context, representing two seasonal cycles; this is a modeling limitation rather than a generic file-format limit.

## Database Representation

Persistent application data is stored in MySQL through Prisma. Application code must use the approved backend/Prisma boundary rather than treating database tables as an external interchange format.

## Encoding / Validation Policy

- Imported files must pass the corresponding domain validator before trusted persistence.
- Invalid, duplicate, unmatched or overlapping historical rows must follow the explicit row/import status rules rather than being silently accepted.
- The system must not infer support for arbitrary spreadsheet/PDF/OCR layouts solely because a parsing library is installed.
- File size/type constraints are governed by the active upload/import implementation and should be documented per endpoint when finalized for release.
