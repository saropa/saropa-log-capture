/**
 * Formatter for raw DAP protocol messages.
 * Converts DAP requests, responses, and events into log-friendly strings.
 */

import { formatTimestamp } from './log-session-helpers';

/** Shape of a raw DAP protocol message. */
export interface DapMessage {
    readonly type?: string;
    readonly command?: string;
    readonly event?: string;
    readonly seq?: number;
    readonly request_seq?: number;
    readonly success?: boolean;
    readonly body?: unknown;
    readonly arguments?: unknown;
}

/** Direction of a DAP message relative to the debug adapter. */
export type DapDirection = 'outgoing' | 'incoming';

/** Maximum JSON payload length before truncation. */
const maxPayloadLength = 500;

/** Format a DAP message as a single log line. */
export function formatDapMessage(
    msg: DapMessage,
    direction: DapDirection,
    timestamp: Date,
): string {
    const ts = formatTimestamp(timestamp);
    const prefix = getDapPrefix(msg, direction);
    const label = getDapLabel(msg);
    const payload = truncatePayload(getPayload(msg));
    if (payload.length === 0) {
        return `[${ts}] ${prefix} ${label}`;
    }
    return `[${ts}] ${prefix} ${label} ${payload}`;
}

/** Get directional prefix based on message type and direction. */
function getDapPrefix(msg: DapMessage, dir: DapDirection): string {
    if (msg.type === 'event') { return '[dap:event]'; }
    return dir === 'outgoing' ? '[dap->]' : '[dap<-]';
}

/** Get the command or event label. */
function getDapLabel(msg: DapMessage): string {
    return msg.command ?? msg.event ?? 'unknown';
}

/** Extract the most useful payload field from the message. */
function getPayload(msg: DapMessage): string {
    const data = msg.body ?? msg.arguments;
    if (data === undefined) { return ''; }
    try { return JSON.stringify(data); }
    catch { return '[unserializable]'; }
}

/** Truncate payload to avoid enormous log lines. */
function truncatePayload(json: string): string {
    if (json.length <= maxPayloadLength) { return json; }
    return json.slice(0, maxPayloadLength) + '...';
}
