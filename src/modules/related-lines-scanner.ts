/** Scan a log file for lines sharing a source tag — builds the diagnostic group. */

import * as vscode from 'vscode';
import { parseSourceTag } from './source-tag-parser';
import { extractSourceReference } from './source-linker';
import { type AnalysisToken, extractAnalysisTokens } from './line-analyzer';

/** A single line belonging to the related-lines group. */
export interface RelatedLine {
    readonly lineIndex: number;
    readonly text: string;
    readonly sourceRef?: { readonly file: string; readonly line: number };
}

/** Result of scanning a log file for lines matching a source tag. */
export interface RelatedLinesResult {
    readonly tag: string;
    readonly lines: readonly RelatedLine[];
    readonly uniqueFiles: readonly string[];
    readonly enhancedTokens: readonly AnalysisToken[];
}

const maxScanLines = 5000;
const maxRelatedLines = 200;

/** Scan a log file for all lines sharing the given source tag. */
export async function scanRelatedLines(fileUri: vscode.Uri, sourceTag: string, analyzedLineIndex: number): Promise<RelatedLinesResult> {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const allLines = Buffer.from(raw).toString('utf-8').split('\n');
    const scanLimit = Math.min(allLines.length, maxScanLines);
    const lines: RelatedLine[] = [];
    const fileSet = new Set<string>();
    for (let i = 0; i < scanLimit && lines.length < maxRelatedLines; i++) {
        const tag = parseSourceTag(allLines[i]);
        if (tag !== sourceTag) { continue; }
        const ref = extractSourceReference(allLines[i]);
        const sourceRef = ref ? { file: ref.filePath.replace(/\\/g, '/').split('/').pop() ?? ref.filePath, line: ref.line } : undefined;
        if (sourceRef) { fileSet.add(sourceRef.file); }
        lines.push({ lineIndex: i, text: allLines[i].trimEnd(), sourceRef });
    }
    const enhancedTokens = extractGroupTokens(lines);
    return { tag: sourceTag, lines, uniqueFiles: [...fileSet], enhancedTokens };
}

/** Extract deduplicated tokens from all related lines. */
function extractGroupTokens(lines: readonly RelatedLine[]): AnalysisToken[] {
    const seen = new Set<string>();
    const tokens: AnalysisToken[] = [];
    for (const line of lines) {
        for (const t of extractAnalysisTokens(line.text)) {
            const key = `${t.type}:${t.value}`;
            if (!seen.has(key)) { seen.add(key); tokens.push(t); }
        }
    }
    return tokens;
}
