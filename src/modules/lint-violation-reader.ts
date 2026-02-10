/**
 * Reads and filters the Saropa Lints structured violation export.
 *
 * Looks for `reports/.saropa_lints/violations.json` in the workspace root.
 * Returns matched violations for files appearing in a stack trace, or
 * undefined if the file is missing, invalid, or has an incompatible schema.
 *
 * See: VIOLATION_EXPORT_API.md in the saropa_lints project.
 */

import * as vscode from 'vscode';
import type { StackFrame } from './bug-report-collector';

/** A single lint violation from the export. */
export interface LintViolation {
    readonly file: string;
    readonly line: number;
    readonly rule: string;
    readonly message: string;
    readonly correction?: string;
    readonly severity: string;
    readonly impact: string;
    readonly owasp: { readonly mobile: readonly string[]; readonly web: readonly string[] };
}

/** Matched lint data for inclusion in a bug report. */
export interface LintReportData {
    readonly matches: readonly LintViolation[];
    readonly totalInExport: number;
    readonly tier: string;
    readonly version?: string;
    readonly timestamp: string;
    readonly isStale: boolean;
}

const staleThresholdMs = 24 * 60 * 60 * 1000;
const impactOrder = ['critical', 'high', 'medium', 'low', 'opinionated'];

/** Find lint violations matching files in a stack trace. */
export async function findLintMatches(
    stackTrace: readonly StackFrame[], wsRoot: vscode.Uri,
): Promise<LintReportData | undefined> {
    const raw = await readExportFile(wsRoot);
    if (!raw) { return undefined; }
    if (!isCompatibleSchema(raw.schema)) {
        console.warn(`[Saropa] Unsupported lint export schema "${raw.schema}" — expected major version 1`);
        return undefined;
    }

    const stackFiles = collectStackFiles(stackTrace, wsRoot);
    if (stackFiles.size === 0) { return undefined; }

    const fileIndex: Record<string, number> = raw.summary?.issuesByFile ?? {};
    const relevantFiles = filterRelevantFiles(stackFiles, fileIndex);
    if (relevantFiles.size === 0) {
        return buildResult([], raw);
    }

    const matches = filterAndSort(raw.violations ?? [], relevantFiles, stackTrace);
    return buildResult(matches, raw);
}

interface RawExport {
    readonly schema?: string;
    readonly version?: string;
    readonly timestamp?: string;
    readonly config?: { readonly tier?: string };
    readonly summary?: { readonly totalViolations?: number; readonly issuesByFile?: Record<string, number> };
    readonly violations?: readonly RawViolation[];
}

interface RawViolation {
    readonly file?: string;
    readonly line?: number;
    readonly rule?: string;
    readonly message?: string;
    readonly correction?: string;
    readonly severity?: string;
    readonly impact?: string;
    readonly owasp?: { readonly mobile?: readonly string[]; readonly web?: readonly string[] };
}

async function readExportFile(wsRoot: vscode.Uri): Promise<RawExport | undefined> {
    const uri = vscode.Uri.joinPath(wsRoot, 'reports', '.saropa_lints', 'violations.json');
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        return JSON.parse(Buffer.from(data).toString('utf-8')) as RawExport;
    } catch { return undefined; }
}

function isCompatibleSchema(schema: unknown): boolean {
    if (typeof schema !== 'string') { return false; }
    const major = parseInt(schema.split('.')[0], 10);
    return major === 1;
}

/** Collect unique relative forward-slash file paths from app stack frames. */
function collectStackFiles(frames: readonly StackFrame[], wsRoot: vscode.Uri): Set<string> {
    const files = new Set<string>();
    for (const f of frames) {
        if (!f.isApp || !f.sourceRef) { continue; }
        const rel = toRelativeForwardSlash(f.sourceRef.filePath, wsRoot);
        if (rel) { files.add(rel.toLowerCase()); }
    }
    return files;
}

function toRelativeForwardSlash(filePath: string, wsRoot: vscode.Uri): string | undefined {
    if (/^[A-Za-z]:[\\/]|^\//.test(filePath)) {
        const uri = vscode.Uri.file(filePath);
        const rel = vscode.workspace.asRelativePath(uri, false);
        return rel.replace(/\\/g, '/');
    }
    return filePath.replace(/\\/g, '/');
}

/** Pre-filter: only keep stack files that have at least one violation. */
function filterRelevantFiles(stackFiles: Set<string>, fileIndex: Record<string, number>): Set<string> {
    const result = new Set<string>();
    for (const sf of stackFiles) {
        for (const key of Object.keys(fileIndex)) {
            if (key.toLowerCase() === sf && (fileIndex[key] ?? 0) > 0) {
                result.add(sf);
            }
        }
    }
    return result;
}

function filterAndSort(
    violations: readonly RawViolation[], relevantFiles: Set<string>,
    frames: readonly StackFrame[],
): LintViolation[] {
    const frameLines = buildFrameLineMap(frames);
    const matched: LintViolation[] = [];
    for (const v of violations) {
        if (!v.file || !v.rule || !v.message) { continue; }
        if (!relevantFiles.has(v.file.toLowerCase())) { continue; }
        matched.push({
            file: v.file, line: v.line ?? 0, rule: v.rule,
            message: stripRulePrefix(v.message, v.rule),
            correction: v.correction, severity: v.severity ?? 'info',
            impact: v.impact ?? 'low',
            owasp: { mobile: v.owasp?.mobile ?? [], web: v.owasp?.web ?? [] },
        });
    }
    matched.sort((a, b) => compareViolations(a, b, frameLines));
    return matched;
}

/** Strip the conventional `[rule_name] ` prefix from messages. */
function stripRulePrefix(message: string, rule: string): string {
    const prefix = `[${rule}] `;
    return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

function compareViolations(
    a: LintViolation, b: LintViolation, frameLines: Map<string, number[]>,
): number {
    const impactCmp = (impactOrder.indexOf(a.impact) >>> 0) - (impactOrder.indexOf(b.impact) >>> 0);
    if (impactCmp !== 0) { return impactCmp; }
    const fileCmp = a.file.localeCompare(b.file, undefined, { sensitivity: 'accent' });
    if (fileCmp !== 0) { return fileCmp; }
    const aProx = proximity(a, frameLines);
    const bProx = proximity(b, frameLines);
    return aProx - bProx;
}

function proximity(v: LintViolation, frameLines: Map<string, number[]>): number {
    const lines = frameLines.get(v.file.toLowerCase());
    if (!lines?.length) { return v.line; }
    return Math.min(...lines.map(fl => Math.abs(v.line - fl)));
}

function buildFrameLineMap(frames: readonly StackFrame[]): Map<string, number[]> {
    const map = new Map<string, number[]>();
    for (const f of frames) {
        if (!f.sourceRef) { continue; }
        const key = f.sourceRef.filePath.replace(/\\/g, '/').toLowerCase();
        const arr = map.get(key) ?? [];
        arr.push(f.sourceRef.line);
        map.set(key, arr);
    }
    return map;
}

function buildResult(matches: LintViolation[], raw: RawExport): LintReportData {
    const ts = raw.timestamp ?? '';
    const exportTime = Date.parse(ts);
    const isStale = isNaN(exportTime) || (Date.now() - exportTime) > staleThresholdMs;
    return {
        matches,
        totalInExport: raw.summary?.totalViolations ?? 0,
        tier: raw.config?.tier ?? 'unknown',
        version: raw.version,
        timestamp: ts,
        isStale,
    };
}
