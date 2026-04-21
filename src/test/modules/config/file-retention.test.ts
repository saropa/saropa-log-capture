import * as assert from 'assert';
import { selectFilesToTrash, expandGroupsForTrash } from '../../../modules/config/file-retention';
import type { SessionMeta } from '../../../modules/session/session-metadata';

suite('File retention', () => {

    suite('selectFilesToTrash', () => {

        test('returns empty when maxLogFiles <= 0', () => {
            const stats = [{ name: 'a.log', mtime: 100 }];
            assert.deepStrictEqual(selectFilesToTrash(stats, 0), []);
            assert.deepStrictEqual(selectFilesToTrash(stats, -1), []);
        });

        test('returns empty when count <= maxLogFiles', () => {
            const stats = [
                { name: 'a.log', mtime: 100 },
                { name: 'b.log', mtime: 200 },
            ];
            assert.deepStrictEqual(selectFilesToTrash(stats, 2), []);
            assert.deepStrictEqual(selectFilesToTrash(stats, 5), []);
        });

        test('returns oldest first when over limit', () => {
            const stats = [
                { name: 'new.log', mtime: 300 },
                { name: 'old.log', mtime: 100 },
                { name: 'mid.log', mtime: 200 },
            ];
            // 3 files, max 2 → trash 1 (oldest)
            assert.deepStrictEqual(selectFilesToTrash(stats, 2), ['old.log']);
        });

        test('trashes exactly count - maxLogFiles', () => {
            const stats = [
                { name: '1.log', mtime: 100 },
                { name: '2.log', mtime: 200 },
                { name: '3.log', mtime: 300 },
                { name: '4.log', mtime: 400 },
                { name: '5.log', mtime: 500 },
            ];
            assert.deepStrictEqual(selectFilesToTrash(stats, 3), ['1.log', '2.log']);
            assert.deepStrictEqual(selectFilesToTrash(stats, 1), ['1.log', '2.log', '3.log', '4.log']);
        });

        test('trashes one when two files and maxLogFiles 1', () => {
            const stats = [
                { name: 'new.log', mtime: 200 },
                { name: 'old.log', mtime: 100 },
            ];
            assert.deepStrictEqual(selectFilesToTrash(stats, 1), ['old.log']);
        });

        test('does not mutate input', () => {
            const stats = [
                { name: 'a.log', mtime: 200 },
                { name: 'b.log', mtime: 100 },
            ];
            selectFilesToTrash(stats, 1);
            assert.strictEqual(stats[0].name, 'a.log');
            assert.strictEqual(stats[1].name, 'b.log');
        });
    });

    suite('expandGroupsForTrash', () => {
        test('ungrouped candidates pass through unchanged', () => {
            const meta = new Map<string, SessionMeta>([
                ['a.log', {}],
                ['b.log', {}],
            ]);
            const out = expandGroupsForTrash(['a.log', 'b.log'], meta, undefined);
            assert.deepStrictEqual([...out].sort(), ['a.log', 'b.log']);
        });

        test('skips an active-group member entirely', () => {
            const meta = new Map<string, SessionMeta>([
                ['a.log', { groupId: 'g1' }],
                ['b.log', { groupId: 'g1' }],
                ['c.log', {}],
            ]);
            // Candidate a.log is in the active group g1 \u2014 must be skipped.
            const out = expandGroupsForTrash(['a.log', 'c.log'], meta, 'g1');
            assert.deepStrictEqual([...out].sort(), ['c.log']);
        });

        test('expands a closed-group candidate to every member', () => {
            const meta = new Map<string, SessionMeta>([
                ['a.log', { groupId: 'g1' }],
                ['b.log', { groupId: 'g1' }],
                ['c.log', { groupId: 'g1' }],
            ]);
            // Candidate a.log \u2192 expands to all three members of g1 (group is closed, no active id).
            const out = expandGroupsForTrash(['a.log'], meta, undefined);
            assert.deepStrictEqual([...out].sort(), ['a.log', 'b.log', 'c.log']);
        });

        test('dedupes when multiple candidates belong to the same closed group', () => {
            const meta = new Map<string, SessionMeta>([
                ['a.log', { groupId: 'g1' }],
                ['b.log', { groupId: 'g1' }],
            ]);
            // Two candidates, both in g1 \u2192 output is still just {a, b} (not duplicated).
            const out = expandGroupsForTrash(['a.log', 'b.log'], meta, undefined);
            assert.deepStrictEqual([...out].sort(), ['a.log', 'b.log']);
        });

        test('separates closed-group expansion from active-group skip', () => {
            const meta = new Map<string, SessionMeta>([
                ['a1.log', { groupId: 'open' }],
                ['a2.log', { groupId: 'open' }],
                ['b1.log', { groupId: 'closed' }],
                ['b2.log', { groupId: 'closed' }],
                ['c.log', {}],
            ]);
            // a1 is in the active group 'open' \u2192 skipped. b1 is in closed group \u2192 expands to b1+b2.
            // c is ungrouped \u2192 passes through. Result: {b1, b2, c}.
            const out = expandGroupsForTrash(['a1.log', 'b1.log', 'c.log'], meta, 'open');
            assert.deepStrictEqual([...out].sort(), ['b1.log', 'b2.log', 'c.log']);
        });
    });
});
