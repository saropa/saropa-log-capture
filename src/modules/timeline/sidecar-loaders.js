"use strict";
/**
 * Sidecar file loaders for the unified timeline.
 * Extracts events from various sidecar formats.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPerfSidecar = loadPerfSidecar;
exports.loadHttpSidecar = loadHttpSidecar;
exports.loadTerminalSidecar = loadTerminalSidecar;
exports.loadDockerSidecar = loadDockerSidecar;
exports.loadBrowserSidecar = loadBrowserSidecar;
exports.loadDatabaseSidecar = loadDatabaseSidecar;
exports.loadEventsSidecar = loadEventsSidecar;
const timeline_event_1 = require("./timeline-event");
function loadPerfSidecar(text, uri, _sessionStart) {
    try {
        const data = JSON.parse(text);
        const samples = data.samples ?? [];
        const events = [];
        for (let i = 0; i < samples.length; i++) {
            const event = (0, timeline_event_1.parsePerfSampleToEvent)(samples[i], uri, i, i > 0 ? samples[i - 1] : undefined);
            if (event) {
                events.push(event);
            }
        }
        return events;
    }
    catch {
        return [];
    }
}
function loadHttpSidecar(text, uri, sessionStart) {
    try {
        const data = JSON.parse(text);
        const requests = data.requests ?? [];
        const events = [];
        for (let i = 0; i < requests.length; i++) {
            const event = (0, timeline_event_1.parseHttpRequestToEvent)(requests[i], uri, i, sessionStart);
            if (event) {
                events.push(event);
            }
        }
        return events;
    }
    catch {
        return [];
    }
}
function loadTerminalSidecar(text, uri, sessionStart) {
    const lines = text.split('\n');
    const events = [];
    for (let i = 0; i < lines.length; i++) {
        const event = (0, timeline_event_1.parseTerminalLineToEvent)(lines[i], i, uri, sessionStart);
        if (event) {
            events.push(event);
        }
    }
    return events;
}
function loadDockerSidecar(text, uri, sessionStart) {
    const events = [];
    try {
        const data = JSON.parse(text);
        const items = data.events ?? [];
        for (let i = 0; i < items.length; i++) {
            const event = (0, timeline_event_1.parseDockerEventToEvent)(items[i], uri, i, sessionStart);
            if (event) {
                events.push(event);
            }
        }
        return events;
    }
    catch {
        // Try JSON lines
    }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            continue;
        }
        try {
            const item = JSON.parse(line);
            const event = (0, timeline_event_1.parseDockerEventToEvent)(item, uri, i, sessionStart);
            if (event) {
                events.push(event);
            }
        }
        catch {
            // Skip non-JSON lines
        }
    }
    return events;
}
function loadBrowserSidecar(text, uri, sessionStart) {
    try {
        const data = JSON.parse(text);
        const items = Array.isArray(data) ? data : (data.events ?? []);
        const events = [];
        for (let i = 0; i < items.length; i++) {
            const event = (0, timeline_event_1.parseBrowserEventToEvent)(items[i], uri, i, sessionStart);
            if (event) {
                events.push(event);
            }
        }
        return events;
    }
    catch {
        return [];
    }
}
function loadDatabaseSidecar(text, uri, sessionStart) {
    try {
        const data = JSON.parse(text);
        const queries = data.queries ?? [];
        const events = [];
        for (let i = 0; i < queries.length; i++) {
            const event = (0, timeline_event_1.parseDatabaseQueryToEvent)(queries[i], uri, i, sessionStart);
            if (event) {
                events.push(event);
            }
        }
        return events;
    }
    catch {
        return [];
    }
}
function loadEventsSidecar(text, uri, sessionStart) {
    try {
        const data = JSON.parse(text);
        const items = Array.isArray(data) ? data : (data.events ?? []);
        const events = [];
        for (let i = 0; i < items.length; i++) {
            const event = (0, timeline_event_1.parseGenericEventToEvent)(items[i], uri, i, sessionStart);
            if (event) {
                events.push(event);
            }
        }
        return events;
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=sidecar-loaders.js.map