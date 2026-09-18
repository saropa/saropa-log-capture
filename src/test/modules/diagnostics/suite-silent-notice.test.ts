import * as assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { DRIFT_ADVISOR_EXTENSION_ID } from '../../../modules/integrations/drift-advisor-constants';
import { readSiblingConnection } from '../../../modules/diagnostics/suite-connection-status';
import {
    maybeNotifySilentSiblings,
    notifySilentOnce,
    tryRefreshSilent,
} from '../../../modules/diagnostics/suite-silent-notice';
import type { SiblingConnection } from '../../../modules/diagnostics/suite-connection-classify';

/**
 * Bug 047: the "installed but silent" check nagged about Drift Advisor in workspaces that could never
 * produce Advisor data, and its self-wire refresh surfaced Advisor's own user-facing toast. These tests
 * pin the fix: Advisor is `notApplicable` without a Drift dependency, nothing fires with no workspace
 * folder, the refresh is flagged `{ silent: true }`, and the once-gate is per workspace.
 * vscode.extensions/commands/window are stubbed so no real sibling or toast is involved.
 */
suite('suite silent-sibling notice (bug 047)', () => {
    let executed: Array<{ command: string; args: unknown[] }>;
    let infos: string[];
    let tmpDir: string;
    let originalGetExtension: typeof vscode.extensions.getExtension;
    let originalExecute: typeof vscode.commands.executeCommand;
    let originalGetCommands: typeof vscode.commands.getCommands;
    let originalInfo: typeof vscode.window.showInformationMessage;

    const extensions = vscode.extensions as unknown as Record<string, unknown>;
    const commands = vscode.commands as unknown as Record<string, unknown>;
    const window = vscode.window as unknown as Record<string, unknown>;

    /** Map-backed ExtensionContext exposing separate workspace and global state stores. */
    function fakeContext(): { ctx: vscode.ExtensionContext; workspace: Map<string, unknown>; global: Map<string, unknown> } {
        const workspace = new Map<string, unknown>();
        const global = new Map<string, unknown>();
        const memento = (store: Map<string, unknown>) => ({
            get: <T>(key: string): T | undefined => store.get(key) as T | undefined,
            update: (key: string, value: unknown): Thenable<void> => {
                store.set(key, value);
                return Promise.resolve();
            },
        });
        const ctx = { workspaceState: memento(workspace), globalState: memento(global) } as unknown as vscode.ExtensionContext;
        return { ctx, workspace, global };
    }

    /** Writes a pubspec.yaml with the given body into the temp workspace root. */
    function writePubspec(body: string): vscode.Uri {
        fs.writeFileSync(path.join(tmpDir, 'pubspec.yaml'), body);
        return vscode.Uri.file(tmpDir);
    }

    setup(() => {
        executed = [];
        infos = [];
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slc-bug047-'));
        originalGetExtension = vscode.extensions.getExtension;
        originalExecute = vscode.commands.executeCommand;
        originalGetCommands = vscode.commands.getCommands;
        originalInfo = vscode.window.showInformationMessage;
        // Only Drift Advisor is "installed"; Saropa Lints is absent.
        extensions.getExtension = (id: string) => (id === DRIFT_ADVISOR_EXTENSION_ID ? {} : undefined);
        commands.getCommands = () => Promise.resolve(['driftViewer.writeDiagnosticsMirror']);
        commands.executeCommand = (command: string, ...args: unknown[]) => {
            executed.push({ command, args });
            return Promise.resolve(false);
        };
        window.showInformationMessage = (message: string) => {
            infos.push(message);
            return Promise.resolve(undefined);
        };
    });

    teardown(() => {
        extensions.getExtension = originalGetExtension;
        commands.executeCommand = originalExecute;
        commands.getCommands = originalGetCommands;
        window.showInformationMessage = originalInfo;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('Advisor is notApplicable in a workspace whose pubspec has no Drift dependency', async () => {
        const root = writePubspec('name: app\ndependencies:\n  http: ^1.0.0\n');
        const c = await readSiblingConnection('advisor', undefined, root);
        assert.strictEqual(c.state, 'notApplicable');
    });

    test('Advisor is notApplicable when the workspace has no pubspec.yaml at all', async () => {
        const c = await readSiblingConnection('advisor', undefined, vscode.Uri.file(tmpDir));
        assert.strictEqual(c.state, 'notApplicable');
    });

    test('Advisor in a Drift workspace with no mirror is still silent (dev_dependencies counts)', async () => {
        const root = writePubspec('name: app\ndev_dependencies:\n  drift: ^2.14.0\n');
        const c = await readSiblingConnection('advisor', undefined, root);
        assert.strictEqual(c.state, 'silent');
    });

    test('no workspace folder: no refresh command and no notice', async () => {
        // The Extension Development Host for this suite opens no folder.
        assert.strictEqual(vscode.workspace.workspaceFolders, undefined, 'precondition: test host has no folder');
        const { ctx, workspace, global } = fakeContext();
        await maybeNotifySilentSiblings(ctx);
        assert.deepStrictEqual(executed, []);
        assert.deepStrictEqual(infos, []);
        assert.strictEqual(workspace.size + global.size, 0);
    });

    test('refresh calls Advisor\'s command with { silent: true }', async () => {
        const silent: SiblingConnection[] = [{ tool: 'advisor', state: 'silent', cause: 'noMirror' }];
        const ran = await tryRefreshSilent(silent);
        assert.strictEqual(ran, true);
        assert.deepStrictEqual(executed, [
            { command: 'driftViewer.writeDiagnosticsMirror', args: [{ silent: true }] },
        ]);
    });

    test('once-gate is stored per workspace, not globally', async () => {
        const c: SiblingConnection = { tool: 'advisor', state: 'silent', cause: 'noMirror' };
        const first = fakeContext();
        await notifySilentOnce(first.ctx, c);
        await notifySilentOnce(first.ctx, c);
        assert.strictEqual(infos.length, 1, 'shown once per workspace');
        assert.strictEqual(first.global.size, 0, 'must not persist the gate in globalState');
        assert.strictEqual(first.workspace.size, 1);

        // A different workspace (fresh workspaceState) is not suppressed by the first.
        const second = fakeContext();
        await notifySilentOnce(second.ctx, c);
        assert.strictEqual(infos.length, 2);
    });
});
