/**
 * Shared test helpers for session panel runtime tests.
 *
 * Provides a minimal VM sandbox with mock DOM, vscodeApi, and message
 * dispatch — used by both the main runtime test and name-filter tests.
 */
import * as vm from 'vm';
import { getSessionTransformsScript } from '../../ui/viewer/viewer-session-transforms';
import { getSessionTagsScript } from '../../ui/viewer-panels/viewer-session-tags';
import { getSessionPanelScript } from '../../ui/viewer-panels/viewer-session-panel';
import { stringsWebview } from '../../l10n/strings-webview';

/** Faithful stand-in for the webview's vt() (l10n bridge) — resolves a key to its
 *  English template via stringsWebview and substitutes {0},{1},… positionally.
 *  The real bridge injects __VT; the sandbox provides this so render scripts that
 *  call vt() resolve to real English text matching the runtime tests' assertions. */
export function vtStub(key: string, ...args: (string | number)[]): string {
    let s = stringsWebview[key] ?? key;
    for (let i = 0; i < args.length; i++) {
        s = s.split('{' + i + '}').join(String(args[i]));
    }
    return s;
}

/** No-op function for mock DOM callbacks. */
export function noop(): void {}

/** Create a mock DOM element with common properties and methods stubbed. */
export function mockEl(): Record<string, unknown> {
    const el: Record<string, unknown> = {
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
    // Append HTML to innerHTML, matching real Element.insertAdjacentHTML('beforeend', ...)
    el.insertAdjacentHTML = (_position: string, html: string) => {
        el.innerHTML = String(el.innerHTML) + html;
    };
    return el;
}

/** Create a VM sandbox with mock DOM and capture message handlers. */
export function buildSandbox(): {
    sandbox: Record<string, unknown>;
    messageHandlers: Array<(e: { data?: unknown }) => void>;
    elements: Map<string, Record<string, unknown>>;
} {
    const elements = new Map<string, Record<string, unknown>>();
    const getEl = (id: string): Record<string, unknown> => {
        if (!elements.has(id)) { elements.set(id, mockEl()); }
        return elements.get(id)!;
    };
    const document = {
        getElementById: (id: string) => getEl(id),
        addEventListener: noop,
    };
    const messageHandlers: Array<(e: { data?: unknown }) => void> = [];
    const sandbox: Record<string, unknown> = {
        document,
        CSS: { escape: (v: string) => v },
        vscodeApi: { postMessage: noop },
        requestAnimationFrame: (fn: () => void) => fn(),
        __sharedPanelWidth: 560,
        // Webview l10n bridge stand-in — render scripts now resolve strings via vt().
        vt: vtStub,
    };
    sandbox.window = sandbox;
    sandbox.addEventListener = (type: string, fn: (e: { data?: unknown }) => void) => {
        if (type === 'message') { messageHandlers.push(fn); }
    };
    vm.createContext(sandbox);
    return { sandbox, messageHandlers, elements };
}

/** Boot the panel scripts in a sandbox and return message handlers. */
export function bootPanel(sandbox: Record<string, unknown>): void {
    vm.runInContext(getSessionTransformsScript(), sandbox);
    vm.runInContext(getSessionTagsScript(), sandbox);
    vm.runInContext(getSessionPanelScript(), sandbox);
}
