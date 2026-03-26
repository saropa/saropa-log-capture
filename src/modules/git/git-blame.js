"use strict";
/**
 * Git blame for a single line.
 *
 * Used by the analysis panel to show who last changed a crash line.
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
exports.getGitBlame = getGitBlame;
exports.parsePorcelainBlame = parsePorcelainBlame;
const vscode = __importStar(require("vscode"));
const workspace_analyzer_1 = require("../misc/workspace-analyzer");
/** Get git blame for a specific line. Returns undefined on error or uncommitted lines. */
async function getGitBlame(uri, line) {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root || line < 1) {
        return undefined;
    }
    const relPath = vscode.workspace.asRelativePath(uri, false);
    const raw = await (0, workspace_analyzer_1.runGitCommand)(['blame', '-L', `${line},${line}`, '--porcelain', '--', relPath], root);
    if (!raw) {
        return undefined;
    }
    return parsePorcelainBlame(raw);
}
/** Parse git blame --porcelain output. Exported for use by git provider. */
function parsePorcelainBlame(raw) {
    const lines = raw.split('\n');
    if (lines.length === 0) {
        return undefined;
    }
    const hashMatch = /^([0-9a-f]{40})/.exec(lines[0]);
    if (!hashMatch) {
        return undefined;
    }
    const hash = hashMatch[1].slice(0, 7);
    if (hash === '0000000') {
        return undefined;
    }
    let author = '';
    let date = '';
    let message = '';
    for (const l of lines) {
        if (l.startsWith('author ')) {
            author = l.slice(7);
        }
        else if (l.startsWith('author-time ')) {
            const epoch = parseInt(l.slice(12), 10);
            if (!isNaN(epoch)) {
                date = new Date(epoch * 1000).toISOString().slice(0, 10);
            }
        }
        else if (l.startsWith('summary ')) {
            message = l.slice(8);
        }
    }
    return { hash, author, date, message };
}
//# sourceMappingURL=git-blame.js.map