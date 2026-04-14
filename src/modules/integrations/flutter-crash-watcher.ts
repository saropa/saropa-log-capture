/**
 * Standalone watcher for Flutter CLI crash logs (flutter_*.log) in the workspace root.
 *
 * Flutter writes crash reports to the project root when `flutter test`, `flutter run`,
 * or `flutter build` hit an unhandled exception. These files accumulate silently.
 * This watcher detects them and copies them into the reports directory so they
 * appear in the session history list.
 *
 * Runs independently of debug sessions — Flutter CLI crashes happen from terminal
 * commands, not just during VS Code debug sessions.
 */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri } from '../config/config';

/** Glob pattern matching Flutter crash log filenames (e.g. flutter_01.log). */
const flutterCrashGlob = 'flutter_*.log';

/** Debounce delay (ms) before copying a newly detected crash log — file may still be written. */
const copyDebounceMs = 500;

/**
 * Start watching the workspace root for flutter_*.log files.
 * Sweeps existing files on activation, then watches for new ones.
 *
 * @returns A disposable that stops the watcher and cleans up timers.
 */
export function startFlutterCrashWatcher(
    folder: vscode.WorkspaceFolder,
    outputChannel: vscode.OutputChannel,
): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];
    const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

    // Sweep existing flutter crash logs on activation (non-blocking).
    sweepExisting(folder, outputChannel).catch(() => { /* best-effort */ });

    // Watch for new flutter crash logs appearing in workspace root.
    const pattern = new vscode.RelativePattern(folder, flutterCrashGlob);
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    disposables.push(watcher);

    disposables.push(watcher.onDidCreate((uri) => {
        // Debounce: Flutter may still be writing the file when the create event fires.
        const timer = setTimeout(() => {
            pendingTimers.delete(timer);
            importCrashLog(uri, folder, outputChannel).catch(() => { /* best-effort */ });
        }, copyDebounceMs);
        pendingTimers.add(timer);
    }));

    return {
        dispose: () => {
            for (const t of pendingTimers) { clearTimeout(t); }
            pendingTimers.clear();
            for (const d of disposables) { d.dispose(); }
        },
    };
}

/**
 * Scan workspace root for existing flutter_*.log files and import any that
 * haven't been imported yet. Called once on extension activation.
 */
async function sweepExisting(
    folder: vscode.WorkspaceFolder,
    outputChannel: vscode.OutputChannel,
): Promise<void> {
    const pattern = new vscode.RelativePattern(folder, flutterCrashGlob);
    const files = await vscode.workspace.findFiles(pattern);
    for (const uri of files) {
        await importCrashLog(uri, folder, outputChannel);
    }
}

/**
 * Copy a single flutter crash log into the reports directory.
 * Skips if the target already exists (already imported).
 * Deletes the original if `deleteOriginals` config is true.
 */
async function importCrashLog(
    sourceUri: vscode.Uri,
    folder: vscode.WorkspaceFolder,
    outputChannel: vscode.OutputChannel,
): Promise<void> {
    const config = getConfig();
    if (!(config.integrationsAdapters ?? []).includes('flutterCrashLogs')) {
        return;
    }

    const logDir = getLogDirectoryUri(folder);
    const sourceName = sourceUri.path.split('/').pop() ?? 'flutter_crash.log';

    // Prefix with "flutter-crash_" so these are visually distinct in the session list.
    const destName = `flutter-crash_${sourceName}`;
    const destUri = vscode.Uri.joinPath(logDir, destName);

    // Skip if already imported (target file exists).
    try {
        await vscode.workspace.fs.stat(destUri);
        // File exists — already imported. Still delete original if configured.
        if (config.integrationsFlutterCrashLogs.deleteOriginals) {
            await deleteOriginal(sourceUri, outputChannel);
        }
        return;
    } catch {
        // File doesn't exist — proceed with import.
    }

    // Ensure the reports directory exists before copying.
    try {
        await vscode.workspace.fs.createDirectory(logDir);
    } catch {
        // Directory likely already exists; ignore.
    }

    try {
        await vscode.workspace.fs.copy(sourceUri, destUri);
        outputChannel.appendLine(`[flutterCrashLogs] Imported ${sourceName} → ${destName}`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[flutterCrashLogs] Failed to import ${sourceName}: ${msg}`);
        return;
    }

    // Delete original from workspace root to prevent clutter.
    if (config.integrationsFlutterCrashLogs.deleteOriginals) {
        await deleteOriginal(sourceUri, outputChannel);
    }
}

/** Delete the original flutter crash log from workspace root. */
async function deleteOriginal(
    uri: vscode.Uri,
    outputChannel: vscode.OutputChannel,
): Promise<void> {
    try {
        await vscode.workspace.fs.delete(uri);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[flutterCrashLogs] Could not delete original ${uri.fsPath}: ${msg}`);
    }
}
