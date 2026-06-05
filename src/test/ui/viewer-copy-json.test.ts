import * as assert from 'node:assert';
import { getCopyJsonScript } from '../../ui/viewer/viewer-copy-json';
import { getCopyScript } from '../../ui/viewer/viewer-copy';

/**
 * Behavioral tests for structured JSON copy (default Ctrl+C / top "Copy to JSON").
 *
 * The helpers live in a `/* javascript *\/`-tagged template literal, so we eval the
 * generated source inside a `Function` with a stubbed `lineToPlainText` (its only
 * cross-module dependency) and exercise `lineToJsonObject` / `linesToJson` directly.
 * This pins the actual output shape — 1-based `line`, ISO `timestamp`, the tag-source
 * precedence, and the omit-empty-fields rule — rather than mere string presence.
 */
suite('Copy to JSON', () => {

    // Build the two pure serializers with a deterministic text stub.
    function buildHelpers(): {
        lineToJsonObject: (item: Record<string, unknown>, idx: number) => Record<string, unknown>;
        linesToJson: (lines: Record<string, unknown>[]) => string;
    } {
        const factory = new Function(
            'lineToPlainText',
            getCopyJsonScript() +
            '\nreturn { lineToJsonObject: lineToJsonObject, linesToJson: linesToJson };',
        );
        return factory((item: Record<string, unknown>) => String(item.text ?? ''));
    }

    suite('lineToJsonObject', () => {
        test('emits every populated field with the expected names', () => {
            const { lineToJsonObject } = buildHelpers();
            const ts = Date.UTC(2026, 5, 5, 7, 23, 36); // 2026-06-05T07:23:36Z
            const obj = lineToJsonObject(
                { viewerLineIndex: 41, timestamp: ts, level: 'error', category: 'flutter', sourceTag: 'database', source: 'debug', text: 'boom' },
                0,
            );
            assert.deepStrictEqual(obj, {
                line: 42, // 1-based viewer row, not the internal index
                timestamp: '2026-06-05T07:23:36.000Z',
                level: 'error',
                category: 'flutter',
                tag: 'database',
                source: 'debug',
                text: 'boom',
            });
        });

        test('omits empty fields — a bare print() line carries only line + text', () => {
            const { lineToJsonObject } = buildHelpers();
            const obj = lineToJsonObject({ viewerLineIndex: 0, text: 'hello world' }, 0);
            assert.deepStrictEqual(obj, { line: 1, text: 'hello world' });
            assert.ok(!('timestamp' in obj) && !('level' in obj) && !('tag' in obj));
        });

        test('falls back to the array index for line when viewerLineIndex is absent', () => {
            const { lineToJsonObject } = buildHelpers();
            const obj = lineToJsonObject({ text: 'x' }, 7);
            assert.strictEqual(obj.line, 8);
        });

        test('tag precedence: sourceTag, then logcatTag, then parsedTag', () => {
            const { lineToJsonObject } = buildHelpers();
            assert.strictEqual(lineToJsonObject({ sourceTag: 'a', logcatTag: 'b', parsedTag: 'c', text: '' }, 0).tag, 'a');
            assert.strictEqual(lineToJsonObject({ logcatTag: 'b', parsedTag: 'c', text: '' }, 0).tag, 'b');
            assert.strictEqual(lineToJsonObject({ parsedTag: 'c', text: '' }, 0).tag, 'c');
        });

        test('an unparseable timestamp is omitted rather than emitting "Invalid Date"', () => {
            const { lineToJsonObject } = buildHelpers();
            const obj = lineToJsonObject({ viewerLineIndex: 0, timestamp: 'not-a-date', text: '' }, 0);
            assert.ok(!('timestamp' in obj), 'NaN-parsing timestamp must not appear');
        });
    });

    suite('linesToJson', () => {
        test('produces a pretty-printed, parseable array, one object per line', () => {
            const { linesToJson } = buildHelpers();
            const out = linesToJson([
                { viewerLineIndex: 0, level: 'info', text: 'one' },
                { viewerLineIndex: 1, level: 'error', text: 'two' },
            ]);
            assert.ok(out.includes('\n  '), 'should be indented (JSON.stringify with 2 spaces)');
            const parsed = JSON.parse(out);
            assert.strictEqual(parsed.length, 2);
            assert.deepStrictEqual(parsed[0], { line: 1, level: 'info', text: 'one' });
            assert.deepStrictEqual(parsed[1], { line: 2, level: 'error', text: 'two' });
        });
    });

    suite('wiring', () => {
        test('copyAsJson is part of the concatenated copy script and preserves raw drag-select', () => {
            const script = getCopyScript();
            assert.ok(script.includes('function copyAsJson'), 'copyAsJson must be in the shared copy scope');
            const start = script.indexOf('function copyAsJson');
            const block = script.slice(start, start + 900);
            // Native (sub-line) selection is copied verbatim — a fragment cannot be structured.
            assert.ok(block.includes('window.getSelection'), 'must check the native selection');
            assert.ok(block.includes('postLinesAsJson(getVisibleLines())'), 'falls back to visible lines as JSON');
        });
    });
});
