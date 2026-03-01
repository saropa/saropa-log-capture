/**
 * Lightweight assertion helpers for required parameters and invariants.
 *
 * Use at the start of public or hot-path functions when a missing value
 * indicates a programming error. Throws with a clear message for easier diagnosis.
 */

/**
 * Throws if value is null or undefined. Returns value so you can use inline.
 * @param value - Value that must be defined
 * @param name - Name to include in error message (e.g. "uri", "sessionId")
 */
export function assertDefined<T>(value: T | null | undefined, name: string): asserts value is T {
    if (value === null || value === undefined) {
        throw new Error(`Expected ${name} to be defined`);
    }
}
