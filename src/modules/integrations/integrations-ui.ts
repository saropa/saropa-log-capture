/**
 * UI for enabling/disabling integration adapters. Shows a multi-select Quick Pick
 * and writes the selection to workspace settings.
 */

import * as vscode from 'vscode';
import { getConfig } from '../config/config';

const SECTION = 'saropaLogCapture';
const ADAPTERS_KEY = 'integrations.adapters';

/** Known adapters: id, label, and short description for the picker. */
export const INTEGRATION_ADAPTERS: ReadonlyArray<{ id: string; label: string; description: string }> = [
    { id: 'packages', label: 'Package / lockfile', description: 'Lockfile hash and package manager in header' },
    { id: 'buildCi', label: 'Build / CI', description: 'Last build status from file (e.g. .saropa/last-build.json)' },
    { id: 'git', label: 'Git (extended)', description: 'Git describe, uncommitted files, stash in header' },
    { id: 'environment', label: 'Environment snapshot', description: 'Env checksum and config file hashes' },
    { id: 'testResults', label: 'Test results', description: 'Last test run from file or JUnit XML' },
    { id: 'coverage', label: 'Code coverage', description: 'Coverage % from lcov/Cobertura/summary file' },
    { id: 'crashDumps', label: 'Crash dumps', description: 'Scan for .dmp/.core in session time range at end' },
    { id: 'windowsEvents', label: 'Windows Event Log', description: 'Application/System events in session range (Windows)' },
    { id: 'docker', label: 'Docker / containers', description: 'Container inspect and logs at session end' },
];

interface AdapterQuickPickItem extends vscode.QuickPickItem {
    adapterId: string;
}

/** Show Quick Pick to toggle integration adapters; update workspace setting on accept. */
export async function showIntegrationsPicker(): Promise<void> {
    const config = getConfig();
    const current = new Set(config.integrationsAdapters ?? []);

    const items: AdapterQuickPickItem[] = INTEGRATION_ADAPTERS.map((a) => ({
        label: (current.has(a.id) ? '$(check) ' : '$(circle-outline) ') + a.label,
        description: a.description,
        picked: current.has(a.id),
        adapterId: a.id,
    }));

    const selected = await vscode.window.showQuickPick(items, {
        title: 'Session integrations',
        placeHolder: 'Select which integrations run for each debug session',
        canPickMany: true,
        matchOnDescription: true,
    });

    if (selected === undefined) { return; }

    const selectedIds = (selected as AdapterQuickPickItem[]).map((s) => s.adapterId);

    const cfg = vscode.workspace.getConfiguration(SECTION);
    await cfg.update(ADAPTERS_KEY, selectedIds, vscode.ConfigurationTarget.Workspace);

    const count = selectedIds.length;
    vscode.window.showInformationMessage(
        count === 0 ? 'All integrations disabled.' : `${count} integration(s) enabled.`,
    );
}
