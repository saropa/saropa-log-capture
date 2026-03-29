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
const adb_logcat_capture_1 = require("../../../modules/integrations/adb-logcat-capture");
suite('adb-logcat-capture', () => {
    teardown(() => {
        (0, adb_logcat_capture_1.stopLogcatCapture)();
        (0, adb_logcat_capture_1.clearLogcatBuffer)();
    });
    test('isAdbAvailable should return boolean', () => {
        const result = (0, adb_logcat_capture_1.isAdbAvailable)();
        assert.strictEqual(typeof result, 'boolean');
    });
    test('getLogcatBuffer should return empty array initially', () => {
        const buf = (0, adb_logcat_capture_1.getLogcatBuffer)();
        assert.ok(Array.isArray(buf));
        assert.strictEqual(buf.length, 0);
    });
    test('clearLogcatBuffer should empty the buffer', () => {
        (0, adb_logcat_capture_1.clearLogcatBuffer)();
        assert.strictEqual((0, adb_logcat_capture_1.getLogcatBuffer)().length, 0);
    });
    test('stopLogcatCapture should be safe to call when not running', () => {
        (0, adb_logcat_capture_1.stopLogcatCapture)();
        (0, adb_logcat_capture_1.stopLogcatCapture)();
        assert.ok(true, 'No error thrown');
    });
    test('getLogcatBuffer should return a copy', () => {
        const a = (0, adb_logcat_capture_1.getLogcatBuffer)();
        const b = (0, adb_logcat_capture_1.getLogcatBuffer)();
        assert.notStrictEqual(a, b);
        assert.deepStrictEqual(a, b);
    });
});
//# sourceMappingURL=adb-logcat-capture.test.js.map