/**
 * Reads and filters the Saropa Lints structured violation export.
 *
 * When the Saropa Lints extension is installed and exposes an API, uses
 * getViolationsData() for the current workspace; otherwise reads
 * `reports/.saropa_lints/violations.json` from the workspace root.
 * Returns matched violations for files appearing in a stack trace, or
 * undefined if the file is missing, invalid, or has an incompatible schema.
 *
 * See: VIOLATION_EXPORT_API.md in the saropa_lints project.
 */

import * as vscode from 'vscode';
import type { StackFrame } from '../bug-report/bug-report-collector';
import { SAROPA_LINTS_EXTENSION_ID, type SaropaLintsApi } from './saropa-lints-api';
import { detectExtension, readExportFile, type RawExport, type RawViolation } from './lint-violation-reader-io';

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
    /** True if the Saropa Lints VS Code extension has been used in this workspace. */
    readonly hasExtension: boolean;
    /** Number of files analyzed in the lint run (for health score). */
    readonly filesAnalyzed: number;
    /** Violation counts by impact level (for health score). */
    readonly byImpact: Record<string, number>;
}

/** Same threshold as Phase 3 staleness prompt (24h initial release). */
export const LINT_EXPORT_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const impactOrder = ['critical', 'high', 'medium', 'low', 'opinionated'];

/** Minimal stack frame shape for collecting workspace-relative paths (avoids circular imports). */
export interface LintStackPathFrame {
    readonly isApp: boolean;
    readonly sourceRef?: { readonly filePath: string };
}

/** True if export timestamp is missing or older than {@link LINT_EXPORT_STALE_THRESHOLD_MS}. */
export function isLintExportTimestampStale(timestamp: string, nowMs: number = Date.now()): boolean {
    const exportTime = Date.parse(timestamp);
    if (Number.isNaN(exportTime)) { return true; }
    return (nowMs - exportTime) > LINT_EXPORT_STALE_THRESHOLD_MS;
}

/**
 * Snapshot of violations export for refresh prompt (same source as findLintMatches: API then file).
 * Undefined when no export exists.
 */
export async function getLintViolationsExportSnapshot(wsRoot: vscode.Uri): Promise<{ timestamp: string } | undefined> {
    const raw = await getRawExport(wsRoot);
    if (!raw) { return undefined; }
    return { timestamp: raw.timestamp ?? '' };
}

/**
 * Workspace-relative forward-slash paths from app stack frames (for dart analyze file list).
 * Deduped; capped at maxFiles (default 50) per CLI length risk in integration plan.
 */
export function collectAppStackRelativePaths(frames: readonly LintStackPathFrame[], maxFiles = 50): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const f of frames) {
        if (!f.isApp || !f.sourceRef) { continue; }
        const rel = toRelativeForwardSlash(f.sourceRef.filePath);
        if (!rel) { continue; }
        const key = rel.toLowerCase();
        if (seen.has(key)) { continue; }
        seen.add(key);
        out.push(rel);
        if (out.length >= maxFiles) { break; }
    }
    return out;
}

/** Find lint violations matching files in a stack trace. */
export async function findLintMatches(
    stackTrace: readonly StackFrame[], wsRoot: vscode.Uri,
): Promise<LintReportData | undefined> {
    const raw = await getRawExport(wsRoot);
    if (!raw) { return undefined; }
    if (!isCompatibleSchema(raw.schema)) {
        console.warn(`[Saropa] Unsupported lint export schema "${raw.schema}" — expected major version 1`);
        return undefined;
    }

    const stackFiles = collectStackFiles(stackTrace);
    if (stackFiles.size === 0) { return undefined; }

    const usedApi = raw.source === 'api';
    const hasExt = usedApi ? true : await detectExtension(wsRoot);
    const fileIndex: Record<string, number> = raw.summary?.issuesByFile ?? {};
    const relevantFiles = filterRelevantFiles(stackFiles, fileIndex);
    if (relevantFiles.size === 0) {
        return buildResult([], raw, hasExt);
    }

    const matches = filterAndSort(raw.violations ?? [], relevantFiles, stackTrace);
    return buildResult(matches, raw, hasExt);
}

/**
 * Get raw violations export: try Saropa Lints extension API first (sync, in-memory);
 * on null or throw, fall back to reading reports/.saropa_lints/violations.json from wsRoot.
 */
async function getRawExport(wsRoot: vscode.Uri): Promise<(RawExport & { source?: 'api' | 'file' }) | undefined> {
    const api = getSaropaLintsApi();
    if (api) {
        try {
            const data = api.getViolationsData();
            if (data && typeof data === 'object') {
                return {
                    schema: data.schema,
                    version: data.version,
                    timestamp: data.timestamp,
                    config: data.config,
                    summary: data.summary,
                    violations: data.violations,
                    source: 'api' as const,
                };
            }
        } catch {
            /* fall through to file read */
        }
    }
    const fileData = await readExportFile(wsRoot);
    return fileData ? { ...fileData, source: 'file' } : undefined;
}

/** Get Saropa Lints API from the extension if installed and exposing the API. */
function getSaropaLintsApi(): SaropaLintsApi | undefined {
    const ext = vscode.extensions.getExtension<SaropaLintsApi>(SAROPA_LINTS_EXTENSION_ID);
    if (!ext?.exports || typeof ext.exports.getViolationsData !== 'function') { return undefined; }
    return ext.exports;
}


function isCompatibleSchema(schema: unknown): boolean {
    if (typeof schema !== 'string') { return false; }
    const major = Number.parseInt(schema.split('.')[0], 10);
    return major === 1;
}

/** Collect unique relative forward-slash file paths from app stack frames. */
function collectStackFiles(frames: readonly StackFrame[]): Set<string> {
    const files = new Set<string>();
    for (const f of frames) {
        if (!f.isApp || !f.sourceRef) { continue; }
        const rel = toRelativeForwardSlash(f.sourceRef.filePath);
        if (rel) { files.add(rel.toLowerCase()); }
    }
    return files;
}

function toRelativeForwardSlash(filePath: string): string | undefined {
    if (/^[A-Za-z]:[\\/]|^\//.test(filePath)) {
        const uri = vscode.Uri.file(filePath);
        const rel = vscode.workspace.asRelativePath(uri, false);
        return rel.replaceAll('\\', '/');
    }
    return filePath.replaceAll('\\', '/');
}

/** Pre-filter: only keep stack files that have at least one violation. */
function filterRelevantFiles(stackFiles: Set<string>, fileIndex: Record<string, number>): Set<string> {
    const lowered = new Map<string, number>();
    for (const key of Object.keys(fileIndex)) { lowered.set(key.toLowerCase(), fileIndex[key] ?? 0); }
    const result = new Set<string>();
    for (const sf of stackFiles) {
        if ((lowered.get(sf) ?? 0) > 0) { result.add(sf); }
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
        const key = f.sourceRef.filePath.replaceAll('\\', '/').toLowerCase();
        const arr = map.get(key) ?? [];
        arr.push(f.sourceRef.line);
        map.set(key, arr);
    }
    return map;
}

function buildResult(matches: LintViolation[], raw: RawExport, hasExtension: boolean): LintReportData {
    const ts = raw.timestamp ?? '';
    const isStale = isLintExportTimestampStale(ts);
    return {
        matches,
        totalInExport: raw.summary?.totalViolations ?? 0,
        tier: raw.config?.tier ?? 'unknown',
        version: raw.version,
        timestamp: ts,
        isStale,
        hasExtension,
        filesAnalyzed: raw.summary?.filesAnalyzed ?? 0,
        byImpact: raw.summary?.byImpact ?? {},
    };
}
