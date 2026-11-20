/**
 * Backwards compatibility for the "Saropa Log Capture" -> "Saropa Capture" rename (v9.8.0).
 *
 * The rename changed three user-visible identifiers: the settings prefix
 * (`saropaLogCapture.*` -> `saropaCapture.*`), the command IDs (same prefix change), and the
 * marketplace extension ID. This module keeps the first two working for existing users:
 *  - copies explicitly-set old settings to the new keys (never overwrites a new value),
 *  - registers the old command IDs as aliases so keybindings/tasks keep working,
 *  - warns when the old extension is still installed (two copies would fight over the
 *    same output channel, status bar item, and log files).
 */
import * as vscode from 'vscode';
import { t } from './l10n';
import { logExtensionError, logExtensionWarn } from './modules/misc/extension-logger';

const oldPrefix = 'saropaLogCapture';
const newPrefix = 'saropaCapture';
const oldExtensionId = 'saropa.saropa-log-capture';
const userScopeFlag = `${newPrefix}.legacySettingsMigratedUser`;
const workspaceScopeFlag = `${newPrefix}.legacySettingsMigratedWorkspace`;

interface ManifestShape {
    contributes?: {
        configuration?: unknown;
        commands?: Array<{ command?: string }>;
    };
}

/** Setting keys (without prefix) declared by the manifest; the manifest is the only complete list. */
export function listSettingKeys(manifest: ManifestShape): string[] {
    const raw = manifest.contributes?.configuration;
    const sections = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const keys: string[] = [];
    for (const section of sections) {
        const props = (section as { properties?: Record<string, unknown> }).properties ?? {};
        for (const full of Object.keys(props)) {
            if (full.startsWith(`${newPrefix}.`)) { keys.push(full.slice(newPrefix.length + 1)); }
        }
    }
    return keys;
}

/** Copy one old value to the new key when the new key is unset at that exact scope. Returns true if copied. */
async function copyIfUnset(
    oldCfg: vscode.WorkspaceConfiguration,
    newCfg: vscode.WorkspaceConfiguration,
    key: string,
    scope: 'global' | 'workspace' | 'folder',
): Promise<boolean> {
    const o = oldCfg.inspect(key);
    const n = newCfg.inspect(key);
    const pick = { global: [o?.globalValue, n?.globalValue, vscode.ConfigurationTarget.Global],
        workspace: [o?.workspaceValue, n?.workspaceValue, vscode.ConfigurationTarget.Workspace],
        folder: [o?.workspaceFolderValue, n?.workspaceFolderValue, vscode.ConfigurationTarget.WorkspaceFolder] }[scope];
    // Explicit new value wins: the user already chose under the new name.
    if (pick[0] === undefined || pick[1] !== undefined) { return false; }
    await newCfg.update(key, pick[0], pick[2] as vscode.ConfigurationTarget);
    return true;
}

async function migrateScope(keys: string[], scope: 'global' | 'workspace' | 'folder', resource?: vscode.Uri): Promise<number> {
    const oldCfg = vscode.workspace.getConfiguration(oldPrefix, resource);
    const newCfg = vscode.workspace.getConfiguration(newPrefix, resource);
    let copied = 0;
    for (const key of keys) {
        try {
            if (await copyIfUnset(oldCfg, newCfg, key, scope)) { copied++; }
        } catch (err) {
            // A single un-writable key (e.g. read-only workspace settings) must not abort the rest.
            logExtensionWarn('legacyCompat', `Could not migrate setting ${key}: ${String(err)}`);
        }
    }
    return copied;
}

/**
 * Migrate old-prefix settings once per scope kind. User-scope runs once per machine, workspace and
 * folder scopes once per workspace, so a user who later resets a new key is not re-migrated.
 * Old keys are left in place so a downgrade or the old extension still sees them.
 */
export async function migrateLegacySettings(context: vscode.ExtensionContext): Promise<number> {
    const keys = listSettingKeys(context.extension.packageJSON as ManifestShape);
    let copied = 0;
    if (!context.globalState.get<boolean>(userScopeFlag)) {
        copied += await migrateScope(keys, 'global');
        await context.globalState.update(userScopeFlag, true);
    }
    if (!context.workspaceState.get<boolean>(workspaceScopeFlag)) {
        copied += await migrateScope(keys, 'workspace');
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            copied += await migrateScope(keys, 'folder', folder.uri);
        }
        await context.workspaceState.update(workspaceScopeFlag, true);
    }
    return copied;
}

/** Register `saropaLogCapture.x` as a forwarding alias of every contributed `saropaCapture.x` command. */
export function registerLegacyCommandAliases(context: vscode.ExtensionContext): void {
    const manifest = context.extension.packageJSON as ManifestShape;
    for (const c of manifest.contributes?.commands ?? []) {
        const id = c.command;
        if (!id?.startsWith(`${newPrefix}.`)) { continue; }
        const legacyId = oldPrefix + id.slice(newPrefix.length);
        try {
            context.subscriptions.push(vscode.commands.registerCommand(
                legacyId, (...args: unknown[]) => vscode.commands.executeCommand(id, ...args)));
        } catch {
            // Already registered (old extension still active): its own handler keeps working.
        }
    }
}

/** One-time-per-activation warning when the pre-rename extension is still installed beside this one. */
function warnIfOldExtensionInstalled(): void {
    if (!vscode.extensions.getExtension(oldExtensionId)) { return; }
    void vscode.window.showWarningMessage(t('msg.legacyExtensionInstalled'));
}

/** Entry point called from activation. Never throws: compatibility must not block startup. */
export function activateLegacyCompat(context: vscode.ExtensionContext): void {
    registerLegacyCommandAliases(context);
    warnIfOldExtensionInstalled();
    migrateLegacySettings(context).then((copied) => {
        if (copied > 0) { void vscode.window.showInformationMessage(t('msg.legacySettingsMigrated', copied)); }
    }).catch((err) => logExtensionError('legacyCompat', err instanceof Error ? err : new Error(String(err))));
}
