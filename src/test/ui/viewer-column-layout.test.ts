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

suite('viewer column layout (path 1 — fixed-width decoration prefix)', () => {
    test('.line-decoration is pinned to a fixed-width inline-block column', () => {
        const css = getDecorationStyles();
        const rule = /\.line:has\(\.line-decoration\)\s*\.line-decoration\s*\{[^}]*\}/s.exec(css);
        assert.ok(rule, 'expected the ".line:has(.line-decoration) .line-decoration" rule');
        const body = rule[0];
        assert.ok(/display:\s*inline-block/.test(body), 'decoration prefix must be display:inline-block');
        assert.ok(
            /width:\s*var\(--deco-content-indent-em/.test(body),
            'decoration prefix width must be pinned to --deco-content-indent-em',
        );
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
});
