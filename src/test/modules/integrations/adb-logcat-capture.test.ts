import * as assert from 'assert';
import {
    isAdbAvailable,
    getLogcatBuffer,
    clearLogcatBuffer,
    stopLogcatCapture,
} from '../../../modules/integrations/adb-logcat-capture';

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
