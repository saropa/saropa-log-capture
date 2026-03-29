import * as assert from 'assert';
import { parseLogcatLine, meetsMinLevel } from '../../../modules/integrations/adb-logcat-parser';

suite('adb-logcat-parser', () => {
    suite('parseLogcatLine', () => {
        test('should parse a standard threadtime line', () => {
            const line = '03-29 09:00:20.509 20824 20824 D FirebaseSessions: App backgrounded';
            const result = parseLogcatLine(line);
            assert.ok(result);
            assert.strictEqual(result.timestamp, '03-29 09:00:20.509');
            assert.strictEqual(result.pid, 20824);
            assert.strictEqual(result.tid, 20824);
            assert.strictEqual(result.level, 'D');
            assert.strictEqual(result.tag, 'FirebaseSessions');
            assert.strictEqual(result.message, 'App backgrounded');
            assert.strictEqual(result.raw, line);
        });

        test('should parse line with different PID and TID', () => {
            const line = '03-29 09:00:20.576   699   726 I ActivityManager: Killing 20824';
            const result = parseLogcatLine(line);
            assert.ok(result);
            assert.strictEqual(result.pid, 699);
            assert.strictEqual(result.tid, 726);
            assert.strictEqual(result.level, 'I');
            assert.strictEqual(result.tag, 'ActivityManager');
        });

        test('should parse all logcat levels', () => {
            const levels = ['V', 'D', 'I', 'W', 'E', 'F', 'A'];
            for (const level of levels) {
                const line = `01-01 00:00:00.000  1000  1000 ${level} TestTag: msg`;
                const result = parseLogcatLine(line);
                assert.ok(result, `Failed for level ${level}`);
                assert.strictEqual(result.level, level);
            }
        });

        test('should handle tag with dots and slashes', () => {
            const line = '03-29 09:00:20.801   486   486 I Zygote: Process 20824 exited';
            const result = parseLogcatLine(line);
            assert.ok(result);
            assert.strictEqual(result.tag, 'Zygote');
        });

        test('should handle message with colons', () => {
            const line = '03-29 09:00:20.000  1000  1000 E crash: key: value: detail';
            const result = parseLogcatLine(line);
            assert.ok(result);
            assert.strictEqual(result.tag, 'crash');
            assert.strictEqual(result.message, 'key: value: detail');
        });

        test('should return null for blank line', () => {
            assert.strictEqual(parseLogcatLine(''), null);
        });

        test('should return null for unparseable line', () => {
            assert.strictEqual(parseLogcatLine('--- beginning of main'), null);
        });

        test('should return null for header line', () => {
            assert.strictEqual(parseLogcatLine('--------- beginning of system'), null);
        });
    });

    suite('meetsMinLevel', () => {
        test('should accept all levels when minLevel is V', () => {
            for (const l of ['V', 'D', 'I', 'W', 'E', 'F', 'A']) {
                assert.strictEqual(meetsMinLevel(l, 'V'), true, `${l} should pass V`);
            }
        });

        test('should filter verbose when minLevel is D', () => {
            assert.strictEqual(meetsMinLevel('V', 'D'), false);
            assert.strictEqual(meetsMinLevel('D', 'D'), true);
            assert.strictEqual(meetsMinLevel('E', 'D'), true);
        });

        test('should only accept errors and above when minLevel is E', () => {
            assert.strictEqual(meetsMinLevel('I', 'E'), false);
            assert.strictEqual(meetsMinLevel('W', 'E'), false);
            assert.strictEqual(meetsMinLevel('E', 'E'), true);
            assert.strictEqual(meetsMinLevel('F', 'E'), true);
        });

        test('should accept unknown levels', () => {
            assert.strictEqual(meetsMinLevel('X', 'V'), true);
            assert.strictEqual(meetsMinLevel('E', 'X'), true);
        });
    });
});
