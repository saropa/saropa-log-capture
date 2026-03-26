"use strict";
/**
 * Integration Context Handlers
 *
 * Handlers for integration context popover and document display.
 *
 * ## Database-tagged lines (Drift SQL)
 *
 * The webview attaches `dbInsight` to `sourceTag === 'database'` rows and may send
 * `hasDatabaseLine: true` with **Show integration context**. When there is no HTTP/perf/etc.
 * data in the ±window and no `saropa-drift-advisor` session meta, we still open the popover
 * so **Database insight** can render from line-local metadata. {@link shouldPostNoIntegrationDataError}
 * encodes that gate for tests and keeps the “empty context” decision in one place.
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
exports.shouldPostNoIntegrationDataError = shouldPostNoIntegrationDataError;
exports.handlePerformanceRequest = handlePerformanceRequest;
exports.handleIntegrationContextRequest = handleIntegrationContextRequest;
exports.handleRelatedQueriesRequest = handleRelatedQueriesRequest;
exports.handleIntegrationContextDocument = handleIntegrationContextDocument;
const path = __importStar(require("node:path"));
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../../l10n");
const session_metadata_1 = require("../../../modules/session/session-metadata");
const context_loader_1 = require("../../../modules/context/context-loader");
const perf_aggregator_1 = require("../../../modules/misc/perf-aggregator");
const safe_json_1 = require("../../../modules/misc/safe-json");
const MAX_SPARKLINE_POINTS = 48;
/**
 * Whether to respond with `noIntegrationData` for the context popover.
 * False positives to avoid: opening an empty popover when the line is not database-tagged
 * and there is truly no integration payload; those stay on the error path.
 */
function shouldPostNoIntegrationDataError(params) {
    return (!params.hasContextWindowData &&
        !params.hasDriftAdvisorIntegrationMeta &&
        !params.hasDatabaseLine &&
        !params.hasSecurityMeta);
}
/** Load and downsample .perf.json for hero sparkline. Returns undefined if no samples. */
async function loadHeroSparklineData(logUri, sessionData) {
    const samplesFile = sessionData?.samplesFile;
    if (!samplesFile || typeof samplesFile !== 'string' || !samplesFile.endsWith('.perf.json')) {
        return undefined;
    }
    const logDir = path.dirname(logUri.fsPath);
    const sidecarPath = path.join(logDir, samplesFile);
    try {
        const content = await vscode.workspace.fs.readFile(vscode.Uri.file(sidecarPath));
        const data = (0, safe_json_1.parseJSONOrDefault)(Buffer.from(content).toString('utf-8'), {});
        const raw = data.samples && Array.isArray(data.samples) ? data.samples : [];
        if (raw.length < 2) {
            return undefined;
        }
        const n = Math.min(MAX_SPARKLINE_POINTS, raw.length);
        const step = (raw.length - 1) / (n - 1);
        const times = [];
        const freememMb = [];
        const loadAvg1 = [];
        for (let i = 0; i < n; i++) {
            const idx = i === n - 1 ? raw.length - 1 : Math.round(i * step);
            const s = raw[idx];
            times.push(s.t);
            freememMb.push(typeof s.freememMb === 'number' ? s.freememMb : 0);
            loadAvg1.push(typeof s.loadAvg1 === 'number' ? s.loadAvg1 : 0);
        }
        return { times, freememMb, loadAvg1 };
    }
    catch {
        return undefined;
    }
}
/** Format a single integration entry into display lines. */
function formatIntegrationEntry(key, value) {
    const lines = [];
    const data = value;
    const capturedAt = data.capturedAt;
    const sessionWindow = data.sessionWindow;
    const header = capturedAt
        ? `${key} (captured at ${new Date(capturedAt).toLocaleTimeString()})`
        : key;
    lines.push(`── ${header} ──`);
    if (sessionWindow) {
        lines.push(`  Session: ${new Date(sessionWindow.start).toLocaleTimeString()} - ${new Date(sessionWindow.end).toLocaleTimeString()}`);
    }
    for (const [k, v] of Object.entries(data)) {
        if (k === 'capturedAt' || k === 'sessionWindow') {
            continue;
        }
        let formatted;
        if (typeof v === 'object' && v !== null) {
            formatted = JSON.stringify(v, null, 2);
        }
        else if (typeof v === 'string') {
            formatted = v;
        }
        else {
            formatted = String(v);
        }
        if (formatted.includes('\n')) {
            lines.push(`  ${k}:`);
            formatted.split('\n').forEach(line => lines.push(`    ${line}`));
        }
        else {
            lines.push(`  ${k}: ${formatted}`);
        }
    }
    lines.push('');
    return lines;
}
/**
 * Get the center time for context filtering from session metadata.
 */
