/**
 * Anomaly detection helpers for correlation.
 * Extracts HTTP status, duration, memory, and CPU from TimelineEvent summary/detail.
 * Data source: detail is often JSON from sidecars; summary is short text.
 */

import type { TimelineEvent } from '../timeline/timeline-event';

export interface PerfBaseline {
    avgMemory: number;
    avgCpu: number;
    stdDevMemory: number;
    stdDevCpu: number;
}

/** Parse memory (MB) from summary/detail. e.g. "Memory drop: 120 → 80 MB" or "Memory: 450MB". */
export function extractMemoryMb(event: TimelineEvent): number | undefined {
    const text = (event.summary + ' ' + (event.detail ?? '')).toLowerCase();
    const match = text.match(/(\d+(?:\.\d+)?)\s*mb|memory[:\s]+(\d+)/i);
    if (match) { return parseFloat(match[1] ?? match[2] ?? '0'); }
    try {
        const d = event.detail ? JSON.parse(event.detail) as Record<string, unknown> : null;
        if (d && typeof (d as { freememMb?: number }).freememMb === 'number') {
            return (d as { freememMb: number }).freememMb;
        }
    } catch { /* ignore */ }
    return undefined;
}

/** Parse CPU/load from summary/detail. */
export function extractCpuLoad(event: TimelineEvent): number | undefined {
    const text = (event.summary + ' ' + (event.detail ?? '')).toLowerCase();
    const match = text.match(/load[:\s]+(\d+(?:\.\d+)?)|loadavg[:\s]+(\d+(?:\.\d+)?)/i);
    if (match) { return parseFloat(match[1] ?? match[2] ?? '0'); }
    try {
        const d = event.detail ? JSON.parse(event.detail) as Record<string, unknown> : null;
        if (d && typeof (d as { loadAvg1?: number }).loadAvg1 === 'number') {
            return (d as { loadAvg1: number }).loadAvg1;
        }
    } catch { /* ignore */ }
    return undefined;
}

/** Parse HTTP status from summary (→ 500) or detail JSON. */
export function extractHttpStatus(event: TimelineEvent): number | undefined {
    const summaryMatch = event.summary.match(/→\s*(\d{3})/);
    if (summaryMatch) { return parseInt(summaryMatch[1], 10); }
    try {
        const d = event.detail ? JSON.parse(event.detail) as Record<string, unknown> : null;
        if (d) {
            const s = (d as { status?: number }).status ?? (d as { statusCode?: number }).statusCode;
            if (typeof s === 'number') { return s; }
        }
    } catch { /* ignore */ }
    return undefined;
}

/** Parse HTTP duration (ms) from summary or detail. */
export function extractHttpDuration(event: TimelineEvent): number | undefined {
    const summaryMatch = event.summary.match(/\((\d+)\s*ms\)/i);
    if (summaryMatch) { return parseInt(summaryMatch[1], 10); }
    try {
        const d = event.detail ? JSON.parse(event.detail) as Record<string, unknown> : null;
        if (d) {
            const dur = (d as { duration?: number }).duration ?? (d as { durationMs?: number }).durationMs;
            if (typeof dur === 'number') { return dur; }
        }
    } catch { /* ignore */ }
    return undefined;
}

export function isMemorySpike(event: TimelineEvent, baseline?: PerfBaseline): boolean {
    const memMb = extractMemoryMb(event);
    if (memMb === undefined) { return false; }
    if (baseline) {
        return memMb > baseline.avgMemory + 2 * baseline.stdDevMemory;
    }
    return memMb > 500;
}

export function isCpuSpike(event: TimelineEvent, baseline?: PerfBaseline): boolean {
    const cpu = extractCpuLoad(event);
    if (cpu === undefined) { return false; }
    if (baseline) {
        return cpu > baseline.avgCpu + 2 * baseline.stdDevCpu;
    }
    return cpu > 0.8;
}

export function isHttpError(event: TimelineEvent): boolean {
    const status = extractHttpStatus(event);
    return status !== undefined && status >= 400;
}

export function isHttpTimeout(event: TimelineEvent): boolean {
    const duration = extractHttpDuration(event);
    return duration !== undefined && duration > 10000;
}

export function isTimeoutError(event: TimelineEvent): boolean {
    const text = event.summary.toLowerCase();
    return text.includes('timeout') || text.includes('timed out') || text.includes('etimedout');
}

export function isNetworkError(event: TimelineEvent): boolean {
    const text = event.summary.toLowerCase();
    return (
        text.includes('network') ||
        text.includes('econnrefused') ||
        text.includes('enotfound') ||
        text.includes('socket')
    );
}
