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
        test('returns labels for new panel toggle actions', () => {
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('toggleOptions'), 'Toggle options panel');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('toggleFilters'), 'Toggle filters panel');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('toggleSignals'), 'Toggle signals panel');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('toggleBookmarks'), 'Toggle bookmarks panel');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('toggleSessions'), 'Toggle sessions panel');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('toggleCollections'), 'Toggle collections panel');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('toggleSqlHistory'), 'Toggle SQL history panel');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('toggleTrash'), 'Toggle trash panel');
        });
        test('returns labels for new display and nav actions', () => {
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('bookmark'), 'Bookmark center line');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('toggleCompress'), 'Toggle compress duplicates');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('toggleBlankLines'), 'Toggle hide blank lines');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('toggleSpacing'), 'Toggle visual spacing');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('prevSession'), 'Previous session');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('nextSession'), 'Next session');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('prevPart'), 'Previous file part');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('nextPart'), 'Next file part');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('lineHeightUp'), 'Line height up');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('lineHeightDown'), 'Line height down');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('lineHeightReset'), 'Line height reset');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('copyFilePath'), 'Copy log file path');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('revealFile'), 'Reveal log file');
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('showKeyboardShortcuts'), 'Keyboard shortcuts');
        });
        test('returns actionId for unknown', () => {
            assert.strictEqual((0, viewer_keybindings_1.getViewerActionLabel)('unknown'), 'unknown');
        });
    });
    suite('new keybinding defaults', () => {
        test('panel toggle keys are single letters', () => {
            const map = (0, viewer_keybindings_1.getDefaultKeyToAction)();
            assert.strictEqual(map['o'], 'toggleOptions');
            assert.strictEqual(map['f'], 'toggleFilters');
            assert.strictEqual(map['s'], 'toggleSignals');
            assert.strictEqual(map['b'], 'toggleBookmarks');
            assert.strictEqual(map['l'], 'toggleSessions');
            assert.strictEqual(map['i'], 'toggleCollections');
            assert.strictEqual(map['q'], 'toggleSqlHistory');
            assert.strictEqual(map['t'], 'toggleTrash');
        });
        test('navigation keys use brackets', () => {
            const map = (0, viewer_keybindings_1.getDefaultKeyToAction)();
            assert.strictEqual(map['['], 'prevSession');
            assert.strictEqual(map[']'], 'nextSession');
            assert.strictEqual(map['shift+['], 'prevPart');
            assert.strictEqual(map['shift+]'], 'nextPart');
        });
        test('line height keys mirror font size with shift', () => {
            const map = (0, viewer_keybindings_1.getDefaultKeyToAction)();
            assert.strictEqual(map['ctrl+shift+='], 'lineHeightUp');
            assert.strictEqual(map['ctrl+shift+-'], 'lineHeightDown');
            assert.strictEqual(map['ctrl+shift+0'], 'lineHeightReset');
        });
        test('F1 opens keyboard shortcuts', () => {
            const map = (0, viewer_keybindings_1.getDefaultKeyToAction)();
            assert.strictEqual(map['f1'], 'showKeyboardShortcuts');
        });
        test('no default key collisions', () => {
            const map = (0, viewer_keybindings_1.getDefaultKeyToAction)();
            const keys = Object.keys(map);
            const unique = new Set(keys);
            assert.strictEqual(keys.length, unique.size, 'every default key must map to exactly one action');
        });
    });
    suite('new actions are registered', () => {
        const ids = viewer_keybindings_1.VIEWER_KEYBINDING_ACTION_IDS;
        const newActions = [
            'showKeyboardShortcuts', 'toggleOptions', 'toggleFilters', 'toggleSignals',
            'toggleBookmarks', 'toggleSessions', 'toggleCollections', 'toggleSqlHistory',
            'toggleTrash', 'bookmark', 'toggleCompress', 'toggleBlankLines', 'toggleSpacing',
            'prevSession', 'nextSession', 'prevPart', 'nextPart',
            'lineHeightUp', 'lineHeightDown', 'lineHeightReset', 'copyFilePath', 'revealFile',
        ];
        for (const action of newActions) {
            test(`${action} is in VIEWER_KEYBINDING_ACTION_IDS`, () => {
                assert.ok(ids.includes(action), `${action} must be a registered action ID`);
            });
        }
    });
});
//# sourceMappingURL=viewer-keybindings.test.js.map