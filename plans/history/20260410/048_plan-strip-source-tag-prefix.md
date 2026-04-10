# 048: Strip source tag prefix from displayed text

## Problem

The Dart debug adapter prepends `[log]` to all `dart:developer` `log()` output.
This appears in the viewer as visible text even though the information is already
captured as a **source tag** (parsed by `parseSourceTag()`) and available via
the source tag filter and optional category badge.

Example line in the log file:
```
[07:38:24.776] [console] [log] [32m[SDA] Resolving package root (cwd: /)
```

The file loader strips `[07:38:24.776] [console]` but `[log]` remains as part
of the line text. Users see redundant `[log]` on every `dart:developer` line.

Other bracket prefixes (`[SDA]`, `[Awesome Notifications]`, etc.) have the same
pattern — already parsed as source tags but still shown in text.

## Proposal

Add a viewer setting `stripSourceTagPrefix` (default: `true`) that removes the
leading bracket prefix from displayed text when it has already been parsed as a
source tag.

### Scope

- **Display only** — the log file on disk is never modified
- Applies to bracket-prefixed source tags: `[log]`, `[SDA]`, `[TagName]`
- Does NOT strip logcat prefixes (`D/FlutterJNI(3861):`) — those carry the
  level letter and PID which have independent value
- The stripped prefix should still be searchable (search operates on raw text)

### Implementation

1. In `addToData()` or the render path, after `parseSourceTag()` confirms a
   bracket tag match, strip the `[tag] ` prefix from the displayed HTML
2. Gate behind the setting so users who want to see the raw text can
3. The source tag badge (when enabled) replaces the stripped text visually

### Complexity

Low — single regex replace gated by a boolean, applied during render or ingest.

## Files likely affected

- `viewer-data-add.ts` or `viewer-data-helpers-render.ts` — strip on render
- `package.json` — setting definition
- `config.ts` — setting reader
- Settings pipeline to webview (standard flow)

## Risk

Low. Display-only change. Search must still match the unstripped text.
