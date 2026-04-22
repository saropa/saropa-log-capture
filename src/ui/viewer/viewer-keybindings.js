"use strict";
/**
 * Configurable viewer keybindings: defaults, config read, and keyToAction map
 * for the log viewer panel (power shortcuts). User overrides via
 * saropaLogCapture.viewerKeybindings (actionId -> key descriptor).
 */
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
exports.VIEWER_ACTION_LABELS = exports.VIEWER_KEYBINDING_ACTION_IDS = void 0;
exports.getViewerActionLabel = getViewerActionLabel;
exports.getDefaultKeyToAction = getDefaultKeyToAction;
exports.buildKeyToAction = buildKeyToAction;
exports.normalizeKeyDescriptor = normalizeKeyDescriptor;
exports.getViewerKeybindingsFromConfig = getViewerKeybindingsFromConfig;
exports.getViewerActionToKeyFromConfig = getViewerActionToKeyFromConfig;
exports.setViewerKeybinding = setViewerKeybinding;
exports.resetViewerKeybinding = resetViewerKeybinding;
const vscode = __importStar(require("vscode"));
/** Stable action IDs for rebindable viewer shortcuts. */
exports.VIEWER_KEYBINDING_ACTION_IDS = [
    'openSearch',
    'openFindPanel',
    'escape',
    'copyPlain',
    'copyMarkdown',
    'copyAll',
    'selectAll',
    'fontSizeUp',
    'fontSizeDown',
    'fontSizeReset',
    'gotoLine',
    'togglePause',
    'toggleWrap',
    'home',
    'end',
    'pageUp',
    'pageDown',
    'insertMarker',
    'togglePin',
    'annotate',
    'toggleDevice',
    'copyRaw',
    'showKeyboardShortcuts',
    'toggleOptions',
    'toggleFilters',
    'toggleSignals',
    'toggleBookmarks',
    'toggleSessions',
    'toggleCollections',
    'toggleSqlHistory',
    'toggleTrash',
    'bookmark',
    'toggleCompress',
    'toggleBlankLines',
    'toggleSpacing',
    'prevSession',
    'nextSession',
    'prevPart',
    'nextPart',
    'lineHeightUp',
    'lineHeightDown',
    'lineHeightReset',
    'copyFilePath',
    'revealFile',
];
/** Default key descriptor per action (one key per action; openSearch also has f3 in keyToAction). */
const DEFAULT_ACTION_TO_KEY = {
    openSearch: 'ctrl+f',
    openFindPanel: 'ctrl+shift+f',
    escape: 'escape',
    copyPlain: 'ctrl+c',
    copyMarkdown: 'ctrl+shift+c',
    copyAll: 'ctrl+shift+a',
    selectAll: 'ctrl+a',
    fontSizeUp: 'ctrl+=',
    fontSizeDown: 'ctrl+-',
    fontSizeReset: 'ctrl+0',
    gotoLine: 'ctrl+g',
    togglePause: 'space',
    toggleWrap: 'w',
    home: 'home',
    end: 'end',
    pageUp: 'pageup',
    pageDown: 'pagedown',
    insertMarker: 'm',
    togglePin: 'p',
    annotate: 'n',
    toggleDevice: 'a',
    copyRaw: 'ctrl+alt+c',
    showKeyboardShortcuts: 'f1',
    toggleOptions: 'o',
    toggleFilters: 'f',
    toggleSignals: 's',
    toggleBookmarks: 'b',
    toggleSessions: 'l',
    toggleCollections: 'i',
    toggleSqlHistory: 'q',
    toggleTrash: 't',
    bookmark: 'ctrl+b',
    toggleCompress: 'c',
    toggleBlankLines: 'h',
    toggleSpacing: 'v',
    prevSession: '[',
    nextSession: ']',
    prevPart: 'shift+[',
    nextPart: 'shift+]',
    lineHeightUp: 'ctrl+shift+=',
    lineHeightDown: 'ctrl+shift+-',
    lineHeightReset: 'ctrl+shift+0',
    copyFilePath: 'ctrl+shift+p',
    revealFile: 'ctrl+shift+e',
};
/** Short labels for status bar when recording a keybinding. */
exports.VIEWER_ACTION_LABELS = {
    openSearch: 'Focus log search',
    openFindPanel: 'Open find panel',
    escape: 'Escape',
    copyPlain: 'Copy selection',
    copyMarkdown: 'Copy as markdown',
    copyAll: 'Copy all visible',
    selectAll: 'Select all',
    fontSizeUp: 'Font size up',
    fontSizeDown: 'Font size down',
    fontSizeReset: 'Font size reset',
    gotoLine: 'Go to line',
    togglePause: 'Toggle pause',
    toggleWrap: 'Word wrap',
    home: 'Scroll to top',
    end: 'Scroll to bottom',
    pageUp: 'Page up',
    pageDown: 'Page down',
    insertMarker: 'Insert marker',
    togglePin: 'Pin line',
    annotate: 'Annotate line',
    toggleDevice: 'Cycle device logs (None / Warn+ / All)',
    copyRaw: 'Copy as raw text',
    showKeyboardShortcuts: 'Keyboard shortcuts',
    toggleOptions: 'Toggle options panel',
    toggleFilters: 'Toggle filters panel',
    toggleSignals: 'Toggle signals panel',
    toggleBookmarks: 'Toggle bookmarks panel',
    toggleSessions: 'Toggle sessions panel',
    toggleCollections: 'Toggle collections panel',
    toggleSqlHistory: 'Toggle SQL history panel',
    toggleTrash: 'Toggle trash panel',
    bookmark: 'Bookmark center line',
    toggleCompress: 'Toggle compress duplicates',
    toggleBlankLines: 'Toggle hide blank lines',
    toggleSpacing: 'Toggle visual spacing',
    prevSession: 'Previous session',
    nextSession: 'Next session',
    prevPart: 'Previous file part',
    nextPart: 'Next file part',
    lineHeightUp: 'Line height up',
    lineHeightDown: 'Line height down',
    lineHeightReset: 'Line height reset',
    copyFilePath: 'Copy log file path',
    revealFile: 'Reveal log file',
};
function getViewerActionLabel(actionId) {
    return exports.VIEWER_ACTION_LABELS[actionId] ?? actionId;
}
/** Key -> actionId for the viewer script. Includes f3 -> openSearch in addition to ctrl+f. */
function getDefaultKeyToAction() {
    const out = {};
    for (const [actionId, key] of Object.entries(DEFAULT_ACTION_TO_KEY)) {
        out[key] = actionId;
    }
    out['f3'] = 'openSearch';
    return out;
}
/** Merge user overrides onto defaults. Single source for actionId -> key. */
function mergeUserKeybindings(userConfig) {
    const actionToKey = { ...DEFAULT_ACTION_TO_KEY };
    if (userConfig && typeof userConfig === 'object') {
        for (const [actionId, key] of Object.entries(userConfig)) {
            if (typeof key === 'string' && key.trim() && exports.VIEWER_KEYBINDING_ACTION_IDS.includes(actionId)) {
                actionToKey[actionId] = normalizeKeyDescriptor(key.trim());
            }
        }
    }
    return actionToKey;
}
/** Merged actionId -> key from current config. */
function getMergedActionToKey() {
    const config = vscode.workspace.getConfiguration('saropaLogCapture');
    const user = config.get('viewerKeybindings');
    return mergeUserKeybindings(user);
}
/** Build key -> actionId map for the viewer from optional user config. Used at runtime and in tests. */
function buildKeyToAction(userConfig) {
    const actionToKey = mergeUserKeybindings(userConfig);
    const keyToAction = {};
    for (const [actionId, key] of Object.entries(actionToKey)) {
        keyToAction[key] = actionId;
    }
    if (!keyToAction['f3']) {
        keyToAction['f3'] = 'openSearch';
    }
    return keyToAction;
}
/** Normalize a key descriptor for storage and comparison: lowercase, modifier order ctrl, shift, alt, key. */
function normalizeKeyDescriptor(raw) {
    const parts = raw.toLowerCase().split('+').map((s) => s.trim()).filter(Boolean);
    const mods = [];
    let key = '';
    for (const p of parts) {
        if (p === 'ctrl' || p === 'meta' || p === 'control') {
            mods.push('ctrl');
        }
        else if (p === 'shift') {
            mods.push('shift');
        }
        else if (p === 'alt') {
            mods.push('alt');
        }
        else {
            key = p;
        }
    }
    mods.sort((a, b) => (a === 'ctrl' ? 0 : a === 'shift' ? 1 : 2) - (b === 'ctrl' ? 0 : b === 'shift' ? 1 : 2));
    const uniq = [...new Set(mods)];
    if (key) {
        uniq.push(key);
    }
    return uniq.join('+');
}
/** Read config and return keyToAction for the viewer. */
function getViewerKeybindingsFromConfig() {
    const actionToKey = getMergedActionToKey();
    const keyToAction = {};
    for (const [actionId, key] of Object.entries(actionToKey)) {
        keyToAction[key] = actionId;
    }
    if (!keyToAction['f3']) {
        keyToAction['f3'] = 'openSearch';
    }
    return keyToAction;
}
/** Current actionId -> key (defaults + user overrides) for UI display and saving. */
function getViewerActionToKeyFromConfig() {
    return getMergedActionToKey();
}
/** Persist a single viewer keybinding override. */
async function setViewerKeybinding(actionId, keyDescriptor) {
    const config = vscode.workspace.getConfiguration('saropaLogCapture');
    const current = config.get('viewerKeybindings') ?? {};
    const key = normalizeKeyDescriptor(keyDescriptor);
    const next = { ...current, [actionId]: key };
    await config.update('viewerKeybindings', next, vscode.ConfigurationTarget.Global);
}
/** Reset one binding to default, or all if actionId is omitted. */
async function resetViewerKeybinding(actionId) {
    const config = vscode.workspace.getConfiguration('saropaLogCapture');
    let next;
    if (actionId) {
        const current = config.get('viewerKeybindings') ?? {};
        next = { ...current };
        delete next[actionId];
        if (Object.keys(next).length === 0) {
            next = undefined;
        }
    }
    await config.update('viewerKeybindings', next ?? {}, vscode.ConfigurationTarget.Global);
}
//# sourceMappingURL=viewer-keybindings.js.map