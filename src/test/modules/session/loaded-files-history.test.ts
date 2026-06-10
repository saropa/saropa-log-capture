import * as assert from 'node:assert';
import {
    pruneToCap, MAX_ENTRIES, type HistoryMap, type LoadedFileHistoryEntry,
} from '../../../modules/session/loaded-files-history';

/** Minimal entry with a given loadedAt; other fields are irrelevant to pruning. */
function entry(uri: string, loadedAt: number): LoadedFileHistoryEntry {
    return { uri, loadedAt, filename: uri, size: 1, mtime: 0 };
}

suite('loaded-files-history pruneToCap', () => {

    test('keeps the map untouched when under the cap', () => {
        const map: HistoryMap = {
            'file:///a.log': entry('file:///a.log', 100),
            'file:///b.log': entry('file:///b.log', 200),
        };
        const result = pruneToCap(map);
        assert.strictEqual(Object.keys(result).length, 2);
    });

    test('drops the oldest-by-loadedAt entries when over the cap', () => {
        const map: HistoryMap = {};
        // Build cap + 5 entries with ascending loadedAt; the 5 oldest must be dropped.
        for (let i = 0; i < MAX_ENTRIES + 5; i++) {
            map[`file:///f${i}.log`] = entry(`file:///f${i}.log`, i);
        }
        const result = pruneToCap(map);
        assert.strictEqual(Object.keys(result).length, MAX_ENTRIES);
        // The 5 lowest loadedAt values (0..4) are the oldest and must be gone.
        for (let i = 0; i < 5; i++) {
            assert.strictEqual(result[`file:///f${i}.log`], undefined, `oldest f${i} should be pruned`);
        }
        // The newest must survive.
        assert.ok(result[`file:///f${MAX_ENTRIES + 4}.log`], 'newest entry must survive');
    });
});
