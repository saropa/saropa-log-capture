import * as assert from 'assert';
import { parseRawLinesToPending, findHeaderEnd } from '../../ui/viewer/viewer-file-loader';
import type { FileParseContext } from '../../ui/viewer/viewer-file-loader';

suite('Viewer file loader', () => {
    const ctx: FileParseContext = {
        classifyFrame: () => undefined,
        sessionMidnightMs: 0,
    };

    suite('parseRawLinesToPending', () => {
        test('returns one PendingLine per input line', () => {
            const lines = ['[stdout] hello', '[stderr] world'];
            const pending = parseRawLinesToPending(lines, ctx);
            assert.strictEqual(pending.length, 2);
        });

        test('parses marker lines with isMarker true', () => {
            const lines = ['--- MARKER: test ---'];
            const pending = parseRawLinesToPending(lines, ctx);
            assert.strictEqual(pending.length, 1);
            assert.strictEqual(pending[0].isMarker, true);
        });

        test('parses category-prefixed lines with category', () => {
            const lines = ['[stdout] some output'];
            const pending = parseRawLinesToPending(lines, ctx);
            assert.strictEqual(pending.length, 1);
            assert.strictEqual(pending[0].category, 'stdout');
            assert.strictEqual(pending[0].isMarker, false);
        });
    });

    suite('findHeaderEnd', () => {
        test('returns 0 when no header', () => {
            assert.strictEqual(findHeaderEnd(['line1', 'line2']), 0);
        });

        test('returns index after closing equals line', () => {
            const lines = ['=== SAROPA LOG CAPTURE ===', 'Date: 2026-01-01', '==========', '', 'first log'];
            assert.strictEqual(findHeaderEnd(lines), 4);
        });
    });
});
