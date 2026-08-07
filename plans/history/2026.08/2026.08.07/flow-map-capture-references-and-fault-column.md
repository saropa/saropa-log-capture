# Flow map: capture references, fault-column layout, and lightbox path/zoom

Screenshot thumbnails on the Session Flow Map's diagram cards reserved their frame but painted
nothing, while the same captures rendered correctly in the report's gallery. Separately, a
four-step session rendered 1272px wide because five terminal crash nodes shared one unbounded
layout row.

## Defect 1 — blank card thumbnails

### What was wrong

Two independent causes, found in sequence.

**Document weight.** Captures were embedded as base64 data URIs in both the gallery figure and the
diagram thumbnail. A seven-capture session produced roughly 10.5 MB of HTML handed to
`webview.html` in a single IPC message. Every stage reproducible outside the Extension Host was
verified correct beforehand — the PNG files, the sidecar join, the emitted markup, the panel's exact
CSP as a `<meta http-equiv>`, and the real stylesheet all rendered the capture in headless Chromium.
Weight was the only property no probe reproduced.

**The element.** After captures moved to on-disk references, the gallery painted and the diagram
still did not, in one document, under one CSP, using the same URLs from the same directory. That
isolated the failure to the SVG `<image>` element itself rather than to resource loading.

### What changed

Captures are no longer embedded. `FlowShot.dataUri` became `FlowShot.src`, carrying the PNG's
`file:` URI from the loader and rewritten to `webview.asWebviewUri(...)` by the panel immediately
before render — only a live `Webview` can mint a URL its own sandbox will load, and the report panel
and the pop-out are separate webviews. A new `FlowShot.path` carries the absolute on-disk path for
display and copy; the two must not be conflated, because one is fetched and the other is pasted.

Both panels open `localResourceRoots` to exactly the log's `.screenshots/` directory, reapplied on
every render because a panel outlives any one log. The CSP moved from `img-src data:` to
`img-src ${webview.cspSource}`; `data:` is deliberately no longer allowed, so a stray embed fails
loudly rather than quietly reintroducing megabytes of base64.

`MAX_REPORT_SHOT_BYTES` and the pure `shotBudgetVerdict` were deleted with the thing they bounded.
The count cap `MAX_REPORT_SHOTS` (12) remains as a readability bound on the gallery.
`loadFlowShots` now `stat`s each PNG instead of reading it.

Diagram thumbnails are an HTML `<img>` inside a `<foreignObject>`, not an SVG `<image>`.
`object-fit: cover` + `object-position: top` reproduces what `preserveAspectRatio="xMidYMin slice"`
did: fill the frame and crop from the bottom, keeping the top chrome that identifies a phone screen.
The hairline frame stays SVG so it still scales with the diagram's zoom. The lightbox binder
collapsed to one selector (`img.shot-img, img.fm-shot`) once both surfaces became `<img>`.

Panel HTML drops from megabytes to kilobytes, each capture loads and caches independently, and the
diagram and gallery copies of one capture now share a single fetch instead of shipping the bytes
twice.

## Defect 2 — the diagram fanned out

`rowsByDepth` placed every node at the same longest-path depth into one unbounded, centered row.
Five terminal crash leaves shared a depth, so a session only four steps deep needed a 1272px canvas.
Narrower portrait cards had reduced each card's width without touching the row count.

Row planning moved to `flow-map-svg-layout.ts` (pure, no `vscode` import) under two rules:

- **Terminal fault nodes leave the walk.** A crash node with no outgoing forward edge is an
  annotation on the screen it happened on, not a step the user took. They stack in a per-parent
  column beside the walk. A back edge does not count as the walk continuing — returning to an
  ancestor is not "the session went on from here" — and an orphan fault node with no incoming edge
  stays in the walk rather than floating in the column with no arrow explaining it.
- **Wide sibling rows wrap.** Any remaining row over three cards splits into near-equal sub-rows, so
  a screen that really did open six children costs height rather than width.

Depths are still computed from the full graph, so pulling a leaf aside never shifts the layering of
the walk above it. `flow-map-svg.ts` retains all pixel placement; `placeFaultLeaves` visits parents
top-down through a shared cursor, which is what keeps two adjacent parents' stacks from overlapping.

Measured on a real session: **1272 × 471 → 456 × 744**, walk rows `[1,1,1,1]`, five fault cards
stacked beside `emergency dashboard`.

## Related work in the same change

**Sidecar validation.** `readScreenshotSidecar` asserted `is ScreenshotMetaEntry` while checking
only `file` and `timestamp`, so any string passed as a `trigger`. That matters because consumers
switch on it — `pickThumbShot` to choose which capture represents a screen, `pillClass` to pick a
severity tint — so an unknown value rendered as an untinted mystery instead of being rejected at the
boundary. The read path now validates against the real union. `logLine`, `text`, and `fingerprint`
are defaulted rather than required: a manual capture legitimately has no anchor and no fingerprint,
and demanding them would discard valid history.

**Independent column scrolling.** The report's two columns shared the page scrollbar, so a long
issue table dragged the diagram off-screen. Each column now owns its scroll within a shared
`--report-vh` budget — the detail column directly, the diagram column via `.diagram-scroll`, which
must keep the scrollbars zoom-panning uses. The wrapped single-column layout under 720px drops both
caps, since two stacked viewport-height boxes would mean scrolling twice to reach one page's bottom.

