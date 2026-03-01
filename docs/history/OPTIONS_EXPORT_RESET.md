# Options Panel – Export & Reset

**Status: Implemented (see CHANGELOG [Unreleased]).**

## 1. Add user settings reset to the Options panel

- **Clarification:** The panel already has “Reset to default,” which resets **viewer** state only (display, layout, audio). The extension command `saropaLogCapture.resetAllSettings` resets **all extension settings** (workspace and global config) to package.json defaults.
- **Implementation:** Add a second action in the Options panel: “Reset extension settings” that triggers `saropaLogCapture.resetAllSettings`. Confirmation is handled in the extension host. Keep “Reset to default” for viewer-only reset.

## 2. Move Export out of the Options panel

- **Problem:** The Export action lives in the Options panel, so users may expect it to export options/settings. It actually exports the **current log view** (with level filters/templates).
- **Chosen approach:** Move export to the **log content context menu** as “Export current view…”, next to Copy All / Copy All Decorated, so it’s clear the action applies to the current log. Remove the Export button from the Options panel.

### Alternatives considered

- **Icon bar:** Add an Export icon; would work but icon bar is already dense.
- **Keep in Options but rename:** e.g. “Log actions” section with “Export current log…”; we prefer moving to the context menu so Options stays about settings only.
