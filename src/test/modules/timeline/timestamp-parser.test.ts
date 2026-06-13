import * as assert from 'assert';
import { parseTimestamp } from '../../../modules/timeline/timestamp-parser';

const HOUR = 60 * 60 * 1000;

suite('TimestampParser — time-only day rollover', () => {

    test('rolls a just-after-midnight stamp forward to the next day', () => {
        // Session started before midnight; a "00:05" line belongs to the following day.
        const sessionStart = new Date(2026, 2, 12, 23, 50, 0).getTime();
        const result = parseTimestamp('00:05:00', sessionStart);
        assert.ok(result !== undefined);
        assert.ok((result as number) > sessionStart, 'after-midnight time is later than session start');
        assert.ok((result as number) - sessionStart < HOUR, 'lands ~15 min after start, not ~24h earlier');
    });

    test('rolls a just-before-midnight stamp back to the previous day', () => {
        // Session started just after midnight; a "23:55" line belongs to the previous day.
        // The earlier one-directional code left this ~24h in the future.
        const sessionStart = new Date(2026, 2, 12, 0, 10, 0).getTime();
        const result = parseTimestamp('23:55:00', sessionStart);
        assert.ok(result !== undefined);
        assert.ok((result as number) < sessionStart, 'before-midnight time is earlier than session start');
        assert.ok(sessionStart - (result as number) < HOUR, 'lands ~15 min before start, not ~24h ahead');
    });

    test('keeps a same-day stamp on the session day', () => {
        const sessionStart = new Date(2026, 2, 12, 14, 0, 0).getTime();
        const result = parseTimestamp('14:30:00', sessionStart);
        assert.ok(result !== undefined);
        assert.strictEqual((result as number) - sessionStart, 30 * 60 * 1000);
    });
});
