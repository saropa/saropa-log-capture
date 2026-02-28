/**
 * Correlation scanner: extract semantic tags from log file content.
 *
 * Scans a log file for source file references and error class names,
 * returning frequency-ranked tags like `file:handler.dart` or `error:SocketException`.
 */

import * as vscode from 'vscode';
import { extractAnalysisTokens, type AnalysisToken } from './line-analyzer';

const maxScanLines = 5000;
const maxTags = 20;
const correlationTypes: ReadonlySet<AnalysisToken['type']> = new Set(['source-file', 'error-class']);

/** Scan a log file and return frequency-ranked correlation tags. */
export async function scanForCorrelationTags(fileUri: vscode.Uri): Promise<string[]> {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');
    const scanLimit = Math.min(lines.length, maxScanLines);
    const freq = new Map<string, number>();
    for (let i = 0; i < scanLimit; i++) { collectTokens(lines[i], freq); }
    return rankTags(freq);
}

/** Extract correlation tokens from a line and update frequency map. */
function collectTokens(line: string, freq: Map<string, number>): void {
    for (const token of extractAnalysisTokens(line)) {
        if (!correlationTypes.has(token.type)) { continue; }
        const prefix = token.type === 'source-file' ? 'file' : 'error';
        const tag = `${prefix}:${token.value}`;
        freq.set(tag, (freq.get(tag) ?? 0) + 1);
    }
}

/** Sort tags by frequency descending, return top N sorted alphabetically. */
function rankTags(freq: Map<string, number>): string[] {
    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxTags)
        .map(([tag]) => tag)
        .sort();
}
