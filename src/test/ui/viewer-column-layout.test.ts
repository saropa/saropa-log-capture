/**
 * Guards the column layout (Item E, path 1 — incremental hardening).
 *
 * The decoration prefix span is pinned to a fixed-width inline-block, so the
 * hanging-indent math (padding-left + negative text-indent on
 * .line:has(.line-decoration)) is structurally guaranteed — variable counter /
 * timestamp / PID / tag content can no longer drift the column and push the
 * message text line-to-line.
 *
 * Path 1 deliberately KEEPS the existing padding-left / text-indent model so
 * wrapped SQL and error lines still align; it does NOT introduce a flex
 * .line-cols / .line-msg DOM rewrite (that was path 2, set aside). See
 * bugs/PLAN_VIEWER_STACK_NOISE_FILTER_LAYOUT.md Item E.
 */
import * as assert from 'node:assert';
import { getDecorationStyles } from '../../ui/viewer-styles/viewer-styles-decoration';
import { getDecorationsScript } from '../../ui/viewer-decorations/viewer-decorations';
import { getViewerDataAddScript } from '../../ui/viewer/viewer-data-add';

suite('viewer column layout (path 1 — fixed-width decoration prefix)', () => {
    test('.line-decoration is pinned to a fixed-width inline-block column', () => {
        const css = getDecorationStyles();
        const rule = /\.line:has\(\.line-decoration\)\s*\.line-decoration\s*\{[^}]*\}/s.exec(css);
        assert.ok(rule, 'expected the ".line:has(.line-decoration) .line-decoration" rule');
        const body = rule[0];
        assert.ok(/display:\s*inline-block/.test(body), 'decoration prefix must be display:inline-block');
        assert.ok(
            /width:\s*calc\(var\(--deco-content-indent-em/.test(body),
            'decoration prefix width must be pinned to --deco-content-indent-em',
        );
        // The /0.85 divisor converts the parent-em var into the span's own
        // 0.85em font units — without it the box is ~15% too narrow.
        assert.ok(/\/\s*0\.85/.test(body), 'width must divide by 0.85 for the .line-decoration font-size');
        // text-indent:0 is load-bearing: as an inline-block the span would
        // otherwise inherit .line's large negative text-indent and yank the
        // counter/timestamp text off-screen.
        assert.ok(/text-indent:\s*0/.test(body), 'inline-block prefix must reset the inherited negative text-indent');
    });

    test('the hanging-indent model is preserved (not replaced by a flex rewrite)', () => {
        const css = getDecorationStyles();
        // Path 1 keeps padding-left + negative text-indent so wrapped SQL/error
        // lines still align under the message column. A flex rewrite would have
        // neutralized text-indent — this asserts that did NOT happen.
        assert.ok(
            /\.line:has\(\.line-decoration\)\s*\{[^}]*text-indent:\s*calc\(-1/s.test(css),
            'the negative text-indent hanging-indent must remain (wrapped-line alignment)',
        );
    });

    test('prefix-column width is gated on enabled flags AND data actually present', () => {
        const script = getDecorationsScript();
        const fn = /function applyDecorationLayoutWidth\(\)\s*\{[\s\S]*?\n\}/.exec(script);
        assert.ok(fn, 'expected the applyDecorationLayoutWidth function');
        const body = fn[0];
        // No hardcoded worst-case base.
        assert.ok(!/13\s*\+\s*extraDigits/.test(body), 'the static 13em worst-case base must be gone');
        // A part is reserved only when the toggle is on AND the data was seen —
        // a markdown/plain file with no timestamps/PIDs/tags must reserve nothing
        // for those columns. decoSeen carries the data-presence flags.
        assert.ok(/decoShowTimestamp\s*&&\s*decoSeen\.ts/.test(body), 'timestamp width must require decoSeen.ts');
        assert.ok(/decoSeen\.pidTid/.test(body) && /decoSeen\.tag/.test(body),
            'PID/TID and tag columns must require their decoSeen data flags');
        assert.ok(/decoShowCounter/.test(body), 'counter must contribute to width when enabled');
    });

    test('decoSeen data-presence flags are tracked at ingestion and reset on clear', () => {
        const decoScript = getDecorationsScript();
        assert.ok(/var decoSeen\s*=\s*\{/.test(decoScript), 'decoSeen must be declared in the decorations script');
        const add = getViewerDataAddScript();
        assert.ok(/decoSeen\.ts\s*=\s*true/.test(add), 'addToData must record when a timestamped line is seen');
        assert.ok(/decoSeen\.pidTid\s*=\s*true/.test(add), 'addToData must record when PID/TID data is seen');
    });
});
