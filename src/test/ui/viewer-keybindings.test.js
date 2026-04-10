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
const viewer_keybindings_1 = require("../../ui/viewer/viewer-keybindings");
suite('ViewerKeybindings', () => {
    suite('normalizeKeyDescriptor', () => {
        test('lowercases and orders modifiers', () => {
            assert.strictEqual((0, viewer_keybindings_1.normalizeKeyDescriptor)('Ctrl+Shift+F'), 'ctrl+shift+f');
            assert.strictEqual((0, viewer_keybindings_1.normalizeKeyDescriptor)('Meta+Alt+A'), 'ctrl+alt+a');
        });
        test('normalizes space and special keys', () => {
            assert.strictEqual((0, viewer_keybindings_1.normalizeKeyDescriptor)('Space'), 'space');
            assert.strictEqual((0, viewer_keybindings_1.normalizeKeyDescriptor)('Escape'), 'escape');
        });
        test('single key', () => {
            assert.strictEqual((0, viewer_keybindings_1.normalizeKeyDescriptor)('m'), 'm');
            assert.strictEqual((0, viewer_keybindings_1.normalizeKeyDescriptor)('M'), 'm');
        });
    });
    suite('getDefaultKeyToAction', () => {
        test('returns key -> actionId map with f3 for openSearch', () => {
            const map = (0, viewer_keybindings_1.getDefaultKeyToAction)();
            assert.strictEqual(map['ctrl+f'], 'openSearch');
            assert.strictEqual(map['f3'], 'openSearch');
            assert.strictEqual(map['space'], 'togglePause');
            assert.strictEqual(map['m'], 'insertMarker');
        });
        test('all action IDs have exactly one default key (or f3 alias)', () => {
            const map = (0, viewer_keybindings_1.getDefaultKeyToAction)();
            const actions = new Set(Object.values(map));
            assert.ok(actions.size >= viewer_keybindings_1.VIEWER_KEYBINDING_ACTION_IDS.length, 'every action has a key');
        });
        test('copyRaw is bound to ctrl+alt+c by default', () => {
            const map = (0, viewer_keybindings_1.getDefaultKeyToAction)();
            assert.strictEqual(map['ctrl+alt+c'], 'copyRaw');
        });
    });
    test('VIEWER_KEYBINDING_ACTION_IDS includes copyRaw', () => {
        assert.ok(viewer_keybindings_1.VIEWER_KEYBINDING_ACTION_IDS.includes('copyRaw'), 'copyRaw must be a registered action ID');
    });
    suite('buildKeyToAction', () => {
        test('empty user config returns defaults plus f3', () => {
            const map = (0, viewer_keybindings_1.buildKeyToAction)(undefined);
            assert.strictEqual(map['space'], 'togglePause');
            assert.strictEqual(map['f3'], 'openSearch');
        });
        test('user override replaces default', () => {
            const map = (0, viewer_keybindings_1.buildKeyToAction)({ togglePause: 'x' });
            assert.strictEqual(map['x'], 'togglePause');
            assert.strictEqual(map['space'], undefined);
        });
        test('invalid action IDs are ignored', () => {
            const map = (0, viewer_keybindings_1.buildKeyToAction)({ unknownAction: 'x', togglePause: 'x' });
            assert.strictEqual(map['x'], 'togglePause');
        });
        test('empty key is ignored', () => {
            const map = (0, viewer_keybindings_1.buildKeyToAction)({ togglePause: '   ' });
            assert.strictEqual(map['space'], 'togglePause');
        });
    });
    suite('getViewerActionLabel', () => {
        test('returns label for known action', () => {
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('togglePause'), 'Toggle pause');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('openSearch'), 'Focus log search');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('copyRaw'), 'Copy as raw text');
        });
        test('returns actionId for unknown', () => {
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('unknown'), 'unknown');
        });
    });
});
//# sourceMappingURL=viewer-keybindings.test.js.map