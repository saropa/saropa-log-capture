"use strict";
/**
 * Git commit diff summary.
 *
 * Fetches the --stat output for a commit to show which files changed
 * and how many lines were inserted/deleted.
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
exports.getCommitDiff = getCommitDiff;
const vscode = __importStar(require("vscode"));
const workspace_analyzer_1 = require("../misc/workspace-analyzer");
/** Get the diff stat summary for a commit. Returns undefined on error. */
async function getCommitDiff(hash) {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
        return undefined;
    }
    const raw = await (0, workspace_analyzer_1.runGitCommand)(['show', '--stat', '--format=', hash], root);
    if (!raw) {
        return undefined;
    }
    return parseStatOutput(hash, raw);
}
function parseStatOutput(hash, raw) {
    const lines = raw.split('\n').filter(Boolean);
    if (lines.length === 0) {
        return undefined;
    }
    const summaryLine = lines[lines.length - 1];
    const summaryMatch = /(\d+) files? changed/.exec(summaryLine);
    if (!summaryMatch) {
        return undefined;
    }
    const filesChanged = parseInt(summaryMatch[1], 10);
    const insMatch = /(\d+) insertions?\(\+\)/.exec(summaryLine);
    const delMatch = /(\d+) deletions?\(-\)/.exec(summaryLine);
    const insertions = insMatch ? parseInt(insMatch[1], 10) : 0;
    const deletions = delMatch ? parseInt(delMatch[1], 10) : 0;
    return { hash, filesChanged, insertions, deletions };
}
//# sourceMappingURL=git-diff.js.map