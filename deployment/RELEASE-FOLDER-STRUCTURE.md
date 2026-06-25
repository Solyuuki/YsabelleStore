# Release Folder Structure

## Purpose

This document defines the planned output structure for deployment artifacts.

## Scope

- Release folder naming
- Installer placement
- Notes and checksum files
- Version tracking

## Planned Release Structure

```text
release/
  Setup.exe
  Release Notes/
  Version.txt
  Checksums.txt
```

## Folder Responsibilities

| Item             | Purpose                              |
| ---------------- | ------------------------------------ |
| `Setup.exe`      | Windows installer artifact           |
| `Release Notes/` | Human-readable release summary       |
| `Version.txt`    | Version label for the packaged build |
| `Checksums.txt`  | Integrity verification record        |

## Future Implementation Notes

- Release artifacts should remain separate from source files.
- The release folder should only hold approved deployment outputs.
- No generated release artifact should be committed by default unless the workflow explicitly requires it.

## Validation Checklist

- [x] Release folder layout is documented
- [x] Artifact roles are defined
- [x] Source separation is clear
- [x] No release artifacts are generated here
