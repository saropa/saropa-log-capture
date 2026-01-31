import * as assert from 'assert';
import { parseSourceTag } from '../modules/source-tag-parser';

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

        test('should handle Android: nested tag format', () => {
            // "D/Android: [Awesome Notifications]( 3861): message"
            // Tag is "Android" — the colon is the logcat separator, not part of the tag.
            const result = parseSourceTag('D/Android: [Awesome Notifications]( 3861): message');
            assert.strictEqual(result, 'android');
        });

        test('should not match logcat-like pattern mid-line', () => {
            assert.strictEqual(parseSourceTag('some text D/Flutter( 1234): message'), null);
        });

        test('should not match bracket pattern mid-line', () => {
            assert.strictEqual(parseSourceTag('some text [log] message'), null);
        });
    });
});
