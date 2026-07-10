import * as assert from 'assert';
import { parseStructuredLine } from '../../../modules/analysis/structured-line-parser';

suite('StructuredLineParser', () => {

    suite('parseStructuredLine — logcat threadtime', () => {

        test('should parse standard threadtime line', () => {
            const result = parseStructuredLine('04-12 20:47:05.621   485   485 D Zygote  : begin preload');
            assert.ok(result);
            assert.strictEqual(result.format, 'logcat-threadtime');
            assert.strictEqual(result.pid, 485);
            assert.strictEqual(result.tid, '485');
            assert.strictEqual(result.rawLevel, 'D');
            assert.strictEqual(result.level, 'debug');
            assert.strictEqual(result.tag, 'Zygote');
            assert.strictEqual(result.message, 'begin preload');
            assert.ok(result.timestamp);
        });

        test('should parse error-level logcat line', () => {
            const result = parseStructuredLine('03-29 09:00:20.509 20824 20824 E AndroidRuntime: FATAL EXCEPTION');
            assert.ok(result);
            assert.strictEqual(result.level, 'error');
            assert.strictEqual(result.tag, 'AndroidRuntime');
        });

        test('should parse warning-level logcat line', () => {
            const result = parseStructuredLine('04-12 20:46:56.366   240   240 W lowmemorykiller: low memory');
            assert.ok(result);
            assert.strictEqual(result.level, 'warning');
        });

        test('should not fracture the tag/message split on an embedded colon inside a bracket suffix', () => {
            // Some GmsCore/Clearcut components append a "[epoch:seq][tid]" counter
            // directly onto their tag with no colon-space delimiter at all. The old
            // non-greedy (.+?): split matched the FIRST colon anywhere in the line —
            // including the one inside "[000:619]" — truncating the tag and eating
            // the start of the message (2026-07-10, contacts device log).
            const result = parseStructuredLine(
                '07-10 10:45:49.281 25822 25918 I TY_com.google.android.libraries.communications.conference.service.impl.telecom.TelecomRegistra[000:619][25918] Telecom registration synclet',
            );
            assert.ok(result);
            assert.strictEqual(
                result.tag,
                'TY_com.google.android.libraries.communications.conference.service.impl.telecom.TelecomRegistra[000:619][25918]',
            );
            assert.strictEqual(result.message, 'Telecom registration synclet');
        });

        test('should not stamp a year-less logcat date in the far future (year rollback)', () => {
            // Logcat omits the year. Assuming the current year for a December line read the next January
            // threw the timestamp ~12 months ahead; the parser now rolls the year back when the
            // current-year date lands in the future. Invariant: never more than a day past now.
            const result = parseStructuredLine('12-31 23:59:59.999  100  100 I Test: end of year');
            assert.ok(result?.timestamp);
            assert.ok(
                (result.timestamp as number) <= Date.now() + 24 * 60 * 60 * 1000,
                'year-less timestamp is not parsed into the far future',
            );
        });
    });

    suite('parseStructuredLine — logcat shorthand', () => {

        test('should parse D/Tag: message format', () => {
            const result = parseStructuredLine('D/flutter: App started');
            assert.ok(result);
            assert.strictEqual(result.format, 'logcat-short');
            assert.strictEqual(result.rawLevel, 'D');
            assert.strictEqual(result.tag, 'flutter');
            assert.strictEqual(result.message, 'App started');
        });

        test('should parse E/Tag with PID format', () => {
            const result = parseStructuredLine('E/ActivityManager( 3861): error msg');
            assert.ok(result);
            assert.strictEqual(result.level, 'error');
            assert.strictEqual(result.tag, 'ActivityManager');
        });
    });

    suite('parseStructuredLine — log4j', () => {

        test('should parse log4j format', () => {
            const result = parseStructuredLine('2026-03-12 14:32:05.123 [main] INFO com.example.App - Starting');
            assert.ok(result);
            assert.strictEqual(result.format, 'log4j');
            assert.strictEqual(result.tid, 'main');
            assert.strictEqual(result.level, 'info');
            assert.strictEqual(result.tag, 'com.example.App');
            assert.strictEqual(result.message, 'Starting');
        });

        test('should parse log4j with T separator', () => {
            const result = parseStructuredLine('2026-03-12T14:32:05.123 [worker-1] ERROR com.App - Crash');
            assert.ok(result);
            assert.strictEqual(result.level, 'error');
        });
    });

    suite('parseStructuredLine — python logging', () => {

        test('should parse python format', () => {
            const result = parseStructuredLine('2026-03-12 14:32:05,123 - mymodule - INFO - Starting server');
            assert.ok(result);
            assert.strictEqual(result.format, 'python');
            assert.strictEqual(result.tag, 'mymodule');
            assert.strictEqual(result.level, 'info');
            assert.strictEqual(result.message, 'Starting server');
        });
    });

    suite('parseStructuredLine — bracketed', () => {

        test('should parse bracketed timestamp + level', () => {
            const result = parseStructuredLine('[2026-03-12 14:32:05.123] [ERROR] Something broke');
            assert.ok(result);
            assert.strictEqual(result.format, 'bracketed');
            assert.strictEqual(result.level, 'error');
            assert.strictEqual(result.message, 'Something broke');
        });

        test('should parse ISO timestamp with Z', () => {
            const result = parseStructuredLine('[2026-03-12T14:32:05.123Z] [WARN] disk full');
            assert.ok(result);
            assert.strictEqual(result.level, 'warning');
        });
    });

    suite('parseStructuredLine — iso-level', () => {

        test('should parse ISO timestamp + level without brackets', () => {
            const result = parseStructuredLine('2026-03-12T14:32:05.123Z INFO Starting server');
            assert.ok(result);
            assert.strictEqual(result.format, 'iso-level');
            assert.strictEqual(result.level, 'info');
        });
    });

    suite('parseStructuredLine — syslog', () => {

        test('should parse syslog RFC 3164', () => {
            const result = parseStructuredLine('Mar 12 14:32:05 myhost sshd[1234]: Accepted publickey');
            assert.ok(result);
            assert.strictEqual(result.format, 'syslog-3164');
            assert.strictEqual(result.pid, 1234);
            assert.strictEqual(result.tag, 'sshd');
            assert.strictEqual(result.message, 'Accepted publickey');
        });

        test('should parse syslog without PID', () => {
            const result = parseStructuredLine('Mar 12 14:32:05 myhost kernel: OOM detected');
            assert.ok(result);
            assert.strictEqual(result.pid, undefined);
            assert.strictEqual(result.tag, 'kernel');
        });
    });

    suite('parseStructuredLine — SDA log', () => {

        test('should parse [log] prefix format', () => {
            const result = parseStructuredLine('[log] 14:32:05.123 Something happened');
            assert.ok(result);
            assert.strictEqual(result.format, 'sda-log');
            assert.strictEqual(result.tag, 'log');
            assert.strictEqual(result.message, 'Something happened');
        });
    });

    suite('parseStructuredLine — no match', () => {

        test('should return null for plain text', () => {
            assert.strictEqual(parseStructuredLine('just some normal text'), null);
        });

        test('should return null for empty string', () => {
            assert.strictEqual(parseStructuredLine(''), null);
        });
    });

    suite('parseStructuredLine — format hint', () => {

        test('should use format hint when it matches', () => {
            const result = parseStructuredLine(
                '04-12 20:47:05.621   485   485 D Zygote  : msg',
                'logcat-threadtime',
            );
            assert.ok(result);
            assert.strictEqual(result.format, 'logcat-threadtime');
        });

        test('should fall back to full chain when hint does not match', () => {
            const result = parseStructuredLine(
                'D/flutter: hello',
                'logcat-threadtime',
            );
            assert.ok(result);
            assert.strictEqual(result.format, 'logcat-short');
        });

        test('should return null when hint misses and no format matches', () => {
            assert.strictEqual(parseStructuredLine('plain text', 'logcat-threadtime'), null);
        });
    });
});
