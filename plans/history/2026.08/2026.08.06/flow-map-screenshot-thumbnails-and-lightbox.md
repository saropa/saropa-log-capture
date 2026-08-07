# Flow map — screenshot thumbnails on diagram cards, and a lightbox for every capture

Captured screenshots existed only as a small gallery in the report's detail column, disconnected from
the diagram they described: a reader looking at a screen's node had no way to see what that screen
actually looked like, and a gallery thumbnail was too small to read. Clicking a gallery thumbnail also
jumped the log viewer, so a mis-click scrolled the reader's log out from under them.

## What changed

**Diagram nodes became portrait storyboard cards.** `BOX_W` in
[flow-map-svg.ts](../../../../src/modules/flow-map/flow-map-svg.ts) dropped from 236 to 168, and the
per-role text budgets in `clip()` from 29/34 characters to 20/24 to match the narrower card. A card
whose screen was captured reserves a `THUMB_BLOCK_H` band above its text lines; a card without a
capture keeps its previous short height rather than reserving an empty frame, so a breadcrumb-only
session costs no extra vertical space.

**Thumbnails.** [flow-map-svg-shots.ts](../../../../src/modules/flow-map/flow-map-svg-shots.ts) (new,
pure — no `vscode` or l10n import, so the SVG path still renders headless) owns the thumbnail geometry
and markup. `groupShotsByScreen()` keys captures by `screenKeyOf(screenLabel)`, which mirrors the
builder's `normalizeKey`, so a node finds its own captures by `node.key`. `thumbMarkup()` renders the
screen's FIRST capture in a 148×176 frame with `preserveAspectRatio="xMidYMin slice"`: the frame is
filled and cropped from the bottom because a phone capture identifies itself by its top chrome (app
bar, screen title), where a letterboxed `meet` fit would render a sliver between two dead margins. A
rounded count pill appears bottom-right only when the screen has two or more captures.

**Lightbox.** [flow-map-panel-lightbox-script.ts](../../../../src/ui/panels/flow-map-panel-lightbox-script.ts)
(new, nonce-guarded like its zoom/replay siblings) binds both capture surfaces — `image.fm-shot` in the
SVG and `img.shot-img` in the gallery — and opens an overlay carrying the capture at full size plus its
screen, capture time, trigger, and a clickable log line. Clicks `stopPropagation()` because the
enclosing `.fm-node` group owns its own click (row highlight + log jump) and dblclick (detail popup)
handlers. Gallery figures no longer carry the `loglink` class; the reveal-in-log action moved inside
the lightbox where it is a deliberate act.

The overlay's facts grid is built with `textContent` exclusively — screen labels and triggers originate
in log text, so interpolating them into markup would let a log line inject nodes into the panel. `Tab`
is trapped inside the card (`trapTab`) and focus returns to the thumbnail that opened it, because
`aria-modal="true"` without either is a claim the DOM does not honor: every diagram node, thumbnail and
gallery figure behind the overlay remains tabbable.

**Counter scope.** A card thumbnail's index/total count that SCREEN's captures; a gallery figure's
count the whole session's. Two different denominators would read identically as "1 of 3", so the
thumbnail emits `data-shot-scope="screen"` and the script selects `flowMap.shot.counterScreen`
("Capture {0} of {1} on this screen") over `flowMap.shot.counter`.

**Pop-out parity.** `buildFlowDiagramBody` accepts screenshots, so the pop-out diagram carries the same
thumbnails; its CSP consequently gained `img-src data:`.

**Signature change.** `flowDiagramHtml` takes a `FlowDiagramOptions` object — its inputs (pop-out flag,
empty detail, suggestions, screenshots) outgrew the project's 4-parameter limit.

New modules were introduced to keep the touched files inside the line budget:
`flow-map-svg-shots.ts` (geometry, markup, and the single source of the `data-shot-*` attribute
names, imported by the gallery so the two surfaces cannot describe the same capture differently),
`flow-map-html-shots.ts` (gallery), `flow-map-panel-lightbox-script.ts`, and
`flow-map-panel-styles-shots.ts`.

## Accepted costs

In the main report, a captured screen's first capture ships its base64 payload twice — once as the SVG
thumbnail, once as the gallery figure. Static HTML cannot share one payload between an SVG `<image>`
and an `<img>`, and having the diagram borrow the gallery's image at runtime would leave the pop-out
(which renders no gallery) with blank cards. The existing 12-capture report cap bounds the total. The
pop-out pays nothing extra: it embeds only the diagram copy.

Repeat captures on one screen are NOT each embedded in the diagram — the count pill reports them and
the gallery holds them. At 148px a second capture of the same screen adds weight, not information.

## Review findings addressed

A read-only review of the first commit raised, and this record reflects the fixes for: the missing
focus trap and focus restoration in the lightbox (HIGH); a comment in `flow-map-panel.ts` asserting the
pop-out CSP was unchanged when the same commit changed it (MEDIUM); a suppressed focus outline on
`.fm-shot` combined with a `.fm-node:focus` frame rule that can never fire because Tab lands on the
child `<image>`, not the group (MEDIUM, fixed with `:focus-visible` and `:focus-within`); and a data
URI escaped on the diagram path but not the gallery path (LOW, now escaped on both).

Flagged and deliberately NOT changed, as out of scope: four identical `esc()` implementations across
the flow-map render modules (the project's "wait for 3+ uses" threshold is now met, so this is a real
candidate); the two-closure `srcOf` split between `.src` and `getAttribute('href')` in the lightbox
binding; and the two fixed-black values in the overlay CSS (backdrop scrim and image letterbox), which
are intentionally theme-independent but are not tokenized.

## Verification

- `npm run check-types` — 0 errors.
- `npm run lint` — 0 errors, 14 pre-existing warnings, none in the touched files.
- `npm run compile` — full gate chain green, including `verify:l10n-keys` (2548 keys) and
  `verify:dist-size` (5.34 MiB of a 12 MiB ceiling).
- 17 tests in `src/test/modules/flow-map/flow-map-shot-thumbs.test.ts` (new) plus the existing 114
  flow-map tests across seven files — all passing.
- Not verified on screen: no run in the Extension Development Host was performed for this work.

## Known follow-up

`npm run compile` runs a changelog-rotation step that moved the `[9.0.9]` and `[9.0.8]` sections into
`CHANGELOG_ARCHIVE.md` and corrupted them, splitting the sentence "Level badges now match what you
see:" into a bogus `## [9.0.9] / Level badge.` heading plus a `## [s now match what you see: …`
heading. The corruption was reverted rather than committed, and recurs on every compile. Unrelated to
this change; recorded here because it will surface for anyone running the gate chain.
