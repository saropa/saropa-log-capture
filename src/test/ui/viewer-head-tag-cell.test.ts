/**
 * Tests for renderHeadTagCell — the fixed-width head-tag decoration cell.
 *
 * App head tags ([db]/[perf]/[frame-stall]) render in their own fixed column
 * left of the message (deco-cell-htags). Because the column is a SHARED fixed
 * width (it cannot stretch per row without breaking message alignment), a line
 * with more tags than fit collapses to "first chip + +N", and the full list
 * rides the cell title. This suite pins that collapse + the title contract.
 */
import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getHeadTagsParserScript } from '../../ui/viewer-bracket-head-tags/viewer-bracket-head-tags';

/** Run the head-tags webview script in a VM and return renderHeadTagCell's plain result. */
function cellFor(tags: unknown): { html: string; title: string } {
    const ctx = vm.createContext({});
    vm.runInContext(getHeadTagsParserScript(), ctx);
    // JSON round-trip so the result crosses the VM boundary as a plain object
    // (a returned VM-realm object has a foreign prototype — see the deepStrictEqual
    // lesson in viewer-blank-structured-message.test.ts).
    const json = vm.runInContext(
        `JSON.stringify(renderHeadTagCell(${JSON.stringify(tags)}))`,
        ctx,
    );
    return JSON.parse(json as string);
}

suite('renderHeadTagCell — head-tag decoration cell', () => {
    test('no tags → empty html and empty title (nothing reserves the cell)', () => {
        const cell = cellFor([]);
        assert.strictEqual(cell.html, '');
        assert.strictEqual(cell.title, '');
    });

    test('single tag → one level-colored chip, no +N badge', () => {
        const cell = cellFor([{ name: 'perf', level: 'performance' }]);
        assert.ok(cell.html.includes('tag-chip tag-level-performance'), 'chip carries its level class');
        assert.ok(cell.html.includes('>perf<'), 'chip shows the tag name');
        assert.ok(!cell.html.includes('tag-chip-more'), 'a single tag must not show a +N badge');
        assert.strictEqual(cell.title, 'perf', 'title is the one tag name');
    });

    test('multiple tags → first chip + +N badge, title lists all in order', () => {
        const cell = cellFor([
            { name: 'perf', level: 'performance' },
            { name: 'frame-stall', level: 'performance' },
            { name: 'db', level: 'database' },
        ]);
        assert.ok(cell.html.includes('>perf<'), 'first (leftmost) tag is the visible chip');
        assert.ok(!cell.html.includes('>frame-stall<'), 'overflow tags are not rendered as chips');
        assert.ok(cell.html.includes('tag-chip-more'), 'overflow collapses to a +N badge');
        assert.ok(cell.html.includes('>+2<'), 'the badge counts the hidden tags (3 total − 1 shown)');
        assert.strictEqual(cell.title, 'perf frame-stall db', 'title carries the full list in emission order');
    });

    test('tag names are HTML-escaped in both the chip body and the title', () => {
        // Head tag text is attacker-controlled log content; a raw & or < must never
        // reach the DOM (chip) or a title attribute unescaped.
        const cell = cellFor([
            { name: 'a&b', level: 'info' },
            { name: '<x>', level: 'info' },
        ]);
        assert.ok(cell.html.includes('a&amp;b'), 'chip body escapes &');
        assert.ok(!cell.html.includes('a&b'), 'chip body must not contain a raw &');
        assert.ok(cell.title.includes('a&amp;b') && cell.title.includes('&lt;x&gt;'), 'title escapes both tags');
    });
});
