"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const source_tag_parser_1 = require("../../../modules/source/source-tag-parser");
suite('SourceTagParser', () => {
    suite('parseSourceTag — logcat format', () => {
        test('should parse Debug level tag', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('D/FlutterJNI( 3861): flutter loaded'), 'flutterjni');
        });
        test('should parse Info level tag', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('I/flutter ( 3861): some message'), 'flutter');
        });
        test('should parse Warning level tag', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('W/HWUI    ( 3861): Unknown dataspace'), 'hwui');
        });
        test('should parse Error level tag', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('E/MediaCodec( 3861): Service not found'), 'mediacodec');
        });
        test('should parse Fatal level tag', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('F/libc    ( 3861): Fatal signal 6'), 'libc');
        });
        test('should parse Verbose level tag', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('V/MediaPlayer( 3861): resetDrmState'), 'mediaplayer');
        });
        test('should parse Assert level tag', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('A/DEBUG( 1234): crash info'), 'debug');
        });
        test('should handle tag with dots', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('I/TRuntime.CctTransportBackend( 3861): Making request'), 'truntime.ccttransportbackend');
        });
        test('should handle tag with hyphens', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('D/WM-RescheduleReceiver( 3861): Received intent'), 'wm-reschedulereceiver');
        });
        test('should handle PID with extra spaces', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('I/FA      ( 3861): Tag Manager'), 'fa');
        });
        test('should lowercase tag names for grouping', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('D/FlutterGeolocator( 3861): Attaching'), 'fluttergeolocator');
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('I/Choreographer( 3861): Skipped 54 frames'), 'choreographer');
        });
    });
    suite('parseSourceTag — bracket format', () => {
        test('should parse [log] prefix', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('[log] some dart log message'), 'log');
        });
        test('should parse arbitrary bracket tags', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('[SomeTag] details here'), 'sometag');
        });
        test('should handle spaces inside brackets', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('[My Tag] message'), 'my tag');
        });
    });
    suite('parseSourceTag — no match', () => {
        test('should return null for plain text', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('Launching lib/main.dart in debug mode...'), null);
        });
        test('should return null for empty string', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)(''), null);
        });
        test('should return null for compiler error format', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('lib/foo.dart:196:21: Error: Undefined name'), null);
        });
        test('should return null for VM service lines', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('Connecting to VM Service at ws://127.0.0.1:57309'), null);
        });
        test('should return null for native crash separator', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('*** *** *** *** *** *** *** ***'), null);
        });
        test('should return null for build output', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('Lost connection to device.'), null);
        });
    });
    suite('parseSourceTag — edge cases', () => {
        test('should extract sub-tag from generic Android logcat tag', () => {
            // "android" is generic — sub-tag detection finds [Awesome Notifications]
            const result = (0, source_tag_parser_1.parseSourceTag)('D/Android: [Awesome Notifications]( 3861): message');
            assert.strictEqual(result, 'awesome notifications');
        });
        test('should extract HERO-DEBUG sub-tag from flutter', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('I/flutter ( 9812): HERO-DEBUG ContactAvatar: building'), 'hero-debug');
        });
        test('should classify Drift SQL statements as database source tag', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('I/flutter ( 5475): Drift: Sent SELECT * FROM "contacts" WHERE "contact_saropa_u_u_i_d" = ? LIMIT 1; with args [sar-c4bd35cd-c72d-4f95-b5a2-405348819d01]'), 'database');
        });
        test('should extract bracket sub-tag from flutter', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('I/flutter ( 9812): [Awesome Notifications] channel created'), 'awesome notifications');
        });
        test('should keep flutter when no sub-tag found', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('I/flutter ( 9812): normal log message'), 'flutter');
        });
        test('should extract sub-tag from system.err', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('W/system.err( 5432): RETROFIT Something failed'), 'retrofit');
        });
        test('should not extract sub-tag from specific logcat tags', () => {
            // PlayCore is not generic — should NOT look for sub-tags
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('I/PlayCore( 9812): HERO-DEBUG something'), 'playcore');
        });
        test('should require ALL-CAPS prefix to be 3+ chars', () => {
            // "OK " is only 2 chars — not a sub-tag
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('I/flutter ( 9812): OK something'), 'flutter');
        });
        test('should not match logcat-like pattern mid-line', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('some text D/Flutter( 1234): message'), null);
        });
        test('should not match bracket pattern mid-line', () => {
            assert.strictEqual((0, source_tag_parser_1.parseSourceTag)('some text [log] message'), null);
        });
    });
    suite('parseLogcatTag', () => {
        test('should return raw logcat tag for specific tags', () => {
            assert.strictEqual((0, source_tag_parser_1.parseLogcatTag)('D/FlutterJNI( 3861): message'), 'flutterjni');
        });
        test('should return raw logcat tag for generic tags', () => {
            assert.strictEqual((0, source_tag_parser_1.parseLogcatTag)('I/flutter ( 9812): HERO-DEBUG msg'), 'flutter');
        });
        test('should return null for bracket format', () => {
            assert.strictEqual((0, source_tag_parser_1.parseLogcatTag)('[log] some message'), null);
        });
        test('should return null for plain text', () => {
            assert.strictEqual((0, source_tag_parser_1.parseLogcatTag)('no tag here'), null);
        });
        test('should return android for generic android tag', () => {
            assert.strictEqual((0, source_tag_parser_1.parseLogcatTag)('D/Android: [Awesome Notifications]'), 'android');
        });
    });
});
//# sourceMappingURL=source-tag-parser.test.js.map