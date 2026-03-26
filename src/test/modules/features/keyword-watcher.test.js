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
const keyword_watcher_1 = require("../../../modules/features/keyword-watcher");
suite('KeywordWatcher', () => {
    function makeWatcher(configs) {
        return new keyword_watcher_1.KeywordWatcher(configs);
    }
    test('should match a simple string (case-insensitive)', () => {
        const watcher = makeWatcher([{ keyword: 'error', alert: 'flash' }]);
        const hits = watcher.testLine('Something Error happened');
        assert.strictEqual(hits.length, 1);
        assert.strictEqual(hits[0].label, 'error');
    });
    test('should not match when keyword is absent', () => {
        const watcher = makeWatcher([{ keyword: 'error', alert: 'flash' }]);
        const hits = watcher.testLine('All good here');
        assert.strictEqual(hits.length, 0);
    });
    test('should match multiple patterns on the same line', () => {
        const watcher = makeWatcher([
            { keyword: 'error', alert: 'flash' },
            { keyword: 'fatal', alert: 'flash' },
        ]);
        const hits = watcher.testLine('FATAL ERROR: something broke');
        assert.strictEqual(hits.length, 2);
    });
    test('should match regex pattern', () => {
        const watcher = makeWatcher([{ keyword: '/\\berr\\d+/i', alert: 'badge' }]);
        const hits = watcher.testLine('Got ERR42 from server');
        assert.strictEqual(hits.length, 1);
        assert.strictEqual(hits[0].alert, 'badge');
    });
    test('should not match invalid regex (gracefully skipped)', () => {
        const watcher = makeWatcher([{ keyword: '/[invalid/', alert: 'flash' }]);
        const hits = watcher.testLine('anything');
        assert.strictEqual(hits.length, 0);
    });
    test('should track hit counts correctly', () => {
        const watcher = makeWatcher([{ keyword: 'warn', alert: 'badge' }]);
        watcher.testLine('warning 1');
        watcher.testLine('no match');
        watcher.testLine('another warning');
        assert.strictEqual(watcher.getCounts().get('warn'), 2);
    });
    test('should reset counts to zero', () => {
        const watcher = makeWatcher([{ keyword: 'error', alert: 'flash' }]);
        watcher.testLine('error occurred');
        assert.strictEqual(watcher.getCounts().get('error'), 1);
        watcher.resetCounts();
        assert.strictEqual(watcher.getCounts().get('error'), 0);
    });
    test('should handle empty patterns list', () => {
        const watcher = makeWatcher([]);
        const hits = watcher.testLine('anything');
        assert.strictEqual(hits.length, 0);
    });
    test('should handle empty line', () => {
        const watcher = makeWatcher([{ keyword: 'error', alert: 'flash' }]);
        const hits = watcher.testLine('');
        assert.strictEqual(hits.length, 0);
    });
    test('should escape special regex characters in string patterns', () => {
        const watcher = makeWatcher([{ keyword: 'error()', alert: 'flash' }]);
        const hits = watcher.testLine('called error() method');
        assert.strictEqual(hits.length, 1);
    });
    test('should report correct alert type per hit', () => {
        const watcher = makeWatcher([
            { keyword: 'error', alert: 'flash' },
            { keyword: 'warning', alert: 'badge' },
            { keyword: 'info', alert: 'none' },
        ]);
        const hits = watcher.testLine('error and warning and info');
        assert.strictEqual(hits.find(h => h.label === 'error')?.alert, 'flash');
        assert.strictEqual(hits.find(h => h.label === 'warning')?.alert, 'badge');
        assert.strictEqual(hits.find(h => h.label === 'info')?.alert, 'none');
    });
});
//# sourceMappingURL=keyword-watcher.test.js.map