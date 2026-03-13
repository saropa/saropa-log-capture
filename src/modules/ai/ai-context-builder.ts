/**
 * Build context for AI "Explain this error": error line, surrounding lines, stack trace, integration data.
 * Phase 2: stack trace extraction and integration data (perf, HTTP, terminal) from context-loader.
 */

import * as vscode from 'vscode';
import { findHeaderEnd, parseHeaderFields } from '../../ui/viewer/viewer-file-loader';
import { loadContextData, loadContextFromMeta } from '../context/context-loader';
import type { ContextWindow } from '../context/context-loader-types';
import { SessionMetadataStore } from '../session/session-metadata';

export interface AIContext {
    errorLine: string;
    lineIndex: number;
    surroundingLines: string[];
    stackTrace?: string;
    integrationData?: {
        performance?: { memory: string; cpu: string };
        http?: { url: string; status: number; duration: number }[];
        terminal?: string[];
    };
    sessionInfo: {
        debugAdapter: string;
        project: string;
        timestamp: string;
    };
}

export interface BuildAIContextOptions {
    /** Line timestamp in ms (from log line) for integration data window. */
    lineTimestampMs?: number;
    /** Whether to load integration data from sidecars/meta. Default true. */
    includeIntegrationData?: boolean;
    /** End line index for multi-line selection (inclusive). When set, surrounding lines span [lineIndex - n, lineEndIndex + n]. */
    lineEndIndex?: number;
}

const DEFAULT_CONTEXT_LINES = 10;
const CONTEXT_WINDOW_MS = 5000;

/** Patterns that suggest a stack frame line (at, #0, indent + "at ", etc.). */
const STACK_FRAME_PATTERNS = [
    /^\s*at\s+\S/,                    // "at package.Class.method"
    /^\s*#\d+\s+/,                     // "#0 ..." (Dart/Flutter)
    /^\s*at\s+/,                       // "    at "
    /\([^)]+:\d+\)/,                  // "(file.dart:123)" or "(File.java:42)"
    /^\s*in\s+\S+\s+/,                 // "in package.Class"
];

function looksLikeStackFrame(line: string): boolean {
    const t = line.trim();
    if (t.length === 0) { return false; }
    return STACK_FRAME_PATTERNS.some((re) => re.test(line));
}

/**
 * Extract consecutive stack-frame-like lines from content, starting around the error line.
 * Returns the joined block or undefined if none found.
 */
export function extractStackTrace(contentLines: string[], errorLineIndex: number): string | undefined {
    const maxFrames = 40;
    const start = Math.max(0, errorLineIndex);
    const lines: string[] = [];
    for (let i = start; i < contentLines.length && lines.length < maxFrames; i++) {
        const line = contentLines[i];
        if (line === undefined) { break; }
        if (looksLikeStackFrame(line)) {
            lines.push(line.trimEnd());
        } else if (lines.length > 0) {
            // Stop at first non-frame after we've seen at least one frame (allow one blank)
            const trimmed = line.trim();
            if (trimmed.length > 0) { break; }
        }
    }
    if (lines.length === 0) { return undefined; }
    return lines.join('\n');
}

function getSessionCenterTime(integrations: Record<string, unknown> | undefined): number {
    if (!integrations) { return 0; }
    for (const value of Object.values(integrations)) {
        const data = value as Record<string, unknown>;
        if (typeof data.capturedAt === 'number') { return data.capturedAt; }
        const sw = data.sessionWindow as { start?: number; end?: number } | undefined;
        if (sw?.start != null && sw?.end != null) {
            return Math.round((sw.start + sw.end) / 2);
        }
    }
    return 0;
}

function mapContextDataToIntegrationData(
    data: Awaited<ReturnType<typeof loadContextData>>,
): AIContext['integrationData'] {
    const out: NonNullable<AIContext['integrationData']> = {};
    if (data.performance && data.performance.length > 0) {
        const p = data.performance[0];
        const mem = `${p.freeMemMb} MB free`;
        const cpu = p.loadAvg1 != null ? `load ${p.loadAvg1.toFixed(2)}` : 'N/A';
        out.performance = { memory: mem, cpu };
    }
    if (data.http && data.http.length > 0) {
        out.http = data.http.slice(0, 20).map((h) => ({
            url: h.url,
            status: h.status,
            duration: h.durationMs,
        }));
    }
    if (data.terminal && data.terminal.length > 0) {
        out.terminal = data.terminal.slice(0, 30).map((t) => t.line);
    }
    if (Object.keys(out).length === 0) { return undefined; }
    return out;
}

/**
 * Read log file and build context: surrounding lines, stack trace, session metadata, optional integration data.
 */
export async function buildAIContext(
    logUri: vscode.Uri,
    lineIndex: number,
    lineText: string,
    contextLines: number = DEFAULT_CONTEXT_LINES,
    options: BuildAIContextOptions = {},
): Promise<AIContext> {
    const { lineTimestampMs, includeIntegrationData = true, lineEndIndex } = options;

    let rawLines: string[] = [];
    const fields: Record<string, string> = {};
    try {
        const raw = await vscode.workspace.fs.readFile(logUri);
        const text = Buffer.from(raw).toString('utf-8');
        rawLines = text.split(/\r?\n/);
        const headerEnd = findHeaderEnd(rawLines);
        Object.assign(fields, parseHeaderFields(rawLines));
    } catch {
        // Use only lineText and placeholders if file read fails
    }

    const contentStart = findHeaderEnd(rawLines);
    const contentLines = rawLines.slice(contentStart);
    const n = Math.max(0, Math.min(50, contextLines));
    const endLine = lineEndIndex != null && lineEndIndex >= lineIndex ? lineEndIndex : lineIndex;
    const lo = Math.max(0, lineIndex - n);
    const hi = Math.min(contentLines.length - 1, endLine + n);
    const surroundingLines: string[] = [];
    for (let i = lo; i <= hi; i++) {
        const line = contentLines[i];
        if (line !== undefined) { surroundingLines.push(line.trimEnd()); }
    }

    const stackTrace = extractStackTrace(contentLines, lineIndex);

    let integrationData: AIContext['integrationData'] | undefined;
    if (includeIntegrationData) {
        try {
            const store = new SessionMetadataStore();
            const meta = await store.loadMetadata(logUri);
            const centerTime = lineTimestampMs && lineTimestampMs > 0
                ? lineTimestampMs
                : getSessionCenterTime(meta.integrations);
            const windowMs = vscode.workspace
                .getConfiguration('saropaLogCapture')
                .get<number>('contextWindowSeconds', 5) * 1000;
            const window: ContextWindow = { centerTime, windowMs: windowMs || CONTEXT_WINDOW_MS };
            let contextData = await loadContextData(logUri, window);
            if (!contextData.hasData && meta.integrations) {
                const metaContext = await loadContextFromMeta(meta.integrations, window);
                contextData = { ...contextData, ...metaContext, hasData: Object.keys(metaContext).length > 0 };
            }
            integrationData = mapContextDataToIntegrationData(contextData);
        } catch {
            // Integration data optional; continue without it
        }
    }

    const sessionInfo = {
        debugAdapter: fields['Debug adapter'] ?? fields['Adapter'] ?? 'unknown',
        project: fields['Project'] ?? fields['Workspace'] ?? vscode.workspace.name ?? 'unknown',
        timestamp: fields['Date'] ?? fields['Started'] ?? new Date().toISOString(),
    };

    return {
        errorLine: lineText,
        lineIndex,
        surroundingLines,
        stackTrace,
        integrationData,
        sessionInfo,
    };
}
