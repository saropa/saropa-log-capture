/**
 * UI for enabling/disabling integration adapters. Shows a multi-select Quick Pick
 * and writes the selection to workspace settings.
 */

import * as vscode from 'vscode';
import { getConfig } from '../config/config';

const SECTION = 'saropaLogCapture';
const ADAPTERS_KEY = 'integrations.adapters';

/** Known adapters: id, label, and short description for the picker and options panel. */
export const INTEGRATION_ADAPTERS: ReadonlyArray<{ id: string; label: string; description: string }> = [
    { id: 'packages', label: 'Package / lockfile', description: 'Lockfile hash and package manager in session header' },
    { id: 'buildCi', label: 'Build / CI', description: 'Last build status from file (e.g. .saropa/last-build.json)' },
    { id: 'git', label: 'Git', description: 'Describe, uncommitted/stash in header; blame and git history when opening source from log' },
    { id: 'environment', label: 'Environment snapshot', description: 'Env checksum and config file hashes in header' },
    { id: 'testResults', label: 'Test results', description: 'Last test run from file or JUnit XML in header' },
    { id: 'coverage', label: 'Code coverage', description: 'Coverage % from lcov/Cobertura in header' },
    { id: 'crashDumps', label: 'Crash dumps', description: 'Scan for .dmp/.core in session time range at session end' },
    { id: 'windowsEvents', label: 'Windows Event Log', description: 'Application/System events in session range (Windows only)' },
    { id: 'docker', label: 'Docker / containers', description: 'Container inspect and logs at session end' },
    { id: 'crashlytics', label: 'Firebase Crashlytics', description: 'Sidebar to view production crash issues (requires gcloud auth)' },
    { id: 'performance', label: 'Performance', description: 'System snapshot (CPUs, RAM) and optional sampling at session end' },
    { id: 'terminal', label: 'Terminal output', description: 'Capture Integrated Terminal output to sidecar during session' },
    { id: 'linuxLogs', label: 'WSL / Linux logs', description: 'dmesg and journalctl for WSL or remote Linux sessions' },
    { id: 'externalLogs', label: 'Application / file logs', description: 'Tail external log files (app.log, nginx) during session' },
    { id: 'security', label: 'Security / audit logs', description: 'Windows Security and app audit log (opt-in)' },
    { id: 'database', label: 'Database query logs', description: 'Correlate query logs with debug output by request ID' },
    { id: 'http', label: 'HTTP / network', description: 'Correlate request log or HAR with debug output' },
    { id: 'browser', label: 'Browser / DevTools', description: 'Browser console log (file or CDP) alongside debug log' },
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
    const { runIntegrationPrepCheck } = await import('./integration-prep.js');
    void runIntegrationPrepCheck(selectedIds);
}
