import * as assert from 'assert';
import {
    isAdbAvailable,
    getLogcatBuffer,
    clearLogcatBuffer,
    stopLogcatCapture,
    shouldAcceptLogcatLine,
    parseAdbDevices,
    type LogcatLineFilter,
} from '../../../modules/integrations/adb-logcat-capture';
import { parseLogcatLine } from '../../../modules/integrations/adb-logcat-parser';

suite('adb-logcat-capture', () => {
    teardown(() => {
        stopLogcatCapture();
        clearLogcatBuffer();
    });

    test('isAdbAvailable should return boolean', () => {
        const result = isAdbAvailable();
        assert.strictEqual(typeof result, 'boolean');
    });

    test('getLogcatBuffer should return empty array initially', () => {
        const buf = getLogcatBuffer();
        assert.ok(Array.isArray(buf));
        assert.strictEqual(buf.length, 0);
    });

    test('clearLogcatBuffer should empty the buffer', () => {
        clearLogcatBuffer();
        assert.strictEqual(getLogcatBuffer().length, 0);
    });

    test('stopLogcatCapture should be safe to call when not running', () => {
        stopLogcatCapture();
        stopLogcatCapture();
        assert.ok(true, 'No error thrown');
    });

    test('getLogcatBuffer should return a copy', () => {
        const a = getLogcatBuffer();
        const b = getLogcatBuffer();
        assert.notStrictEqual(a, b);
        assert.deepStrictEqual(a, b);
    });
});

suite('shouldAcceptLogcatLine (ANR bypass)', () => {
    // ANR header as ActivityManager dumps it: from system_server (pid 1234), NOT the app (pid 9999).
    const anrHeader = parseLogcatLine('03-29 09:00:20.509  1234  1234 E ActivityManager: ANR in com.saropa.app');
    // A noisy device-other line at low level, also from a non-app pid.
    const deviceOther = parseLogcatLine('03-29 09:00:20.600  1234  1234 D SettingsState: persist async');

    const strict: LogcatLineFilter = {
        minLevel: 'W', filterByPid: true, pidFilter: 9999, captureDeviceOther: false, captureAnr: false,
    };

    test('captures cross-process ANR line even under PID + level filtering when captureAnr on', () => {
        assert.ok(anrHeader);
        assert.strictEqual(shouldAcceptLogcatLine(anrHeader, { ...strict, captureAnr: true }), true);
    });

    test('drops the same ANR line under PID filtering when captureAnr off', () => {
        assert.ok(anrHeader);
        // Different pid than the app -> PID gate drops it once the ANR bypass is disabled.
        assert.strictEqual(shouldAcceptLogcatLine(anrHeader, { ...strict, captureAnr: false }), false);
    });

    test('captureAnr does not resurrect device-other noise', () => {
        assert.ok(deviceOther);
        assert.strictEqual(shouldAcceptLogcatLine(deviceOther, { ...strict, captureAnr: true }), false);
    });
});

suite('parseAdbDevices', () => {
    test('extracts serials of ready devices only', () => {
        const out = [
            'List of devices attached',
            'emulator-5554\tdevice',
            'RF8M12345\tdevice',
            '',
        ].join('\n');
        assert.deepStrictEqual(parseAdbDevices(out), ['emulator-5554', 'RF8M12345']);
    });

    test('excludes offline / unauthorized / no-permission rows', () => {
        const out = [
            'List of devices attached',
            'emulator-5554\tdevice',
            'ZY223\toffline',
            'ABC99\tunauthorized',
            '0123456789ABCDEF\tno permissions',
        ].join('\n');
        // Only the ready "device" row is streaming-capable.
        assert.deepStrictEqual(parseAdbDevices(out), ['emulator-5554']);
    });

    test('returns empty for the no-devices case', () => {
        assert.deepStrictEqual(parseAdbDevices('List of devices attached\n\n'), []);
    });
});
