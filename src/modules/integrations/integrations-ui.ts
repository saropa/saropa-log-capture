/**
 * UI for enabling/disabling integration adapters. Shows a multi-select Quick Pick
 * and writes the selection to workspace settings.
 */

import * as vscode from 'vscode';
import { getConfig } from '../config/config';

const SECTION = 'saropaLogCapture';
const ADAPTERS_KEY = 'integrations.adapters';

/** Extended adapter metadata for the Integrations screen (long description, performance, when to disable). */
export interface IntegrationAdapterMeta {
    id: string;
    label: string;
    /** Short description for Quick Pick and status. */
    description: string;
    /** Longer explanation for the Integrations screen. */
    descriptionLong?: string;
    /** Performance impact note, if any. */
    performanceNote?: string;
    /** When you might want to leave this integration off. */
    whenToDisable?: string;
}

/** Known adapters: id, label, description, and optional long description / performance / when-to-disable for the Integrations screen. */
export const INTEGRATION_ADAPTERS: ReadonlyArray<IntegrationAdapterMeta> = [
    {
        id: 'packages',
        label: 'Package / lockfile',
        description: 'Lockfile hash and package manager in session header',
        descriptionLong: 'Adds lockfile hash and package manager (npm, yarn, pnpm) to the session header so you can tell exactly which dependency set a run used.',
        performanceNote: 'Minimal — reads lockfile(s) once at session start.',
        whenToDisable: 'No lockfile in the workspace, or you don\'t need dependency context.',
    },
    {
        id: 'buildCi',
        label: 'Build / CI',
        description: 'Last build status from file (e.g. .saropa/last-build.json)',
        descriptionLong: 'Reads the last build result from a file (e.g. .saropa/last-build.json) and adds it to the session header so you can see whether the last build succeeded or failed.',
        performanceNote: 'Minimal — single file read at session start.',
        whenToDisable: 'You don\'t use the build-status file or don\'t care about build context.',
    },
    {
        id: 'git',
        label: 'Git',
        description: 'Describe, uncommitted/stash in header; blame and git history when opening source from log',
        descriptionLong: 'Adds git describe, uncommitted files summary, and stash count to the header. When you open a source file from a log line, can show blame (last commit, author) in the status bar and optional commit links.',
        performanceNote: 'Small — a few git commands at session start; blame on navigate can add a short delay in very large repos.',
        whenToDisable: 'Not in a Git repo, or you want faster session start in huge repos.',
    },
    {
        id: 'environment',
        label: 'Environment snapshot',
        description: 'Env checksum and config file hashes in header',
        descriptionLong: 'Captures an environment checksum (from launch config) and hashes of configured config files so you can detect env or config drift between runs.',
        performanceNote: 'Minimal — reads env and a small set of files at session start.',
        whenToDisable: 'You don\'t need to track env or config changes.',
    },
    {
        id: 'testResults',
        label: 'Test results',
        description: 'Last test run from file or JUnit XML in header',
        descriptionLong: 'Reads the last test run from a JSON file or JUnit XML and adds pass/fail and optionally failed test names to the session header.',
        performanceNote: 'Low to moderate — parsing large JUnit XML can take a moment.',
        whenToDisable: 'You don\'t run tests or don\'t want to parse test output; disable if JUnit files are huge and slow.',
    },
    {
        id: 'coverage',
        label: 'Code coverage',
        description: 'Coverage % from lcov/Cobertura in header',
        descriptionLong: 'Parses lcov.info, cobertura.xml, or similar and adds coverage percentage (and optionally summary) to the session header.',
        performanceNote: 'Low to moderate — parsing large coverage reports can be slow.',
        whenToDisable: 'You don\'t generate coverage, or reports are very large and slow session start.',
    },
    {
        id: 'crashDumps',
        label: 'Crash dumps',
        description: 'Scan for .dmp/.core in session time range at session end',
        descriptionLong: 'At session end, scans configured directories for .dmp or .core files in the session time range and attaches references or summaries so you can correlate crashes with the log.',
        performanceNote: 'Can be slow if scan directories are large or on slow disks.',
        whenToDisable: 'You don\'t produce crash dumps or want faster session end; disable on large scan paths.',
    },
    {
        id: 'windowsEvents',
        label: 'Windows Event Log',
        description: 'Application/System events in session range (Windows only)',
        descriptionLong: 'On Windows only: at session end, queries Application and System (and optionally Security) event logs for the session time range and writes events to a sidecar JSON file.',
        performanceNote: 'Noticeable — PowerShell query can take several seconds (up to ~15s) and may use significant memory for large result sets.',
        whenToDisable: 'Not on Windows; or you don\'t need event log context and want faster session end.',
    },
    {
        id: 'docker',
        label: 'Docker / containers',
        description: 'Container inspect and logs at session end',
        descriptionLong: 'At session end, captures container ID (from config or docker ps), runs docker inspect and docker logs for the session time range, and writes a sidecar so you can correlate container state with the log.',
        performanceNote: 'Can be slow — docker inspect and logs can take time for large outputs.',
        whenToDisable: 'You don\'t use Docker for this session, or you want faster session end.',
    },
    {
        id: 'crashlytics',
        label: 'Firebase Crashlytics',
        description: 'Sidebar to view production crash issues (requires gcloud auth)',
        descriptionLong: 'Shows a sidebar with production crash issues from Firebase Crashlytics. Requires gcloud (or similar) auth to call the Crashlytics API.',
        performanceNote: 'Network and UI — API calls and sidebar rendering; only active when the Crashlytics panel is used.',
        whenToDisable: 'You don\'t use Firebase Crashlytics or don\'t want the sidebar or API usage.',
    },
    {
        id: 'performance',
        label: 'Performance',
        description: 'System snapshot (CPUs, RAM) and optional sampling at session end',
        descriptionLong: 'Adds a system snapshot (CPU count, RAM) at session start. Optionally runs periodic sampling during the session and writes a performance sidecar for analysis.',
        performanceNote: 'Snapshot is light. Periodic sampling can add CPU and I/O; disable sampling on resource-constrained machines.',
        whenToDisable: 'You don\'t need system metrics; turn off sampling if the machine is slow or you want minimal overhead.',
    },
    {
        id: 'terminal',
        label: 'Terminal output',
        description: 'Capture Integrated Terminal output to sidecar during session',
        descriptionLong: 'Captures Integrated Terminal output while the session is active and writes it to a .terminal.log sidecar at session end so you can correlate terminal commands and output with the debug log.',
        performanceNote: 'Low — in-memory buffer during session; one write at end.',
        whenToDisable: 'You don\'t use the terminal during debug, or you don\'t want terminal output in the bundle.',
    },
    {
        id: 'linuxLogs',
        label: 'WSL / Linux logs',
        description: 'dmesg and journalctl for WSL or remote Linux sessions',
        descriptionLong: 'For WSL or remote Linux: captures dmesg and journalctl output in the session time range so you can correlate kernel and system logs with the app log.',
        performanceNote: 'Can be slow — journalctl over a wide range or on a busy system may take time.',
        whenToDisable: 'Not on WSL or Linux; or you don\'t need system logs and want faster session end.',
    },
    {
        id: 'externalLogs',
        label: 'Application / file logs',
        description: 'Tail external log files (app.log, nginx) during session',
        descriptionLong: 'Tails configured external log files (e.g. app.log, nginx access log) during the session and attaches them as sidecars so you have one bundle with both debug and app logs.',
        performanceNote: 'I/O — continuous read of configured files; more files or high churn can add load.',
        whenToDisable: 'You don\'t have external logs to tail, or you want to reduce I/O.',
    },
    {
        id: 'security',
        label: 'Security / audit logs',
        description: 'Windows Security and app audit log (opt-in)',
        descriptionLong: 'On Windows: can include Security event log and application audit log in the session context. Opt-in and configurable; may redact sensitive event details.',
        performanceNote: 'Similar to Windows Event Log — query can take time; Security log may be large.',
        whenToDisable: 'Not on Windows; or you don\'t need security/audit context and want faster session end.',
    },
    {
        id: 'database',
        label: 'Database query logs',
        description: 'Correlate query logs with debug output by request ID',
        descriptionLong: 'Correlates database query logs with debug output (e.g. by request ID or trace ID) so you can see which queries ran around a given log line.',
        performanceNote: 'Depends on config — file reads or API calls; generally low if sources are local and small.',
        whenToDisable: 'You don\'t use DB query logs or don\'t need correlation.',
    },
    {
        id: 'http',
        label: 'HTTP / network',
        description: 'Correlate request log or HAR with debug output',
        descriptionLong: 'Correlates HTTP/network request data (from request logs or HAR) with debug output so you can see which requests occurred around a given log line.',
        performanceNote: 'Depends on config — file or API; generally low for local files.',
        whenToDisable: 'You don\'t have request logs or HAR to correlate.',
    },
    {
        id: 'browser',
        label: 'Browser / DevTools',
        description: 'Browser console log (file or CDP) alongside debug log',
        descriptionLong: 'Brings browser console or DevTools data (from file or CDP) into the session so you can view browser and debug log together.',
        performanceNote: 'Depends on source — reading a file is light; CDP has some overhead.',
        whenToDisable: 'You\'re not debugging a browser target or don\'t need console/DevTools data.',
    },
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
