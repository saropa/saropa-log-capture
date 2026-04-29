# Proposed VS Code API usage

This extension is published **without** `enabledApiProposals` in `package.json` (Marketplace requirement). Some features still use proposed APIs **when available** at runtime.

## Local F5 / Extension Development Host

`.vscode/launch.json` passes:

`--enable-proposed-api=saropa.saropa-log-capture`

That opt-in applies only when you debug from this workspace. It does **not** ship to end users.

## Integrated terminal capture (proposed API)

**Integrated terminal output capture** uses a proposed VS Code surface when present; if the API is missing or throws, capture is skipped without crashing. Start in `src/modules/integrations/terminal-capture.ts` and activation wiring that registers it.

When VS Code changes or tightens proposed APIs:

1. Run the extension under F5 with the launch flag above.
2. Exercise terminal-related capture toggles.
3. Watch the **Saropa Log Capture** output channel for errors.

## Adding a new proposed dependency

1. Confirm Marketplace policy still allows shipping without listing the proposal (or add a graceful fallback path).
2. Document the proposal name and fallback behavior here and in `CHANGELOG.md` if user-visible.
3. Keep `launch.json` in sync if the extension id or enablement story changes.
