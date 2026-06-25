# Windows Installer

## Purpose

This document defines the planned Windows installer behavior for YsabelleStore.

## Scope

- Installer philosophy
- Installation directory
- Shortcuts
- App icon
- Future uninstall behavior

## Installer Philosophy

| Principle            | Description                                                            |
| -------------------- | ---------------------------------------------------------------------- |
| Local-first          | The installer should support offline desktop use                       |
| Minimal friction     | Installation should be simple for store staff or evaluators            |
| Predictable location | App files should install to a clear Windows directory                  |
| Clean uninstall path | Future uninstall support should remove installed app artifacts cleanly |

## Planned Installer Behavior

| Item                   | Planned Behavior                                                |
| ---------------------- | --------------------------------------------------------------- |
| Installer format       | Windows `Setup.exe` generated through `electron-builder`        |
| Installation directory | User-selectable where appropriate, with a sensible default      |
| Desktop shortcut       | Available for quick app launch                                  |
| Start Menu shortcut    | Available for standard Windows navigation                       |
| Application icon       | Use a branded YsabelleStore icon in installer and shortcuts     |
| Uninstall support      | Future uninstall flow should cleanly remove installed app files |

## Future Implementation Notes

- The installer must remain focused on desktop delivery only.
- No auto-update server or release publishing belongs in this foundation.
- Packaging settings should remain aligned with the local-first architecture.

## Validation Checklist

- [x] Installer philosophy is documented
- [x] Shortcuts are documented
- [x] Installation behavior is documented
- [x] Future uninstall support is noted
