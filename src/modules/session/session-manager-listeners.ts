/**
 * Listener management for session manager — add/remove line and split listeners.
 *
 * Extracted from SessionManagerImpl to keep the class file under the line limit.
 */
import type { LineListener, SplitListener } from './session-event-bus';

/** Register a listener, appending it to the array. */
export function addListener<T>(listeners: T[], listener: T): void {
    listeners.push(listener);
}

/** Remove a listener by identity, splicing it from the array. */
export function removeListener<T>(listeners: T[], listener: T): void {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) { listeners.splice(idx, 1); }
}

// Re-export types so callers don't need a second import
export type { LineListener, SplitListener };
