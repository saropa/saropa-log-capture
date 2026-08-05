import * as assert from 'node:assert';
import { LogcatCrashGate } from '../../../modules/screenshot/logcat-crash-gate';

/** Device stamps are device-local; arrivals are absolute. The two are never compared. */
const YEAR = 2026;
const crash = (stamp: string): string => `${stamp} 24445 24458 E AndroidRuntime: FATAL EXCEPTION: main`;
const info = (stamp: string): string => `${stamp} 24732 24752 I ActivityManager: displayed`;

/** Arrival clock in absolute epoch ms — deliberately UTC-anchored so the runner's own
 *  timezone cannot influence the result (the defect this suite exists to prevent). */
const T0 = Date.UTC(2026, 7, 4, 23, 0, 0);

suite('LogcatCrashGate', () => {
    test('should admit a live crash regardless of device/host timezone offset', () => {
        // Device stamps sit 11 hours from the host's UTC arrival clock — larger than any
        // absolute "within N minutes of now" window would tolerate. The gate compares device
        // stamps only to other device stamps, so the offset cancels and this must still pass.
        const gate = new LogcatCrashGate();
        assert.strictEqual(gate.observe(info('08-05 10:00:00.000'), T0, YEAR), false, 'first line is grace');
        assert.strictEqual(gate.observe(info('08-05 10:00:06.000'), T0 + 6000, YEAR), false, 'still grace');
        assert.strictEqual(gate.observe(crash('08-05 10:00:10.000'), T0 + 10_000, YEAR), true);
    });

    test('should reject the startup replay burst (whole buffer inside the grace window)', () => {
        const gate = new LogcatCrashGate();
        // Real shape: hundreds of lines, days of device time, all arriving in the same instant.
        assert.strictEqual(gate.observe(crash('07-29 08:39:15.769'), T0, YEAR), false);
        assert.strictEqual(gate.observe(info('07-29 08:39:16.000'), T0 + 1, YEAR), false);
        assert.strictEqual(gate.observe(crash('08-04 23:00:00.000'), T0 + 2, YEAR), false);
    });

    test('should reject a mid-session re-dump of old history after the watermark is live', () => {
        const gate = new LogcatCrashGate();
        gate.observe(info('08-05 10:00:00.000'), T0, YEAR);              // grace anchor
        gate.observe(info('08-05 10:00:20.000'), T0 + 20_000, YEAR);     // watermark → live
        // logcat respawns and re-dumps the buffer: same old crash, now well past grace.
        assert.strictEqual(gate.observe(crash('07-29 08:39:15.769'), T0 + 21_000, YEAR), false);
        // A genuinely current crash in the same feed still fires.
        assert.strictEqual(gate.observe(crash('08-05 10:00:22.000'), T0 + 22_000, YEAR), true);
    });

    test('should reject non-critical tags and levels below error', () => {
        const gate = new LogcatCrashGate();
        gate.observe(info('08-05 10:00:00.000'), T0, YEAR);
        gate.observe(info('08-05 10:00:10.000'), T0 + 10_000, YEAR);
        // W-level binder chatter on a device-critical tag — matches isErrorLine, must not fire.
        assert.strictEqual(gate.observe('08-05 10:00:11.000 24732 26378 W ActivityManager: got error -32', T0 + 11_000, YEAR), false);
        // E-level on a device-OTHER tag (benign framework noise).
        assert.strictEqual(gate.observe('08-05 10:00:12.000 14538 14538 E Gralloc4: isSupported failed with 5', T0 + 12_000, YEAR), false);
        // Non-threadtime text is simply not a logcat crash.
        assert.strictEqual(gate.observe('Exception caught by rendering library', T0 + 13_000, YEAR), false);
    });

    test('should not let a December stamp poison the watermark after New Year rollover', () => {
        const gate = new LogcatCrashGate();
        const jan = Date.UTC(2027, 0, 1, 0, 0, 0);
        gate.observe(info('01-01 00:00:00.000'), jan, 2027);
        gate.observe(info('01-01 00:00:10.000'), jan + 10_000, 2027);
        // A tail-end December line (last year) must not jump the watermark ~11 months ahead.
        gate.observe(info('12-31 23:59:00.000'), jan + 11_000, 2027);
        // A current crash still reads as live rather than "stale by a year".
        assert.strictEqual(gate.observe(crash('01-01 00:00:12.000'), jan + 12_000, 2027), true);
    });
});
