"use strict";
/**
 * Context Sidecar Parsers
 *
 * Functions for parsing integration sidecar files (.perf.json, .requests.json, etc.)
 * and filtering entries to a time window.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPerfContext = loadPerfContext;
exports.loadHttpContext = loadHttpContext;
exports.loadTerminalContext = loadTerminalContext;
exports.loadBrowserContext = loadBrowserContext;
exports.extractTimestamp = extractTimestamp;
const safe_json_1 = require("../misc/safe-json");
/**
 * Load and filter performance samples from .perf.json sidecar.
 */
function loadPerfContext(content, window) {
    const data = (0, safe_json_1.parseJSONOrDefault)(content, {});
    if (!data.samples || !Array.isArray(data.samples)) {
        return {};
    }
    const minTime = window.centerTime - window.windowMs;
    const maxTime = window.centerTime + window.windowMs;
    const filtered = data.samples
        .filter(s => s.t >= minTime && s.t <= maxTime)
        .map(s => ({
        timestamp: s.t,
        freeMemMb: s.freememMb,
        loadAvg1: s.loadAvg1,
    }));
    if (filtered.length === 0) {
        return {};
    }
    if (filtered.length >= 2) {
        const first = filtered[0];
        const last = filtered[filtered.length - 1];
        const memDelta = last.freeMemMb - first.freeMemMb;
        const sign = memDelta >= 0 ? '+' : '';
        last.delta = `${sign}${memDelta}MB from window start`;
    }
    return { performance: filtered };
}
/**
 * Load and filter HTTP requests from .requests.json sidecar.
 */
function loadHttpContext(content, window) {
    const data = (0, safe_json_1.parseJSONOrDefault)(content, {});
    if (!data.requests || !Array.isArray(data.requests)) {
        return {};
    }
    const minTime = window.centerTime - window.windowMs;
    const maxTime = window.centerTime + window.windowMs;
    const filtered = [];
    for (const req of data.requests) {
        const timestamp = extractTimestamp(req);
        if (timestamp === 0 || timestamp < minTime || timestamp > maxTime) {
            continue;
        }
        filtered.push({
            timestamp,
            method: String(req.method || 'GET'),
            url: String(req.url || req.path || ''),
            status: Number(req.status || req.statusCode || 0),
            durationMs: Number(req.duration || req.durationMs || req.responseTime || 0),
            requestId: req.requestId ? String(req.requestId) : undefined,
        });
    }
    if (filtered.length === 0) {
        return {};
    }
    filtered.sort((a, b) => a.timestamp - b.timestamp);
    return { http: filtered.slice(0, 50) };
}
/**
 * Load and filter terminal output from .terminal.log sidecar.
 */
function loadTerminalContext(content, window) {
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) {
        return {};
    }
    const minTime = window.centerTime - window.windowMs;
    const maxTime = window.centerTime + window.windowMs;
    const filtered = [];
    for (const line of lines) {
        const tsMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\]/);
        if (!tsMatch) {
            continue;
        }
        const timestamp = new Date(tsMatch[1]).getTime();
        if (isNaN(timestamp) || timestamp < minTime || timestamp > maxTime) {
            continue;
        }
        const text = line.substring(tsMatch[0].length).trim();
        if (text) {
            filtered.push({ timestamp, line: text });
        }
    }
    if (filtered.length === 0) {
        return {};
    }
    return { terminal: filtered.slice(0, 30) };
}
/**
 * Load and filter browser console events from .browser.json sidecar.
 */
function loadBrowserContext(content, window) {
    const parsed = (0, safe_json_1.parseJSONOrDefault)(content, null);
    if (!parsed) {
        return {};
    }
    const items = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed.events) ? parsed.events : []);
    if (items.length === 0) {
        return {};
    }
    const minTime = window.centerTime - window.windowMs;
    const maxTime = window.centerTime + window.windowMs;
    const filtered = [];
    for (const item of items) {
        const timestamp = extractTimestamp(item);
        if (timestamp === 0 || timestamp < minTime || timestamp > maxTime) {
            continue;
        }
        const message = String(item.message || item.text || '');
        if (!message) {
            continue;
        }
        filtered.push({
            timestamp,
            level: String(item.level || item.type || 'log'),
            message,
            url: item.url ? String(item.url) : undefined,
        });
    }
    if (filtered.length === 0) {
        return {};
    }
    filtered.sort((a, b) => a.timestamp - b.timestamp);
    return { browser: filtered.slice(0, 30) };
}
/**
 * Extract timestamp from a request object.
 */
function extractTimestamp(obj) {
    const candidates = ['timestamp', 'time', 'ts', 'startTime', 'requestTime', 'createdAt'];
    for (const key of candidates) {
        const val = obj[key];
        if (typeof val === 'number' && val > 0) {
            return val < 1e12 ? val * 1000 : val;
        }
        if (typeof val === 'string') {
            const parsed = Date.parse(val);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }
    }
    return 0;
}
//# sourceMappingURL=context-sidecar-parsers.js.map