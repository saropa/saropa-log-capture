import * as assert from 'assert';
import { selectFilesToTrash } from '../../../modules/config/file-retention';

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
});
