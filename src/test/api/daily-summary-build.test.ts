import * as assert from 'assert';
import { buildHeadline, buildTrouble } from '../../api-daily-summary-build';
import type { RecurringSignalEntry } from '../../modules/misc/recurring-signal-builder';

/** Build a minimal RecurringSignalEntry — only the fields the presenters read matter. */
function signal(over: Partial<RecurringSignalEntry>): RecurringSignalEntry {
    return {
        kind: 'error',
        fingerprint: 'abc123',
        label: 'Something failed',
        sessionCount: 1,
        totalOccurrences: 1,
        firstSeen: '20260715_000000_p.log',
        lastSeen: '20260715_000000_p.log',
        severity: 'high',
        recurring: false,
        timeline: [],
        ...over,
    } as RecurringSignalEntry;
}

suite('daily-summary headline', () => {
    test('should report no errors or warnings on a clean day', () => {
        const h = buildHeadline(3, { errors: 0, warnings: 0 }, undefined);
        assert.strictEqual(h, '3 log sessions with no errors or warnings.');
    });

    test('should singularize a single session', () => {
        const h = buildHeadline(1, { errors: 0, warnings: 0 }, undefined);
        assert.strictEqual(h, '1 log session with no errors or warnings.');
    });

    test('should pluralize errors and warnings', () => {
        const h = buildHeadline(2, { errors: 4, warnings: 1 }, undefined);
        assert.strictEqual(h, '2 log sessions with 4 errors and 1 warning.');
    });

    test('should omit a zero severity and name the top signal', () => {
        const h = buildHeadline(2, { errors: 4, warnings: 0 }, signal({ label: 'Null check operator' }));
        assert.strictEqual(h, '2 log sessions with 4 errors. Top issue: Null check operator.');
    });

    test('should list only warnings on a warnings-only day', () => {
        const h = buildHeadline(1, { errors: 0, warnings: 3 }, undefined);
        assert.strictEqual(h, '1 log session with 3 warnings.');
    });
});

suite('daily-summary trouble items', () => {
    test('should keep only critical and high severity signals', () => {
        const items = buildTrouble([
            signal({ severity: 'high', label: 'H' }),
            signal({ severity: 'critical', label: 'C' }),
            signal({ severity: 'medium', label: 'M' }),
            signal({ severity: 'low', label: 'L' }),
        ]);
        assert.deepStrictEqual(items.map((i) => i.label), ['H', 'C']);
    });

    test('should deep-link via openSignal with a kind:fingerprint id', () => {
        const [item] = buildTrouble([signal({ kind: 'network', fingerprint: 'deadbeef', severity: 'critical' })]);
        assert.strictEqual(item.command, 'saropaLogCapture.openSignal');
        assert.deepStrictEqual(item.args, { id: 'network:deadbeef' });
    });

    test('should fall back to a computed detail when the signal has none', () => {
        const [item] = buildTrouble([signal({ severity: 'high', totalOccurrences: 5, sessionCount: 2 })]);
        assert.strictEqual(item.detail, '5 occurrences across 2 logs');
    });

    test('should prefer the signal detail when present', () => {
        const [item] = buildTrouble([signal({ severity: 'high', detail: 'at foo.dart:42' })]);
        assert.strictEqual(item.detail, 'at foo.dart:42');
    });

    test('should cap the list at 10 items', () => {
        const many = Array.from({ length: 15 }, (_, i) => signal({ severity: 'high', label: `S${i}` }));
        assert.strictEqual(buildTrouble(many).length, 10);
    });
});
