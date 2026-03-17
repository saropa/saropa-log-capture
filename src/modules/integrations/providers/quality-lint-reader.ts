/**
 * Lint report reader for the code quality metrics integration.
 * Parses ESLint JSON format (`--format json`) and extracts per-file
 * warning/error counts for files referenced in log stack traces.
 */

import * as fs from 'fs';
import { normalizeForLookup, type FileLintData } from './quality-types';

const MAX_LINT_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_TOP_MESSAGES = 3;

/** ESLint severity: 1 = warning, 2 = error. */
interface EslintMessage {
    readonly severity?: number;
    readonly message?: string;
}

/** Single file entry in ESLint JSON output. */
interface EslintFileEntry {
    readonly filePath?: string;
    readonly messages?: readonly EslintMessage[];
}

/**
 * Parse ESLint JSON content and extract per-file lint data.
 * Only includes files present in the referenced set (normalized paths).
 */
export function parseEslintJson(
    content: string,
    referencedNorm: ReadonlySet<string>,
): ReadonlyMap<string, FileLintData> {
    const result = new Map<string, FileLintData>();
    let entries: unknown[];
    try {
        const parsed: unknown = JSON.parse(content);
        if (!Array.isArray(parsed)) { return result; }
        entries = parsed;
    } catch {
        return result;
    }
    for (const raw of entries) {
        const entry = raw as EslintFileEntry;
        if (!entry.filePath || !Array.isArray(entry.messages)) { continue; }
        const norm = normalizeForLookup(entry.filePath);
        if (!referencedNorm.has(norm) && !matchesSuffix(norm, referencedNorm)) { continue; }
        let warnings = 0;
        let errors = 0;
        const messages: string[] = [];
        for (const msg of entry.messages) {
            if (msg.severity === 1) { warnings++; }
            else if (msg.severity === 2) { errors++; }
            if (msg.message && messages.length < MAX_TOP_MESSAGES) {
                messages.push(msg.message);
            }
        }
        const key = findMatchingKey(norm, referencedNorm) ?? norm;
        result.set(key, { warnings, errors, topMessages: messages });
    }
    return result;
}

/** Check if any referenced path is a suffix of (or matches) the given normalized path. */
function matchesSuffix(norm: string, referencedNorm: ReadonlySet<string>): boolean {
    for (const ref of referencedNorm) {
        if (norm.endsWith('/' + ref) || ref.endsWith('/' + norm)) { return true; }
    }
    return false;
}

/** Find the matching referenced key for a normalized lint path. */
function findMatchingKey(norm: string, referencedNorm: ReadonlySet<string>): string | undefined {
    if (referencedNorm.has(norm)) { return norm; }
    for (const ref of referencedNorm) {
        if (norm.endsWith('/' + ref) || ref.endsWith('/' + norm)) { return ref; }
    }
    return undefined;
}

/**
 * Read an ESLint-format JSON lint report from disk and extract per-file lint data.
 * Returns an empty map if the file is missing, too large, or unparseable.
 */
export function readLintReport(
    absPath: string,
    referencedNorm: ReadonlySet<string>,
): ReadonlyMap<string, FileLintData> {
    try {
        const stat = fs.statSync(absPath);
        if (!stat.isFile() || stat.size > MAX_LINT_FILE_BYTES) {
            return new Map();
        }
        const content = fs.readFileSync(absPath, 'utf-8');
        return parseEslintJson(content, referencedNorm);
    } catch {
        return new Map();
    }
}
