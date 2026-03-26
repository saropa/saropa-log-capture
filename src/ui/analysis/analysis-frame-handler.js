"use strict";
/** Frame extraction and analysis — separated from analysis-panel.ts for headroom. */
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
exports.extractFrames = extractFrames;
exports.analyzeFrame = analyzeFrame;
const vscode = __importStar(require("vscode"));
const stack_parser_1 = require("../../modules/analysis/stack-parser");
const source_linker_1 = require("../../modules/source/source-linker");
const workspace_analyzer_1 = require("../../modules/misc/workspace-analyzer");
const git_blame_1 = require("../../modules/git/git-blame");
const analysis_frame_render_1 = require("./analysis-frame-render");
const maxFrameScan = 30;
const separatorPattern = /^={10,}/;
/** Scan lines below the analyzed line for stack frames. */
async function extractFrames(fileUri, lineIndex) {
    if (!fileUri || lineIndex === undefined || lineIndex < 0) {
        return [];
    }
    try {
        const raw = await vscode.workspace.fs.readFile(fileUri);
        const lines = Buffer.from(raw).toString('utf-8').split('\n');
        let start = lineIndex + 1;
        while (start < lines.length && separatorPattern.test(lines[start].trim())) {
            start++;
        }
        const frames = [];
        const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        for (let i = start; i < lines.length && frames.length < maxFrameScan; i++) {
            if (!(0, stack_parser_1.isStackFrameLine)(lines[i])) {
                break;
            }
            const ref = (0, source_linker_1.extractSourceReference)(lines[i]);
            frames.push({ text: lines[i].trimEnd(), isApp: !(0, stack_parser_1.isFrameworkFrame)(lines[i], wsPath), sourceRef: ref ?? undefined });
        }
        return frames;
    }
    catch {
        return [];
    }
}
/** Run mini-analysis for a single stack frame and post the result. */
async function analyzeFrame(file, line, postResult) {
    try {
        const info = await (0, workspace_analyzer_1.analyzeSourceFile)(file, line);
        if (!info) {
            postResult(file, line, '<div class="no-matches">Source not found</div>');
            return;
        }
        const blame = await (0, git_blame_1.getGitBlame)(info.uri, line).catch(() => undefined);
        postResult(file, line, (0, analysis_frame_render_1.renderFrameAnalysis)(info, blame));
    }
    catch {
        postResult(file, line, '<div class="no-matches">Analysis failed</div>');
    }
}
//# sourceMappingURL=analysis-frame-handler.js.map