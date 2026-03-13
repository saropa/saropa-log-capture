/**
 * In-memory store of detected correlations per session.
 * Key: session URI string. Persistence can be added later via session metadata.
 */

import type { Correlation } from './correlation-types';

const store = new Map<string, Correlation[]>();
let lastSessionUri: string | undefined;

export function getCorrelations(sessionUri: string): Correlation[] {
    return store.get(sessionUri) ?? [];
}

export function setCorrelations(sessionUri: string, correlations: Correlation[]): void {
    store.set(sessionUri, correlations);
    lastSessionUri = sessionUri;
}

export function getLastSessionUri(): string | undefined {
    return lastSessionUri;
}

export function clearCorrelations(sessionUri: string): void {
    store.delete(sessionUri);
}

/** Build a map of (file URI + line number) -> correlation id and description for viewer. */
export function getCorrelationByLocation(sessionUri: string): Map<string, { id: string; description: string }> {
    const map = new Map<string, { id: string; description: string }>();
    for (const c of getCorrelations(sessionUri)) {
        for (const e of c.events) {
            const key = e.location.line !== undefined
                ? `${e.location.file}:${e.location.line}`
                : e.location.file;
            map.set(key, { id: c.id, description: c.description });
        }
    }
    return map;
}

/** Build a map of event key (file:line or file) -> correlation id for timeline event rows. */
export function getCorrelationIdForEvent(sessionUri: string): (file: string, line?: number) => string | undefined {
    const byLoc = getCorrelationByLocation(sessionUri);
    return (file: string, line?: number) => {
        const key = line !== undefined ? `${file}:${line}` : file;
        return byLoc.get(key)?.id;
    };
}
