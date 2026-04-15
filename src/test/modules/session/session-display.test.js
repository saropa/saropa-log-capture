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
            assert.ok(typeof session_display_1.defaultDisplayOptions.dateRange === 'string', 'dateRange should be a string');
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
    suite('normalizeFilename', () => {
        test('should replace underscores with spaces and Title Case', () => {
            assert.strictEqual((0, session_display_1.normalizeFilename)('my_app_name.log'), 'My App Name.log');
        });
        test('should replace hyphens with spaces and Title Case', () => {
            assert.strictEqual((0, session_display_1.normalizeFilename)('my-app-name.log'), 'My App Name.log');
        });
        test('should replace dots with spaces and Title Case', () => {
            // Bug fix: "contacts.drift-advisor" was showing as "Contacts.drift Advisor"
            assert.strictEqual((0, session_display_1.normalizeFilename)('contacts.drift-advisor.json'), 'Contacts Drift Advisor.json');
        });
        test('should handle mixed separators', () => {
            assert.strictEqual((0, session_display_1.normalizeFilename)('my_app.sub-module.log'), 'My App Sub Module.log');
        });
        test('should collapse consecutive separators', () => {
            assert.strictEqual((0, session_display_1.normalizeFilename)('foo__bar--baz.log'), 'Foo Bar Baz.log');
        });
        test('should preserve extension for known types', () => {
            assert.strictEqual((0, session_display_1.normalizeFilename)('test.json'), 'Test.json');
            assert.strictEqual((0, session_display_1.normalizeFilename)('test.log'), 'Test.log');
            assert.strictEqual((0, session_display_1.normalizeFilename)('test.csv'), 'Test.csv');
        });
        test('should handle name with no known extension', () => {
            // No known extension — the whole string is the base
            assert.strictEqual((0, session_display_1.normalizeFilename)('my_app'), 'My App');
        });
        test('should fall back to original base when separators produce empty string', () => {
            // Edge case: name is only separators plus extension — falls back to raw base
            assert.strictEqual((0, session_display_1.normalizeFilename)('___.log'), '___.log');
        });
    });
});
//# sourceMappingURL=session-display.test.js.map