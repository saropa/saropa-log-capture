/**
 * Sidecar event types for the unified timeline.
 * These interfaces represent the data formats from various integration sidecars.
 */

/** Perf sample from .perf.json sidecar. */
export interface PerfSample {
    t: number;
    freememMb: number;
    loadAvg1?: number;
}

/** HTTP request from .requests.json sidecar. */
export interface HttpRequest {
    timestamp?: number;
    time?: string;
    method?: string;
    url?: string;
    path?: string;
    status?: number;
    statusCode?: number;
    duration?: number;
    durationMs?: number;
    error?: string;
}

/** Docker container event from .container.log sidecar. */
export interface DockerEvent {
    timestamp?: number;
    time?: string;
    message?: string;
    stream?: string;
    level?: string;
}

/** Browser console event from .browser.json sidecar. */
export interface BrowserEvent {
    timestamp?: number;
    time?: string;
    level?: string;
    type?: string;
    message?: string;
    text?: string;
    url?: string;
    lineNumber?: number;
}

/** Database query event from .queries.json sidecar. */
export interface DatabaseQuery {
    timestamp?: number;
    time?: string;
    query?: string;
    sql?: string;
    duration?: number;
    durationMs?: number;
    error?: string;
    rows?: number;
}

/** Generic events from .events.json sidecar. */
export interface GenericEvent {
    timestamp?: number;
    time?: string;
    t?: number;
    type?: string;
    name?: string;
    message?: string;
    level?: string;
    data?: unknown;
}
