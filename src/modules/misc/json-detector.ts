/**
 * JSON detection and formatting for log lines.
 * Detects JSON objects/arrays embedded in log output.
 */

/** Result of JSON detection on a log line. */
export interface JsonDetection {
    readonly hasJson: boolean;
    readonly jsonStart: number;
    readonly jsonEnd: number;
    readonly prefix: string;
    readonly json: string;
    readonly suffix: string;
    readonly parsed: unknown;
}

/** Detection result when no JSON is found. */
const NO_JSON: JsonDetection = {
    hasJson: false,
    jsonStart: -1,
    jsonEnd: -1,
    prefix: '',
    json: '',
    suffix: '',
    parsed: null,
};

/**
 * Detect JSON object or array in a log line.
 * Handles common patterns like: "[INFO] {"key": "value"}"
 * Tries each potential JSON start until valid JSON is found.
 */
export function detectJson(line: string): JsonDetection {
    if (!line || line.length === 0) {
        return NO_JSON;
    }

    // Find all potential JSON start positions
    const candidates: { start: number; closer: string }[] = [];

    for (let i = 0; i < line.length; i++) {
        if (line[i] === '{') {
            candidates.push({ start: i, closer: '}' });
        } else if (line[i] === '[') {
            candidates.push({ start: i, closer: ']' });
        }
    }

    // Try each candidate until we find valid JSON
    for (const { start, closer } of candidates) {
        const end = findMatchingBracket(line, start, closer);
        if (end < 0) {
            continue;
        }

        const jsonStr = line.slice(start, end + 1);

        try {
            const parsed = JSON.parse(jsonStr);

            // Only treat as JSON if it's an object or array (not primitive)
            if (typeof parsed !== 'object' || parsed === null) {
                continue;
            }

            return {
                hasJson: true,
                jsonStart: start,
                jsonEnd: end + 1,
                prefix: line.slice(0, start),
                json: jsonStr,
                suffix: line.slice(end + 1),
                parsed,
            };
        } catch {
            // Not valid JSON, try next candidate
        }
    }

    return NO_JSON;
}

/**
 * Find the matching closing bracket, accounting for nesting.
 */
function findMatchingBracket(str: string, start: number, closer: string): number {
    const opener = str[start];
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < str.length; i++) {
        const ch = str[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (ch === '\\') {
            escape = true;
            continue;
        }

        if (ch === '"') {
            inString = !inString;
            continue;
        }

        if (inString) {
            continue;
        }

        if (ch === opener) {
            depth++;
        } else if (ch === closer) {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }

    return -1;
}

/**
 * Format JSON for pretty display with indentation.
 */
export function formatJson(parsed: unknown, indent: number = 2): string {
    try {
        return JSON.stringify(parsed, null, indent);
    } catch {
        return String(parsed);
    }
}

/**
 * Get a compact preview of JSON (first N characters).
 */
export function jsonPreview(json: string, maxLength: number = 60): string {
    if (json.length <= maxLength) {
        return json;
    }
    return json.slice(0, maxLength - 3) + '...';
}

/**
 * Check if a string looks like it might contain JSON.
 * Fast pre-check before full parsing.
 */
export function mightContainJson(line: string): boolean {
    return line.includes('{') || line.includes('[');
}
