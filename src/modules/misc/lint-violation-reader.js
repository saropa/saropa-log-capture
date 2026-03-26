"use strict";
/**
 * Reads and filters the Saropa Lints structured violation export.
 *
 * When the Saropa Lints extension is installed and exposes an API, uses
 * getViolationsData() for the current workspace; otherwise reads
 * `reports/.saropa_lints/violations.json` from the workspace root.
 * Returns matched violations for files appearing in a stack trace, or
 * undefined if the file is missing, invalid, or has an incompatible schema.
 *
 * See: VIOLATION_EXPORT_API.md in the saropa_lints project.
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
exports.LINT_EXPORT_STALE_THRESHOLD_MS = void 0;
exports.isLintExportTimestampStale = isLintExportTimestampStale;
exports.getLintViolationsExportSnapshot = getLintViolationsExportSnapshot;
exports.collectAppStackRelativePaths = collectAppStackRelativePaths;
exports.findLintMatches = findLintMatches;
const vscode = __importStar(require("vscode"));
const saropa_lints_api_1 = require("./saropa-lints-api");
const lint_violation_reader_io_1 = require("./lint-violation-reader-io");
/** Same threshold as Phase 3 staleness prompt (24h initial release). */
exports.LINT_EXPORT_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const impactOrder = ['critical', 'high', 'medium', 'low', 'opinionated'];
/** True if export timestamp is missing or older than {@link LINT_EXPORT_STALE_THRESHOLD_MS}. */
function isLintExportTimestampStale(timestamp, nowMs = Date.now()) {
    const exportTime = Date.parse(timestamp);
    if (Number.isNaN(exportTime)) {
        return true;
    }
    return (nowMs - exportTime) > exports.LINT_EXPORT_STALE_THRESHOLD_MS;
}
/**
 * Snapshot of violations export for refresh prompt (same source as findLintMatches: API then file).
 * Undefined when no export exists.
 */
async function getLintViolationsExportSnapshot(wsRoot) {
    const raw = await getRawExport(wsRoot);
    if (!raw) {
        return undefined;
    }
    return { timestamp: raw.timestamp ?? '' };
}
/**
 * Workspace-relative forward-slash paths from app stack frames (for dart analyze file list).
 * Deduped; capped at maxFiles (default 50) per CLI length risk in integration plan.
 */
function collectAppStackRelativePaths(frames, maxFiles = 50) {
    const seen = new Set();
    const out = [];
    for (const f of frames) {
        if (!f.isApp || !f.sourceRef) {
            continue;
        }
        const rel = toRelativeForwardSlash(f.sourceRef.filePath);
        if (!rel) {
            continue;
        }
        const key = rel.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        out.push(rel);
        if (out.length >= maxFiles) {
            break;
        }
    }
    return out;
}
/** Find lint violations matching files in a stack trace. */
async function findLintMatches(stackTrace, wsRoot) {
    const raw = await getRawExport(wsRoot);
    if (!raw) {
        return undefined;
    }
    if (!isCompatibleSchema(raw.schema)) {
        console.warn(`[Saropa] Unsupported lint export schema "${raw.schema}" — expected major version 1`);
        return undefined;
    }
    const stackFiles = collectStackFiles(stackTrace);
    if (stackFiles.size === 0) {
        return undefined;
    }
    const usedApi = raw.source === 'api';
    const hasExt = usedApi ? true : await (0, lint_violation_reader_io_1.detectExtension)(wsRoot);
    const fileIndex = raw.summary?.issuesByFile ?? {};
    const relevantFiles = filterRelevantFiles(stackFiles, fileIndex);
    if (relevantFiles.size === 0) {
        return buildResult([], raw, hasExt);
    }
    const matches = filterAndSort(raw.violations ?? [], relevantFiles, stackTrace);
    return buildResult(matches, raw, hasExt);
}
/**
 * Get raw violations export: try Saropa Lints extension API first (sync, in-memory);
 * on null or throw, fall back to reading reports/.saropa_lints/violations.json from wsRoot.
 */
