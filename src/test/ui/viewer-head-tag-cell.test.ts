/**
 * Tests for the head-tag chips that render in the tag decoration column.
 *
 * App head tags ([db]/[perf]/[frame-stall]) render as chips in the same tag cell
 * as the structured device tag (buildDecoParts). Every tag is shown — no +N
 * collapse — and the full list rides the cell title (headTagsTitle) so a chip
 * clipped by the fixed column width is recoverable on hover. This suite pins the
 * all-chips rendering, the title list, and HTML-escaping of hostile tag text.
 */
import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getHeadTagsParserScript } from '../../ui/viewer-bracket-head-tags/viewer-bracket-head-tags';

/** Run the head-tags webview script in a VM and return the named function's string result. */
function run(call: string): string {
    const ctx = vm.createContext({});
    vm.runInContext(getHeadTagsParserScript(), ctx);
    return vm.runInContext(call, ctx) as string;
}

suite('head-tag chips in the tag column', () => {
    test('renderHeadTagChips shows every tag as a level-colored chip (no +N)', () => {
        const html = run(
            'renderHeadTagChips([{name:"perf",level:"performance"},{name:"frame-stall",level:"performance"}])',
        );
        assert.ok(html.includes('>perf<'), 'first tag chip is present');
        assert.ok(html.includes('>frame-stall<'), 'second tag chip is ALSO present — nothing collapsed');
        assert.ok(html.includes('tag-level-performance'), 'chips carry their level class');
        assert.ok(!html.includes('+1') && !html.includes('tag-chip-more'), 'no +N overflow badge');
    });

    test('renderHeadTagChips on an empty list renders nothing', () => {
        assert.strictEqual(run('renderHeadTagChips([])'), '');
    });

    test('headTagsTitle lists every tag name in emission order', () => {
        const title = run(
            'headTagsTitle([{name:"perf",level:"performance"},{name:"frame-stall",level:"performance"},{name:"db",level:"database"}])',
        );
        assert.strictEqual(title, 'perf frame-stall db');
    });

    test('tag names are HTML-escaped in both the chip body and the title', () => {
        // Head tag text is attacker-controlled log content; a raw & or < must never
        // reach the DOM (chip) or a title attribute unescaped.
        const html = run('renderHeadTagChips([{name:"a&b",level:"info"}])');
        assert.ok(html.includes('a&amp;b') && !html.includes('a&b'), 'chip body escapes &');
        const title = run('headTagsTitle([{name:"a&b",level:"info"},{name:"<x>",level:"info"}])');
        assert.ok(title.includes('a&amp;b') && title.includes('&lt;x&gt;'), 'title escapes both tags');
    });
});
