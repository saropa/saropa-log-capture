"use strict";
/**
 * Formatter for raw DAP protocol messages.
 * Converts DAP requests, responses, and events into log-friendly strings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDapMessage = formatDapMessage;
const log_session_helpers_1 = require("./log-session-helpers");
/** Maximum JSON payload length before truncation. */
const maxPayloadLength = 500;
/** Format a DAP message as a single log line. */
function formatDapMessage(msg, direction, timestamp) {
    const ts = (0, log_session_helpers_1.formatTimestamp)(timestamp);
    const prefix = getDapPrefix(msg, direction);
    const label = getDapLabel(msg);
    const payload = truncatePayload(getPayload(msg));
    if (payload.length === 0) {
        return `[${ts}] ${prefix} ${label}`;
    }
    return `[${ts}] ${prefix} ${label} ${payload}`;
}
/** Get directional prefix based on message type and direction. */
function getDapPrefix(msg, dir) {
    if (msg.type === 'event') {
        return '[dap:event]';
    }
    return dir === 'outgoing' ? '[dap->]' : '[dap<-]';
}
/** Get the command or event label. */
function getDapLabel(msg) {
    return msg.command ?? msg.event ?? 'unknown';
}
/** Extract the most useful payload field from the message. */
function getPayload(msg) {
    const data = msg.body ?? msg.arguments;
    if (data === undefined) {
        return '';
    }
    try {
        return JSON.stringify(data);
    }
    catch {
        return '[unserializable]';
    }
}
/** Truncate payload to avoid enormous log lines. */
function truncatePayload(json) {
    if (json.length <= maxPayloadLength) {
        return json;
    }
    return json.slice(0, maxPayloadLength) + '...';
}
//# sourceMappingURL=dap-formatter.js.map