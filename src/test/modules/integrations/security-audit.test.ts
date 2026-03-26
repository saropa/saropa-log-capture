import * as assert from 'assert';
import { redact, buildEventSummary } from '../../../modules/integrations/providers/security-audit';

suite('security-audit', () => {
    suite('redact', () => {
        test('should redact TargetUserName', () => {
            const input = 'TargetUserName: JohnDoe';
            assert.strictEqual(redact(input), 'TargetUserName=REDACTED');
        });

        test('should redact Account Name', () => {
            const input = 'Account Name: DOMAIN\\admin';
            assert.strictEqual(redact(input), 'TargetUserName=REDACTED');
        });

        test('should redact SubjectUserName', () => {
            const input = 'SubjectUserName=system_user';
            assert.strictEqual(redact(input), 'TargetUserName=REDACTED');
        });

        test('should redact IpAddress', () => {
            const input = 'IpAddress: 192.168.1.100';
            assert.strictEqual(redact(input), 'IpAddress=REDACTED');
        });

        test('should redact multiple fields in one message', () => {
            const input = 'TargetUserName: admin, IpAddress: 10.0.0.1';
            const result = redact(input);
            assert.ok(result.includes('TargetUserName=REDACTED'));
            assert.ok(result.includes('IpAddress=REDACTED'));
            assert.ok(!result.includes('admin'));
            assert.ok(!result.includes('10.0.0.1'));
        });

        test('should pass through clean strings unchanged', () => {
            const input = 'Process exited with code 0';
            assert.strictEqual(redact(input), 'Process exited with code 0');
        });

        test('should handle empty string', () => {
            assert.strictEqual(redact(''), '');
        });
    });

    suite('buildEventSummary', () => {
        test('should categorize logon events', () => {
            const events = [
                { time: '', id: 4624, level: '', message: '' },
                { time: '', id: 4624, level: '', message: '' },
                { time: '', id: 4625, level: '', message: '' },
            ];
            const summary = buildEventSummary(events);
            assert.ok(summary.includes('2 logon'));
            assert.ok(summary.includes('1 failed logon'));
        });

        test('should categorize logoff events', () => {
            const events = [
                { time: '', id: 4634, level: '', message: '' },
                { time: '', id: 4647, level: '', message: '' },
            ];
            const summary = buildEventSummary(events);
            assert.ok(summary.includes('2 logoff'));
        });

        test('should label unknown event IDs as other', () => {
            const events = [
                { time: '', id: 9999, level: '', message: '' },
            ];
            const summary = buildEventSummary(events);
            assert.ok(summary.includes('1 other'));
        });

        test('should handle empty events', () => {
            const summary = buildEventSummary([]);
            assert.strictEqual(summary, '0 event(s)');
        });

        test('should handle mix of known and unknown IDs', () => {
            const events = [
                { time: '', id: 4624, level: '', message: '' },
                { time: '', id: 1234, level: '', message: '' },
                { time: '', id: 4688, level: '', message: '' },
            ];
            const summary = buildEventSummary(events);
            assert.ok(summary.includes('1 logon'));
            assert.ok(summary.includes('1 other'));
            assert.ok(summary.includes('1 process created'));
        });
    });
});
