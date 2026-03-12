/**
 * Context Loader Types
 *
 * Type definitions for context data loaded from integration sidecar files.
 */

/** Time window specification for filtering context data. */
export interface ContextWindow {
    /** Center time in epoch milliseconds (from clicked line). */
    centerTime: number;
    /** Window size in milliseconds (applied ±). Default: 5000ms. */
    windowMs: number;
}

/** Performance sample entry from .perf.json sidecar. */
export interface PerfContextEntry {
    timestamp: number;
    freeMemMb: number;
    loadAvg1?: number;
    delta?: string;
}

/** HTTP request entry from .requests.json sidecar. */
export interface HttpContextEntry {
    timestamp: number;
    method: string;
    url: string;
    status: number;
    durationMs: number;
    requestId?: string;
}

/** Terminal output entry from .terminal.log sidecar. */
export interface TerminalContextEntry {
    timestamp: number;
    line: string;
}

/** Docker container event from metadata or sidecar. */
export interface DockerContextEntry {
    timestamp: number;
    containerId: string;
    containerName: string;
    status: string;
    health?: string;
}

/** Generic event entry for other integration sources. */
export interface EventContextEntry {
    timestamp: number;
    source: string;
    message: string;
    level?: string;
}

/** Combined context data from all integration sources. */
export interface ContextData {
    performance?: PerfContextEntry[];
    http?: HttpContextEntry[];
    terminal?: TerminalContextEntry[];
    docker?: DockerContextEntry[];
    events?: EventContextEntry[];
    /** The time window used for filtering. */
    window: ContextWindow;
    /** Whether any data was found. */
    hasData: boolean;
}

/** Sidecar file type to loader mapping. */
export interface SidecarType {
    suffix: string;
    loader: (content: string, window: ContextWindow) => Partial<ContextData>;
}
