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

        test('rawText preserves original line text before HTML conversion', () => {
            const lines = ['[stdout] hello <world>'];
            const pending = parseRawLinesToPending(lines, ctx);
            assert.strictEqual(pending[0].rawText, 'hello <world>');
        });

        test('rawText on marker preserves marker text', () => {
            const lines = ['--- MARKER: test ---'];
            const pending = parseRawLinesToPending(lines, ctx);
            assert.strictEqual(pending[0].rawText, 'MARKER: test');
        });

        test('extracts an ISO 8601 timestamp prefix, strips it, and sets timestamp', () => {
            const line = '2026-05-14T11:50:51.135Z  [CACHE]  HIT  flutter.releases';
            const pending = parseRawLinesToPending([line], ctx);
            assert.strictEqual(pending.length, 1);
            assert.strictEqual(pending[0].timestamp, Date.parse('2026-05-14T11:50:51.135Z'));
            // The ISO prefix must be removed from the message — it belongs in the
            // time decoration column, not inline in the text.
            assert.strictEqual(pending[0].rawText, '[CACHE]  HIT  flutter.releases');
            assert.ok(!pending[0].text.includes('2026-05-14T'), 'ISO prefix must be stripped from the displayed text');
        });

        test('parses an ISO line without trailing Z or fractional seconds', () => {
            const pending = parseRawLinesToPending(['2026-05-14T11:50:51 plain message'], ctx);
            assert.ok(pending[0].timestamp > 0, 'timestamp must be parsed even without .mmm or Z');
            assert.strictEqual(pending[0].rawText, 'plain message');
        });

        test('parses a space-separated date+time prefix', () => {
            const pending = parseRawLinesToPending(['2026-05-14 11:50:51.135  some message'], ctx);
            assert.ok(pending[0].timestamp > 0, 'space-separated date+time must be parsed');
            assert.strictEqual(pending[0].rawText, 'some message');
        });

        test('parses a clock-time-only prefix', () => {
            const pending = parseRawLinesToPending(['11:50:51.135  clock-only message'], ctx);
            assert.ok(pending[0].timestamp > 0, 'clock-time-only prefix must be parsed');
            assert.strictEqual(pending[0].rawText, 'clock-only message');
        });

        test('parses a syslog RFC 3164 prefix', () => {
            const pending = parseRawLinesToPending(['May 14 11:50:51 host daemon started'], ctx);
            assert.ok(pending[0].timestamp > 0, 'syslog Mon DD HH:MM:SS prefix must be parsed');
            assert.strictEqual(pending[0].rawText, 'host daemon started');
        });

        test('parses a Unix epoch-ms prefix', () => {
            const epoch = 1747223451135;
            const pending = parseRawLinesToPending([`${epoch} epoch message`], ctx);
            assert.strictEqual(pending[0].timestamp, epoch);
            assert.strictEqual(pending[0].rawText, 'epoch message');
        });

        test('does not mistake a bracket category for a timestamp', () => {
            const pending = parseRawLinesToPending(['[stdout] not a timestamp'], ctx);
            assert.strictEqual(pending[0].category, 'stdout');
            assert.strictEqual(pending[0].timestamp, 0);
        });

        test('does not mistake prose for a syslog timestamp', () => {
            // "Got 5 12:00:00" matches the syslog SHAPE, but "Got" is not a month —
            // parseTimestamp rejects it via the native-Date check, so the line is
            // left untouched rather than mis-stripped.
            const pending = parseRawLinesToPending(['Got 5 12:00:00 results back'], ctx);
            assert.strictEqual(pending[0].timestamp, 0);
            assert.strictEqual(pending[0].rawText, 'Got 5 12:00:00 results back');
        });
    });

    suite('sourceLineNo (gutter line-number mapping)', () => {
        // The displayed gutter number must track the user's raw file line, not the
        // in-memory allLines index — which drifts after Item A added hidden async-gap
        // items and synthetic repeat chips. parseRawLinesToPending and parseFileLine
        // honor ctx.sourceLineOffset to compute 1-based file-line numbers.
        test('parseRawLinesToPending stamps 1-based sourceLineNo from index when no offset', () => {
            const pending = parseRawLinesToPending(['[stdout] a', '[stdout] b', '[stdout] c'], ctx);
            assert.strictEqual(pending[0].sourceLineNo, 1);
            assert.strictEqual(pending[1].sourceLineNo, 2);
            assert.strictEqual(pending[2].sourceLineNo, 3);
        });
        test('parseRawLinesToPending adds ctx.sourceLineOffset (post-header start) to the index', () => {
            // sourceLineOffset = headerEnd; first content line is at file row headerEnd+1.
            const offsetCtx: FileParseContext = { ...ctx, sourceLineOffset: 50 };
            const pending = parseRawLinesToPending(['[stdout] first', '[stdout] second'], offsetCtx);
            assert.strictEqual(pending[0].sourceLineNo, 51);
            assert.strictEqual(pending[1].sourceLineNo, 52);
        });
        test('marker lines also carry sourceLineNo', () => {
            // Markers were previously omitted; without sourceLineNo on them the gutter
            // would skip numbers at session-boundary rows.
            const offsetCtx: FileParseContext = { ...ctx, sourceLineOffset: 100 };
            const pending = parseRawLinesToPending(['--- MARKER: split ---', '[stdout] after'], offsetCtx);
            assert.strictEqual(pending[0].isMarker, true);
            assert.strictEqual(pending[0].sourceLineNo, 101);
            assert.strictEqual(pending[1].sourceLineNo, 102);
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
        test('rawText preserves original sidecar line', () => {
            const pending = parseExternalSidecarToPending('raw <b>text</b>', 'app');
            assert.strictEqual(pending[0].rawText, 'raw <b>text</b>');
        });
        test('should extract ISO 8601 timestamps from sidecar lines and strip them from the text', () => {
            const line = '2026-04-13T11:46:50.066Z  [CACHE]  HIT  flutter.releases';
            const pending = parseExternalSidecarToPending(line, 'sda');
            assert.strictEqual(pending.length, 1);
            const expected = new Date('2026-04-13T11:46:50.066Z').getTime();
            assert.strictEqual(pending[0].timestamp, expected);
            // The timestamp belongs in the time decoration column, not inline.
            assert.ok(!pending[0].text.includes('2026-04-13T'), 'ISO prefix must be stripped from the displayed text');
            // rawText keeps the full original line for copy / dedup.
            assert.strictEqual(pending[0].rawText, line);
        });
        test('should return timestamp 0 for lines without timestamps', () => {
            const pending = parseExternalSidecarToPending('plain log line', 'sda');
            assert.strictEqual(pending[0].timestamp, 0);
        });
        test('should extract timestamps from multiple SDA lines', () => {
            const content = [
                '2026-04-13T11:46:50.066Z  [CACHE]  HIT  flutter.releases',
                '2026-04-13T11:46:50.067Z  [INFO ]  Scan started',
            ].join('\n');
            const pending = parseExternalSidecarToPending(content, 'sda');
            assert.strictEqual(pending.length, 2);
            assert.ok(pending[0].timestamp > 0);
            assert.ok(pending[1].timestamp > 0);
            assert.ok(pending[1].timestamp >= pending[0].timestamp);
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
