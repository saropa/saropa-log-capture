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
const session_display_1 = require("../../../ui/session/session-display");
suite('session-display', () => {
    suite('defaultDisplayOptions', () => {
        test('includes dateRange with value "all"', () => {
            assert.strictEqual(session_display_1.defaultDisplayOptions.dateRange, 'all');
        });
        test('has all required display option fields', () => {
            assert.strictEqual(typeof session_display_1.defaultDisplayOptions.stripDatetime, 'boolean');
            assert.strictEqual(typeof session_display_1.defaultDisplayOptions.normalizeNames, 'boolean');
            assert.strictEqual(typeof session_display_1.defaultDisplayOptions.showDayHeadings, 'boolean');
            assert.strictEqual(typeof session_display_1.defaultDisplayOptions.reverseSort, 'boolean');
            assert.ok(session_display_1.defaultDisplayOptions.dateRange === 'all' || session_display_1.defaultDisplayOptions.dateRange === '7d' || session_display_1.defaultDisplayOptions.dateRange === '30d');
        });
    });
    suite('formatRelativeTime', () => {
        test('should return "(just now)" for timestamps < 1 min ago', () => {
            const now = Date.now();
            assert.strictEqual((0, session_display_1.formatRelativeTime)(now), '(just now)');
            assert.strictEqual((0, session_display_1.formatRelativeTime)(now - 30_000), '(just now)');
        });
        test('should return "(1 min ago)" for 1 minute ago', () => {
            assert.strictEqual((0, session_display_1.formatRelativeTime)(Date.now() - 60_000), '(1 min ago)');
        });
        test('should return "(X min ago)" for 2-59 minutes ago', () => {
            assert.strictEqual((0, session_display_1.formatRelativeTime)(Date.now() - 5 * 60_000), '(5 min ago)');
            assert.strictEqual((0, session_display_1.formatRelativeTime)(Date.now() - 59 * 60_000), '(59 min ago)');
        });
        test('should return "(1 hr ago)" for 1 hour ago', () => {
            assert.strictEqual((0, session_display_1.formatRelativeTime)(Date.now() - 60 * 60_000), '(1 hr ago)');
            assert.strictEqual((0, session_display_1.formatRelativeTime)(Date.now() - 89 * 60_000), '(1 hr ago)');
        });
        test('should return "(X hrs ago)" for 2-23 hours ago', () => {
            assert.strictEqual((0, session_display_1.formatRelativeTime)(Date.now() - 2 * 3_600_000), '(2 hrs ago)');
            assert.strictEqual((0, session_display_1.formatRelativeTime)(Date.now() - 23 * 3_600_000), '(23 hrs ago)');
        });
        test('should return empty string for >= 24 hours ago', () => {
            assert.strictEqual((0, session_display_1.formatRelativeTime)(Date.now() - 24 * 3_600_000), '');
            assert.strictEqual((0, session_display_1.formatRelativeTime)(Date.now() - 48 * 3_600_000), '');
        });
        test('should return empty string for future timestamps', () => {
            assert.strictEqual((0, session_display_1.formatRelativeTime)(Date.now() + 60_000), '');
        });
    });
});
//# sourceMappingURL=session-display.test.js.map