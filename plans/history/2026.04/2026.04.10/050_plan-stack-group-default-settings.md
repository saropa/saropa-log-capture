# 050: Configurable stack group defaults

## Problem

Stack groups in the viewer have two hardcoded defaults:
- `collapsed: false` — all frames expanded by default (viewer-data-add.ts:97)
- `previewCount: 3` — preview mode shows 3 app frames (viewer-data-add.ts:97)

Users cannot configure the initial collapsed state or how many frames show in
preview mode. With high-frequency logging (e.g. Drift SQL with 6-frame stacks),
every log entry expands to 7 lines, flooding the viewer.

## Proposal

Two new settings:

### `saropaLogCapture.stackFrameDefaultState`

Controls the initial collapsed state of stack groups.

- `"expanded"` — show all frames (current behavior)
- `"preview"` — show first N app frames with [+N more] badge
- `"collapsed"` — hide all frames, show only the header

Default: `"expanded"` (preserves current behavior).

### `saropaLogCapture.stackFramePreviewCount`

Number of app frames shown in preview mode.

- Type: integer, minimum 1, maximum 20
- Default: 3 (preserves current behavior)

## Settings pipeline

1. `package.json` — setting definitions
2. `config.ts` — interface + reader
3. `extension.ts` → broadcaster → webview targets → `postMessage()`
4. Webview JS var — read by `addToData()` when creating stack-header items

## Files affected

- `package.json` — setting definitions
- `src/modules/config/config.ts` — interface + reader
- `src/modules/config/config-types.ts` — type if needed
- `src/ui/viewer/viewer-data-add.ts` — use settings instead of hardcoded values
- `src/ui/viewer/viewer-script-messages.ts` — receive settings message
- Settings pipeline files (broadcaster, targets, providers)

## Risk

Low. Default values preserve current behavior. Only affects initial state;
users can still click to toggle.
