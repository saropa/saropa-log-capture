/**
 * Drift / SQLite SQL fingerprint normalization (plan **DB_02** — DB noise guardrails).
 *
 * ## Purpose
 * Produce a **compact, stable string** for grouping identical *statement shapes* in the log viewer:
 * N+1 heuristics, `dbInsight` rollups, SQL pattern chips, and in-log search. The goal is to avoid
 * high-cardinality tokens (literals, UUIDs, bare integers) becoming unique “chips” or fingerprint keys.
 *
 * ## Algorithm (keep in sync with the webview)
 * 1. Replace **unquoted UUID** tokens with `?`.
 * 2. Replace SQLite **hex blobs** `x'…'` with `?`.
 * 3. Replace **single-quoted** literals (including SQL `''` escapes) with `?`.
 * 4. Replace **double-quoted** strings (e.g. quoted identifiers) with `?`.
 * 5. Replace **bare integers** (`\b\d+\b`) with `?`.
 * 6. Collapse whitespace and trim.
 * 7. Lowercase the remainder, then **uppercase** tokens matching the exported keyword alternation
 *    `DRIFT_SQL_KEYWORD_ALT` so the
 *    fingerprint reads as “SQL keyword shape” while staying deterministic.
 *
 * ## Explicit non-goals / risks
 * - **Bound arguments** are **not** part of this string — they live in `argsKey` on `parseDriftSqlFingerprint`.
 * - **Over-normalization:** different tables/clauses can collapse to the same fingerprint when literals and
 *   quoted names are stripped (accepted tradeoff per DB_02 risk note; tune keyword list if needed).
 *
 * **Embed sync:** `viewer-data-n-plus-one-script.ts` must mirror this function in embedded JavaScript
 * (`normalizeDriftSqlFingerprintSql` + `new RegExp('\\b(?:' + DRIFT_SQL_KEYWORD_ALT + ')\\b', 'gi')`).
 */

/** Keyword alternation for `RegExp` — sorted longest-first so multi-word tokens win under `\b`. */
const DRIFT_SQL_KEYWORDS_SORTED = [
    'recursive', 'constraint', 'references', 'intersect', 'deferrable', 'temporary',
    'distinct', 'natural', 'cascade', 'default', 'foreign', 'primary', 'rollback',
    'trigger', 'unique', 'except', 'having', 'offset', 'values', 'savepoint', 'release',
    'returning', 'transaction', 'unbounded', 'preceding', 'following', 'partition',
    'select', 'insert', 'update', 'delete', 'create', 'commit', 'pragma', 'exists',
    'replace', 'table', 'index', 'where', 'begin', 'inner', 'cross', 'right', 'outer',
    'order', 'group', 'union', 'using', 'limit', 'into', 'from', 'join', 'left',
    'with', 'case', 'when', 'then', 'else', 'end', 'and', 'not', 'null', 'asc',
    'desc', 'like', 'between', 'in', 'is', 'on', 'as', 'or', 'by', 'if', 'set', 'all',
    'key', 'drop', 'alter', 'add', 'row', 'view',
] as const;

/** Exported for the webview embed RegExp constructor. */
export const DRIFT_SQL_KEYWORD_ALT: string = [...DRIFT_SQL_KEYWORDS_SORTED]
    .sort((a, b) => b.length - a.length)
    .join('|');

const DRIFT_SQL_KEYWORD_RE = new RegExp(`\\b(?:${DRIFT_SQL_KEYWORD_ALT})\\b`, 'gi');

/**
 * Normalize raw SQL (no `with args` tail) to a fingerprint key.
 * Never includes bound-arg payloads — those stay in `argsKey` on the parse result.
 */
export function normalizeDriftSqlFingerprintSql(sql: string): string {
    if (!sql) {
        return '';
    }
    let s = sql;
    // Unquoted UUIDs (high-cardinality ids in generated SQL).
    s = s.replace(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
        '?',
    );
    // SQLite hex blobs before generic quoted literals.
    s = s.replace(/x'[0-9a-f]*'/gi, '?');
    // Single-quoted literals including SQL '' escapes.
    s = s.replace(/'(?:[^']|'')*'/g, '?');
    s = s.replace(/"[^"]*"/g, '?');
    s = s.replace(/\b\d+\b/g, '?');
    s = s.replace(/\s+/g, ' ').trim();
    if (!s) {
        return '';
    }
    s = s.toLowerCase();
    s = s.replace(DRIFT_SQL_KEYWORD_RE, (w) => w.toUpperCase());
    return s;
}
