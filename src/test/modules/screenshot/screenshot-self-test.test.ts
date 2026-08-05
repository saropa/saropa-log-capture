import * as assert from 'node:assert';
import { formatSelfTest, parseAdbDevices, runScreenshotSelfTest } from '../../../modules/screenshot/screenshot-self-test';

suite('parseAdbDevices', () => {
    test('should return only ready devices, skipping the banner and non-ready states', () => {
        const out = [
            'List of devices attached',
            'ZY22G6BMXR\tdevice',
            'emulator-5554\toffline',
            '0A111FDD40012B\tunauthorized',
            'R5CT10ABCDE\tdevice',
            '',
        ].join('\n');
        assert.deepStrictEqual(parseAdbDevices(out), ['ZY22G6BMXR', 'R5CT10ABCDE']);
    });

    test('should return empty when nothing is attached', () => {
        assert.deepStrictEqual(parseAdbDevices('List of devices attached\n\n'), []);
    });
});

suite('formatSelfTest', () => {
    test('should name the toggle when screenshots are off', () => {
        const line = formatSelfTest({ enabled: false, triggers: 'errors', devices: [] });
        assert.ok(line.includes('OFF'));
        assert.ok(line.includes('Debug Screenshots'), 'must say where to turn it on');
    });

    test('should call out a missing adb and a missing device explicitly', () => {
        const noAdb = formatSelfTest({ enabled: true, triggers: 'errors', devices: [] });
        assert.ok(noAdb.includes('adb NOT FOUND'));
        assert.ok(noAdb.includes('NO DEVICE'));
    });

    test('should report the healthy single-device case compactly', () => {
        const ok = formatSelfTest({ enabled: true, triggers: 'errors+warnings', adbVersion: '1.0.41', devices: ['ZY22G6BMXR'] });
        assert.strictEqual(ok, 'Screenshots: on · triggers errors+warnings · adb 1.0.41 · device ZY22G6BMXR');
    });

    test('should tell the user how to disambiguate multiple devices', () => {
        const many = formatSelfTest({ enabled: true, triggers: 'errors', adbVersion: '1.0.41', devices: ['A1', 'B2'] });
        assert.ok(many.includes('A1, B2'));
        assert.ok(many.includes('integrations.adbLogcat.device'));
    });
});

suite('runScreenshotSelfTest', () => {
    test('should skip probing entirely when screenshots are disabled', async () => {
        const t = await runScreenshotSelfTest(false, 'errors');
        assert.strictEqual(t.enabled, false);
        assert.deepStrictEqual(t.devices, []);
        assert.strictEqual(t.adbVersion, undefined);
    });

    test('should probe the real environment without throwing', async function () {
        // Environment-dependent by design: on a machine with adb + device it reports both; on
        // one without, it must still resolve cleanly (the probe is diagnostics, never a gate).
        this.timeout(10000);
        const t = await runScreenshotSelfTest(true, 'errors');
        assert.strictEqual(t.enabled, true);
        assert.ok(Array.isArray(t.devices));
        console.log(`[self-test] ${formatSelfTest(t)}`);
    });
});
