/**
 * Data types for auto-correlation detection.
 * Correlated events are grouped by type and confidence.
 */

import type { TimelineSource } from '../timeline/timeline-event';

export type CorrelationConfidence = 'high' | 'medium' | 'low';

export interface CorrelatedEvent {
    source: TimelineSource;
    timestamp: number;
    summary: string;
    location: {
        file: string;
        line?: number;
        jsonPath?: string;
    };
}

export type CorrelationType =
    | 'error-http'
    | 'error-memory'
    | 'error-cpu'
    | 'error-terminal'
    | 'timeout-network'
    | 'crash-resource'
    | 'perf-cascade';

export interface Correlation {
    id: string;
    type: CorrelationType;
    confidence: CorrelationConfidence;
    events: CorrelatedEvent[];
    description: string;
    timestamp: number;
}

export const CORRELATION_TYPES: CorrelationType[] = [
    'error-http',
    'error-memory',
    'error-cpu',
    'error-terminal',
    'timeout-network',
    'crash-resource',
    'perf-cascade',
];
