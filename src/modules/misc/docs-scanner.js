"use strict";
/** Project documentation scanner — finds references to analysis tokens in markdown files. */
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
exports.scanDocsForTokens = scanDocsForTokens;
const vscode = __importStar(require("vscode"));
const config_1 = require("../config/config");
const project_indexer_1 = require("../project-indexer/project-indexer");
const maxFiles = 50;
const maxMatchesTotal = 100;
const maxMatchesPerFile = 20;
/** Scan project docs for references to extracted tokens. Uses project index when enabled to only read matching files. */
async function scanDocsForTokens(tokens, workspaceFolder) {
    if (tokens.length === 0) {
        return { matches: [], filesScanned: 0 };
    }
    const lowerTokens = tokens.map(t => t.toLowerCase());
    const cfg = (0, config_1.getConfig)().projectIndex;
    let urisToScan;
    const entryByUri = new Map();
    if (cfg.enabled) {
        const indexer = (0, project_indexer_1.getGlobalProjectIndexer)();
        if (indexer) {
            await indexer.getOrRebuild(60_000);
            const docEntries = indexer.queryDocEntriesByTokens([...tokens]);
            for (const e of docEntries) {
                entryByUri.set(e.uri, e);
            }
            urisToScan = docEntries.length > 0
                ? docEntries.slice(0, maxFiles).map((e) => vscode.Uri.parse(e.uri))
                : await collectMarkdownFiles(workspaceFolder);
        }
        else {
            urisToScan = await collectMarkdownFiles(workspaceFolder);
        }
    }
    else {
        urisToScan = await collectMarkdownFiles(workspaceFolder);
    }
    if (urisToScan.length === 0) {
        return { matches: [], filesScanned: 0 };
    }
    const matches = [];
    const allFileMatches = await Promise.all(urisToScan.slice(0, maxFiles).map((uri) => {
        const entry = entryByUri.get(uri.toString());
        const headingForLine = entry?.headings?.length
            ? (line) => headingAtLine(entry.headings, line)
            : undefined;
        return searchFileForTokens(uri, lowerTokens, tokens, headingForLine);
    }));
    for (const fileMatches of allFileMatches) {
        if (matches.length >= maxMatchesTotal) {
            break;
        }
        matches.push(...fileMatches.slice(0, maxMatchesPerFile));
    }
    return { matches: matches.slice(0, maxMatchesTotal), filesScanned: Math.min(urisToScan.length, maxFiles) };
}
function headingAtLine(headings, line) {
    let best = '';
    for (const h of headings) {
        if (h.line <= line) {
            best = (h.level === 1 ? '#' : h.level === 2 ? '##' : '###') + ' ' + h.text;
        }
    }
    return best;
}
async function collectMarkdownFiles(folder) {
    const dirs = (0, config_1.getConfig)().docsScanDirs;
    const patterns = [];
    for (const dir of dirs) {
        patterns.push(`${dir}/**/*.md`);
    }
    patterns.push('*.md');
    const results = await Promise.all(patterns.map(p => vscode.workspace.findFiles(new vscode.RelativePattern(folder, p), '**/node_modules/**', maxFiles)));
    const seen = new Set();
    const uris = [];
    for (const batch of results) {
        for (const uri of batch) {
            const key = uri.toString();
            if (!seen.has(key)) {
                seen.add(key);
                uris.push(uri);
            }
        }
    }
    return uris;
}
async function searchFileForTokens(uri, lowerTokens, originalTokens, headingForLine) {
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const filename = uri.fsPath.split(/[\\/]/).pop() ?? '';
        const matches = [];
        for (let i = 0; i < doc.lineCount && matches.length < maxMatchesPerFile; i++) {
            const lineText = doc.lineAt(i).text;
            const lower = lineText.toLowerCase();
            const idx = lowerTokens.findIndex(t => lower.includes(t));
            if (idx >= 0) {
                const lineNumber = i + 1;
                const heading = headingForLine?.(lineNumber);
                matches.push({ uri, filename, lineNumber, lineText, matchedToken: originalTokens[idx], heading });
            }
        }
        return matches;
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=docs-scanner.js.map