function getSessionCenterTime(integrations) {
    if (!integrations) {
        return 0;
    }
    for (const value of Object.values(integrations)) {
        const data = value;
        if (data.capturedAt && typeof data.capturedAt === 'number') {
            return data.capturedAt;
        }
        const sw = data.sessionWindow;
        if (sw?.start && sw?.end) {
            return Math.round((sw.start + sw.end) / 2);
        }
    }
    return 0;
}
function buildSnapshotSummary(sessionData) {
    const snap = sessionData?.snapshot;
    if (!snap || typeof snap !== 'object') {
        return undefined;
    }
    const parts = [];
    if (typeof snap.cpus === 'number') {
        parts.push(`${snap.cpus} CPUs`);
    }
    if (typeof snap.totalMemMb === 'number') {
        parts.push(`${snap.totalMemMb} MB RAM`);
    }
    if (typeof snap.processMemMb === 'number') {
        parts.push(`process ${snap.processMemMb} MB`);
    }
    return parts.length > 0 ? parts.join(', ') : undefined;
}
/** Aggregate performance fingerprints and optional session data for current log. */
async function handlePerformanceRequest(post, logUri) {
    const [insights, logContext] = await Promise.all([
        (0, perf_aggregator_1.aggregatePerformance)('all').catch(() => undefined),
        logUri ? (async () => {
            try {
                const store = new session_metadata_1.SessionMetadataStore();
                const meta = await store.loadMetadata(logUri);
                const sessionData = meta.integrations?.performance;
                const snapshotSummary = buildSnapshotSummary(sessionData);
                const heroSparklineData = await loadHeroSparklineData(logUri, sessionData);
                return {
                    sessionData,
                    errorCount: meta.errorCount,
                    warningCount: meta.warningCount,
                    snapshotSummary,
                    heroSparklineData,
                };
            }
            catch {
                return undefined;
            }
        })() : Promise.resolve(undefined),
    ]);
    const currentLogLabel = logUri ? path.basename(logUri.fsPath) : undefined;
    const sessionData = logContext?.sessionData;
    post({
        type: 'performanceData',
        trends: insights?.trends ?? [],
        sessionCount: insights?.sessionCount ?? 0,
        sessionData: sessionData ?? undefined,
        currentLogLabel: currentLogLabel ?? undefined,
        heroErrorCount: logContext?.errorCount,
        heroWarningCount: logContext?.warningCount,
        heroSnapshotSummary: logContext?.snapshotSummary,
        heroSparklineData: logContext?.heroSparklineData,
    });
}
/**
 * Show integration context data for a log line as a popover.
 * Filters integration data to ±windowMs of the line timestamp,
 * and by request ID when a requestIdPattern is configured.
 */
async function handleIntegrationContextRequest(logUri, lineIndex, post, options) {
    if (!logUri) {
        post({ type: 'contextPopoverData', error: (0, l10n_1.t)('msg.noIntegrationContext') });
        return;
    }
    try {
        const store = new session_metadata_1.SessionMetadataStore();
        const meta = await store.loadMetadata(logUri);
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        const windowMs = cfg.get('contextWindowSeconds', 5) * 1000;
        const timestamp = options?.timestamp;
        const hasDatabaseLine = options?.hasDatabaseLine === true;
        let centerTime = timestamp && timestamp > 0
            ? timestamp
            : getSessionCenterTime(meta.integrations);
        // Database-tagged lines still show line-local insight even without a captured timestamp.
        if (centerTime === 0 && hasDatabaseLine) {
            centerTime = Date.now();
        }
        if (centerTime === 0) {
            post({ type: 'contextPopoverData', error: (0, l10n_1.t)('msg.noIntegrationContext') });
            return;
        }
        const requestId = extractRequestIdFromLine(options?.lineText, cfg);
        const window = { centerTime, windowMs, ...(requestId ? { requestId } : {}) };
        let contextData = await (0, context_loader_1.loadContextData)(logUri, window);
        if (!contextData.hasData && meta.integrations) {
            const metaContext = await (0, context_loader_1.loadContextFromMeta)(meta.integrations, window);
            contextData = { ...contextData, ...metaContext, hasData: Object.keys(metaContext).length > 0 };
        }
        const driftAdvisorMeta = meta.integrations?.['saropa-drift-advisor'];
        const securityMeta = meta.integrations?.security;
        if (shouldPostNoIntegrationDataError({
            hasContextWindowData: contextData.hasData,
            hasDriftAdvisorIntegrationMeta: !!driftAdvisorMeta,
            hasDatabaseLine,
            hasSecurityMeta: !!securityMeta,
        })) {
            post({ type: 'contextPopoverData', error: (0, l10n_1.t)('msg.noIntegrationData') });
            return;
        }
        const integrationsMeta = {};
        if (driftAdvisorMeta) {
            integrationsMeta['saropa-drift-advisor'] = driftAdvisorMeta;
        }
        if (securityMeta) {
            integrationsMeta.security = securityMeta;
        }
        post({
            type: 'contextPopoverData',
            lineIndex,
            timestamp: centerTime,
            windowMs,
            data: { ...contextData, integrationsMeta },
        });
    }
    catch {
        post({ type: 'contextPopoverData', error: (0, l10n_1.t)('msg.noIntegrationContext') });
    }
}
/**
 * Load database queries related to a specific log line and post them to the webview.
 * Uses time-window and optional request-ID correlation (same logic as the integration
 * context popover, but returns only database entries with no cap).
 */
