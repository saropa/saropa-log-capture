import * as assert from 'node:assert';
import { buildLoadedHistoryRows } from '../../ui/session/session-history-fetching';
import type { LoadedFileHistoryEntry } from '../../modules/session/loaded-files-history';

/** A history entry with severity counts, for asserting they survive the mapping. */
function entry(uri: string, loadedAt: number): LoadedFileHistoryEntry {
    return {
        uri, loadedAt, filename: uri.split('/').pop() ?? uri, size: 42, mtime: 1000,
        lineCount: 7, errorCount: 3, warningCount: 1,
    };
}

suite('buildLoadedHistoryRows (loaded-files merge)', () => {

    test('maps a history entry to a row dated to its load time and flagged loadedManually', () => {
        const rows = buildLoadedHistoryRows([entry('file:///ext/a.log', 5000)], new Set());
        assert.strictEqual(rows.length, 1);
        const row = rows[0];
        // mtime is the LOAD time so the webview day-groups it under when it was loaded.
        assert.strictEqual(row.mtime, 5000);
        assert.strictEqual(row.loadedManually, true);
        assert.strictEqual(row.uri.toString(), 'file:///ext/a.log');
        // Cached metadata survives the mapping (so the list never re-reads the file).
        assert.strictEqual(row.lineCount, 7);
        assert.strictEqual(row.errorCount, 3);
        assert.strictEqual(row.warningCount, 1);
    });

    test('dedupes entries whose URI is already among the scanned files', () => {
        const history = [entry('file:///reports/a.log', 5000), entry('file:///ext/b.log', 6000)];
        const scanned = new Set<string>(['file:///reports/a.log']);
        const rows = buildLoadedHistoryRows(history, scanned);
        // a.log lives in reports/ (scanned) so it is suppressed; only the external b.log remains.
        assert.strictEqual(rows.length, 1);
        assert.strictEqual(rows[0].uri.toString(), 'file:///ext/b.log');
    });

    test('returns an empty array when every entry is already scanned', () => {
        const history = [entry('file:///reports/a.log', 5000)];
        const rows = buildLoadedHistoryRows(history, new Set(['file:///reports/a.log']));
        assert.strictEqual(rows.length, 0);
    });
});
