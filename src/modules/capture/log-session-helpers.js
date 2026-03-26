"use strict";
/**
 * Helper functions and types for LogSession.
 *
 * Contains the SessionContext interface and pure functions for
 * filename generation, line formatting, and context header creation.
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
exports.formatDateFolder = formatDateFolder;
exports.generateBaseFileName = generateBaseFileName;
exports.formatLine = formatLine;
exports.formatTimestamp = formatTimestamp;
exports.generateContinuationHeader = generateContinuationHeader;
exports.generateContextHeader = generateContextHeader;
exports.getLogDirUri = getLogDirUri;
exports.computeElapsed = computeElapsed;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const config_1 = require("../config/config");
const file_splitter_1 = require("../misc/file-splitter");
/** Format a date as yyyymmdd for use as a subfolder name. */
function formatDateFolder(date) {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${mo}${d}`;
}
/** Generate base filename without .log extension (for split naming). */
function generateBaseFileName(projectName, date) {
    const dateStr = formatDateFolder(date);
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${dateStr}_${h}${mi}${s}_${safeName}`;
}
/** Format a log line with optional timestamp, elapsed time, category, and source. */
function formatLine(text, category, ctx) {
    const parts = [];
    if (ctx.includeTimestamp) {
        parts.push(`[${formatTimestamp(ctx.timestamp)}]`);
    }
    if (ctx.includeElapsedTime && ctx.elapsedMs !== undefined) {
        parts.push(`[${formatElapsedMs(ctx.elapsedMs)}]`);
    }
    parts.push(`[${category}]`);
    if (ctx.includeSourceLocation && ctx.sourceLocation?.path) {
        parts.push(`[${formatSourceLocation(ctx.sourceLocation)}]`);
    }
    parts.push(text);
    return parts.join(' ');
}
/** Format a Date as HH:MM:SS.mmm. */
function formatTimestamp(ts) {
    return ts.toTimeString().slice(0, 8) + '.' +
        String(ts.getMilliseconds()).padStart(3, '0');
}
/** Format source location as "filename:line" or "filename:line:col". */
function formatSourceLocation(loc) {
    const name = loc.path?.split(/[\\/]/).pop() ?? 'unknown';
    if (loc.line === undefined) {
        return name;
    }
    if (loc.column !== undefined && loc.column > 0) {
        return `${name}:${loc.line}:${loc.column}`;
    }
    return `${name}:${loc.line}`;
}
/** Format elapsed ms as "+Nms", "+N.Ns", or "+Ns". */
function formatElapsedMs(ms) {
    if (ms < 0) {
        return '+0ms';
    }
    if (ms < 1000) {
        return `+${ms}ms`;
    }
    if (ms < 10000) {
        return `+${(ms / 1000).toFixed(1)}s`;
    }
    return `+${Math.round(ms / 1000)}s`;
}
/** Generate a continuation header for split log files. */
function generateContinuationHeader(ctx, partNumber, reason, baseFileName) {
    const lines = [];
    lines.push(`=== SAROPA LOG CAPTURE — PART ${partNumber + 1} ===`);
    lines.push(`Continuation of: ${baseFileName}.log`);
    lines.push(`Split reason:    ${(0, file_splitter_1.formatSplitReason)(reason)}`);
    lines.push(`Date:            ${new Date().toISOString()}`);
    lines.push(`Project:         ${ctx.projectName}`);
    lines.push('==========================================');
    lines.push('');
    return lines.join('\n') + '\n';
}
/** Generate the context header block for the start of a log file. extraLines: from integration adapters, appended before divider. */
function generateContextHeader(ctx, config, extraLines) {
    const lines = [];
    lines.push('=== SAROPA LOG CAPTURE — SESSION START ===');
    lines.push(`Extension version: ${ctx.extensionVersion}`);
    lines.push(`Date:           ${ctx.date.toISOString()}`);
    lines.push(`Project:        ${ctx.projectName}`);
    lines.push(`Debug Adapter:  ${ctx.debugAdapterType}`);
    lines.push(`launch.json:    ${ctx.configurationName}`);
    appendLaunchConfig(lines, ctx.configuration, config.redactEnvVars);
    lines.push(`VS Code:        ${ctx.vscodeVersion}`);
    lines.push(`Extension:      saropa-log-capture v${ctx.extensionVersion}`);
    lines.push(`OS:             ${ctx.os}`);
    appendDevEnvironment(lines, ctx.devEnvironment);
    if (extraLines?.length) {
        for (const l of extraLines) {
            lines.push(l);
        }
    }
    lines.push('==========================================');
    lines.push('');
    return lines.join('\n') + '\n';
}
/** Append launch config properties to header lines, redacting env vars. */
function appendLaunchConfig(lines, configuration, redactPatterns) {
    const { type: _type, name: _name, request: _request, ...rest } = configuration;
    for (const [key, value] of Object.entries(rest)) {
        const padding = ' '.repeat(Math.max(1, 14 - key.length));
        if (key === 'env' && typeof value === 'object' && value !== null) {
            const redacted = redactEnv(value, redactPatterns);
            lines.push(`  ${key}:${padding}${JSON.stringify(redacted)}`);
        }
        else {
            lines.push(`  ${key}:${padding}${JSON.stringify(value)}`);
        }
    }
}
function appendDevEnvironment(lines, env) {
    if (!env) {
        return;
    }
    if (env.gitBranch) {
        lines.push(`Git Branch:     ${env.gitBranch}`);
    }
    if (env.gitCommit) {
        lines.push(`Git Commit:     ${env.gitCommit}${env.gitDirty ? ' (dirty)' : ''}`);
    }
    if (env.gitRemote) {
        lines.push(`Git Remote:     ${env.gitRemote}`);
    }
    lines.push(`Node:           ${env.nodeVersion}`);
    if (env.remoteName) {
        lines.push(`Remote:         ${env.remoteName}`);
    }
}
/** Redact sensitive env vars using patterns from config. */
function redactEnv(env, patterns) {
    if (patterns.length === 0) {
        return env;
    }
    const result = {};
    for (const [key, value] of Object.entries(env)) {
        result[key] = (0, config_1.shouldRedactEnvVar)(key, patterns) ? '***REDACTED***' : value;
    }
    return result;
}
/** Resolve the log directory URI for a session (date subfolder under config.logDirectory). */
function getLogDirUri(context, config) {
    const base = path.isAbsolute(config.logDirectory)
        ? vscode.Uri.file(config.logDirectory)
        : vscode.Uri.joinPath(context.workspaceFolder.uri, config.logDirectory);
    return vscode.Uri.joinPath(base, formatDateFolder(context.date));
}
/** Compute elapsed ms since previous line for optional [+Nms] in log lines. */
function computeElapsed(includeElapsedTime, previousTimestamp, current) {
    if (!includeElapsedTime || !previousTimestamp) {
        return undefined;
    }
    return current.getTime() - previousTimestamp.getTime();
}
//# sourceMappingURL=log-session-helpers.js.map