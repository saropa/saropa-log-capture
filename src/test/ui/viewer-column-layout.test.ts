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

    test('prefix-column width is computed from the enabled decoration parts, not a static worst-case', () => {
        const script = getDecorationsScript();
        const fn = /function applyDecorationLayoutWidth\(\)\s*\{[\s\S]*?\n\}/.exec(script);
        assert.ok(fn, 'expected the applyDecorationLayoutWidth function');
        const body = fn[0];
        // Each enabled part must contribute conditionally — no hardcoded 13em base.
        assert.ok(/if\s*\(decoShowTimestamp\)/.test(body), 'timestamp must add width only when enabled');
        assert.ok(/decoShowCounter/.test(body), 'counter must contribute to width');
        assert.ok(/showParsedPidTid/.test(body) && /structuredLineParsing/.test(body),
            'PID/TID and tag columns must contribute only when enabled');
        assert.ok(!/13\s*\+\s*extraDigits/.test(body), 'the static 13em worst-case base must be gone');
    });
});
