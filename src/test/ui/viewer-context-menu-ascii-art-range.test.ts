import * as assert from 'node:assert';
import { computeAsciiArtBlockRange } from '../../ui/viewer-context-menu/viewer-context-menu-ascii-art-range';

suite('ViewerContextMenuAsciiArtRange', () => {
    test('returns null when the clicked row is not part of an art block', () => {
        const lines = [
            { type: 'line', html: 'plain' },
            { type: 'line', html: 'also plain' },
        ];
        assert.strictEqual(computeAsciiArtBlockRange(lines, 0), null);
        assert.strictEqual(computeAsciiArtBlockRange(lines, 1), null);
    });

    test('expands to the full contiguous art band from any row inside it', () => {
        const lines = [
            { html: 'before' },
            { html: '╭────╮', artBlockPos: 'start' },
            { html: '│ hi │', artBlockPos: 'middle' },
            { html: '│ yo │', artBlockPos: 'middle' },
            { html: '╰────╯', artBlockPos: 'end' },
            { html: 'after' },
        ];
        // Same range no matter which art row is right-clicked.
        assert.deepStrictEqual(computeAsciiArtBlockRange(lines, 1), { lo: 1, hi: 4 });
        assert.deepStrictEqual(computeAsciiArtBlockRange(lines, 2), { lo: 1, hi: 4 });
        assert.deepStrictEqual(computeAsciiArtBlockRange(lines, 4), { lo: 1, hi: 4 });
    });

    test('two adjacent blocks separated by a plain row do not merge', () => {
        const lines = [
            { html: '╭─╮', artBlockPos: 'start' },
            { html: '╰─╯', artBlockPos: 'end' },
            { html: 'gap' },
            { html: '┏━┓', artBlockPos: 'start' },
            { html: '┗━┛', artBlockPos: 'end' },
        ];
        assert.deepStrictEqual(computeAsciiArtBlockRange(lines, 0), { lo: 0, hi: 1 });
        assert.deepStrictEqual(computeAsciiArtBlockRange(lines, 4), { lo: 3, hi: 4 });
    });

    test('returns null for out-of-bounds indices', () => {
        const lines = [{ html: '╭─╮', artBlockPos: 'start' }];
        assert.strictEqual(computeAsciiArtBlockRange(lines, -1), null);
        assert.strictEqual(computeAsciiArtBlockRange(lines, 5), null);
    });

    test('a block reaching the array edges is bounded by the edges', () => {
        const lines = [
            { html: '╭─╮', artBlockPos: 'start' },
            { html: '│ │', artBlockPos: 'middle' },
            { html: '╰─╯', artBlockPos: 'end' },
        ];
        assert.deepStrictEqual(computeAsciiArtBlockRange(lines, 1), { lo: 0, hi: 2 });
    });
});
