/**
 * Per-file coverage parsing for the code quality integration.
 * Extends the aggregate coverage parsing in code-coverage.ts to return
 * per-file line coverage percentages from lcov, cobertura, or Istanbul formats.
 */

import * as fs from 'fs';

/** Per-file coverage map: normalized relative path → line coverage percent (0–100). */
export type CoverageMap = ReadonlyMap<string, number>;

const MAX_COVERAGE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Normalize a file path for consistent map lookups. */
function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').toLowerCase();
}

/** Strip common workspace-style prefixes to get a relative-ish path. */
function stripPrefix(filePath: string): string {
    const norm = normalizePath(filePath);
    // Strip drive letter (C:/) or leading /
    const stripped = norm.replace(/^[a-z]:\//i, '').replace(/^\//, '');
    return stripped;
}

/** Parse LCOV format into per-file coverage map. */
export function parseLcovPerFile(content: string): CoverageMap {
    const map = new Map<string, number>();
    let currentFile = '';
    let lf = 0;
    let lh = 0;
    for (const line of content.split('\n')) {
        const sfMatch = line.match(/^SF:(.+)/);
        if (sfMatch) {
            currentFile = sfMatch[1].trim();
            lf = 0;
            lh = 0;
            continue;
        }
        if (line.startsWith('LF:')) { lf = parseInt(line.slice(3), 10) || 0; }
        if (line.startsWith('LH:')) { lh = parseInt(line.slice(3), 10) || 0; }
        if (line.startsWith('end_of_record') && currentFile && lf > 0) {
            const pct = Math.round((100 * lh) / lf);
            map.set(stripPrefix(currentFile), pct);
            currentFile = '';
        }
    }
    return map;
}

/** Parse Cobertura XML into per-file coverage map. */
export function parseCoberturaPerFile(content: string): CoverageMap {
    const map = new Map<string, number>();
    // Match <class> elements; handle filename/line-rate in either attribute order.
    const classRegex = /<class\s[^>]*?(?:filename="([^"]+)"[^>]*?line-rate="([^"]+)"|line-rate="([^"]+)"[^>]*?filename="([^"]+)")/g;
    let m: RegExpExecArray | null;
    while ((m = classRegex.exec(content)) !== null) {
        const filename = m[1] ?? m[4];
        const rate = m[2] ?? m[3];
        if (!filename || !rate) { continue; }
        const pct = Math.round(parseFloat(rate) * 100);
        map.set(stripPrefix(filename), pct);
    }
    return map;
}

/** Parse Istanbul coverage-summary.json into per-file coverage map. */
export function parseSummaryJsonPerFile(content: string): CoverageMap {
    const map = new Map<string, number>();
    let data: Record<string, unknown>;
    try { data = JSON.parse(content) as Record<string, unknown>; }
    catch { return map; }
    for (const [key, val] of Object.entries(data)) {
        if (key === 'total') { continue; }
        const entry = val as Record<string, unknown> | undefined;
        const lines = entry?.lines as { pct?: number } | undefined;
        if (lines?.pct !== undefined) {
            map.set(stripPrefix(key), Math.round(Number(lines.pct)));
        }
    }
    return map;
}

/** Auto-detect format by extension and parse content into per-file coverage map. */
export function parsePerFileCoverageContent(absPath: string, content: string): CoverageMap {
    const lower = absPath.toLowerCase();
    if (lower.endsWith('.xml')) { return parseCoberturaPerFile(content); }
    if (lower.endsWith('.json')) { return parseSummaryJsonPerFile(content); }
    return parseLcovPerFile(content);
}

/** Read a coverage file and parse into per-file coverage map. */
export function parsePerFileCoverage(absPath: string): CoverageMap | undefined {
    try {
        const stat = fs.statSync(absPath);
        if (!stat.isFile() || stat.size > MAX_COVERAGE_FILE_BYTES) { return undefined; }
        const content = fs.readFileSync(absPath, 'utf-8');
        return parsePerFileCoverageContent(absPath, content);
    } catch {
        return undefined;
    }
}

/**
 * Look up coverage percent for a file path extracted from a stack frame.
 * Tries normalized exact match first, then basename fallback.
 */
export function lookupCoverage(coverageMap: CoverageMap, filePath: string): number | undefined {
    const norm = stripPrefix(filePath);
    // Exact normalized match
    for (const [key, pct] of coverageMap) {
        if (key === norm || key.endsWith('/' + norm) || norm.endsWith('/' + key)) {
            return pct;
        }
    }
    // Basename fallback — only when unambiguous (single match).
    const basename = norm.split('/').pop() ?? '';
    if (!basename) { return undefined; }
    let found: number | undefined;
    let count = 0;
    for (const [key, pct] of coverageMap) {
        if (key.endsWith('/' + basename) || key === basename) {
            found = pct;
            count++;
            if (count > 1) { return undefined; } // Ambiguous — multiple files share basename.
        }
    }
    return found;
}
