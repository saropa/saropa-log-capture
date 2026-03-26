"use strict";
/** Firebase Crashlytics REST API query functions. */
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
exports.getLastApiDiagnostic = getLastApiDiagnostic;
exports.clearApiCache = clearApiCache;
exports.queryTopIssues = queryTopIssues;
exports.updateIssueState = updateIssueState;
exports.getCrashEventDetail = getCrashEventDetail;
exports.getCrashEvents = getCrashEvents;
const vscode = __importStar(require("vscode"));
const app_version_1 = require("../misc/app-version");
const crashlytics_io_1 = require("./crashlytics-io");
const crashlytics_event_parser_1 = require("./crashlytics-event-parser");
const crashlytics_diagnostics_1 = require("./crashlytics-diagnostics");
const apiBase = 'https://firebasecrashlytics.googleapis.com/v1beta1';
const issueListTtl = 5 * 60_000;
let cachedIssueRows;
let lastApiDiagnostic;
/** Get last diagnostic detail from API operations (for error reporting by caller). */
function getLastApiDiagnostic() { return lastApiDiagnostic; }
/** Reset cached issue list (called when the parent module clears all caches). */
function clearApiCache() {
    cachedIssueRows = undefined;
    lastApiDiagnostic = undefined;
}
function getTimeRange() {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
    return cfg.get('timeRange', 'LAST_7_DAYS');
}
/** Never throws; returns [] on any failure. */
async function queryTopIssues(config, token, errorTokens) {
    try {
        if (cachedIssueRows && Date.now() < cachedIssueRows.expires) {
            return matchIssues(cachedIssueRows.rows, errorTokens);
        }
        if (!config?.projectId || !config?.appId || typeof token !== 'string') {
            return [];
        }
        const url = `${apiBase}/projects/${config.projectId}/apps/${config.appId}/reports/topIssues:query`;
        const filters = { issueErrorTypes: ['FATAL', 'NON_FATAL'] };
        try {
            const ver = await (0, app_version_1.detectAppVersion)();
            if (ver) {
                filters.versions = [ver];
            }
        }
        catch {
            // Proceed without version filter
        }
        const body = JSON.stringify({
            issueFilters: filters,
            pageSize: 20,
            eventTimePeriod: getTimeRange(),
        });
        const data = await fetchJson(url, token, body);
        if (!data?.rows || !Array.isArray(data.rows)) {
            return [];
        }
        cachedIssueRows = { rows: data.rows, expires: Date.now() + issueListTtl };
        return matchIssues(cachedIssueRows.rows, errorTokens);
    }
    catch {
        return [];
    }
}
function parseIssueState(raw) {
    const s = String(raw ?? '').toUpperCase();
    if (s === 'CLOSED') {
        return 'CLOSED';
    }
    if (s === 'REGRESSION' || s === 'REGRESSED') {
        return 'REGRESSION';
    }
    if (s === 'OPEN') {
        return 'OPEN';
    }
    return 'UNKNOWN';
}
function matchIssues(rows, errorTokens) {
    const lowerTokens = errorTokens.map(t => t.toLowerCase()).filter(t => t.length > 0);
    const results = [];
    for (const row of rows) {
        const issue = row.issue;
        if (!issue) {
            continue;
        }
        const title = String(issue.title ?? '');
        const subtitle = String(issue.subtitle ?? '');
        // When no tokens provided, include all issues (sidebar panel use case)
        if (lowerTokens.length > 0) {
            const combined = (title + ' ' + subtitle).toLowerCase();
            if (!lowerTokens.some(t => combined.includes(t))) {
                continue;
            }
        }
        const errorType = String(issue.type ?? issue.issueType ?? '').toUpperCase();
        results.push({
            id: String(issue.id ?? ''),
            title, subtitle,
            eventCount: Number(row.eventCount ?? 0),
            userCount: Number(row.impactedUsers ?? 0),
            isFatal: errorType === 'FATAL' || errorType === 'CRASH',
            state: parseIssueState(issue.state ?? issue.issueState),
            firstVersion: issue.firstSeenVersion ? String(issue.firstSeenVersion) : undefined,
            lastVersion: issue.lastSeenVersion ? String(issue.lastSeenVersion) : undefined,
        });
    }
    return results.slice(0, 5);
}
/** Update a Crashlytics issue state (close or mute). Returns true on success. Never throws. */
async function updateIssueState(config, token, issueId, state) {
    try {
        if (!config?.projectId || !config?.appId || !issueId) {
            return false;
        }
        const url = `${apiBase}/projects/${config.projectId}/apps/${config.appId}/issues/${encodeURIComponent(issueId)}?updateMask=state`;
        const result = await fetchJson(url, token, JSON.stringify({ state }), 'PATCH');
        return result !== undefined;
    }
    catch {
        return false;
    }
}
function fetchJson(url, token, body, method) {
    return new Promise((resolve) => {
        const https = require('https');
        const parsed = new URL(url);
        const req = https.request({
            hostname: parsed.hostname, path: parsed.pathname + parsed.search,
            method: method ?? (body ? 'POST' : 'GET'), timeout: crashlytics_io_1.apiTimeout,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const status = res.statusCode ?? 0;
                if (status >= 400) {
                    const msg = (0, crashlytics_diagnostics_1.classifyHttpStatus)(status, data);
                    (0, crashlytics_diagnostics_1.logCrashlytics)('error', `HTTP ${status} from ${parsed.pathname}: ${msg}`);
                    lastApiDiagnostic = { step: 'api', errorType: 'http', message: msg, httpStatus: status, checkedAt: Date.now(), technicalDetails: data.slice(0, 300) };
                    resolve(undefined);
                    return;
                }
                try {
                    resolve(JSON.parse(data));
                }
                catch {
                    (0, crashlytics_diagnostics_1.logCrashlytics)('error', `Invalid JSON from ${parsed.pathname}: ${data.slice(0, 200)}`);
                    resolve(undefined);
                }
            });
        });
        req.on('error', (err) => {
            (0, crashlytics_diagnostics_1.logCrashlytics)('error', `Network error for ${parsed.pathname}: ${err.message}`);
            lastApiDiagnostic = { step: 'api', errorType: 'network', message: `Network error: ${err.message}`, checkedAt: Date.now() };
            resolve(undefined);
        });
        req.on('timeout', () => {
            (0, crashlytics_diagnostics_1.logCrashlytics)('error', `Request timeout for ${parsed.pathname}`);
            lastApiDiagnostic = { step: 'api', errorType: 'timeout', message: 'Request timed out', checkedAt: Date.now() };
            req.destroy();
            resolve(undefined);
        });
        if (body) {
            req.write(body);
        }
        req.end();
    });
}
/** Fetch crash events for a specific issue, returning the first event detail. */
async function getCrashEventDetail(token, config, issueId) {
    const multi = await getCrashEvents(token, config, issueId);
    return multi?.events[multi.currentIndex];
}
/** Fetch multiple crash events for an issue (cached). */
async function getCrashEvents(token, config, issueId) {
    const cached = await (0, crashlytics_io_1.readCachedEvents)(issueId);
    if (cached) {
        return cached;
    }
    const url = `${apiBase}/projects/${config.projectId}/apps/${config.appId}/issues/${issueId}/events?pageSize=5`;
    const data = await fetchJson(url, token);
    if (!data) {
        return undefined;
    }
    const events = parseMultipleEvents(issueId, data);
    if (events.length === 0) {
        return undefined;
    }
    const result = { issueId, events, currentIndex: 0 };
    (0, crashlytics_io_1.writeCacheEvents)(issueId, result).catch(() => { });
    return result;
}
function parseMultipleEvents(issueId, data) {
    const raw = data.events ?? data.crashEvents;
    if (!Array.isArray(raw) || raw.length === 0) {
        const single = (0, crashlytics_event_parser_1.parseEventResponse)(issueId, data);
        return single ? [single] : [];
    }
    return raw.map((_, i) => (0, crashlytics_event_parser_1.parseEventResponse)(issueId, { events: [raw[i]] })).filter((e) => e !== undefined);
}
//# sourceMappingURL=crashlytics-api.js.map