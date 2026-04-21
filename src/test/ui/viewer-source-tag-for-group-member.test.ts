import * as assert from 'assert';
import { sourceTagForGroupMember } from '../../ui/viewer/viewer-file-loader-sources';

suite('sourceTagForGroupMember', () => {

    test('returns the sidecar label when the filename shares the primary basename', () => {
        assert.strictEqual(
            sourceTagForGroupMember('Contacts_20260421_003700', 'Contacts_20260421_003700.logcat.log'),
            'logcat',
        );
        assert.strictEqual(
            sourceTagForGroupMember('Contacts_20260421_003700', 'Contacts_20260421_003700.drift-advisor.log'),
            'drift-advisor',
        );
    });

    test('falls back to the segment before .log when the filename does NOT share the primary basename', () => {
        // Cross-basename manual group: primary is Session_A, member is unrelated.
        assert.strictEqual(
            sourceTagForGroupMember('Session_A', 'OtherRun.drift-advisor.log'),
            'drift-advisor',
        );
    });

    test('uses the stem when the filename is a plain .log with no inner dot', () => {
        assert.strictEqual(sourceTagForGroupMember('Session_A', 'Session_B.log'), 'Session_B');
    });

    test('uses the stem for non-.log extensions', () => {
        assert.strictEqual(sourceTagForGroupMember('Session_A', 'Session_B.json'), 'Session_B');
        assert.strictEqual(sourceTagForGroupMember('Session_A', 'report.csv'), 'report');
    });

    test('clamps excessive labels to 32 characters', () => {
        const long = 'an-exceedingly-long-integration-provider-identifier-beyond-reasonable.log';
        const result = sourceTagForGroupMember('Primary', long);
        assert.ok(result.length <= 32, `label should be clamped but was ${result.length} chars: ${result}`);
    });

    test('sanitises characters that would break CSS class names or source ids', () => {
        const result = sourceTagForGroupMember('Primary', 'weird name & thing!.log');
        assert.ok(!/[\s!&]/.test(result), `label should not contain whitespace or special chars: ${result}`);
    });

    test('returns a non-empty fallback when the filename is pathological', () => {
        assert.ok(sourceTagForGroupMember('Primary', '.log').length > 0);
        assert.ok(sourceTagForGroupMember('Primary', '').length > 0);
    });
});
