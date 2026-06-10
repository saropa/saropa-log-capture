/**
 * Guards the viewer row column layout (plan 055, Phase 1 — grid model).
 *
 * Log rows render as a CSS grid (`.line.cols.log-cols`): each decoration datum
 * is its own clipping `.deco-cell`, the message is a separate `.line-msg` cell
 * with `min-width:0`, so no part can paint over a neighbor or the message —
 * overlap is impossible by construction, not avoided by a width estimate. Cells
 * are placed by FIXED grid-column index so a row that omits a globally-present
 * part (e.g. a console line with no tag) stays aligned.
 *
 * The legacy inline-block + hanging-indent model still exists for un-migrated
 * render paths but is now SCOPED to `:not(.cols)` so grid rows opt out cleanly.
 * It is removed in Phase 2 once every path is on the grid. See
 * plans/055_plan-viewer-row-grid-rewrite.md.
 */
import * as assert from 'node:assert';
import { getDecorationStyles } from '../../ui/viewer-styles/viewer-styles-decoration';
import { getColumnStyles } from '../../ui/viewer-styles/viewer-styles-columns';
import { getDecorationsScript } from '../../ui/viewer-decorations/viewer-decorations';
import { getViewerDataAddScript } from '../../ui/viewer/viewer-data-add';
import { getViewerDataHelpersRender } from '../../ui/viewer/viewer-data-helpers-render';

