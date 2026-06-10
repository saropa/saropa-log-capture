/**
 * Reusable column-grid primitive for viewer rows (plan 055).
 *
 * `.cols` is an overlap-proof column box: a CSS grid whose decoration cells each
 * clip to their own track, so no datum can ever paint over a neighbor — the
 * failure the old inline-block + hanging-indent model accepted "by design"
 * (see the retired note in viewer-styles-decoration.ts). The mechanism is shared;
 * the *template* differs per consumer and is never merged across axes:
 *   - log gutter rows  → `.log-cols` + `--grid-cols` (this file's consumer)
 *   - CSV / md tables  → `.csv-cols` / `.md-table` + their own `--*-cols` (future)
 *
 * Cells are placed by FIXED `grid-column` index, not auto-flow: a row may omit a
 * globally-present part (e.g. a console line with no tag while the tag column is
 * shown for the file). Auto-placement would then shift that row's remaining cells
 * into the wrong tracks. Fixed indices keep every column aligned top-to-bottom
 * regardless of which parts a given row carries. `--grid-cols` therefore always
 * emits all six decoration tracks (absent ones at width 0) plus the `1fr` message.
 */
export function getColumnStyles(): string {
    return /* css */ `
/* --- Reusable column primitive (plan 055) --- */
.cols {
    display: grid;
    align-items: baseline;
}
/* The decoration wrapper is display:contents so its .deco-cell children become
   direct grid items of the row (keeps the JS hook without a nesting level). */
.cols .line-decoration { display: contents; }

/* Log-gutter consumer: 6 decoration tracks + message, sized by --grid-cols.
   padding-left reserves the severity-bar clearance (matches the old 1.25em). */
.line.cols { padding-left: 1.25em; }
.line.log-cols { grid-template-columns: var(--grid-cols, 0 0 0 0 0 0 1fr); }

/* Each decoration datum is its own clipping cell — no merged content, no spill. */
.deco-cell {
    overflow: hidden;
    white-space: nowrap;
    min-width: 0;
}
/* Variable-width parts (the tag) clip with an ellipsis; the full value stays on
   the title tooltip. Fixed-width parts (counter, timestamp, …) never clip
   because their tracks are sized to the known character count. */
.deco-cell.ellipsis { text-overflow: ellipsis; }

/* Fixed column placement — see file header (why not auto-flow). */
.deco-cell-num { grid-column: 1; }
.deco-cell-time { grid-column: 2; }
.deco-cell-sessElapsed { grid-column: 3; }
.deco-cell-pidtid { grid-column: 4; }
.deco-cell-level { grid-column: 5; }
.deco-cell-tag { grid-column: 6; }

/* Message track: pinned last, min-width:0 so it wraps inside its column and can
   never push or be pushed over the decoration cells. Keeps the row's own
   white-space (pre-wrap / nowrap mode) for the message text. */
.line.cols .line-msg {
    grid-column: 7;
    min-width: 0;
}
`;
}
