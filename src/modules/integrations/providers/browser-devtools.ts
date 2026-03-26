/**
 * Browser / DevTools integration: captures browser console events and writes
 * them to a sidecar file. Supports two modes:
 * - **file**: reads an exported browser log at session end
 * - **cdp**: connects to Chrome DevTools Protocol via WebSocket during the session
 */

import * as fs from 'fs';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import type { BrowserEvent } from '../../timeline/event-types';
import { resolveWorkspaceFileUri } from '../workspace-path';
import { startCdpCapture, stopCdpCapture, isCdpCaptureActive } from './browser-cdp-capture';

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('browser');
}

/** Parse a JSONL string into an array of raw objects, skipping invalid lines. */
function parseJsonlRaw(raw: string, maxLines: number): unknown[] {
    const items: unknown[] = [];
    for (const line of raw.split(/\r?\n/).filter(Boolean).slice(-maxLines)) {
        try { items.push(JSON.parse(line)); } catch { /* skip */ }
    }
    return items;
}

/**
 * Normalize a raw parsed object to BrowserEvent shape.
 * Returns undefined if the object has no usable text content.
 * The timeline parser will separately drop events without timestamps.
 */
export function toBrowserEvent(raw: unknown): BrowserEvent | undefined {
    if (typeof raw !== 'object' || raw === null) { return undefined; }
    const obj = raw as Record<string, unknown>;
    const message = asString(obj['message']) ?? asString(obj['text']);
    if (!message) { return undefined; }
    const event: BrowserEvent = { message };
    const ts = asNumber(obj['timestamp']);
    if (ts !== undefined) { event.timestamp = ts; }
    const time = asString(obj['time']);
    if (time) { event.time = time; }
    const level = asString(obj['level']) ?? asString(obj['type']);
    if (level) { event.level = level; }
    const url = asString(obj['url']);
    if (url) { event.url = url; }
    const lineNumber = asNumber(obj['lineNumber']);
    if (lineNumber !== undefined) { event.lineNumber = lineNumber; }
    return event;
}

function asString(v: unknown): string | undefined {
    return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
    return typeof v === 'number' && isFinite(v) ? v : undefined;
}

/** Finalize CDP capture: stop, normalize events, write sidecar. */
async function endCdpCapture(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
    if (!isCdpCaptureActive()) { return undefined; }
    const raw = stopCdpCapture();
    const events: BrowserEvent[] = [];
    let dropped = 0;
    for (const item of raw) {
        const event = toBrowserEvent(item);
        if (event) { events.push(event); } else { dropped++; }
    }
    if (dropped > 0) {
        context.outputChannel.appendLine(`[browser] CDP: dropped ${dropped} event(s) with no usable text`);
    }
    if (events.length === 0) { return undefined; }
    const filename = `${context.baseFileName}.browser.json`;
    return [
        { kind: 'meta', key: 'browser', payload: { source: 'cdp', sidecar: filename, count: events.length, dropped } },
        { kind: 'sidecar', filename, content: JSON.stringify(events, null, 2), contentType: 'json' },
    ];
}

export const browserDevtoolsProvider: IntegrationProvider = {
    id: 'browser',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    async onSessionStartAsync(context: IntegrationContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const cfg = context.config.integrationsBrowser;
        if (cfg.mode !== 'cdp' || !cfg.cdpUrl) { return undefined; }
        try {
            await startCdpCapture(cfg.cdpUrl, cfg.maxEvents, cfg.includeNetwork,
                msg => context.outputChannel.appendLine(msg));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.outputChannel.appendLine(`[browser] CDP connect failed: ${msg}`);
        }
        return undefined;
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const cfg = context.config.integrationsBrowser;
        if (cfg.mode === 'cdp') { return endCdpCapture(context); }
        if (cfg.mode !== 'file' || !cfg.browserLogPath) { return undefined; }
        try {
            const uri = resolveWorkspaceFileUri(context.workspaceFolder, cfg.browserLogPath);
            const raw = fs.readFileSync(uri.fsPath, 'utf-8');
            let rawItems: unknown[] = [];
            if (cfg.browserLogFormat === 'jsonl') {
                rawItems = parseJsonlRaw(raw, cfg.maxEvents);
            } else {
                try {
                    const parsed = JSON.parse(raw);
                    const list = Array.isArray(parsed) ? parsed : [parsed];
                    rawItems = list.slice(-cfg.maxEvents);
                } catch {
                    return undefined;
                }
            }
            const events: BrowserEvent[] = [];
            let dropped = 0;
            for (const item of rawItems) {
                const event = toBrowserEvent(item);
                if (event) { events.push(event); } else { dropped++; }
            }
            if (dropped > 0) {
                context.outputChannel.appendLine(`[browser] Dropped ${dropped} event(s) with no usable text`);
            }
            if (events.length === 0) { return undefined; }
            const sidecarContent = JSON.stringify(events, null, 2);
            const filename = `${context.baseFileName}.browser.json`;
            return [
                { kind: 'meta', key: 'browser', payload: { sidecar: filename, count: events.length, dropped } },
                { kind: 'sidecar', filename, content: sidecarContent, contentType: 'json' },
            ];
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.outputChannel.appendLine(`[browser] Browser log read failed: ${msg}`);
            return undefined;
        }
    },
};
