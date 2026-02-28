/** Parse Crashlytics crash event responses into structured detail. */

import type { CrashlyticsEventDetail, CrashlyticsStackFrame } from './firebase-crashlytics';

interface CrashlyticsThread { readonly name: string; readonly frames: readonly CrashlyticsStackFrame[]; }

const maxFramesPerThread = 50;
const frameLineRe = /^\s+at\s+(.+)/;
const javaFrameRe = /^([\w.$]+)\(([\w.]+):(\d+)\)$/;

/** Parse the events API response into a CrashlyticsEventDetail. */
export function parseEventResponse(issueId: string, data: Record<string, unknown>): CrashlyticsEventDetail | undefined {
    const events = data.events ?? data.crashEvents;
    if (!Array.isArray(events) || events.length === 0) { return parseRawTrace(issueId, data); }
    const event = events[0] as Record<string, unknown>;
    const eventMeta = extractEventMeta(event);
    const threads = event.threads ?? event.executionThreads;
    if (Array.isArray(threads)) { return { ...parseStructuredThreads(issueId, threads), ...eventMeta }; }
    const trace = event.stackTrace ?? event.exception;
    if (typeof trace === 'string') { return { ...parseRawTrace(issueId, { stackTrace: trace })!, ...eventMeta }; }
    const raw = parseRawTrace(issueId, data);
    return raw ? { ...raw, ...eventMeta } : undefined;
}

function extractEventMeta(event: Record<string, unknown>): Partial<CrashlyticsEventDetail> {
    const device = event.device as Record<string, unknown> | undefined;
    const deviceModel = device ? String(device.model ?? device.deviceModel ?? '') : '';
    const osVersion = device ? String(device.osVersion ?? device.platformVersion ?? '') : '';
    const eventTime = String(event.eventTime ?? event.createTime ?? '');
    const customKeys = parseCustomKeys(event.customKeys ?? event.keys);
    const logs = parseLogEntries(event.logs ?? event.breadcrumbs);
    return {
        ...(deviceModel ? { deviceModel } : {}),
        ...(osVersion ? { osVersion } : {}),
        ...(eventTime ? { eventTime } : {}),
        ...(customKeys.length > 0 ? { customKeys } : {}),
        ...(logs.length > 0 ? { logs } : {}),
    };
}

function parseCustomKeys(raw: unknown): { key: string; value: string }[] {
    if (!Array.isArray(raw)) { return []; }
    return raw.slice(0, 30).map(k => {
        const entry = k as Record<string, unknown>;
        return { key: String(entry.key ?? ''), value: String(entry.value ?? '') };
    }).filter(e => e.key);
}

function parseLogEntries(raw: unknown): { timestamp?: string; message: string }[] {
    if (!Array.isArray(raw)) { return []; }
    return raw.slice(0, 50).map(l => {
        const entry = l as Record<string, unknown>;
        const ts = entry.timestamp ?? entry.logTimestamp;
        return { timestamp: ts ? String(ts) : undefined, message: String(entry.message ?? entry.log ?? '') };
    }).filter(e => e.message);
}

function parseStructuredThreads(issueId: string, threads: unknown[]): CrashlyticsEventDetail {
    let crashThread: CrashlyticsThread | undefined;
    const appThreads: CrashlyticsThread[] = [];
    for (const t of threads) {
        const thread = t as Record<string, unknown>;
        const name = String(thread.name ?? thread.threadName ?? 'Unknown');
        const rawFrames = (thread.frames ?? thread.stackFrames) as unknown[] | undefined;
        if (!Array.isArray(rawFrames)) { continue; }
        const frames = rawFrames.slice(0, maxFramesPerThread).map(parseStructuredFrame);
        const parsed: CrashlyticsThread = { name, frames };
        if (!crashThread && (thread.crashed === true || /fatal|exception/i.test(name))) { crashThread = parsed; }
        else { appThreads.push(parsed); }
    }
    return { issueId, crashThread, appThreads };
}

function parseStructuredFrame(raw: unknown): CrashlyticsStackFrame {
    const f = raw as Record<string, unknown>;
    const symbol = String(f.symbol ?? f.className ?? '');
    const method = f.methodName ? `.${f.methodName}` : '';
    const file = f.file ?? f.fileName;
    const line = Number(f.line ?? f.lineNumber ?? 0);
    const text = file ? `at ${symbol}${method}(${file}:${line})` : `at ${symbol}${method}`;
    return { text, fileName: file ? String(file) : undefined, lineNumber: line || undefined };
}

function parseRawTrace(issueId: string, data: Record<string, unknown>): CrashlyticsEventDetail | undefined {
    const raw = String(data.stackTrace ?? '');
    if (!raw || raw.length < 10) { return undefined; }
    const lines = raw.split(/\r?\n/);
    const frames: CrashlyticsStackFrame[] = [];
    for (const line of lines) {
        const m = frameLineRe.exec(line);
        if (!m) { continue; }
        const frameText = m[1].trim();
        const jm = javaFrameRe.exec(frameText);
        frames.push({
            text: `at ${frameText}`,
            fileName: jm?.[2],
            lineNumber: jm ? Number(jm[3]) : undefined,
        });
        if (frames.length >= maxFramesPerThread) { break; }
    }
    if (frames.length === 0) { return undefined; }
    return { issueId, crashThread: { name: 'Fatal Exception', frames }, appThreads: [] };
}
