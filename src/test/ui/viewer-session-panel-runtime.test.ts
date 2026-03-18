/**
 * Runtime test for the session panel inlined script.
 * Runs the same script combination the webview runs (transforms + tags + panel)
 * in a minimal VM with mock document/vscodeApi, then dispatches a sessionList
 * message. Catches ReferenceErrors (e.g. missing escapeHtmlText) that syntax-
 * only checks cannot detect.
 */
import * as assert from 'assert';
import * as vm from 'vm';
import { getSessionTransformsScript } from '../../ui/viewer/viewer-session-transforms';
import { getSessionTagsScript } from '../../ui/viewer-panels/viewer-session-tags';
import { getSessionPanelScript } from '../../ui/viewer-panels/viewer-session-panel';

function noop(): void {}
function mockEl(): Record<string, unknown> {
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
        const messageHandlers: Array<(e: { data?: unknown }) => void> = [];
        const sandbox: Record<string, unknown> = {
            document,
            vscodeApi: { postMessage: noop },
            requestAnimationFrame: (fn: () => void) => fn(),
            __sharedPanelWidth: 560,
        };
        sandbox.window = sandbox;
        sandbox.addEventListener = (type: string, fn: (e: { data?: unknown }) => void) => {
            if (type === 'message') {
                messageHandlers.push(fn);
            }
        };
        vm.createContext(sandbox);

        const transforms = getSessionTransformsScript();
        const tags = getSessionTagsScript();
        const panel = getSessionPanelScript();

        try {
            vm.runInContext(transforms, sandbox);
            vm.runInContext(tags, sandbox);
            vm.runInContext(panel, sandbox);
        } catch (e) {
            const err = e as Error;
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
        } catch (e) {
            const err = e as Error;
            assert.fail(`renderSessionList threw: ${err.name}: ${err.message}`);
        }
    });
});
