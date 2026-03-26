"use strict";
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
exports.exportToHtml = exportToHtml;
const vscode = __importStar(require("vscode"));
const ansi_1 = require("../capture/ansi");
const session_metadata_1 = require("../session/session-metadata");
/**
 * Export a .log file to a styled .html file alongside it.
 * Includes annotations from sidecar metadata if present.
 * Returns the URI of the generated HTML file.
 */
async function exportToHtml(logUri) {
    const raw = await vscode.workspace.fs.readFile(logUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');
    const { headerLines, bodyLines } = splitHeader(lines);
    const headerHtml = headerLines.map(l => (0, ansi_1.escapeHtml)(l)).join('\n');
    const store = new session_metadata_1.SessionMetadataStore();
    const annotations = await store.getAnnotations(logUri);
    const annotationMap = new Map(annotations.map(a => [a.lineIndex, a.text]));
    const bodyHtml = buildBodyWithAnnotations(bodyLines, annotationMap);
    const htmlPath = logUri.fsPath.replace(/\.log$/, '.html');
    const htmlUri = vscode.Uri.file(htmlPath);
    const content = buildHtmlDocument(headerHtml, bodyHtml);
    await vscode.workspace.fs.writeFile(htmlUri, Buffer.from(content, 'utf-8'));
    return htmlUri;
}
function buildBodyWithAnnotations(lines, annotations) {
    const parts = [];
    for (let i = 0; i < lines.length; i++) {
        parts.push((0, ansi_1.ansiToHtml)(lines[i]));
        const ann = annotations.get(i);
        if (ann) {
            parts.push(`<span class="annotation">[Note: ${(0, ansi_1.escapeHtml)(ann)}]</span>`);
        }
    }
    return parts.join('\n');
}
function splitHeader(lines) {
    const divider = lines.findIndex(l => l.startsWith('===================='));
    if (divider < 0) {
        return { headerLines: [], bodyLines: lines };
    }
    return {
        headerLines: lines.slice(0, divider + 1),
        bodyLines: lines.slice(divider + 1),
    };
}
function buildHtmlDocument(headerHtml, bodyHtml) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Saropa Log Capture</title>
<style>
body {
    background: #1e1e1e;
    color: #d4d4d4;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    margin: 0;
    padding: 16px;
    line-height: 1.5;
}
pre { margin: 0; white-space: pre-wrap; word-break: break-all; }
details { margin-bottom: 16px; }
summary {
    cursor: pointer;
    color: #569cd6;
    font-weight: bold;
    margin-bottom: 4px;
}
.header-block {
    background: #252526;
    border: 1px solid #3c3c3c;
    padding: 8px 12px;
    border-radius: 4px;
    color: #9cdcfe;
}
.body-block { padding: 0; }
.annotation { color: #6a9955; font-style: italic; }
</style>
</head>
<body>
<details open>
<summary>Session Context</summary>
<div class="header-block"><pre>${headerHtml}</pre></div>
</details>
<div class="body-block"><pre>${bodyHtml}</pre></div>
</body>
</html>`;
}
//# sourceMappingURL=html-export.js.map