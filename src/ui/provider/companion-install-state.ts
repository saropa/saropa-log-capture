/**
 * Live install-state feed for the Integrations screen's companion rows.
 *
 * The Integrations HTML is built once, so companion checkboxes are seeded with build-time
 * install state. This module keeps them honest afterwards: it posts a `setCompanionInstalled`
 * message on load and again whenever the set of installed extensions changes, so installing or
 * removing a Saropa companion while the viewer is open flips its row without a reload.
 * Mirrors the `setDriftAdvisorAvailable` pattern, extended with the `onDidChange` subscription.
 */
import * as vscode from 'vscode';
import { COMPANION_EXTENSION_IDS } from '../viewer-panels/viewer-integrations-panel-html';

/** Payload for the host's `setCompanionInstalled` message: `{ [extensionId]: installed }`. */
export type CompanionInstalledStates = Readonly<Record<string, boolean>>;

/** Snapshot the current install state of every companion extension. */
export function buildCompanionInstalledStates(): CompanionInstalledStates {
    const states: Record<string, boolean> = {};
    for (const id of COMPANION_EXTENSION_IDS) {
        states[id] = !!vscode.extensions.getExtension(id);
    }
    return states;
}

/**
 * Emit the current states now, then re-emit on every extension add/remove. The caller owns the
 * message envelope (kept inline at the `postMessage` call site so the outbound catalog indexes
 * the `setCompanionInstalled` type). Returns the subscription so it can be disposed with the
 * webview it feeds — avoids posting into a disposed view. `onDidChange` fires for any extension
 * change, not just ours; re-snapshotting two IDs is cheap, so no per-id filtering is warranted.
 */
export function wireCompanionInstallState(emit: (states: CompanionInstalledStates) => void): vscode.Disposable {
    emit(buildCompanionInstalledStates());
    return vscode.extensions.onDidChange(() => emit(buildCompanionInstalledStates()));
}