async function handleRelatedQueriesRequest(logUri, lineIndex, post, options) {
    if (!logUri) {
        post({ type: 'relatedQueriesData', error: (0, l10n_1.t)('msg.noIntegrationContext') });
        return;
    }
    try {
        const store = new session_metadata_1.SessionMetadataStore();
        const meta = await store.loadMetadata(logUri);
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        const windowMs = cfg.get('contextWindowSeconds', 5) * 1000;
        const centerTime = (options?.timestamp && options.timestamp > 0)
            ? options.timestamp
            : getSessionCenterTime(meta.integrations);
        if (centerTime === 0) {
            post({ type: 'relatedQueriesData', lineIndex, queries: [] });
            return;
        }
        const requestId = extractRequestIdFromLine(options?.lineText, cfg);
        const window = { centerTime, windowMs, ...(requestId ? { requestId } : {}) };
        const contextData = await (0, context_loader_1.loadContextData)(logUri, window);
        post({ type: 'relatedQueriesData', lineIndex, queries: contextData.database ?? [] });
    }
    catch {
        post({ type: 'relatedQueriesData', error: (0, l10n_1.t)('msg.noIntegrationContext') });
    }
}
/**
 * Extract a request ID from a log line using configured requestIdPattern settings.
 * Tries database, HTTP, and browser patterns; returns first match or undefined.
 */
function extractRequestIdFromLine(lineText, cfg) {
    if (!lineText) {
        return undefined;
    }
    const patterns = [
        cfg.get('integrations.database.requestIdPattern', ''),
        cfg.get('integrations.http.requestIdPattern', ''),
        cfg.get('integrations.browser.requestIdPattern', ''),
    ];
    for (const raw of patterns) {
        if (!raw) {
            continue;
        }
        try {
            const m = new RegExp(raw).exec(lineText);
            if (m) {
                return m[1] ?? m[0];
            }
        }
        catch {
            // invalid regex — skip
        }
    }
    return undefined;
}
/**
 * Show integration context in a separate document (legacy behavior).
 * Called when user explicitly wants to view full context.
 */
async function handleIntegrationContextDocument(logUri, lineIndex) {
    if (!logUri) {
        vscode.window.showInformationMessage((0, l10n_1.t)('msg.noIntegrationContext'));
        return;
    }
    try {
        const store = new session_metadata_1.SessionMetadataStore();
        const meta = await store.loadMetadata(logUri);
        const integrations = meta.integrations;
        if (!integrations || Object.keys(integrations).length === 0) {
            vscode.window.showInformationMessage((0, l10n_1.t)('msg.noIntegrationData'));
            return;
        }
        const contextLines = [`Integration context for line ${lineIndex + 1}:`, ''];
        for (const [key, value] of Object.entries(integrations)) {
            contextLines.push(...formatIntegrationEntry(key, value));
        }
        const doc = await vscode.workspace.openTextDocument({ content: contextLines.join('\n'), language: 'markdown' });
        await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
    }
    catch {
        vscode.window.showInformationMessage((0, l10n_1.t)('msg.noIntegrationContext'));
    }
}
//# sourceMappingURL=context-handlers.js.map