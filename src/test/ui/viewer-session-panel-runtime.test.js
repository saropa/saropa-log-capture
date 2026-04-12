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
/** Create a VM sandbox with mock DOM and capture message handlers. */
function buildSandbox() {
    const elements = new Map();
    const getEl = (id) => {
        if (!elements.has(id)) {
            elements.set(id, mockEl());
        }
        return elements.get(id);
    };
    const document = {
        getElementById: (id) => getEl(id),
        addEventListener: noop,
    };
    const messageHandlers = [];
    const sandbox = {
        document,
        CSS: { escape: (v) => v },
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
    return { sandbox, messageHandlers, elements };
}
/** Boot the panel scripts in a sandbox and return message handlers. */
function bootPanel(sandbox) {
    vm.runInContext((0, viewer_session_transforms_1.getSessionTransformsScript)(), sandbox);
    vm.runInContext((0, viewer_session_tags_1.getSessionTagsScript)(), sandbox);
    vm.runInContext((0, viewer_session_panel_1.getSessionPanelScript)(), sandbox);
}
suite('Session panel script runtime', () => {
    test('should render full session list without ReferenceError', () => {
        const { sandbox, messageHandlers } = buildSandbox();
        try {
            bootPanel(sandbox);
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
    test('should render preview list with shimmer metadata without ReferenceError', () => {
        const { sandbox, messageHandlers, elements } = buildSandbox();
        bootPanel(sandbox);
        const previewMessage = {
            data: {
                type: 'sessionListPreview',
                previews: [
                    { filename: 'alpha.log', uriString: 'file:///alpha.log' },
                    { filename: 'beta.log', uriString: 'file:///beta.log' },
                ],
            },
        };
        for (const handler of messageHandlers) {
            handler(previewMessage);
        }
        const listEl = elements.get('session-list');
        const html = String(listEl?.innerHTML ?? '');
        assert.ok(html.includes('session-shimmer-meta'), 'Preview items should have shimmer meta class');
        assert.ok(html.includes('alpha.log'), 'Preview should contain first filename');
        assert.ok(html.includes('beta.log'), 'Preview should contain second filename');
        assert.ok(html.includes('data-uri="file:///alpha.log"'), 'Preview items should have data-uri');
    });
    test('should replace preview with full session list when data arrives', () => {
        const { sandbox, messageHandlers, elements } = buildSandbox();
        bootPanel(sandbox);
        // First: preview
        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionListPreview',
                    previews: [{ filename: 'alpha.log', uriString: 'file:///alpha.log' }],
                },
            });
        }
        const listEl = elements.get('session-list');
        assert.ok(String(listEl?.innerHTML).includes('session-shimmer-meta'), 'Should show shimmer');
        // Then: full data replaces preview
        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionList',
                    sessions: [{
                            uriString: 'file:///alpha.log', filename: 'alpha.log',
                            displayName: 'alpha.log', mtime: Date.now(), trashed: false,
                        }],
                },
            });
        }
        const finalHtml = String(listEl?.innerHTML);
        assert.ok(!finalHtml.includes('session-shimmer-meta'), 'Full render should not have shimmer');
    });
    test('should handle sessionListBatch without ReferenceError', () => {
        const { sandbox, messageHandlers } = buildSandbox();
        bootPanel(sandbox);
        // Send preview first, then batch update
        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionListPreview',
                    previews: [{ filename: 'alpha.log', uriString: 'file:///alpha.log' }],
                },
            });
        }
        // Batch arrives — should not throw even if querySelector returns null
        try {
            for (const handler of messageHandlers) {
                handler({
                    data: {
                        type: 'sessionListBatch',
                        items: [{
                                uriString: 'file:///alpha.log', filename: 'alpha.log',
                                displayName: 'alpha.log', mtime: Date.now(),
                                hasTimestamps: true, size: 1024, trashed: false,
                            }],
                    },
                });
            }
        }
        catch (e) {
            const err = e;
            assert.fail(`sessionListBatch threw: ${err.name}: ${err.message}`);
        }
    });
    test('should handle sessionListBatch with empty items', () => {
        const { sandbox, messageHandlers } = buildSandbox();
        bootPanel(sandbox);
        for (const handler of messageHandlers) {
            handler({ data: { type: 'sessionListBatch', items: [] } });
        }
        assert.ok(true, 'Empty batch should not throw');
    });
    test('should handle sessionListBatch before preview without error', () => {
        const { sandbox, messageHandlers } = buildSandbox();
        bootPanel(sandbox);
        // Batch arrives without a prior preview — should degrade gracefully
        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionListBatch',
                    items: [{
                            uriString: 'file:///orphan.log', filename: 'orphan.log',
                            displayName: 'orphan.log', mtime: Date.now(), trashed: false,
                        }],
                },
            });
        }
        assert.ok(true, 'Batch without preview should not throw');
    });
    test('should handle empty preview gracefully', () => {
        const { sandbox, messageHandlers, elements } = buildSandbox();
        bootPanel(sandbox);
        // Verify loading element is shown before preview
        const loadingEl = elements.get('session-loading');
        loadingEl.style.display = '';
        for (const handler of messageHandlers) {
            handler({ data: { type: 'sessionListPreview', previews: [] } });
        }
        // Empty preview should not crash — loading stays visible
        // (the full sessionList message handles the empty state)
        assert.ok(true, 'Empty preview should not throw');
    });
});
//# sourceMappingURL=viewer-session-panel-runtime.test.js.map