# Import File Security

CSV and Excel imports are useful for store staff, but they must be validated before they affect inventory, sales, or forecasts.

## Import Decision Matrix

| Area               | Foundation Standard                                         |
| ------------------ | ----------------------------------------------------------- |
| Allowed types      | `.csv` and `.xlsx`                                          |
| Planned size limit | 10 MB per file unless approved otherwise                    |
| Required columns   | Defined per future import type before parser implementation |
| Preview            | Required before committing imported rows                    |
| Database writes    | Never write directly without validation                     |
| Error reporting    | Show safe row-level messages                                |

## Import Workflow

```text
Choose file
  -> check extension and size
  -> parse into rows
  -> validate required columns
  -> validate row values
  -> show preview and errors
  -> user confirms
  -> future service writes clean rows
  -> future audit event records import
```

## Validation Rules

| Rule                   | Reason                                              |
| ---------------------- | --------------------------------------------------- |
| Reject negative stocks | Prevents corrupted inventory                        |
| Reject invalid dates   | Protects batch expiration and sales timelines       |
| Sanitize imported text | Reduces spreadsheet formula and text injection risk |
| Require known columns  | Prevents accidental mapping mistakes                |
| Limit file size        | Keeps the desktop app responsive                    |

## Good vs Bad Examples

| Good                                          | Bad                                               |
| --------------------------------------------- | ------------------------------------------------- |
| Preview clean and rejected rows before saving | Import directly after file selection              |
| Report `Row 8: quantity must be positive`     | Report only `Import failed`                       |
| Store only validated values                   | Store spreadsheet formulas as text without review |
| Require user confirmation                     | Silently change inventory after parsing           |
