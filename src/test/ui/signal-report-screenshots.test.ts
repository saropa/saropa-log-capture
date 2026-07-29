import * as assert from 'node:assert';
import { selectDiffPair } from '../../ui/signals/signal-report-screenshots';
import type { ScreenshotMetaEntry } from '../../modules/screenshot/screenshot-store';

function entry(overrides: Partial<ScreenshotMetaEntry>): ScreenshotMetaEntry {
    return { file: 'x.png', trigger: 'error', timestamp: 0, logLine: 0, text: '', fingerprint: '', ...overrides };
}

suite('selectDiffPair', () => {
    test('should pair the nearest error capture with the latest earlier capture', () => {
        const nav = entry({ file: 'n.png', trigger: 'nav', timestamp: 100, logLine: 10 });
        const navLater = entry({ file: 'n2.png', trigger: 'nav', timestamp: 200, logLine: 40 });
        const err = entry({ file: 'e.png', trigger: 'error', timestamp: 300, logLine: 50 });
        const pair = selectDiffPair([nav, navLater, err], 52);
        assert.strictEqual(pair?.after.file, 'e.png');
        // Latest earlier capture wins as "before" (navLater, not the older nav).
        assert.strictEqual(pair?.before.file, 'n2.png');
    });

    test('should pick the error capture nearest the signal anchor when several exist', () => {
        const errFar = entry({ file: 'far.png', trigger: 'error', timestamp: 100, logLine: 10 });
        const errNear = entry({ file: 'near.png', trigger: 'error', timestamp: 300, logLine: 90 });
        const pair = selectDiffPair([errFar, errNear], 88);
        assert.strictEqual(pair?.after.file, 'near.png');
        // A prior error capture is an acceptable "before" source.
        assert.strictEqual(pair?.before.file, 'far.png');
    });

    test('should exclude same-timestamp entries from before-candidates (strict earlier only)', () => {
        // Two errors sharing the exact timestamp: neither is "earlier" than the other, so no
        // pair forms — the strict `<` comparison is the pinned behavior.
        const a = entry({ file: 'a.png', trigger: 'error', timestamp: 500, logLine: 40 });
        const b = entry({ file: 'b.png', trigger: 'error', timestamp: 500, logLine: 60 });
        assert.strictEqual(selectDiffPair([a, b], 50), undefined);
        // A genuinely earlier frame still pairs against the tied errors.
        const nav = entry({ file: 'n.png', trigger: 'nav', timestamp: 100, logLine: 10 });
        const pair = selectDiffPair([nav, a, b], 50);
        assert.strictEqual(pair?.before.file, 'n.png');
        assert.strictEqual(pair?.after.timestamp, 500);
    });

    test('should return undefined without an error capture or without an earlier frame', () => {
        const navOnly = [entry({ trigger: 'nav', timestamp: 100, logLine: 10 })];
        assert.strictEqual(selectDiffPair(navOnly, 10), undefined);
        // Error exists but nothing captured before it.
        const errFirst = [
            entry({ file: 'e.png', trigger: 'error', timestamp: 100, logLine: 10 }),
            entry({ file: 'n.png', trigger: 'nav', timestamp: 200, logLine: 20 }),
        ];
        assert.strictEqual(selectDiffPair(errFirst, 10), undefined);
        assert.strictEqual(selectDiffPair([], 10), undefined);
    });
});
