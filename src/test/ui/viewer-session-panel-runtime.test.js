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
/**
 * Runtime test for the session panel inlined script.
 * Runs the same script combination the webview runs (transforms + tags + panel)
 * in a minimal VM with mock document/vscodeApi, then dispatches a sessionList
 * message. Catches ReferenceErrors (e.g. missing escapeHtmlText) that syntax-
 * only checks cannot detect.
 */
const assert = __importStar(require("assert"));
const vm = __importStar(require("vm"));
const viewer_session_transforms_1 = require("../../ui/viewer/viewer-session-transforms");
const viewer_session_tags_1 = require("../../ui/viewer-panels/viewer-session-tags");
const viewer_session_panel_1 = require("../../ui/viewer-panels/viewer-session-panel");
function noop() { }
function mockEl() {
    return {
        classList: { add: noop, remove: noop, toggle: noop },
        style: { display: '', width: '' },
        innerHTML: '',
        textContent: '',
        addEventListener: noop,
        querySelector: () => null,
        querySelectorAll: () => [],
        contains: () => false,
        getAttribute: () => null,
        setAttribute: noop,
        focus: noop,
    };
}
suite('Session panel script runtime', () => {
    test('session panel script runs and renderSessionList executes without ReferenceError', () => {
        const document = {
            getElementById: () => mockEl(),
            addEventListener: noop,
        };
        const messageHandlers = [];
        const sandbox = {
            document,
            vscodeApi: { postMessage: noop },
            requestAnimationFrame: (fn) => fn(),
            __sharedPanelWidth: 560,
        };
        sandbox.window = sandbox;
        sandbox.addEventListener = (type, fn) => {
            if (type === 'message') {
                messageHandlers.push(fn);
            }
        };
        vm.createContext(sandbox);
        const transforms = (0, viewer_session_transforms_1.getSessionTransformsScript)();
        const tags = (0, viewer_session_tags_1.getSessionTagsScript)();
        const panel = (0, viewer_session_panel_1.getSessionPanelScript)();
        try {
            vm.runInContext(transforms, sandbox);
            vm.runInContext(tags, sandbox);
            vm.runInContext(panel, sandbox);
        }
        catch (e) {
            const err = e;
            assert.fail(`Session panel script threw: ${err.name}: ${err.message}`);
        }
        assert.ok(messageHandlers.length > 0, 'Panel should register a message handler');
        const sessionListMessage = {
            data: {
                type: 'sessionList',
                sessions: [
                    {
                        uriString: 'file:///test.log',
                        filename: 'test.log',
                        displayName: 'test.log',
                        mtime: Date.now(),
                        trashed: false,
                    },
                ],
            },
        };
        try {
            for (const handler of messageHandlers) {
                handler(sessionListMessage);
            }
        }
        catch (e) {
            const err = e;
            assert.fail(`renderSessionList threw: ${err.name}: ${err.message}`);
        }
    });
});
//# sourceMappingURL=viewer-session-panel-runtime.test.js.map