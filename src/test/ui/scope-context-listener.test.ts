/**
 * Regression test for the File Scope filter radios getting greyed out as soon
 * as the log viewer webview had focus.
 *
 * Before the fix, `setupScopeContextListener` rebuilt and broadcast the scope
 * context on every `onDidChangeActiveTextEditor` firing — including the ones
 * VS Code fires with `undefined` whenever focus moves to a non-text surface
 * (webviews, the sidebar, the settings UI). That produced an all-null context
 * that disabled every workspace/package/directory/file radio, leaving only
 * "All logs" selectable exactly when the user needed the radios usable.
 *
 * These tests cover the pure helper `maybeBroadcastScopeContext` that now
 * encodes the "skip undefined editor firings, but allow the initial seed" rule.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { maybeBroadcastScopeContext, type ScopeContextBroadcaster } from '../../activation-listeners';
import type { ScopeContext } from '../../modules/storage/scope-context';

/** Minimal fake broadcaster that records every setScopeContext call. */
function createRecordingBroadcaster(): ScopeContextBroadcaster & { readonly calls: ScopeContext[] } {
    const calls: ScopeContext[] = [];
    return {
        calls,
        setScopeContext(ctx: ScopeContext): void { calls.push(ctx); },
    };
}

suite('setupScopeContextListener / maybeBroadcastScopeContext', () => {

    test('skips the broadcast when the editor is undefined and null is not allowed', async () => {
        // Simulates VS Code firing onDidChangeActiveTextEditor(undefined) as the
        // user clicks on the log viewer webview. Broadcasting here is the bug.
        const broadcaster = createRecordingBroadcaster();

        await maybeBroadcastScopeContext(undefined, broadcaster, { allowNullEditor: false });

        assert.strictEqual(broadcaster.calls.length, 0,
            'listener must not wipe scope context when focus moves to a non-text surface');
    });

    test('broadcasts an all-null context when the editor is undefined and null is allowed', async () => {
        // The cold-start seed path: no file open at activation. We still want
        // the webview to receive the context so it can show the
        // "Open a source file to enable scope filters" hint.
        const broadcaster = createRecordingBroadcaster();

        await maybeBroadcastScopeContext(undefined, broadcaster, { allowNullEditor: true });

        assert.strictEqual(broadcaster.calls.length, 1,
            'initial seed must broadcast even without an editor');
        const ctx = broadcaster.calls[0];
        assert.strictEqual(ctx.activeFilePath, null);
        assert.strictEqual(ctx.workspaceFolder, null);
        assert.strictEqual(ctx.packageRoot, null);
        assert.strictEqual(ctx.activeDirectory, null);
    });

    test('broadcasts a populated context when a real editor is provided', async () => {
        // Open a workspace file so buildScopeContext can produce a real context.
        // Any .ts file in the test workspace works; we just need any editor.
        const files = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**', 1);
        if (files.length === 0) {
            // Cannot run this assertion without a workspace file — skip cleanly
            // rather than fail on an unrelated environment issue.
            return;
        }
        const doc = await vscode.workspace.openTextDocument(files[0]);
        const editor = await vscode.window.showTextDocument(doc);
        const broadcaster = createRecordingBroadcaster();

        await maybeBroadcastScopeContext(editor, broadcaster, { allowNullEditor: false });

        assert.strictEqual(broadcaster.calls.length, 1,
            'a real editor must produce a single broadcast');
        assert.notStrictEqual(broadcaster.calls[0].activeFilePath, null,
            'activeFilePath should be populated when an editor is supplied');
    });
});
