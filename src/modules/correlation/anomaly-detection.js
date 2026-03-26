"use strict";
/**
 * Anomaly detection helpers for correlation.
 * Extracts HTTP status, duration, memory, and CPU from TimelineEvent summary/detail.
 * Data source: detail is often JSON from sidecars; summary is short text.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractMemoryMb = extractMemoryMb;
exports.extractCpuLoad = extractCpuLoad;
exports.extractHttpStatus = extractHttpStatus;
exports.extractHttpDuration = extractHttpDuration;
exports.isMemorySpike = isMemorySpike;
exports.isCpuSpike = isCpuSpike;
exports.isHttpError = isHttpError;
exports.isHttpTimeout = isHttpTimeout;
exports.isTimeoutError = isTimeoutError;
exports.isNetworkError = isNetworkError;
/** Parse memory (MB) from summary/detail. e.g. "Memory drop: 120 → 80 MB" or "Memory: 450MB". */
function extractMemoryMb(event) {
    const text = (event.summary + ' ' + (event.detail ?? '')).toLowerCase();
    const match = text.match(/(\d+(?:\.\d+)?)\s*mb|memory[:\s]+(\d+)/i);
    if (match) {
        return parseFloat(match[1] ?? match[2] ?? '0');
    }
    try {
        const d = event.detail ? JSON.parse(event.detail) : null;
        if (d && typeof d.freememMb === 'number') {
            return d.freememMb;
        }
    }
    catch { /* ignore */ }
    return undefined;
}
/** Parse CPU/load from summary/detail. */
function extractCpuLoad(event) {
    const text = (event.summary + ' ' + (event.detail ?? '')).toLowerCase();
    const match = text.match(/load[:\s]+(\d+(?:\.\d+)?)|loadavg[:\s]+(\d+(?:\.\d+)?)/i);
    if (match) {
        return parseFloat(match[1] ?? match[2] ?? '0');
    }
    try {
        const d = event.detail ? JSON.parse(event.detail) : null;
        if (d && typeof d.loadAvg1 === 'number') {
            return d.loadAvg1;
        }
    }
    catch { /* ignore */ }
    return undefined;
}
/** Parse HTTP status from summary (→ 500) or detail JSON. */
function extractHttpStatus(event) {
    const summaryMatch = event.summary.match(/→\s*(\d{3})/);
    if (summaryMatch) {
        return parseInt(summaryMatch[1], 10);
    }
    try {
        const d = event.detail ? JSON.parse(event.detail) : null;
        if (d) {
            const s = d.status ?? d.statusCode;
            if (typeof s === 'number') {
                return s;
            }
        }
    }
    catch { /* ignore */ }
    return undefined;
}
/** Parse HTTP duration (ms) from summary or detail. */
function extractHttpDuration(event) {
    const summaryMatch = event.summary.match(/\((\d+)\s*ms\)/i);
    if (summaryMatch) {
        return parseInt(summaryMatch[1], 10);
    }
    try {
        const d = event.detail ? JSON.parse(event.detail) : null;
        if (d) {
            const dur = d.duration ?? d.durationMs;
            if (typeof dur === 'number') {
                return dur;
            }
        }
    }
    catch { /* ignore */ }
    return undefined;
}
function isMemorySpike(event, baseline) {
    const memMb = extractMemoryMb(event);
    if (memMb === undefined) {
        return false;
    }
    if (baseline) {
        return memMb > baseline.avgMemory + 2 * baseline.stdDevMemory;
    }
    return memMb > 500;
}
function isCpuSpike(event, baseline) {
    const cpu = extractCpuLoad(event);
    if (cpu === undefined) {
        return false;
    }
    if (baseline) {
        return cpu > baseline.avgCpu + 2 * baseline.stdDevCpu;
    }
    return cpu > 0.8;
}
function isHttpError(event) {
    const status = extractHttpStatus(event);
    return status !== undefined && status >= 400;
}
function isHttpTimeout(event) {
    const duration = extractHttpDuration(event);
    return duration !== undefined && duration > 10000;
}
function isTimeoutError(event) {
    const text = event.summary.toLowerCase();
    return text.includes('timeout') || text.includes('timed out') || text.includes('etimedout');
}
function isNetworkError(event) {
    const text = event.summary.toLowerCase();
    return (text.includes('network') ||
        text.includes('econnrefused') ||
        text.includes('enotfound') ||
        text.includes('socket'));
}
//# sourceMappingURL=anomaly-detection.js.map