"use strict";
/**
 * Git integration: adds git describe, uncommitted files summary, and stash count
 * to session header and meta; at session end optionally captures blame for file:line
 * references and resolves commit URLs (GitHub, GitLab, Bitbucket).
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
exports.gitSourceCodeProvider = void 0;
exports.getRemoteBaseUrl = getRemoteBaseUrl;
exports.getCommitUrl = getCommitUrl;
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const vscode = __importStar(require("vscode"));
const source_resolver_1 = require("../../source/source-resolver");
const git_blame_1 = require("../../git/git-blame");
const GIT_TIMEOUT_MS = 3000;
const MAX_UNCOMMITTED_PATHS = 10;
const LINE_HISTORY_CAP = 20;
const BLAME_TIMEOUT_MS = 2000;
function isEnabled(context) {
    const adapters = context.config.integrationsAdapters ?? [];
    return adapters.includes('git');
}
function runGitSync(cwd, args) {
    try {
        const out = (0, child_process_1.execSync)(`git ${args.join(' ')}`, {
            encoding: 'utf-8',
            cwd,
            timeout: GIT_TIMEOUT_MS,
            maxBuffer: 64 * 1024,
        });
        return typeof out === 'string' ? out.trim() : undefined;
    }
    catch {
        return undefined;
    }
}
function getDescribe(cwd) {
    return runGitSync(cwd, ['describe', '--tags', '--always']);
}
/** Short commit hash at HEAD (for first-seen regression hints). */
function getHeadCommit(cwd) {
    return runGitSync(cwd, ['rev-parse', '--short', 'HEAD']);
}
function getUncommittedPaths(cwd) {
    const out = runGitSync(cwd, ['status', '--porcelain']);
    if (!out) {
        return [];
    }
    return out.split('\n')
        .map(line => line.slice(3).trim())
        .filter(Boolean)
        .slice(0, MAX_UNCOMMITTED_PATHS);
}
function getStashCount(cwd) {
    const out = runGitSync(cwd, ['stash', 'list']);
    if (!out) {
        return 0;
    }
    return out.split('\n').filter(Boolean).length;
}
/** Run git blame for one line with a timeout. Returns raw --porcelain output or undefined. */
function runGitBlameWithTimeout(cwd, relPath, line) {
    return new Promise((resolve) => {
        (0, child_process_1.execFile)('git', ['blame', '-L', `${line},${line}`, '--porcelain', '--', relPath], { cwd, timeout: BLAME_TIMEOUT_MS, maxBuffer: 16 * 1024 }, (err, stdout) => {
            resolve(err ? undefined : (stdout ?? '').trim());
        });
    });
}
/** Parse remote URL (SSH or HTTPS) to base URL for commits. Handles GitHub, GitLab, Bitbucket. */
function parseRemoteBaseUrl(remote) {
    const trimmed = remote.trim();
    // git@host:owner/repo.git or git@host:group/subgroup/repo.git
    const sshMatch = /^git@([^:]+):(.+?)(?:\.git)?$/i.exec(trimmed);
    if (sshMatch) {
        const host = sshMatch[1];
        const path = sshMatch[2].replace(/\.git$/i, '');
        return `https://${host}/${path}`;
    }
    // https://github.com/owner/repo.git or https://gitlab.com/group/subgroup/repo
    const httpsMatch = /^https?:\/\/([^/]+)\/(.+?)(?:\.git)?\/?$/i.exec(trimmed);
    if (httpsMatch) {
        const host = httpsMatch[1];
        const path = httpsMatch[2].replace(/\.git$/i, '');
        return `https://${host}/${path}`;
    }
    return undefined;
}
/** Get the remote repository base URL (e.g. https://github.com/owner/repo). Used to build commit URLs without re-running git. */
function getRemoteBaseUrl(cwd) {
    return new Promise((resolve) => {
        (0, child_process_1.execFile)('git', ['remote', 'get-url', 'origin'], { cwd, timeout: 3000 }, (err, stdout) => {
            if (err || !stdout) {
                resolve(undefined);
                return;
            }
            resolve(parseRemoteBaseUrl(stdout.trim()));
        });
    });
}
/** Resolve a commit hash to a web URL (GitHub/GitLab/Bitbucket). Uses one git call per invocation; for many commits, call getRemoteBaseUrl once and append `/commit/{hash}`. */
async function getCommitUrl(cwd, hash) {
    if (!hash || hash === '0000000') {
        return undefined;
    }
    const base = await getRemoteBaseUrl(cwd);
    return base ? `${base}/commit/${hash}` : undefined;
}
/** Extract file:line references from log text (stack traces, etc.). Deduplicated and capped. */
function parseFileLineReferences(logText) {
    const seen = new Set();
    const out = [];
    const cap = LINE_HISTORY_CAP;
    // Dart: package:foo/bar.dart:42 or package:foo/bar.dart:42:5
    const dartRe = /package:([^:]+)\/([^\s:]+):(\d+)(?::\d+)?/g;
    let m;
    while (out.length < cap && (m = dartRe.exec(logText)) !== null) {
        const file = `package:${m[1]}/${m[2]}`;
        const line = parseInt(m[3], 10);
        const key = `${file}:${line}`;
        if (!seen.has(key) && !file.includes('://')) {
            seen.add(key);
            out.push({ file, line });
        }
    }
    // JS/TS/Java: at Foo (path/to/file.ts:10) or (path/to/file.ts:10:5)
    const atRe = /(?:at\s+[^(]+\(|\()([^)]+):(\d+)(?::\d+)?\)/g;
    while (out.length < cap && (m = atRe.exec(logText)) !== null) {
        const file = m[1].trim();
        const line = parseInt(m[2], 10);
        if (file.includes('://')) {
            continue;
        }
        const key = `${file}:${line}`;
        if (!seen.has(key)) {
            seen.add(key);
            out.push({ file, line });
        }
    }
    // Generic path with slash/backslash then :line (avoid URLs)
    const pathRe = /\b((?:[a-zA-Z]:)?[^\s:]*[\/\\][^\s:]+):(\d+)(?::\d+)?\b/g;
    while (out.length < cap && (m = pathRe.exec(logText)) !== null) {
        const file = m[1].trim();
        if (file.includes('://')) {
            continue;
        }
        const line = parseInt(m[2], 10);
        const key = `${file}:${line}`;
        if (!seen.has(key)) {
            seen.add(key);
            out.push({ file, line });
        }
    }
    return out;
}
exports.gitSourceCodeProvider = {
    id: 'git',
    isEnabled(context) {
        return isEnabled(context);
    },
    onSessionStartSync(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const cwd = context.workspaceFolder.uri.fsPath;
        const { describeInHeader, uncommittedInHeader, stashInHeader } = context.config.integrationsGit;
        const lines = [];
        const payload = {};
        if (describeInHeader) {
            const describe = getDescribe(cwd);
            if (describe) {
                lines.push(`Git describe:   ${describe}`);
                payload.describe = describe;
            }
        }
        const headCommit = getHeadCommit(cwd);
        if (headCommit) {
            payload.commit = headCommit;
        }
        if (uncommittedInHeader) {
            const paths = getUncommittedPaths(cwd);
            const total = runGitSync(cwd, ['status', '--porcelain']);
            const count = total ? total.split('\n').filter(Boolean).length : 0;
            if (count > 0) {
                const summary = paths.length < count
                    ? `${paths.join(', ')} (+${count - paths.length} more)`
                    : paths.join(', ');
                lines.push(`Uncommitted:    ${count} file(s) — ${summary}`);
                payload.uncommittedCount = count;
                payload.uncommittedPaths = paths;
            }
        }
        if (stashInHeader) {
            const stashCount = getStashCount(cwd);
            if (stashCount > 0) {
                lines.push(`Stash:          ${stashCount} entries`);
                payload.stashCount = stashCount;
            }
        }
        if (lines.length === 0) {
            return undefined;
        }
        return [
            { kind: 'header', lines },
            { kind: 'meta', key: 'git', payload },
        ];
    },
    /** At session end: if includeLineHistoryInMeta is true, parse log for file:line refs, run blame (capped), store lineHistory in meta. Commit URLs resolved once per session when commitLinks is true. */
    async onSessionEnd(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const { includeLineHistoryInMeta, commitLinks } = context.config.integrationsGit;
        if (!includeLineHistoryInMeta) {
            return undefined;
        }
        const cwd = context.workspaceFolder.uri.fsPath;
        let logText;
        try {
            logText = fs.readFileSync(context.logUri.fsPath, 'utf-8');
        }
        catch {
            context.outputChannel.appendLine('[git] Could not read log file for line history.');
            return undefined;
        }
        const refs = parseFileLineReferences(logText);
        if (refs.length === 0) {
            return undefined;
        }
        // Resolve remote base URL once so we can build commit URLs without N git calls.
        const remoteBase = commitLinks ? await getRemoteBaseUrl(cwd) : undefined;
        const lineHistory = [];
        for (const { file, line } of refs) {
            const uri = (0, source_resolver_1.resolveSourceUri)(file);
            if (!uri) {
                continue;
            }
            const relPath = vscode.workspace.asRelativePath(uri, false);
            const raw = await runGitBlameWithTimeout(cwd, relPath, line);
            const blame = raw ? (0, git_blame_1.parsePorcelainBlame)(raw) : undefined;
            if (!blame) {
                continue;
            }
            const entry = {
                file,
                line,
                commit: blame.hash,
                author: blame.author,
                date: blame.date,
                summary: blame.message,
            };
            if (remoteBase) {
                entry.commitUrl = `${remoteBase}/commit/${blame.hash}`;
            }
            lineHistory.push(entry);
        }
        const describe = getDescribe(cwd);
        const commit = getHeadCommit(cwd);
        if (lineHistory.length === 0) {
            if (!describe && !commit) {
                return undefined;
            }
            return [{ kind: 'meta', key: 'git', payload: { describe, commit } }];
        }
        const payload = { lineHistory };
        if (describe) {
            payload.describe = describe;
        }
        if (commit) {
            payload.commit = commit;
        }
        return [{ kind: 'meta', key: 'git', payload }];
    },
};
//# sourceMappingURL=git-source-code.js.map