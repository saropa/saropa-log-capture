/**
 * Sidecar file loaders for the unified timeline.
 * Extracts events from various sidecar formats.
 */

import {
    type TimelineEvent,
    parsePerfSampleToEvent,
    parseHttpRequestToEvent,
    parseTerminalLineToEvent,
    parseDockerEventToEvent,
    parseBrowserEventToEvent,
    parseDatabaseQueryToEvent,
    parseGenericEventToEvent,
} from './timeline-event';
import type { PerfSample, HttpRequest, BrowserEvent, DatabaseQuery, GenericEvent, DockerEvent } from './event-types';

export function loadPerfSidecar(text: string, uri: string, _sessionStart: number): TimelineEvent[] {
    try {
        const data = JSON.parse(text) as { samples?: PerfSample[] };
        const samples = data.samples ?? [];
        const events: TimelineEvent[] = [];

        for (let i = 0; i < samples.length; i++) {
            const event = parsePerfSampleToEvent(
                samples[i],
                uri,
                i,
                i > 0 ? samples[i - 1] : undefined,
            );
            if (event) { events.push(event); }
        }

        return events;
    } catch {
        return [];
    }
}

export function loadHttpSidecar(text: string, uri: string, sessionStart: number): TimelineEvent[] {
    try {
        const data = JSON.parse(text) as { requests?: HttpRequest[] };
        const requests = data.requests ?? [];
        const events: TimelineEvent[] = [];

        for (let i = 0; i < requests.length; i++) {
            const event = parseHttpRequestToEvent(requests[i], uri, i, sessionStart);
            if (event) { events.push(event); }
        }

        return events;
    } catch {
        return [];
    }
}

export function loadTerminalSidecar(text: string, uri: string, sessionStart: number): TimelineEvent[] {
    const lines = text.split('\n');
    const events: TimelineEvent[] = [];

    for (let i = 0; i < lines.length; i++) {
        const event = parseTerminalLineToEvent(lines[i], i, uri, sessionStart);
        if (event) { events.push(event); }
    }

    return events;
}

export function loadDockerSidecar(text: string, uri: string, sessionStart: number): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    try {
        const data = JSON.parse(text) as { events?: DockerEvent[] };
        const items = data.events ?? [];
        for (let i = 0; i < items.length; i++) {
            const event = parseDockerEventToEvent(items[i], uri, i, sessionStart);
            if (event) { events.push(event); }
        }
        return events;
    } catch {
        // Try JSON lines
    }

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) { continue; }
        try {
            const item = JSON.parse(line) as DockerEvent;
            const event = parseDockerEventToEvent(item, uri, i, sessionStart);
            if (event) { events.push(event); }
        } catch {
            // Skip non-JSON lines
        }
    }

    return events;
}

export function loadBrowserSidecar(text: string, uri: string, sessionStart: number): TimelineEvent[] {
    try {
        const data = JSON.parse(text) as BrowserEvent[] | { events?: BrowserEvent[] };
        const items = Array.isArray(data) ? data : (data.events ?? []);
        const events: TimelineEvent[] = [];

        for (let i = 0; i < items.length; i++) {
            const event = parseBrowserEventToEvent(items[i], uri, i, sessionStart);
            if (event) { events.push(event); }
        }

        return events;
    } catch {
        return [];
    }
}

export function loadDatabaseSidecar(text: string, uri: string, sessionStart: number): TimelineEvent[] {
    try {
        const data = JSON.parse(text) as { queries?: DatabaseQuery[] };
        const queries = data.queries ?? [];
        const events: TimelineEvent[] = [];

        for (let i = 0; i < queries.length; i++) {
            const event = parseDatabaseQueryToEvent(queries[i], uri, i, sessionStart);
            if (event) { events.push(event); }
        }

        return events;
    } catch {
        return [];
    }
}

export function loadEventsSidecar(text: string, uri: string, sessionStart: number): TimelineEvent[] {
    try {
        const data = JSON.parse(text) as GenericEvent[] | { events?: GenericEvent[] };
        const items = Array.isArray(data) ? data : (data.events ?? []);
        const events: TimelineEvent[] = [];

        for (let i = 0; i < items.length; i++) {
            const event = parseGenericEventToEvent(items[i], uri, i, sessionStart);
            if (event) { events.push(event); }
        }

        return events;
    } catch {
        return [];
    }
}