async function getRawExport(wsRoot) {
    const api = getSaropaLintsApi();
    if (api) {
        try {
            const data = api.getViolationsData();
            if (data && typeof data === 'object') {
                return {
                    schema: data.schema,
                    version: data.version,
                    timestamp: data.timestamp,
                    config: data.config,
                    summary: data.summary,
                    violations: data.violations,
                    source: 'api',
                };
            }
        }
        catch {
            /* fall through to file read */
        }
    }
    const fileData = await (0, lint_violation_reader_io_1.readExportFile)(wsRoot);
    return fileData ? { ...fileData, source: 'file' } : undefined;
}
/** Get Saropa Lints API from the extension if installed and exposing the API. */
function getSaropaLintsApi() {
    const ext = vscode.extensions.getExtension(saropa_lints_api_1.SAROPA_LINTS_EXTENSION_ID);
    if (!ext?.exports || typeof ext.exports.getViolationsData !== 'function') {
        return undefined;
    }
    return ext.exports;
}
function isCompatibleSchema(schema) {
    if (typeof schema !== 'string') {
        return false;
    }
    const major = Number.parseInt(schema.split('.')[0], 10);
    return major === 1;
}
/** Collect unique relative forward-slash file paths from app stack frames. */
function collectStackFiles(frames) {
    const files = new Set();
    for (const f of frames) {
        if (!f.isApp || !f.sourceRef) {
            continue;
        }
        const rel = toRelativeForwardSlash(f.sourceRef.filePath);
        if (rel) {
            files.add(rel.toLowerCase());
        }
    }
    return files;
}
function toRelativeForwardSlash(filePath) {
    if (/^[A-Za-z]:[\\/]|^\//.test(filePath)) {
        const uri = vscode.Uri.file(filePath);
        const rel = vscode.workspace.asRelativePath(uri, false);
        return rel.replaceAll('\\', '/');
    }
    return filePath.replaceAll('\\', '/');
}
/** Pre-filter: only keep stack files that have at least one violation. */
function filterRelevantFiles(stackFiles, fileIndex) {
    const lowered = new Map();
    for (const key of Object.keys(fileIndex)) {
        lowered.set(key.toLowerCase(), fileIndex[key] ?? 0);
    }
    const result = new Set();
    for (const sf of stackFiles) {
        if ((lowered.get(sf) ?? 0) > 0) {
            result.add(sf);
        }
    }
    return result;
}
function filterAndSort(violations, relevantFiles, frames) {
    const frameLines = buildFrameLineMap(frames);
    const matched = [];
    for (const v of violations) {
        if (!v.file || !v.rule || !v.message) {
            continue;
        }
        if (!relevantFiles.has(v.file.toLowerCase())) {
            continue;
        }
        matched.push({
            file: v.file, line: v.line ?? 0, rule: v.rule,
            message: stripRulePrefix(v.message, v.rule),
            correction: v.correction, severity: v.severity ?? 'info',
            impact: v.impact ?? 'low',
            owasp: { mobile: v.owasp?.mobile ?? [], web: v.owasp?.web ?? [] },
        });
    }
    matched.sort((a, b) => compareViolations(a, b, frameLines));
    return matched;
}
/** Strip the conventional `[rule_name] ` prefix from messages. */
function stripRulePrefix(message, rule) {
    const prefix = `[${rule}] `;
    return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}
function compareViolations(a, b, frameLines) {
    const impactCmp = (impactOrder.indexOf(a.impact) >>> 0) - (impactOrder.indexOf(b.impact) >>> 0);
    if (impactCmp !== 0) {
        return impactCmp;
    }
    const fileCmp = a.file.localeCompare(b.file, undefined, { sensitivity: 'accent' });
    if (fileCmp !== 0) {
        return fileCmp;
    }
    const aProx = proximity(a, frameLines);
    const bProx = proximity(b, frameLines);
    return aProx - bProx;
}
function proximity(v, frameLines) {
    const lines = frameLines.get(v.file.toLowerCase());
    if (!lines?.length) {
        return v.line;
    }
    return Math.min(...lines.map(fl => Math.abs(v.line - fl)));
}
function buildFrameLineMap(frames) {
    const map = new Map();
    for (const f of frames) {
        if (!f.sourceRef) {
            continue;
        }
        const key = f.sourceRef.filePath.replaceAll('\\', '/').toLowerCase();
        const arr = map.get(key) ?? [];
        arr.push(f.sourceRef.line);
        map.set(key, arr);
    }
    return map;
}
function buildResult(matches, raw, hasExtension) {
    const ts = raw.timestamp ?? '';
    const isStale = isLintExportTimestampStale(ts);
    return {
        matches,
        totalInExport: raw.summary?.totalViolations ?? 0,
        tier: raw.config?.tier ?? 'unknown',
        version: raw.version,
        timestamp: ts,
        isStale,
        hasExtension,
        filesAnalyzed: raw.summary?.filesAnalyzed ?? 0,
        byImpact: raw.summary?.byImpact ?? {},
    };
}
//# sourceMappingURL=lint-violation-reader.js.map