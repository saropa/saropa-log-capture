/** Frame extraction and analysis — separated from analysis-panel.ts for headroom. */

import * as vscode from 'vscode';
import { isStackFrameLine, isFrameworkFrame } from '../modules/stack-parser';
import { extractSourceReference } from '../modules/source-linker';
import { analyzeSourceFile } from '../modules/workspace-analyzer';
import { getGitBlame } from '../modules/git-blame';
import { type StackFrameInfo, renderFrameAnalysis } from './analysis-frame-render';

const maxFrameScan = 30;
const separatorPattern = /^={10,}/;

/** Scan lines below the analyzed line for stack frames. */
export async function extractFrames(fileUri?: vscode.Uri, lineIndex?: number): Promise<StackFrameInfo[]> {
    if (!fileUri || lineIndex === undefined || lineIndex < 0) { return []; }
    try {
        const raw = await vscode.workspace.fs.readFile(fileUri);
        const lines = Buffer.from(raw).toString('utf-8').split('\n');
        let start = lineIndex + 1;
        while (start < lines.length && separatorPattern.test(lines[start].trim())) { start++; }
        const frames: StackFrameInfo[] = [];
        const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        for (let i = start; i < lines.length && frames.length < maxFrameScan; i++) {
            if (!isStackFrameLine(lines[i])) { break; }
            const ref = extractSourceReference(lines[i]);
            frames.push({ text: lines[i].trimEnd(), isApp: !isFrameworkFrame(lines[i], wsPath), sourceRef: ref ?? undefined });
        }
        return frames;
    } catch { return []; }
}

type FrameResultFn = (file: string, line: number, html: string) => void;

/** Run mini-analysis for a single stack frame and post the result. */
export async function analyzeFrame(file: string, line: number, postResult: FrameResultFn): Promise<void> {
    try {
        const info = await analyzeSourceFile(file, line);
        if (!info) { postResult(file, line, '<div class="no-matches">Source not found</div>'); return; }
        const blame = await getGitBlame(info.uri, line).catch(() => undefined);
        postResult(file, line, renderFrameAnalysis(info, blame));
    } catch { postResult(file, line, '<div class="no-matches">Analysis failed</div>'); }
}
