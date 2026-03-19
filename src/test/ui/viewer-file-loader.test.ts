import * as assert from 'node:assert';
import {
    parseRawLinesToPending,
    findHeaderEnd,
    parseElapsedToMs,
    externalSidecarLabelFromFileName,
    parseExternalSidecarToPending,
    parseUnifiedJsonlToPending,
} from '../../ui/viewer/viewer-file-loader';
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

        test('parses [+Nms] elapsed and sets elapsedMs for replay timing', () => {
            const lines = ['[+125ms] [stdout] first', '[+500ms] [stderr] second'];
            const pending = parseRawLinesToPending(lines, ctx);
            assert.strictEqual(pending.length, 2);
            assert.strictEqual(pending[0].elapsedMs, 125);
            assert.strictEqual(pending[0].category, 'stdout');
            assert.strictEqual(pending[1].elapsedMs, 500);
            assert.strictEqual(pending[1].category, 'stderr');
        });

        test('parses [+N.Ns] and [+Ns] elapsed', () => {
            const lines = ['[+1.5s] [console] slow', '[+15s] [stdout] gap'];
            const pending = parseRawLinesToPending(lines, ctx);
            assert.strictEqual(pending.length, 2);
            assert.strictEqual(pending[0].elapsedMs, 1500);
            assert.strictEqual(pending[1].elapsedMs, 15000);
        });
    });

    suite('parseElapsedToMs', () => {
        test('parses +Nms to ms', () => {
            assert.strictEqual(parseElapsedToMs('+125ms'), 125);
            assert.strictEqual(parseElapsedToMs('+0ms'), 0);
        });
        test('parses +N.Ns and +Ns to ms', () => {
            assert.strictEqual(parseElapsedToMs('+1.5s'), 1500);
            assert.strictEqual(parseElapsedToMs('+15s'), 15000);
        });
        test('returns undefined for invalid input', () => {
            assert.strictEqual(parseElapsedToMs(''), undefined);
            assert.strictEqual(parseElapsedToMs('125ms'), undefined);
            assert.strictEqual(parseElapsedToMs('+1.5m'), undefined);
        });
    });

    suite('externalSidecarLabelFromFileName', () => {
        test('extracts label between main base and .log', () => {
            assert.strictEqual(externalSidecarLabelFromFileName('session', 'session.app.log'), 'app');
        });
        test('returns external when pattern does not match', () => {
            assert.strictEqual(externalSidecarLabelFromFileName('session', 'other.app.log'), 'external');
        });
    });

    suite('parseExternalSidecarToPending', () => {
        test('assigns source external:label per line', () => {
            const pending = parseExternalSidecarToPending('line one\nline two', 'app');
            assert.strictEqual(pending.length, 2);
            assert.strictEqual(pending[0].source, 'external:app');
            assert.strictEqual(pending[1].source, 'external:app');
        });
    });

    suite('parseUnifiedJsonlToPending', () => {
        test('parses JSONL lines and preserves source order', () => {
            const content = '{"source":"debug","text":"a"}\n{"source":"terminal","text":"b"}\n';
            const { lines, sources } = parseUnifiedJsonlToPending(content, ctx);
            assert.strictEqual(lines.length, 2);
            assert.strictEqual(lines[0].source, 'debug');
            assert.strictEqual(lines[1].source, 'terminal');
            assert.deepStrictEqual(sources, ['debug', 'terminal']);
        });
        test('skips invalid lines', () => {
            const content = 'not json\n{"source":"debug","text":"ok"}\n';
            const { lines, sources } = parseUnifiedJsonlToPending(content, ctx);
            assert.strictEqual(lines.length, 1);
            assert.strictEqual(sources[0], 'debug');
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
