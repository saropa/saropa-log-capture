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
const adb_logcat_parser_1 = require("../../../modules/integrations/adb-logcat-parser");
suite('adb-logcat-parser', () => {
    suite('parseLogcatLine', () => {
        test('should parse a standard threadtime line', () => {
            const line = '03-29 09:00:20.509 20824 20824 D FirebaseSessions: App backgrounded';
            const result = (0, adb_logcat_parser_1.parseLogcatLine)(line);
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
            const result = (0, adb_logcat_parser_1.parseLogcatLine)(line);
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
                const result = (0, adb_logcat_parser_1.parseLogcatLine)(line);
                assert.ok(result, `Failed for level ${level}`);
                assert.strictEqual(result.level, level);
            }
        });
        test('should handle tag with dots and slashes', () => {
            const line = '03-29 09:00:20.801   486   486 I Zygote: Process 20824 exited';
            const result = (0, adb_logcat_parser_1.parseLogcatLine)(line);
            assert.ok(result);
            assert.strictEqual(result.tag, 'Zygote');
        });
        test('should handle message with colons', () => {
            const line = '03-29 09:00:20.000  1000  1000 E crash: key: value: detail';
            const result = (0, adb_logcat_parser_1.parseLogcatLine)(line);
            assert.ok(result);
            assert.strictEqual(result.tag, 'crash');
            assert.strictEqual(result.message, 'key: value: detail');
        });
        test('should return null for blank line', () => {
            assert.strictEqual((0, adb_logcat_parser_1.parseLogcatLine)(''), null);
        });
        test('should return null for unparseable line', () => {
            assert.strictEqual((0, adb_logcat_parser_1.parseLogcatLine)('--- beginning of main'), null);
        });
        test('should return null for header line', () => {
            assert.strictEqual((0, adb_logcat_parser_1.parseLogcatLine)('--------- beginning of system'), null);
        });
    });
    suite('meetsMinLevel', () => {
        test('should accept all levels when minLevel is V', () => {
            for (const l of ['V', 'D', 'I', 'W', 'E', 'F', 'A']) {
                assert.strictEqual((0, adb_logcat_parser_1.meetsMinLevel)(l, 'V'), true, `${l} should pass V`);
            }
        });
        test('should filter verbose when minLevel is D', () => {
            assert.strictEqual((0, adb_logcat_parser_1.meetsMinLevel)('V', 'D'), false);
            assert.strictEqual((0, adb_logcat_parser_1.meetsMinLevel)('D', 'D'), true);
            assert.strictEqual((0, adb_logcat_parser_1.meetsMinLevel)('E', 'D'), true);
        });
        test('should only accept errors and above when minLevel is E', () => {
            assert.strictEqual((0, adb_logcat_parser_1.meetsMinLevel)('I', 'E'), false);
            assert.strictEqual((0, adb_logcat_parser_1.meetsMinLevel)('W', 'E'), false);
            assert.strictEqual((0, adb_logcat_parser_1.meetsMinLevel)('E', 'E'), true);
            assert.strictEqual((0, adb_logcat_parser_1.meetsMinLevel)('F', 'E'), true);
        });
        test('should accept unknown levels', () => {
            assert.strictEqual((0, adb_logcat_parser_1.meetsMinLevel)('X', 'V'), true);
            assert.strictEqual((0, adb_logcat_parser_1.meetsMinLevel)('E', 'X'), true);
        });
    });
});
//# sourceMappingURL=adb-logcat-parser.test.js.map