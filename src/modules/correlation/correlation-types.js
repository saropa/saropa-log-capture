"use strict";
/**
 * Data types for auto-correlation detection.
 * Correlated events are grouped by type and confidence.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORRELATION_TYPES = void 0;
exports.CORRELATION_TYPES = [
    'error-http',
    'error-memory',
    'error-cpu',
    'error-terminal',
    'timeout-network',
    'crash-resource',
    'perf-cascade',
];
//# sourceMappingURL=correlation-types.js.map