suite('viewer column layout (plan 055 — grid column model)', () => {
    test('.cols is a grid and every decoration cell clips its own track', () => {
        const css = getColumnStyles();
        const cols = /\.cols\s*\{[^}]*\}/s.exec(css);
        assert.ok(cols, 'expected a ".cols" rule');
        assert.ok(/display:\s*grid/.test(cols[0]), '.cols must be display:grid');
        const cell = /\.deco-cell\s*\{[^}]*\}/s.exec(css);
        assert.ok(cell, 'expected a ".deco-cell" rule');
        // overflow:hidden is the load-bearing invariant — a cell can never spill
        // its content over a neighboring cell or the message.
        assert.ok(/overflow:\s*hidden/.test(cell[0]), 'each .deco-cell must clip (overflow:hidden)');
        assert.ok(/\.deco-cell\.ellipsis\s*\{[^}]*text-overflow:\s*ellipsis/s.test(css),
            'the variable-width (tag) cell must clip with an ellipsis');
    });

    test('the message cell is its own track with min-width:0 (cannot be overlapped)', () => {
        const css = getColumnStyles();
        const msg = /\.line\.cols\s+\.line-msg\s*\{[^}]*\}/s.exec(css);
        assert.ok(msg, 'expected a ".line.cols .line-msg" rule');
        // min-width:0 lets the 1fr message track shrink/wrap inside its column so
        // it never pushes — or is pushed over — the decoration cells.
        assert.ok(/min-width:\s*0/.test(msg[0]), '.line-msg must have min-width:0');
        assert.ok(/grid-column:\s*7/.test(msg[0]), '.line-msg must be pinned to the last (message) column');
    });

    test('cells are placed by FIXED grid-column index (alignment despite missing parts)', () => {
        const css = getColumnStyles();
        // A row may omit a globally-present part; without fixed placement, grid
        // auto-flow would shift the remaining cells into the wrong tracks.
        for (const [cls, col] of [
            ['num', 1], ['time', 2], ['sessElapsed', 3], ['pidtid', 4], ['level', 5], ['tag', 6],
        ] as const) {
            const re = new RegExp(`\\.deco-cell-${cls}\\s*\\{[^}]*grid-column:\\s*${col}`, 's');
            assert.ok(re.test(css), `.deco-cell-${cls} must be pinned to grid-column ${col}`);
        }
        assert.ok(/\.line\.log-cols\s*\{[^}]*grid-template-columns:\s*var\(--grid-cols/s.test(css),
            '.log-cols must drive its template from --grid-cols');
    });

    test('applyDecorationLayoutWidth emits a 7-track --grid-cols (6 deco + 1fr)', () => {
        const script = getDecorationsScript();
        const fn = /function applyDecorationLayoutWidth\(\)\s*\{[\s\S]*?\n\}/.exec(script);
        assert.ok(fn, 'expected the applyDecorationLayoutWidth function');
        const body = fn[0];
        assert.ok(/setProperty\('--grid-cols'/.test(body), 'must set the --grid-cols CSS var');
        // Absent parts emit a 0 track (not omitted) so the fixed grid-column
        // indices stay valid row-to-row; the message track is 1fr.
        assert.ok(/'1fr'/.test(body), 'the message track must be 1fr');
        assert.ok(/decoShowTimestamp\s*&&\s*decoSeen\.ts/.test(body), 'timestamp track still requires decoSeen.ts');
        assert.ok(/decoSeen\.tag/.test(body), 'tag track still requires decoSeen.tag');
    });

    test('getDecorationCells renders one .deco-cell per part, keyed for placement', () => {
        const script = getDecorationsScript();
        assert.ok(/function getDecorationCells\(/.test(script), 'expected getDecorationCells()');
        assert.ok(/function buildDecoParts\(/.test(script),
            'parts must come from the shared buildDecoParts so the two renderers cannot diverge');
        assert.ok(/'<span class="deco-cell deco-cell-' \+ p\.key/.test(script),
            'each part is wrapped in a keyed .deco-cell span');
    });

    test('Phase 2: AI rows render on the grid (.cols.log-cols + .line-msg, grid deco cells)', () => {
        const script = getViewerDataHelpersRender();
        // The AI branch must opt into the gutter grid like regular rows...
        assert.ok(/class="line ai-line cols log-cols /.test(script),
            'AI rows must carry .cols.log-cols so the grid template applies');
        // ...use the grid cell emitter (not the legacy inline-block prefix)...
        assert.ok(/_aiDeco = \(typeof getDecorationCells === 'function'\)/.test(script),
            'AI decoration must come from getDecorationCells (grid), not getDecorationPrefix');
        // ...and wrap its message body in the clipping .line-msg cell.
        assert.ok(/'<span class="line-msg">' \+ _aiElapsed \+ aiPrefix \+ aiCompress \+ aiBody \+ '<\/span><\/div>'/.test(script),
            'AI message body must live in the .line-msg cell so nothing can paint over it');
    });

    test('decoSeen data-presence flags are tracked at ingestion and reset on clear', () => {
        const decoScript = getDecorationsScript();
        assert.ok(/var decoSeen\s*=\s*\{/.test(decoScript), 'decoSeen must be declared in the decorations script');
        const add = getViewerDataAddScript();
        assert.ok(/decoSeen\.ts\s*=\s*true/.test(add), 'addToData must record when a timestamped line is seen');
        assert.ok(/decoSeen\.tag\s*=\s*true/.test(add), 'addToData must record when tag data is seen');
    });

    test('legacy hanging-indent model is retained but scoped to :not(.cols)', () => {
        const css = getDecorationStyles();
        // Un-migrated paths (multi-frame stack headers, chips) still use the
        // inline-block model; it must skip rows that opted into the grid. (AI rows
        // moved to the grid in Phase 2.)
        assert.ok(
            /\.line:not\(\.cols\):has\(\.line-decoration\)/.test(css),
            'the legacy .line:has(.line-decoration) rule must be scoped :not(.cols) so grid rows opt out',
        );
        assert.ok(
            /\.line:not\(\.cols\):has\(\.line-decoration\)[^{]*\{[^}]*text-indent:\s*calc\(-1/s.test(css),
            'the legacy negative text-indent must remain for un-migrated rows',
        );
    });

    test('.deco-parsed-tag is clipped to the reserved tag column with an ellipsis', () => {
        const css = getDecorationStyles();
        const rule = /\.deco-parsed-tag\s*\{[^}]*\}/s.exec(css);
        assert.ok(rule, 'expected the ".deco-parsed-tag" rule');
        const body = rule[0];
        assert.ok(/display:\s*inline-block/.test(body), 'tag must be display:inline-block to accept max-width');
        assert.ok(/max-width:\s*7em/.test(body), 'tag must be capped at the 7em reserved column width');
        assert.ok(/overflow:\s*hidden/.test(body), 'tag overflow must be clipped, not spilled');
        assert.ok(/text-overflow:\s*ellipsis/.test(body), 'a clipped tag must show an ellipsis');
    });
});
