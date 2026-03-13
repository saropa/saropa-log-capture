/**
 * Correlation detection: find events that co-occur within a time window.
 * Uses sliding window and pattern matching. Deduplicates overlapping correlations.
 */

import type { TimelineEvent } from '../timeline/timeline-event';
import type { Correlation, CorrelatedEvent, CorrelationType, CorrelationConfidence } from './correlation-types';
import {
    isHttpError,
    isHttpTimeout,
    isMemorySpike,
    isCpuSpike,
    isTimeoutError,
    isNetworkError,
} from './anomaly-detection';

const CONFIDENCE_ORDER: Record<CorrelationConfidence, number> = { low: 1, medium: 2, high: 3 };

export interface DetectorConfig {
    windowMs: number;
    minConfidence: CorrelationConfidence;
    enabledTypes: CorrelationType[];
    maxEvents?: number;
}

export function meetsMinConfidence(confidence: CorrelationConfidence, minConfidence: CorrelationConfidence): boolean {
    return CONFIDENCE_ORDER[confidence] >= CONFIDENCE_ORDER[minConfidence];
}

function timelineEventToCorrelated(e: TimelineEvent): CorrelatedEvent {
    return {
        source: e.source,
        timestamp: e.timestamp,
        summary: e.summary,
        location: {
            file: e.location?.file ?? '',
            line: e.location?.line,
            jsonPath: e.location?.jsonPath,
        },
    };
}

function buildCorrelation(
    type: CorrelationType,
    events: TimelineEvent[],
    confidence: CorrelationConfidence,
    id: string
): Correlation {
    const correlated = events.map(timelineEventToCorrelated);
    const timestamp = events.reduce((s, e) => s + e.timestamp, 0) / events.length;
    const description = describeCorrelation(type, correlated);
    return { id, type, confidence, events: correlated, description, timestamp };
}

function describeCorrelation(type: CorrelationType, events: CorrelatedEvent[]): string {
    const parts = events.map(e => `[${e.source}] ${e.summary.slice(0, 50)}`).join(' ↔ ');
    const labels: Record<CorrelationType, string> = {
        'error-http': 'Error + HTTP failure',
        'error-memory': 'Error + memory spike',
        'error-cpu': 'Error + CPU spike',
        'error-terminal': 'Error + terminal error',
        'timeout-network': 'Timeout + network issue',
        'crash-resource': 'Crash + resource exhaustion',
        'perf-cascade': 'Slow operation → downstream',
    };
    return `${labels[type]}: ${parts}`;
}

/** Events with level 'perf' and significant summary (e.g. memory drop) count as anomalies for anchoring. */
function isAnomaly(event: TimelineEvent): boolean {
    if (event.level !== 'perf') { return false; }
    const s = event.summary.toLowerCase();
    return s.includes('memory') || s.includes('drop') || s.includes('spike') || s.includes('load');
}

function isAnchorCandidate(event: TimelineEvent): boolean {
    return (
        event.level === 'error' ||
        event.level === 'warning' ||
        isAnomaly(event)
    );
}

let correlationIdCounter = 0;
function nextCorrelationId(): string {
    return `corr-${Date.now()}-${++correlationIdCounter}`;
}

function matchCorrelationPattern(
    anchor: TimelineEvent,
    nearby: TimelineEvent[],
    config: DetectorConfig
): Correlation | undefined {
    if (anchor.level === 'error' && config.enabledTypes.includes('error-http')) {
        const httpFailure = nearby.find(e => e.source === 'http' && isHttpError(e));
        if (httpFailure) { return buildCorrelation('error-http', [anchor, httpFailure], 'high', nextCorrelationId()); }
    }
    if (anchor.level === 'error' && config.enabledTypes.includes('error-memory')) {
        const memSpike = nearby.find(e => e.source === 'perf' && isMemorySpike(e));
        if (memSpike) { return buildCorrelation('error-memory', [anchor, memSpike], 'medium', nextCorrelationId()); }
    }
    if (anchor.level === 'error' && config.enabledTypes.includes('error-cpu')) {
        const cpuSpike = nearby.find(e => e.source === 'perf' && isCpuSpike(e));
        if (cpuSpike) { return buildCorrelation('error-cpu', [anchor, cpuSpike], 'medium', nextCorrelationId()); }
    }
    if (anchor.level === 'error' && config.enabledTypes.includes('error-terminal')) {
        const termErr = nearby.find(e => e.source === 'terminal' && e.level === 'error');
        if (termErr) { return buildCorrelation('error-terminal', [anchor, termErr], 'high', nextCorrelationId()); }
    }
    if (isTimeoutError(anchor) && config.enabledTypes.includes('timeout-network')) {
        const networkIssue = nearby.find(
            e =>
                (e.source === 'http' && isHttpTimeout(e)) ||
                (e.source === 'terminal' && isNetworkError(e))
        );
        if (networkIssue) {
            return buildCorrelation('timeout-network', [anchor, networkIssue], 'high', nextCorrelationId());
        }
    }
    return undefined;
}

/** Deduplicate: when two correlations share an anchor and overlap in time, keep higher confidence. */
export function deduplicateCorrelations(correlations: Correlation[]): Correlation[] {
    const kept: Correlation[] = [];
    for (const c of correlations) {
        const overlap = kept.some(k => {
            const sameAnchor = c.events.some(ce => k.events.some(ke =>
                ke.location.file === ce.location.file && ke.timestamp === ce.timestamp
            ));
            if (!sameAnchor) { return false; }
            const timeOverlap = Math.abs(c.timestamp - k.timestamp) < 5000;
            return timeOverlap;
        });
        if (!overlap) { kept.push(c); }
        else {
            const existing = kept.find(k => k.events.some(ke => c.events.some(ce =>
                ke.location.file === ce.location.file && ke.timestamp === ce.timestamp
            )));
            if (existing && CONFIDENCE_ORDER[c.confidence] > CONFIDENCE_ORDER[existing.confidence]) {
                const idx = kept.indexOf(existing);
                kept[idx] = c;
            }
        }
    }
    return kept;
}

export async function detectCorrelations(
    events: TimelineEvent[],
    config: DetectorConfig
): Promise<Correlation[]> {
    const maxEvents = config.maxEvents ?? 10000;
    const limited = events.length > maxEvents ? events.slice(0, maxEvents) : events;
    const sorted = [...limited].sort((a, b) => a.timestamp - b.timestamp);
    const correlations: Correlation[] = [];

    for (let i = 0; i < sorted.length; i++) {
        const anchor = sorted[i];
        if (!isAnchorCandidate(anchor)) { continue; }

        const windowStart = anchor.timestamp - config.windowMs;
        const windowEnd = anchor.timestamp + config.windowMs;
        const nearby = sorted.filter(
            e =>
                e !== anchor &&
                e.timestamp >= windowStart &&
                e.timestamp <= windowEnd
        );

        const correlation = matchCorrelationPattern(anchor, nearby, config);
        if (correlation && meetsMinConfidence(correlation.confidence, config.minConfidence)) {
            correlations.push(correlation);
        }
    }

    return deduplicateCorrelations(correlations);
}
