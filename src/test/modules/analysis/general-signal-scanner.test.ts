/**
 * Tests for extension-side signal scanner level filtering.
 *
 * Verifies that logcat level detection correctly identifies log levels and
 * that non-error logcat lines are excluded from signal pattern matching,
 * preventing false positives from Android PIDs and system noise (bug 002).
 */
import * as assert from 'assert';
import {
    getLogcatLevel,
    isErrorLevelOrNonLogcat,
} from '../../../modules/analysis/general-signal-scanner';

suite('GeneralSignalScanner — logcat level detection', () => {

    // ── getLogcatLevel: tag-format lines ("V/tag: message") ────────────

    test('should detect E level from tag-format logcat line', () => {
        assert.strictEqual(getLogcatLevel('E/ActivityManager: ANR in com.example'), 'E');
    });

    test('should detect I level from tag-format logcat line', () => {
        assert.strictEqual(getLogcatLevel('I/ActivityManager: Start proc 1041'), 'I');
    });

    test('should detect W level from tag-format logcat line', () => {
        assert.strictEqual(getLogcatLevel('W/System.err: java.io.IOException'), 'W');
    });

    test('should detect D level from tag-format logcat line', () => {
        assert.strictEqual(getLogcatLevel('D/dalvikvm: GC_CONCURRENT freed 2K'), 'D');
    });

    // ── getLogcatLevel: threadtime-format lines ────────────────────────

    test('should detect I level from threadtime-format logcat line', () => {
        const line = '04-15 19:00:41.400 690 720 I ActivityManager: Start proc 1041';
        assert.strictEqual(getLogcatLevel(line), 'I');
    });

    test('should detect E level from threadtime-format logcat line', () => {
        const line = '04-15 19:00:42.100 690 720 E ActivityManager: ANR in com.example';
        assert.strictEqual(getLogcatLevel(line), 'E');
    });

    // ── getLogcatLevel: non-logcat lines ──────────────────────────────

    test('should return undefined for plain text lines', () => {
        assert.strictEqual(getLogcatLevel('SocketException: Connection refused'), undefined);
    });

    test('should return undefined for Dart-style log lines', () => {
        assert.strictEqual(getLogcatLevel('[ERROR] flutter: Unhandled Exception'), undefined);
    });

    test('should return undefined for empty string', () => {
        assert.strictEqual(getLogcatLevel(''), undefined);
    });
});

suite('GeneralSignalScanner — isErrorLevelOrNonLogcat', () => {

    // ── Error-class logcat lines should pass through ──────────────────

    test('should return true for E/ logcat lines', () => {
        assert.strictEqual(isErrorLevelOrNonLogcat('E/MediaCodec: Service not found'), true);
    });

    test('should return true for F/ logcat lines', () => {
        assert.strictEqual(isErrorLevelOrNonLogcat('F/System: fatal crash'), true);
    });

    test('should return true for A/ logcat lines', () => {
        assert.strictEqual(isErrorLevelOrNonLogcat('A/libc: assertion failed'), true);
    });

    // ── Non-error logcat lines should be filtered out ────────────────

    test('should return false for I/ logcat lines (prevents PID false positives)', () => {
        /* Bug 002: "I ActivityManager: Start proc 1041" was matching as network failure
           because PID numbers like 502 matched the HTTP code regex. */
        assert.strictEqual(
            isErrorLevelOrNonLogcat('I/ActivityManager: Start proc 1041:com.google.android.bluetooth/1002'),
            false,
        );
    });

    test('should return false for I-level threadtime lines (CPU dump false positives)', () => {
        /* Bug 002: "E ActivityManager: 3% 502/android.hardware..." — but even if the
           content is E-tagged in logcat, the threadtime level field is what matters. */
        const line = '04-15 19:00:41.400 690 720 I ActivityManager: Start proc 502/some.service';
        assert.strictEqual(isErrorLevelOrNonLogcat(line), false);
    });

    test('should return false for D/ logcat lines', () => {
        assert.strictEqual(isErrorLevelOrNonLogcat('D/dalvikvm: GC_CONCURRENT freed 2K'), false);
    });

    test('should return false for W/ logcat lines', () => {
        assert.strictEqual(isErrorLevelOrNonLogcat('W/InputMethodManager: IME not ready'), false);
    });

    // ── Non-logcat lines should pass through ─────────────────────────

    test('should return true for non-logcat lines (Dart, Node, etc.)', () => {
        /* Non-logcat lines must pass through so that non-Android logs still get scanned. */
        assert.strictEqual(isErrorLevelOrNonLogcat('SocketException: Connection refused on port 8080'), true);
    });

    test('should return true for bracket-format error lines', () => {
        assert.strictEqual(isErrorLevelOrNonLogcat('[ERROR] flutter: Unhandled Exception: ECONNREFUSED'), true);
    });
});
