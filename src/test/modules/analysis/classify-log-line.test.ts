/**
 * Regression tests for prefixless Android system process classification.
 *
 * These lines arrive without the `D/Tag(pid):` logcat prefix — typically when
 * capturing over DAP, `adb logcat -v raw`, tombstones, or system_server stderr.
 * Without the patterns added in `stack-parser.ts`, they fell through to the
 * `tier='flutter'` fallback in `viewer-data-add.ts` and escaped the Device
 * Logs `warnplus` filter, leaking system noise into otherwise-clean views.
 *
 * Each test below corresponds to a verbatim line seen in the bug report; if a
 * pattern is later tightened or relaxed, the test that breaks first names the
 * exact message body that motivated the rule.
 */
import * as assert from 'assert';
import { classifyLogLine } from '../../../modules/analysis/stack-parser';

suite('classifyLogLine — prefixless Android system process patterns', () => {
    test('logcat buffer banner is device-other', () => {
        assert.strictEqual(classifyLogLine('--------- beginning of system'), 'device-other');
        assert.strictEqual(classifyLogLine('--------- beginning of main'), 'device-other');
        assert.strictEqual(classifyLogLine('--------- beginning of crash'), 'device-other');
    });

    test('Saropa custom START banner is device-other', () => {
        assert.strictEqual(
            classifyLogLine('>>>>>> START com.android.internal.os.ZygoteInit uid 0 <<<<<<'),
            'device-other',
        );
    });

    test('Zygote process lifecycle messages are device-other', () => {
        assert.strictEqual(classifyLogLine('Forked child process 699'), 'device-other');
        assert.strictEqual(classifyLogLine('System server process 699 has been created'), 'device-other');
        assert.strictEqual(classifyLogLine('Entering forkRepeatedly native zygote loop'), 'device-other');
        assert.strictEqual(classifyLogLine('Process WebViewLoader-x86_64 (pid 998) has died: psvc PER'), 'device-other');
        assert.strictEqual(classifyLogLine('VM exiting with result code 0, cleanup skipped.'), 'device-other');
    });

    test('boot preload / class-init lines are device-other', () => {
        assert.strictEqual(classifyLogLine('begin preload'), 'device-other');
        assert.strictEqual(classifyLogLine('end preload'), 'device-other');
        assert.strictEqual(classifyLogLine('Called ZygoteHooks.endPreload()'), 'device-other');
        assert.strictEqual(classifyLogLine('Installed AndroidKeyStoreProvider in 0ms.'), 'device-other');
        assert.strictEqual(classifyLogLine('Warmed up JCA providers in 3ms.'), 'device-other');
        assert.strictEqual(classifyLogLine('Using default boot image'), 'device-other');
        assert.strictEqual(classifyLogLine('Leaving lock profiling enabled'), 'device-other');
        assert.strictEqual(classifyLogLine('Memory class: 192'), 'device-other');
        assert.strictEqual(classifyLogLine('System now ready'), 'device-other');
    });

    test('ActivityManager / WindowManager system_server diagnostics are device-other', () => {
        assert.strictEqual(classifyLogLine('Slow operation: 188ms so far, now at startProcess: returned from zygote!'), 'device-other');
        assert.strictEqual(
            classifyLogLine('Override config changes=200 {1.0 ?mcc0mnc [en_US] ldltr sw411dp w411dp h914dp}'),
            'device-other',
        );
        assert.strictEqual(
            classifyLogLine('Override config changes=60007dfc {1.0 ?mcc0mnc [en_US] ldltr sw411dp w411dp h914dp}'),
            'device-other',
        );
        assert.strictEqual(classifyLogLine('DeferredDisplayUpdater: applying DisplayInfo(1080 x 2400) immediately'), 'device-other');
        assert.strictEqual(classifyLogLine('ProcessObserver broadcast disabled'), 'device-other');
        assert.strictEqual(classifyLogLine('Skipping saving the start info due to ongoing loading from storage'), 'device-other');
        assert.strictEqual(classifyLogLine('Too early to start/bind service in system_server: Phase=550 ComponentInfo{...}'), 'device-other');
    });

    test('service / receiver diagnostics are device-other', () => {
        assert.strictEqual(
            classifyLogLine('Unable to start service Intent { act=android.service.notification.NotificationListenerService }'),
            'device-other',
        );
        assert.strictEqual(classifyLogLine('Unable to find com.google.android.trichromelibrary_768016438/u0'), 'device-other');
        assert.strictEqual(
            classifyLogLine('Receiver with filter android.content.IntentFilter@5b4e3eb already registered for pid 954'),
            'device-other',
        );
        assert.strictEqual(
            classifyLogLine('Unbind failed: could not find connection for android.app.LoadedApk$ServiceDispatcher'),
            'device-other',
        );
    });

    test('lmkd / freezer / display settings are device-other', () => {
        assert.strictEqual(classifyLogLine('Connection with lmkd established'), 'device-other');
        assert.strictEqual(classifyLogLine('lmkd data connection established'), 'device-other');
        assert.strictEqual(classifyLogLine('Freezer timeout set to 10000'), 'device-other');
        assert.strictEqual(classifyLogLine('Freezer enabled'), 'device-other');
        assert.strictEqual(classifyLogLine('No existing display settings, starting empty'), 'device-other');
    });

    test('StatsPullAtomService boot probe is device-other', () => {
        assert.strictEqual(classifyLogLine('StatsPullAtomService not ready yet.'), 'device-other');
    });

    test('app stdout/stderr without these patterns still returns undefined', () => {
        // User app's debugPrint() / print() output — must NOT be misclassified as device.
        assert.strictEqual(classifyLogLine('User loaded contact list with 42 entries'), undefined);
        assert.strictEqual(classifyLogLine('My custom app log line'), undefined);
        assert.strictEqual(classifyLogLine('foo bar baz'), undefined);
    });

    test('logcat-prefixed lines still classify by tag (regression: prefix wins over system patterns)', () => {
        // I/flutter — must stay flutter tier even if the message body echoes a system_server string.
        assert.strictEqual(classifyLogLine('I/flutter (1234): Forked child process 1'), 'flutter');
    });
});
