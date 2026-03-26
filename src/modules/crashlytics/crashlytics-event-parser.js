"use strict";
/** Parse Crashlytics crash event responses into structured detail. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEventResponse = parseEventResponse;
const maxFramesPerThread = 50;
const frameLineRe = /^\s+at\s+(.+)/;
const javaFrameRe = /^([\w.$]+)\(([\w.]+):(\d+)\)$/;
/** Parse the events API response into a CrashlyticsEventDetail. */
function parseEventResponse(issueId, data) {
    const events = data.events ?? data.crashEvents;
    if (!Array.isArray(events) || events.length === 0) {
        return parseRawTrace(issueId, data);
    }
    const event = events[0];
    const eventMeta = extractEventMeta(event);
    const threads = event.threads ?? event.executionThreads;
    if (Array.isArray(threads)) {
        return { ...parseStructuredThreads(issueId, threads), ...eventMeta };
    }
    const trace = event.stackTrace ?? event.exception;
    if (typeof trace === 'string') {
        return { ...parseRawTrace(issueId, { stackTrace: trace }), ...eventMeta };
    }
    const raw = parseRawTrace(issueId, data);
    return raw ? { ...raw, ...eventMeta } : undefined;
}
function extractEventMeta(event) {
    const device = event.device;
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
function parseCustomKeys(raw) {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw.slice(0, 30).map(k => {
        const entry = k;
        return { key: String(entry.key ?? ''), value: String(entry.value ?? '') };
    }).filter(e => e.key);
}
function parseLogEntries(raw) {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw.slice(0, 50).map(l => {
        const entry = l;
        const ts = entry.timestamp ?? entry.logTimestamp;
        return { timestamp: ts ? String(ts) : undefined, message: String(entry.message ?? entry.log ?? '') };
    }).filter(e => e.message);
}
function parseStructuredThreads(issueId, threads) {
    let crashThread;
    const appThreads = [];
    for (const t of threads) {
        const thread = t;
        const name = String(thread.name ?? thread.threadName ?? 'Unknown');
        const rawFrames = (thread.frames ?? thread.stackFrames);
        if (!Array.isArray(rawFrames)) {
            continue;
        }
        const frames = rawFrames.slice(0, maxFramesPerThread).map(parseStructuredFrame);
        const parsed = { name, frames };
        if (!crashThread && (thread.crashed === true || /fatal|exception/i.test(name))) {
            crashThread = parsed;
        }
        else {
            appThreads.push(parsed);
        }
    }
    return { issueId, crashThread, appThreads };
}
function parseStructuredFrame(raw) {
    const f = raw;
    const symbol = String(f.symbol ?? f.className ?? '');
    const method = f.methodName ? `.${f.methodName}` : '';
    const file = f.file ?? f.fileName;
    const line = Number(f.line ?? f.lineNumber ?? 0);
    const text = file ? `at ${symbol}${method}(${file}:${line})` : `at ${symbol}${method}`;
    return { text, fileName: file ? String(file) : undefined, lineNumber: line || undefined };
}
function parseRawTrace(issueId, data) {
    const raw = String(data.stackTrace ?? '');
    if (!raw || raw.length < 10) {
        return undefined;
    }
    const lines = raw.split(/\r?\n/);
    const frames = [];
    for (const line of lines) {
        const m = frameLineRe.exec(line);
        if (!m) {
            continue;
        }
        const frameText = m[1].trim();
        const jm = javaFrameRe.exec(frameText);
        frames.push({
            text: `at ${frameText}`,
            fileName: jm?.[2],
            lineNumber: jm ? Number(jm[3]) : undefined,
        });
        if (frames.length >= maxFramesPerThread) {
            break;
        }
    }
    if (frames.length === 0) {
        return undefined;
    }
    return { issueId, crashThread: { name: 'Fatal Exception', frames }, appThreads: [] };
}
//# sourceMappingURL=crashlytics-event-parser.js.map