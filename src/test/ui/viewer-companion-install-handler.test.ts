import * as assert from 'assert';
import * as vscode from 'vscode';
import { handleSessionAndUiActions } from '../../ui/provider/viewer-message-handler-session-ui';
import { COMPANION_EXTENSION_IDS } from '../../ui/viewer-panels/viewer-integrations-panel-html';
import type { ViewerMessageContext } from '../../ui/provider/viewer-message-types';

/**
 * The Integrations list lets the webview request installing a Saropa companion extension. The host
 * MUST re-validate the requested id against the companion allowlist — a hostile webview could
 * otherwise coerce installation of an arbitrary extension. These tests pin that boundary by
 * stubbing vscode.commands.executeCommand so no real install runs.
 */
suite('installCompanion host handler', () => {
    const emptyCtx = {} as unknown as ViewerMessageContext;
    let calls: Array<{ command: string; args: unknown[] }>;
    let originalExecute: typeof vscode.commands.executeCommand;
    let originalInfo: typeof vscode.window.showInformationMessage;
    let originalError: typeof vscode.window.showErrorMessage;

    setup(() => {
        calls = [];
        originalExecute = vscode.commands.executeCommand;
        originalInfo = vscode.window.showInformationMessage;
        originalError = vscode.window.showErrorMessage;
        (vscode.commands as unknown as Record<string, unknown>).executeCommand = (command: string, ...args: unknown[]) => {
            calls.push({ command, args });
            return Promise.resolve(undefined);
        };
        // Swallow the completion toasts so the stubbed resolve does not pop UI in the test host.
        (vscode.window as unknown as Record<string, unknown>).showInformationMessage = () => Promise.resolve(undefined);
        (vscode.window as unknown as Record<string, unknown>).showErrorMessage = () => Promise.resolve(undefined);
    });

    teardown(() => {
        (vscode.commands as unknown as Record<string, unknown>).executeCommand = originalExecute;
        (vscode.window as unknown as Record<string, unknown>).showInformationMessage = originalInfo;
        (vscode.window as unknown as Record<string, unknown>).showErrorMessage = originalError;
    });

    test('should install a known companion via workbench.extensions.installExtension', () => {
        const id = COMPANION_EXTENSION_IDS[0];
        const handled = handleSessionAndUiActions('installCompanion', { extensionId: id }, emptyCtx);
        assert.strictEqual(handled, true, 'handler must claim the installCompanion message');
        const install = calls.find((c) => c.command === 'workbench.extensions.installExtension');
        assert.ok(install, 'must invoke the install command');
        assert.strictEqual(install?.args[0], id, 'must install the requested companion id');
    });

    test('should reject an id that is not a companion extension (no install command)', () => {
        const handled = handleSessionAndUiActions(
            'installCompanion',
            { extensionId: 'evil.arbitrary-extension' },
            emptyCtx,
        );
        assert.strictEqual(handled, true, 'handler still claims the message');
        assert.ok(
            !calls.some((c) => c.command === 'workbench.extensions.installExtension'),
            'a non-allowlisted id must never reach the install command',
        );
    });
});
