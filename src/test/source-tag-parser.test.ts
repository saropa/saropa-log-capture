import * as assert from 'assert';
import { parseSourceTag, parseLogcatTag } from '../modules/source-tag-parser';

suite('SourceTagParser', () => {

    suite('parseSourceTag — logcat format', () => {

        test('should parse Debug level tag', () => {
            assert.strictEqual(parseSourceTag('D/FlutterJNI( 3861): flutter loaded'), 'flutterjni');
        });

        test('should parse Info level tag', () => {
            assert.strictEqual(parseSourceTag('I/flutter ( 3861): some message'), 'flutter');
        });

        test('should parse Warning level tag', () => {
            assert.strictEqual(parseSourceTag('W/HWUI    ( 3861): Unknown dataspace'), 'hwui');
        });

        test('should parse Error level tag', () => {
            assert.strictEqual(parseSourceTag('E/MediaCodec( 3861): Service not found'), 'mediacodec');
        });

        test('should parse Fatal level tag', () => {
            assert.strictEqual(parseSourceTag('F/libc    ( 3861): Fatal signal 6'), 'libc');
        });

        test('should parse Verbose level tag', () => {
            assert.strictEqual(parseSourceTag('V/MediaPlayer( 3861): resetDrmState'), 'mediaplayer');
        });

        test('should parse Assert level tag', () => {
            assert.strictEqual(parseSourceTag('A/DEBUG( 1234): crash info'), 'debug');
        });

        test('should handle tag with dots', () => {
            assert.strictEqual(
                parseSourceTag('I/TRuntime.CctTransportBackend( 3861): Making request'),
                'truntime.ccttransportbackend',
            );
        });

        test('should handle tag with hyphens', () => {
            assert.strictEqual(
                parseSourceTag('D/WM-RescheduleReceiver( 3861): Received intent'),
                'wm-reschedulereceiver',
            );
        });

        test('should handle PID with extra spaces', () => {
            assert.strictEqual(parseSourceTag('I/FA      ( 3861): Tag Manager'), 'fa');
        });

        test('should lowercase tag names for grouping', () => {
            assert.strictEqual(parseSourceTag('D/FlutterGeolocator( 3861): Attaching'), 'fluttergeolocator');
            assert.strictEqual(parseSourceTag('I/Choreographer( 3861): Skipped 54 frames'), 'choreographer');
        });
    });

    suite('parseSourceTag — bracket format', () => {

        test('should parse [log] prefix', () => {
            assert.strictEqual(parseSourceTag('[log] some dart log message'), 'log');
        });

        test('should parse arbitrary bracket tags', () => {
            assert.strictEqual(parseSourceTag('[SomeTag] details here'), 'sometag');
        });

        test('should handle spaces inside brackets', () => {
            assert.strictEqual(parseSourceTag('[My Tag] message'), 'my tag');
        });
    });

    suite('parseSourceTag — no match', () => {

        test('should return null for plain text', () => {
            assert.strictEqual(parseSourceTag('Launching lib/main.dart in debug mode...'), null);
        });

        test('should return null for empty string', () => {
            assert.strictEqual(parseSourceTag(''), null);
        });

        test('should return null for compiler error format', () => {
            assert.strictEqual(
                parseSourceTag('lib/foo.dart:196:21: Error: Undefined name'),
                null,
            );
        });

        test('should return null for VM service lines', () => {
            assert.strictEqual(
                parseSourceTag('Connecting to VM Service at ws://127.0.0.1:57309'),
                null,
            );
        });

        test('should return null for native crash separator', () => {
            assert.strictEqual(
                parseSourceTag('*** *** *** *** *** *** *** ***'),
                null,
            );
        });

        test('should return null for build output', () => {
            assert.strictEqual(parseSourceTag('Lost connection to device.'), null);
        });
    });

    suite('parseSourceTag — edge cases', () => {

        test('should extract sub-tag from generic Android logcat tag', () => {
            // "android" is generic — sub-tag detection finds [Awesome Notifications]
            const result = parseSourceTag('D/Android: [Awesome Notifications]( 3861): message');
            assert.strictEqual(result, 'awesome notifications');
        });

        test('should extract HERO-DEBUG sub-tag from flutter', () => {
            assert.strictEqual(
                parseSourceTag('I/flutter ( 9812): HERO-DEBUG ContactAvatar: building'),
                'hero-debug',
            );
        });

        test('should extract bracket sub-tag from flutter', () => {
            assert.strictEqual(
                parseSourceTag('I/flutter ( 9812): [Awesome Notifications] channel created'),
                'awesome notifications',
            );
        });

        test('should keep flutter when no sub-tag found', () => {
            assert.strictEqual(
                parseSourceTag('I/flutter ( 9812): normal log message'),
                'flutter',
            );
        });

        test('should extract sub-tag from system.err', () => {
            assert.strictEqual(
                parseSourceTag('W/system.err( 5432): RETROFIT Something failed'),
                'retrofit',
            );
        });

        test('should not extract sub-tag from specific logcat tags', () => {
            // PlayCore is not generic — should NOT look for sub-tags
            assert.strictEqual(
                parseSourceTag('I/PlayCore( 9812): HERO-DEBUG something'),
                'playcore',
            );
        });

        test('should require ALL-CAPS prefix to be 3+ chars', () => {
            // "OK " is only 2 chars — not a sub-tag
            assert.strictEqual(
                parseSourceTag('I/flutter ( 9812): OK something'),
                'flutter',
            );
        });

        test('should not match logcat-like pattern mid-line', () => {
            assert.strictEqual(parseSourceTag('some text D/Flutter( 1234): message'), null);
        });

        test('should not match bracket pattern mid-line', () => {
            assert.strictEqual(parseSourceTag('some text [log] message'), null);
        });
    });

    suite('parseLogcatTag', () => {

        test('should return raw logcat tag for specific tags', () => {
            assert.strictEqual(parseLogcatTag('D/FlutterJNI( 3861): message'), 'flutterjni');
        });

        test('should return raw logcat tag for generic tags', () => {
            assert.strictEqual(parseLogcatTag('I/flutter ( 9812): HERO-DEBUG msg'), 'flutter');
        });

        test('should return null for bracket format', () => {
            assert.strictEqual(parseLogcatTag('[log] some message'), null);
        });

        test('should return null for plain text', () => {
            assert.strictEqual(parseLogcatTag('no tag here'), null);
        });

        test('should return android for generic android tag', () => {
            assert.strictEqual(parseLogcatTag('D/Android: [Awesome Notifications]'), 'android');
        });
    });
});
