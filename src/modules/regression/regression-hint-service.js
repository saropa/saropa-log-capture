"use strict";
/**
 * Regression hints: correlate errors with Git history for "Introduced in commit X".
 *
 * - Blame-based: git blame for file:line → "Last changed in commit X".
 * - First-seen: first session where error appeared → session's Git commit (from integration meta).
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
exports.getBlameHint = getBlameHint;
exports.getFirstSeenCommitForError = getFirstSeenCommitForError;
exports.getRegressionHintsForError = getRegressionHintsForError;
exports.getFirstSeenHintsForErrors = getFirstSeenHintsForErrors;
const vscode = __importStar(require("vscode"));
const git_blame_1 = require("../git/git-blame");
const git_source_code_1 = require("../integrations/providers/git-source-code");
const cross_session_aggregator_1 = require("../misc/cross-session-aggregator");
const config_1 = require("../config/config");
const metadata_loader_1 = require("../session/metadata-loader");
const session_metadata_1 = require("../session/session-metadata");
function normSession(s) {
    return s.replace(/\\/g, '/');
}
/**
 * Get blame for a source line and optional commit URL.
 * Runs async; use for analysis panel and error hover when file:line is known.
 */
async function getBlameHint(uri, line, options) {
    const blame = await (0, git_blame_1.getGitBlame)(uri, line).catch(() => undefined);
    if (!blame) {
        return undefined;
    }
    let commitUrl;
    if (options?.resolveCommitUrl) {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (cwd) {
            commitUrl = await (0, git_source_code_1.getCommitUrl)(cwd, blame.hash).catch(() => undefined);
        }
    }
    return {
        type: 'blame',
        hash: blame.hash,
        author: blame.author,
        date: blame.date,
        message: blame.message,
        commitUrl,
    };
}
/**
 * Get the commit (if any) for the first session where this error signature appeared.
 * Uses session metadata integrations.git.commit from the Git provider.
 */
async function getFirstSeenCommitForError(errorHash, options) {
    const aggregated = await (0, cross_session_aggregator_1.aggregateSignals)('all').catch(() => undefined);
    // Find matching error signal by fingerprint (raw hash for error-kind signals)
    const error = aggregated?.allSignals.find(s => s.kind === 'error' && s.fingerprint === errorHash);
    if (!error?.firstSeen) {
        return undefined;
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return undefined;
    }
    const logDir = (0, config_1.getLogDirectoryUri)(folder);
    const firstSeenNorm = normSession(error.firstSeen);
    const loaded = await (0, metadata_loader_1.loadMeta)(logDir, firstSeenNorm).catch(() => undefined);
    if (!loaded) {
        return undefined;
    }
    const gitPayload = loaded.meta.integrations?.git;
    const commit = typeof gitPayload?.commit === 'string' ? gitPayload.commit : undefined;
    if (!commit) {
        return undefined;
    }
    let commitUrl;
    if (options?.resolveCommitUrl) {
        commitUrl = await (0, git_source_code_1.getCommitUrl)(folder.uri.fsPath, commit).catch(() => undefined);
    }
    return {
        type: 'first-seen',
        hash: commit,
        session: error.firstSeen,
        commitUrl,
    };
}
/**
 * Get regression hints for an error: blame (if file:line given) and/or first-seen commit.
 */
async function getRegressionHintsForError(errorHash, options) {
    const resolve = options?.resolveCommitUrls ?? true;
    const [blame, firstSeen] = await Promise.all([
        options?.fileUri !== undefined && options?.fileUri !== null && options?.line !== undefined && options?.line !== null
            ? getBlameHint(options.fileUri, options.line, { resolveCommitUrl: resolve })
            : Promise.resolve(undefined),
        getFirstSeenCommitForError(errorHash, { resolveCommitUrl: resolve }),
    ]);
    return { blame, firstSeen };
}
/**
 * Batch first-seen commit hints for recurring errors (e.g. for Signal panel).
 * Loads session meta for first-seen sessions in parallel; caps count for performance.
 */
async function getFirstSeenHintsForErrors(errorHashes, options) {
    const cap = options?.cap ?? 15;
    const resolve = options?.resolveCommitUrls ?? true;
    const aggregated = await (0, cross_session_aggregator_1.aggregateSignals)('all').catch(() => undefined);
    if (!aggregated) {
        return {};
    }
    const toFetch = errorHashes.slice(0, cap).filter(h => {
        const err = aggregated.allSignals.find(s => s.kind === 'error' && s.fingerprint === h);
        return err?.firstSeen !== undefined && err?.firstSeen !== null;
    });
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return {};
    }
    const logDir = (0, config_1.getLogDirectoryUri)(folder);
    const store = new session_metadata_1.SessionMetadataStore();
    const remoteBase = resolve ? await (0, git_source_code_1.getRemoteBaseUrl)(folder.uri.fsPath).catch(() => undefined) : undefined;
    const entries = await Promise.all(toFetch.map(async (hash) => {
        const error = aggregated.allSignals.find(s => s.kind === 'error' && s.fingerprint === hash);
        if (!error?.firstSeen) {
            return undefined;
        }
        const firstSeenNorm = normSession(error.firstSeen);
        try {
            const uri = vscode.Uri.joinPath(logDir, firstSeenNorm);
            const meta = await store.loadMetadata(uri);
            const gitPayload = meta.integrations?.git;
            const commit = typeof gitPayload?.commit === 'string' ? gitPayload.commit : undefined;
            if (!commit) {
                return undefined;
            }
            return [
                hash,
                {
                    type: 'first-seen',
                    hash: commit,
                    session: error.firstSeen,
                    commitUrl: remoteBase ? `${remoteBase}/commit/${commit}` : undefined,
                },
            ];
        }
        catch {
            return undefined;
        }
    }));
    const result = {};
    for (const entry of entries) {
        if (entry) {
            result[entry[0]] = entry[1];
        }
    }
    return result;
}
//# sourceMappingURL=regression-hint-service.js.map