**Full path surfaced.** The sidecar stores bare filenames, which are not something a reader can act
on. The capture directory now rides along on the `screenshotList` message and the log viewer's
preview popover prints the full path, selectable and wrapped, with the separator inferred from the
directory the host sent rather than assumed — the webview has no platform of its own. In the flow
map's lightbox, a File row shows the filename inline with the full path on a copy button and its
hover title, using a dedicated `copyShotPath` message rather than the generic `copyText`, whose
status line reports "Summary copied".

**Lightbox zoom.** Two modes: fit (the browser sizing the capture to the card) and an explicit pixel
scale entered by any deliberate zoom — wheel over the image or the slider. Zoom overrides fit,
because a phone capture at 100% is taller than any card, which is the point of asking for 100%; a
reset control returns to fit. Wheel zoom corrects scroll so the pointer stays over the same part of
the capture instead of the detail walking off-screen. Behavior lives in its own module injected into
the lightbox IIFE so neither file crosses the line budget.

**Load-failure state.** A capture that existed when the report was built can be gone by the time the
browser fetches it, and a misconfigured resource root fails identically. Both surfaces now handle
the `error` event: the frame shows the alt text with a failed style and stops advertising a click,
rather than presenting the browser's broken-image glyph with no statement of what happened.

## Hardening pass

Five risks identified in review were closed rather than documented:

- **The column height budget is measured, not guessed.** `--report-vh` was a hard-coded
  `calc(100vh - 9.5rem)`. A topbar that wraps to two lines — a long project name plus a full pill row
  does exactly that — would push the bottom of both columns below the fold with nothing to scroll
  them into view, and it would fail silently. `sizeColumns()` now measures the report row's own top
  edge, re-measures on resize, and removes the cap entirely under 720px where the layout wraps.
- **Wheel zoom no longer jumps on an undecoded image.** Leaving fit mode needs the image's true
  size; `naturalWidth` is 0 until the PNG decodes, and the old fallback of 1.0 would snap a fitted
  capture to full size on the first tick. The event is now swallowed (still calling
  `preventDefault`, so the page behind the overlay cannot scroll) and the next tick works.
- **The path separator is sent, not inferred.** The webview guessed the separator from the directory
  string, which a host-normalized path would defeat. `screenshotDirPayload()` sends `{dir, sep}` and
  is used by the sidecar listing AND the live-capture message, so a popover on a just-captured line
  no longer waits for the next listing to learn its own path.
- **Capture filenames are validated before joining.** The sidecar is user-editable and `Uri.joinPath`
  would follow `../../` straight out of the one directory the panel's CSP opens. `SAFE_SHOT_FILE`
  refuses anything that is not a bare generated PNG name — deliberately a second, independent copy of
  the viewer's own guard, because each read path must refuse traversal on its own.
- **The fault column is bounded.** A stack passing `FAULT_COL_H` (720px) now starts another column
  instead of growing. Twenty faults under one screen would otherwise have produced a 2000px column
  beside a 400px walk — the same unbounded-growth defect the fault column was introduced to fix,
  rotated ninety degrees. Measured: 5 faults 424×465, 8 faults 424×687, then width steps by a column
  while height holds at 761 for 12, 20, and 40.

## Capture compare

A screen captured several times raises one question — what changed between them — and the count pill
on a diagram card is where a reader meets it. The lightbox now offers Compare on any capture whose
screen has more than one, putting two captures side by side at a shared height with their clocks
beneath, and stepping the right-hand pane through the rest of the set.

The set travels on a `data-shot-siblings` attribute carrying only what compare needs (URL, clock,
trigger), per screen rather than per gallery — comparing Home against Settings answers nothing. It is
omitted for a lone capture, so the control's absence is data-driven rather than a special case.

Two traps closed during review. The sibling walk is a bounded one-lap scan, never "skip until a
different image": nothing dedups captures by file, so every entry in a set can carry the same URL,
and a loop whose only exit is finding a different one would hang the panel. And compare panes state a
load failure like every other capture surface — a broken-image glyph in the one view meant for
spotting differences would read as "this screen changed completely", the exact wrong conclusion.

There is deliberately no pixel-difference overlay. Webview image URLs are a different origin from the
webview document, so drawing them to a canvas taints it and `getImageData` throws. A real difference
metric belongs host-side where the bytes are readable.

## Verification

- `npm run check-types` — 0 errors.
- `npm run lint` — 0 errors, 14 pre-existing warnings.
- `npm run compile` — full gate chain green, including `verify:l10n-keys` (2557 keys), the webview
  message catalogs, and `verify:dist-size`.
- 177 tests passing across the twelve affected suites, including two new files:
  `flow-map-svg-layout.test.ts` (13) covering fault-leaf extraction, back-edge exclusion, orphan
  retention, row wrapping, and rendered canvas width; and `screenshot-sidecar-validation.test.ts`
  (6) covering trigger-union rejection, per-field defaulting, and malformed sidecars. The layout
  suite additionally pins the fault column's wrap bound; the thumbnail suite pins the sibling set,
  the bounded sibling walk, and the load-failure statement on both thumbnails and compare panes.

## Known gaps

- Nothing in this change has been exercised in the Extension Host. The thumbnail fix in particular
  rests on an inference from field evidence, not on an observed console.
- `resolveShotFile` / `loadFlowShots` in `commands-flow-map.ts` have no direct test — they are not
  exported and require `vscode.workspace.fs`. The pure layers either side of them
  (`joinShotsToScreens`, `planRows`, `validateEntry`) are covered.
- The screenshot gallery panel (`screenshot-gallery-panel.ts`), the signal report, and the viewer
  content surface still deliver images as embedded data URIs. The codebase now carries two
  screenshot-delivery strategies side by side.
