"use strict";
/**
 * UI for enabling/disabling integration adapters. Shows a multi-select Quick Pick
 * and writes the selection to workspace settings.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTEGRATION_ADAPTERS = void 0;
exports.showIntegrationsPicker = showIntegrationsPicker;
const vscode = __importStar(require("vscode"));
const config_1 = require("../config/config");
const SECTION = 'saropaLogCapture';
const ADAPTERS_KEY = 'integrations.adapters';
/** Known adapters: id, label, description, and optional long description / performance / when-to-disable for the Integrations screen. */
exports.INTEGRATION_ADAPTERS = [
    {
        id: 'packages',
        label: 'Package / Lockfile',
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
        performanceNote: 'Minimal — single file read at session start. Requires a build-status file (e.g. .saropa/last-build.json) most projects won\'t have.',
        whenToDisable: 'You haven\'t configured a build-status file, or you don\'t care about build context.',
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
        label: 'Environment Snapshot',
        description: 'Env checksum and config file hashes in header',
        descriptionLong: 'Captures an environment checksum (from launch config) and hashes of configured config files so you can detect env or config drift between runs.',
        performanceNote: 'Minimal — reads env and a small set of files at session start.',
        whenToDisable: 'You don\'t need to track env or config changes.',
    },
    {
        id: 'testResults',
        label: 'Test Results',
        description: 'Last test run from file or JUnit XML in header',
        descriptionLong: 'Reads the last test run from a JSON file or JUnit XML and adds pass/fail and optionally failed test names to the session header.',
        performanceNote: '\u26A0\uFE0F Low to moderate — needs a JUnit/JSON file configured; parsing large XML can be slow.',
        whenToDisable: 'You haven\'t configured a test results path, or JUnit files are large enough to slow session start.',
    },
    {
        id: 'coverage',
        label: 'Code Coverage',
        description: 'Coverage % from lcov/Cobertura in header',
        descriptionLong: 'Parses lcov.info, cobertura.xml, or similar and adds coverage percentage to the session header. Also shows per-file coverage badges on stack frame lines and writes a quality.json sidecar at session end.',
        performanceNote: '\u26A0\uFE0F Low to moderate — needs a report path configured; parsing large coverage reports can be slow.',
        whenToDisable: 'You haven\'t configured a coverage report path, or reports are large enough to slow session start.',
    },
    {
        id: 'crashDumps',
        label: 'Crash Dumps',
        description: 'Scan for .dmp/.core in session time range at session end',
        descriptionLong: 'At session end, scans configured directories for .dmp or .core files in the session time range and attaches references or summaries so you can correlate crashes with the log.',
        performanceNote: '\u26A0\uFE0F Can be slow if scan directories are large or on slow disks.',
        whenToDisable: 'You don\'t produce crash dumps, or want faster session end. Only useful if your app generates .dmp/.core files.',
    },
    {
        id: 'windowsEvents',
        label: 'Windows Event Log',
        description: 'Application/System events in session range (Windows only)',
        descriptionLong: 'On Windows only: at session end, queries Application and System (and optionally Security) event logs for the session time range and writes events to a sidecar JSON file.',
        performanceNote: '\u26A0\uFE0F Noticeable — PowerShell query can take several seconds (up to ~15s) and may use significant memory. Windows only.',
        whenToDisable: 'Not on Windows, or you don\'t need event log context and want faster session end.',
    },
    {
        id: 'docker',
        label: 'Docker / Containers',
        description: 'Container inspect and logs at session end',
        descriptionLong: 'At session end, captures container ID (from config or docker ps), runs docker inspect and docker logs for the session time range, and writes a sidecar so you can correlate container state with the log.',
        performanceNote: '\u26A0\uFE0F Can be slow — docker inspect and logs can take time for large outputs. Only relevant if running containers.',
        whenToDisable: 'You don\'t use Docker for this project, or you want faster session end.',
    },
    {
        id: 'crashlytics',
        label: 'Firebase Crashlytics',
        description: 'Sidebar to view production crash issues (requires gcloud auth)',
        descriptionLong: 'Shows a sidebar with production crash issues from Firebase Crashlytics. Requires gcloud (or similar) auth to call the Crashlytics API.',
        performanceNote: '\u26A0\uFE0F Network — requires gcloud auth; makes API calls for crash data. Only active when the Crashlytics panel is used.',
        whenToDisable: 'You don\'t use Firebase Crashlytics, or you haven\'t set up gcloud authentication.',
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
        label: 'Terminal Output',
        description: 'Capture Integrated Terminal output to sidecar during session',
        descriptionLong: 'Captures Integrated Terminal output while the session is active and writes it to a .terminal.log sidecar at session end so you can correlate terminal commands and output with the debug log.',
        performanceNote: 'Low — in-memory buffer during session; one write at end.',
        whenToDisable: 'You don\'t use the terminal during debug, or you don\'t want terminal output in the bundle.',
    },
    {
        id: 'linuxLogs',
        label: 'WSL / Linux Logs',
        description: 'dmesg and journalctl for WSL or remote Linux sessions',
        descriptionLong: 'For WSL or remote Linux: captures dmesg and journalctl output in the session time range so you can correlate kernel and system logs with the app log.',
        performanceNote: '\u26A0\uFE0F Can be slow — journalctl over a wide range or on a busy system may take time. WSL/Linux only.',
        whenToDisable: 'Not on WSL or Linux, or you don\'t need system logs and want faster session end.',
    },
    {
        id: 'externalLogs',
        label: 'Application / File Logs',
        description: 'Tail external log files (app.log, nginx) during session',
        descriptionLong: 'Tails configured external log files (e.g. app.log, nginx access log) during the session and attaches them as sidecars so you have one bundle with both debug and app logs.',
        performanceNote: '\u26A0\uFE0F Continuous I/O — reads configured files throughout the session; more files or high churn adds load. Needs explicit file paths configured.',
        whenToDisable: 'You haven\'t configured external log file paths, or you want to reduce I/O during debug.',
    },
    {
        id: 'security',
        label: 'Security / Audit Logs',
        description: 'Windows Security and app audit log (opt-in)',
        descriptionLong: 'On Windows: can include Security event log and application audit log in the session context. Opt-in and configurable; may redact sensitive event details.',
        performanceNote: '\u26A0\uFE0F Similar to Windows Event Log — query can take time; Security log may be large and contain sensitive data. Windows only.',
        whenToDisable: 'Not on Windows, or you don\'t need security/audit context and want faster session end.',
    },
    {
        id: 'database',
        label: 'Database Query Logs',
        description: 'Correlate query logs with debug output by request ID',
        descriptionLong: 'Correlates database query logs with debug output (e.g. by request ID or trace ID) so you can see which queries ran around a given log line.',
        performanceNote: '\u26A0\uFE0F Needs external configuration — file reads or API calls; generally low if sources are local and small.',
        whenToDisable: 'You haven\'t configured database query log sources, or don\'t need correlation.',
    },
    {
        id: 'http',
        label: 'HTTP / Network',
        description: 'Correlate request log or HAR with debug output',
        descriptionLong: 'Correlates HTTP/network request data (from request logs or HAR) with debug output so you can see which requests occurred around a given log line.',
        performanceNote: '\u26A0\uFE0F Needs configuration — requires request logs or HAR files to be set up; generally low for local files.',
        whenToDisable: 'You haven\'t configured request log or HAR file paths.',
    },
    {
        id: 'browser',
        label: 'Browser / DevTools',
        description: 'Browser console log (file or CDP) alongside debug log',
        descriptionLong: 'Brings browser console or DevTools data (from file or CDP) into the session so you can view browser and debug log together.',
        performanceNote: '\u26A0\uFE0F Only for browser targets — reading a file is light; CDP connection has some overhead.',
        whenToDisable: 'You\'re not debugging a browser target, or you don\'t need console/DevTools data.',
    },
    {
        id: 'driftAdvisor',
        label: 'Drift Advisor',
        description: 'Drift query stats, schema, and health in session metadata and sidecar',
        descriptionLong: 'Adds Saropa Drift Advisor data to the capture when its extension is installed: session metadata (`saropa-drift-advisor`) and `{logBase}.drift-advisor.json` beside the log. Log Capture’s built-in path calls Drift’s `getSessionSnapshot()` or reads `.saropa/drift-advisor-session.json` only when `driftViewer.integrations.includeInLogCaptureSession` is full (default if unset); none or header skips that path. Drift’s own bridge usually runs afterward and may overwrite the same meta key. Right-click drift-perf / drift-query lines for Open in Drift Advisor.',
        performanceNote: 'Low when full — built-in uses API/file with timeout; Drift bridge uses parallel requests with timeout.',
        whenToDisable: 'Drift Advisor extension not installed (and no session file), you don\'t use Drift/SQLite, or you set includeInLogCaptureSession to none/header in Drift.',
    },
];
/** Show Quick Pick to toggle integration adapters; update workspace setting on accept. */
async function showIntegrationsPicker() {
    const config = (0, config_1.getConfig)();
    const current = new Set(config.integrationsAdapters ?? []);
    const items = exports.INTEGRATION_ADAPTERS.map((a) => ({
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
    if (selected === undefined) {
        return;
    }
    const selectedIds = selected.map((s) => s.adapterId);
    const cfg = vscode.workspace.getConfiguration(SECTION);
    await cfg.update(ADAPTERS_KEY, selectedIds, vscode.ConfigurationTarget.Workspace);
    const count = selectedIds.length;
    vscode.window.showInformationMessage(count === 0 ? 'All integrations disabled.' : `${count} integration(s) enabled.`);
    const { runIntegrationPrepCheck } = await import('./integration-prep.js');
    void runIntegrationPrepCheck(selectedIds);
}
//# sourceMappingURL=integrations-ui.js.map