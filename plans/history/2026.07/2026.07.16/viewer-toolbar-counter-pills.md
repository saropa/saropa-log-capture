# Viewer toolbar counter pills

The log-viewer toolbar's per-level severity counters (E/W/I/P/T/N/D/DB) and the
line-count total rendered as faint `descriptionForeground` gray text that was
hard to read against the dense toolbar. Each counter is now a filled,
high-contrast pill.

## Finish Report (2026-07-16)

### Scope

VS Code extension (TypeScript) — webview CSS and one HTML template attribute. No
Dart/Flutter code. No user-facing strings added (colors and a per-level CSS class
only), so no localization work.

### Defect

`#line-count` and `.dot-count` both inherited near-illegible gray (`--vscode-descriptionForeground`)
on the toolbar. The severity counts in particular — the numbers beside each level
dot — were the hardest element to read.

### Change

- `viewer-toolbar-html.ts` — `levelDot()` now emits the count span with a paired
  per-level class (`dot-count dot-count-<level>`) so each counter can be filled in
  its own level color.
- `viewer-styles-level.ts` — `.dot-count` is now a filled pill (padding, radius,
  bold, tabular). Per-level `.dot-count-<level>` rules set the background to the
  level color (kept in lockstep with the existing `.level-dot-<level>` palette) and
  a per-level foreground chosen to clear WCAG AA (4.5:1) for the 10px bold number.
  White-on-red and white-on-blue were rejected (they sit at ~3.9:1 / ~3.1:1, below
  AA); error and info use near-black text instead, which the request for very high
  legibility requires. Added an inactive-level dim rule and a Trouble-Mode dim rule
  for the count pills — Trouble Mode leaves `.active` in place, so without an
  explicit rule a suppressed level would show a vivid pill next to its dimmed dot
  and letter.
- `viewer-styles-toolbar.ts` — `#line-count` renders as a pill using the theme
  badge token pair (`--vscode-badge-background/foreground`), the guaranteed-contrast
  neutral pair, with `:empty` hiding it when there is no count. (This portion was
  already committed at HEAD when the /finish audit ran.)

### Tests

- Updated the "bug 006" assertion in `src/test/ui/viewer-toolbar.test.ts` — the
  count span class changed from `dot-count` to `dot-count dot-count-<level>`.
- Added two tests: one asserting every level's count pill background matches its dot
  color (pins the manual lockstep invariant), and one asserting Trouble Mode dims the
  suppressed-level count pills.
- `npm run test:file -- out/test/ui/viewer-toolbar.test.js` → 27 passing.

### Notes for future maintainers

The level palette is a hand-maintained invariant duplicated across `.level-dot-*`,
some `.level-letter-*`, and now `.dot-count-*` in `viewer-styles-level.ts`. The added
test guards `.dot-count-*` against `.level-dot-*` drift, but the letter colors remain
unguarded. If the palette changes, update all three groups together.
