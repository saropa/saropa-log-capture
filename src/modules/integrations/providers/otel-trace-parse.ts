/**
 * Pure OpenTelemetry trace-ID detection (no vscode/fs imports). Scans captured
 * log lines for W3C `traceparent` values and common `trace_id=`/`traceId:` forms
 * so each distinct trace can be linked out to a trace backend (Jaeger, Tempo,
 * etc.). Embedding a full distributed-trace view is intentionally out of scope —
 * this surfaces the trace IDs and a deep link, not the trace timeline.
 */

import { boundForUserRegex } from '../../misc/regex-safety';

/** A detected trace ID and the content-line indexes it appeared on. */
export interface TraceHit {
    readonly traceId: string;
    readonly lines: number[];
}

/** W3C traceparent header value: version "00", 32-hex trace id, 16-hex span id, 2-hex flags. */
const traceparentPattern = /\b00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}\b/i;
/** Common log key forms: trace_id / traceId / trace-id = 16–32 hex (quotes optional). */
const traceKeyValuePattern = /\btrace[_-]?id["']?\s*[:=]\s*["']?([0-9a-f]{16,32})\b/i;

/** Extract a trace ID from one line: user pattern first, then traceparent, then key=value. */
export function extractTraceId(line: string, userRe?: RegExp): string | undefined {
    if (userRe) {
        const m = userRe.exec(line);
        if (m) { return (m[1] ?? m[0]).toLowerCase(); }
    }
    const tp = traceparentPattern.exec(line);
    if (tp) { return tp[1].toLowerCase(); }
    const kv = traceKeyValuePattern.exec(line);
    if (kv) { return kv[1].toLowerCase(); }
    return undefined;
}

/**
 * Collect distinct trace IDs and the lines they appear on. `maxTraces` caps the
 * number of DISTINCT traces (further new IDs are ignored), while lines for
 * already-seen traces keep accumulating.
 */
export function extractTraceHits(
    lines: readonly string[],
    traceIdPattern: string,
    maxTraces: number,
): TraceHit[] {
    let userRe: RegExp | undefined;
    // A bad user-supplied regex must not break session end; fall back to built-ins.
    if (traceIdPattern) { try { userRe = new RegExp(traceIdPattern, 'i'); } catch { userRe = undefined; } }

    const byId = new Map<string, number[]>();
    for (let i = 0; i < lines.length; i++) {
        const id = extractTraceId(boundForUserRegex(lines[i]), userRe);
        if (!id) { continue; }
        if (!byId.has(id) && byId.size >= maxTraces) { continue; }
        const at = byId.get(id) ?? [];
        at.push(i);
        byId.set(id, at);
    }
    return [...byId.entries()].map(([traceId, ls]) => ({ traceId, lines: ls }));
}

/**
 * Build a backend deep link by substituting {traceId} in the template. Returns
 * undefined when the template is empty or has no {traceId} placeholder.
 */
export function traceBackendUrl(template: string, traceId: string): string | undefined {
    if (!template || !template.includes('{traceId}')) { return undefined; }
    return template.replace(/\{traceId\}/g, encodeURIComponent(traceId));
}

/** A content line's trace id and the backend URL to open for it. */
export interface TraceLineLink {
    readonly traceId: string;
    readonly url: string;
}

/**
 * Map content-line index -> { traceId, url } for lines that carry a trace id,
 * for the clickable in-viewer trace badge. Empty when no URL template is set
 * (a trace id with no backend link is not worth badging).
 */
export function traceLineLinks(
    contentLines: readonly string[],
    traceUrlTemplate: string,
    traceIdPattern: string,
): Record<number, TraceLineLink> {
    if (!traceUrlTemplate) { return {}; }
    let userRe: RegExp | undefined;
    if (traceIdPattern) { try { userRe = new RegExp(traceIdPattern, 'i'); } catch { userRe = undefined; } }

    const out: Record<number, TraceLineLink> = {};
    for (let i = 0; i < contentLines.length; i++) {
        const traceId = extractTraceId(boundForUserRegex(contentLines[i]), userRe);
        if (!traceId) { continue; }
        const url = traceBackendUrl(traceUrlTemplate, traceId);
        if (url) { out[i] = { traceId, url }; }
    }
    return out;
}
