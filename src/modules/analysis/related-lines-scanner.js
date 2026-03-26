"use strict";
/** Scan a log file for lines sharing a source tag — builds the diagnostic group. */
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
exports.scanRelatedLines = scanRelatedLines;
const vscode = __importStar(require("vscode"));
const source_tag_parser_1 = require("../source/source-tag-parser");
const source_linker_1 = require("../source/source-linker");
const line_analyzer_1 = require("./line-analyzer");
const maxScanLines = 5000;
const maxRelatedLines = 200;
/** Scan a log file for all lines sharing the given source tag. */
async function scanRelatedLines(fileUri, sourceTag, _analyzedLineIndex) {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const allLines = Buffer.from(raw).toString('utf-8').split('\n');
    const scanLimit = Math.min(allLines.length, maxScanLines);
    const lines = [];
    const fileSet = new Set();
    for (let i = 0; i < scanLimit && lines.length < maxRelatedLines; i++) {
        const tag = (0, source_tag_parser_1.parseSourceTag)(allLines[i]);
        if (tag !== sourceTag) {
            continue;
        }
        const ref = (0, source_linker_1.extractSourceReference)(allLines[i]);
        const sourceRef = ref ? { file: ref.filePath.replace(/\\/g, '/').split('/').pop() ?? ref.filePath, line: ref.line } : undefined;
        if (sourceRef) {
            fileSet.add(sourceRef.file);
        }
        lines.push({ lineIndex: i, text: allLines[i].trimEnd(), sourceRef });
    }
    const enhancedTokens = extractGroupTokens(lines);
    return { tag: sourceTag, lines, uniqueFiles: [...fileSet], enhancedTokens };
}
/** Extract deduplicated tokens from all related lines. */
function extractGroupTokens(lines) {
    const seen = new Set();
    const tokens = [];
    for (const line of lines) {
        for (const t of (0, line_analyzer_1.extractAnalysisTokens)(line.text)) {
            const key = `${t.type}:${t.value}`;
            if (!seen.has(key)) {
                seen.add(key);
                tokens.push(t);
            }
        }
    }
    return tokens;
}
//# sourceMappingURL=related-lines-scanner.js.map