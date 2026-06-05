/**
 * Extension-side severity level classification.
 * Mirrors `viewer-level-classify.ts` (embedded webview script). Keep patterns in sync.
 * Used by viewer level filter, analysis panel, and error classification.
 *
 * Structural patterns (logcat prefixes, bracket notation, Dart types, SQL) are hardcoded.
 * Keyword patterns are built from user-configurable {@link SeverityKeywords} lists.
 */

import type { SeverityKeywords } from "../config/config-types";
import { DEFAULT_SEVERITY_KEYWORDS } from "../config/config-normalizers";
import { matchesTagLevel, type SeverityLevel } from "./tag-level-dictionary";

// SeverityLevel now lives in tag-level-dictionary.ts (shared with the dictionary).
// Re-exported here so existing importers of this module keep working unchanged.
export type { SeverityLevel };

// ── Structural patterns (hardcoded, not user-configurable) ──────────────

const logcatLevelPattern = /^([VDIWEFA])\//;
/** Threadtime format: `MM-DD HH:MM:SS.mmm  PID  TID LEVEL TAG: message` (from `adb logcat -v threadtime`). */
const threadtimeLevelPattern = /^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+\d+\s+\d+\s+([VDIWEFA])\s/;
// Drift SQL statement logs can contain enum values like "ApplicationLogError" in args.
// Matches both LogInterceptor (`Drift: Sent SELECT`) and DriftDebugInterceptor (`Drift SELECT: SELECT`).
const driftStatementPattern = /\bDrift(?::\s+Sent|\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\s*:)\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\b/i;

/**
 * Vendor tokens that strongly imply database content when they appear as a
 * leading bracket tag or `Vendor:` prefix. Curated — bare "DB" / "SQL" are
 * intentionally excluded to avoid false positives on common English text
 * (e.g. "DB connection issue" in a non-DB log line, "SQL injection" in a
 * security advisory). Add new vendors only when the token is unambiguous in
 * isolation.
 */
const databaseVendorTokens = '(?:Drift|Isar|Sqlite3|Sqlite|Sqflite|Hive|Realm|Postgres|MySQL|MongoDB?|Prisma|DynamoDB)';

/**
 * Bracket tag at line head containing a DB vendor token, e.g.:
 *   "[Drift] log message"           → bracket = "[Drift]"
 *   "[IsarDriftRowCountAudit] ..."  → bracket contains "Isar" + "Drift"
 *   "[log] [SqliteCache] ..."       → outer "[log]" tolerated, inner tag matches
 *   "I/flutter (12): [Drift] ..."   → logcat prefix tolerated
 * Anchored to line start (after optional logcat/threadtime/`[log]` shells) so
 * a mid-message mention like "see [Drift] for details" doesn't promote.
 */
const databaseBracketTagPattern = new RegExp(
    '^(?:[VDIWEFA]\\/[^:]*:\\s*)?'           // optional logcat prefix
    + '(?:\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2}\\.\\d{3}\\s+\\d+\\s+\\d+\\s+[VDIWEFA]\\s+[^:]*:\\s*)?' // optional threadtime
    + '(?:\\[log\\]\\s*)?'                    // optional Flutter [log] shell
    + '\\[[^\\]]*' + databaseVendorTokens + '[^\\]]*\\]',
    'i',
);

/**
 * `Vendor:` colon prefix at line head, e.g.:
 *   "DRIFT: VM Service WebSocket connect failed"
 *   "Drift: Sent SELECT ..."  (also caught by driftStatementPattern, this is broader)
 *   "Isar: opened collection x"
 *   "[log] Database: rolling back transaction"
 * Anchored to line start so "the Drift: project is..." mid-message doesn't promote.
 */
const databaseColonPrefixPattern = new RegExp(
    '^(?:[VDIWEFA]\\/[^:]*:\\s*)?'           // optional logcat prefix
    + '(?:\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2}\\.\\d{3}\\s+\\d+\\s+\\d+\\s+[VDIWEFA]\\s+[^:]*:\\s*)?' // optional threadtime
    + '(?:\\[log\\]\\s*)?'                    // optional Flutter [log] shell
    + databaseVendorTokens + '\\s*:',
    'i',
);

/** True when the line opens with a DB vendor bracket tag or `Vendor:` prefix. */
function matchesDatabaseAnnotation(plainText: string): boolean {
    return databaseBracketTagPattern.test(plainText)
        || databaseColonPrefixPattern.test(plainText);
}

/**
 * Strict structural error: keyword in label position (`Error:`), Dart private types,
 * Null check. Case-sensitive on `Error`/`Exception` so prose like
 * `classification error: rule lumps …` (lowercase mid-sentence) stays as `info` —
 * Dart label and type conventions are always PascalCase, so requiring an uppercase
 * `E` distinguishes log labels from English nouns without losing real cases like
 * `TypeError:` or `PermissionDeniedException (no OS grant)`.
 * Private-type alt requires `_[A-Z]…` to avoid matching snake_case identifiers like
 * `avoid_print_error` (rule names in lint reports), which the previous `_\w*` form
 * matched because `\w` includes `_`. Dart private types are always `_PascalCase`.
 * The `(` in the char class catches the `<Type>Exception (detail)` / `<Type>Error (detail)`
 * shape — e.g. `PermissionDeniedException (no OS grant on file)`. Without it, an exception
 * object printed with a parenthesized detail (no trailing colon) fell through to `info`,
 * so it never reached the Errors filter and the E toggle could read zero on a log that
 * plainly contained errors. See plans/history/2026.05/2026.05.15/054_plan-viewer-stack-noise-filter-layout.md Item D.
 */
const strictStructuralErrorPattern = /\w*(?:Error|Exception)\s*[:\]!(]|_[A-Z]\w*(?:Error|Exception)\b|Null check operator/;
/**
 * Bracket label form is case-insensitive — explicit log tags like `[ERROR]`, `[error]`,
 * `[fatal]` are unambiguous error markers regardless of case. Kept separate from
 * `strictStructuralErrorPattern` because the latter dropped the `/i` flag to filter out
 * lowercase `error:` in prose; bracket tags don't have that ambiguity.
 */
const strictBracketErrorPattern = /\[(?:error|exception|fatal|panic)\]/i;
/**
 * Loose structural error: bare `error`/`exception` with negative lookahead, Dart private
 * types, Null check. Private-type alt requires `_[A-Z]…` (PascalCase) for the same reason
 * as `strictStructuralErrorPattern`: avoid matching snake_case identifiers.
 */
const looseStructuralErrorPattern = /\b(?:error|exception)(?!\s+(?:handl|recover|logg|report|track|manag|prone|bound|callback|safe))\b|_[A-Z]\w*(?:Error|Exception)\b|Null check operator/i;
/**
 * "critical" only signals error severity in a structural context: a colon/bracket label
 * (`critical:`, `[critical]`) or paired with a severity noun (`critical error/failure/
 * exception/fault`). Bare "critical" is a common adjective in non-severity noun phrases —
 * "critical CSS", "critical path", "critical section" — and was promoting ordinary build
 * output to error (whole rows reddened, E count inflated). So "critical" was removed from
 * the default error keyword list and from the strict bracket group above, and gated behind
 * this pattern in matchesError() instead. Applies in both strict and loose mode — `[critical]`
 * was previously caught loosely via the kwError keyword, so this preserves that.
 * Mirrored in viewer-level-classify.ts. Keep in sync.
 */
const criticalSeverityPattern = /\[critical\]|\bcritical\s*:|\bcritical\s+(?:errors?|failures?|exceptions?|faults?)\b/i;
/**
 * Flutter framework exception banner: `════ Exception caught by <library> ════`.
 * Why: strict/loose patterns require `Exception:` / `[exception]` / `_Exception` shapes, so
 * the `Exception caught by` phrase (space-separated, no colon) falls through to `info` and
 * the whole rendering error block ends up hidden under the Errors/Warnings filter.
 * This is Flutter's canonical error title for rendering/widgets/scheduler/gesture/services —
 * always an error, never an excluded handler/recovery phrase.
 */
const flutterExceptionBannerPattern = /\bException caught by\b/i;

/**
 * Structural warning: "could not / unable to / failed to / cannot <verb>" failure phrasing
 * that carries no `warn`/`fail` keyword. Catches lines like
 * `databaseDecode: could not decode "{…}" as DatabaseValueType.Json` — a real,
 * actionable failure that otherwise classified as `info` and vanished under the level
 * filter. Requires a following word so a bare trailing "cannot." does not match.
 *
 * Negative lookahead for perception / cognition verbs: in prose comments like
 * `rule's single-method scope cannot see the pair`, "cannot see" is metaphorical, not
 * an actionable failure. Real failures always pair with an I/O / system-action verb
 * (open/read/connect/parse/...), never with perception verbs. Without the exclusion,
 * lint-report comments embedded in saropa-lint output classified as warnings.
 * See plans/history/2026.05/2026.05.15/054_plan-viewer-stack-noise-filter-layout.md Item D.
 */
const structuralWarnPattern = /\b(?:could\s*not|couldn't|cannot|unable\s+to|failed\s+to)\s+(?!(?:see|tell|say|imagine|think|know|believe|recall|remember|hear|feel|guess|understand|wait|help)\b)\w/i;

/** Performance patterns that use regex features (quantifiers, alternation) and can't be simple keywords. */
const structuralPerfPattern = /\b(skipped\s+\d+\s+frames?|gc\s+(?:pause|freed|concurrent))\b/i;
const anrPattern = /\b(anr|application\s+not\s+responding|input\s+dispatching\s+timed\s+out)\b/i;

// Flutter/Dart memory: applied only when line has Flutter/Dart context.
const flutterDartContextRe = /(?:^[VDIW]\/(?:flutter|dart)[\s:]|package[\/:](?:flutter|dart)\b)/i;
const memoryPhraseRe = /\b(Memory\s*:\s*\d+|memory\s+(?:pressure|usage|leak)|(?:old|new)\s+gen\s|retained\s+\d+|leak\s+detected|potential\s+leak)\b/i;

// Generic SQL: requires structural keyword pairs to avoid false positives on bare words.
const genericSqlPattern = /\bSELECT\b.{1,80}\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\b\s+\S+\s+SET\b|\bDELETE\s+FROM\b|\bCREATE\s+(?:TABLE|INDEX|VIEW)\b|\bALTER\s+(?:TABLE|INDEX)\b|\bDROP\s+(?:TABLE|INDEX|VIEW)\b|\bPRAGMA\s+\w+/i;

// ── Keyword patterns (rebuilt from config) ──────────────────────────────

let kwError: RegExp | null = null;
let kwWarn: RegExp | null = null;
let kwPerf: RegExp | null = null;
let kwTodo: RegExp | null = null;
let kwDebug: RegExp | null = null;
let kwNotice: RegExp | null = null;

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build a `\b(word1|word2)\b` regex from a keyword list, or null if empty. */
export function buildKeywordPattern(keywords: readonly string[]): RegExp | null {
    if (keywords.length === 0) { return null; }
    const alts = keywords.map((k) => escapeRegex(k).replace(/\s+/g, '\\s+'));
    return new RegExp(`\\b(${alts.join('|')})\\b`, 'i');
}

function rebuildKeywordPatterns(kw: SeverityKeywords): void {
    kwError = buildKeywordPattern(kw.error);
    kwWarn = buildKeywordPattern(kw.warning);
    kwPerf = buildKeywordPattern(kw.performance);
    kwTodo = buildKeywordPattern(kw.todo);
    kwDebug = buildKeywordPattern(kw.debug);
    kwNotice = buildKeywordPattern(kw.notice);
}

// Initialize with defaults.
rebuildKeywordPatterns(DEFAULT_SEVERITY_KEYWORDS);

/** Update cached keyword patterns from user config. Call when settings change. */
export function setSeverityKeywords(kw: SeverityKeywords): void {
    rebuildKeywordPatterns(kw);
}

// ── Public API ──────────────────────────────────────────────────────────

/** True when the line is a Drift SQL trace (`Drift: Sent …` or `Drift SELECT: …`). */
export function isDriftSqlStatementLine(plainText: string): boolean {
    return driftStatementPattern.test(plainText);
}

/**
 * Classify a plain-text log line into a severity level.
 *
 * @param stderrTreatAsError When `true`, forces `error` for DAP category `stderr`.
 */
export function classifyLevel(
    plainText: string,
    category: string,
    strict: boolean,
    stderrTreatAsError = true,
): SeverityLevel {
    if (stderrTreatAsError && category === 'stderr') { return 'error'; }
    if (driftStatementPattern.test(plainText)) { return 'database'; }
    const lcm = logcatLevelPattern.exec(plainText) ?? threadtimeLevelPattern.exec(plainText);
    if (lcm) { return classifyLogcat(lcm[1], plainText, strict); }
    if (matchesError(plainText, strict)) { return 'error'; }
    // Explicit app-emitted head tag (`[db] …`, `[perf:phase 2] …`) wins over the generic
    // warning/perf keyword sweep so `[db] bulkPreload failed` is database, not warning. Runs
    // AFTER the error check so `[db] Error: lost connection` still classifies as error.
    const tagLevel = matchesTagLevel(plainText);
    if (tagLevel) { return tagLevel; }
    // matchesDatabaseAnnotation keeps the non-bracket `Vendor:` colon-prefix arm
    // (e.g. "DRIFT: VM Service WebSocket connect failed"); the head-tag dictionary above
    // supersedes its bracket arm. Both still sit ahead of the keyword sweep for the same
    // reason: a "failed"/"warning" word in a DB line must not outrank the DB grouping.
    if (matchesDatabaseAnnotation(plainText)) { return 'database'; }
    return classifyNonError(plainText);
}

/** Whether the text matches an ANR-specific pattern (subset of performance). */
export function isAnrLine(plainText: string): boolean { return anrPattern.test(plainText); }

/** Whether a level represents an actionable event (shown on timeline). */
export function isActionableLevel(level: SeverityLevel): boolean {
    return level === 'error' || level === 'warning' || level === 'performance' || level === 'todo';
}

// ── Internal ────────────────────────────────────────────────────────────

/** Structural + keyword error check. */
function matchesError(plainText: string, strict: boolean): boolean {
    const structural = strict ? strictStructuralErrorPattern : looseStructuralErrorPattern;
    if (structural.test(plainText)) { return true; }
    // Bracket label form (`[error]`, `[ERROR]`) is case-insensitive and only needed in
    // strict mode — loose mode already matches via the bare `\berror\b` keyword. Strict
    // dropped `/i` on the main structural pattern to filter lowercase `error:` in prose,
    // so brackets need a separate /i regex to stay unambiguous.
    if (strict && strictBracketErrorPattern.test(plainText)) { return true; }
    // Flutter banner runs independently of strict/loose — it is unambiguous even in strict mode.
    if (flutterExceptionBannerPattern.test(plainText)) { return true; }
    // "critical" is structural, not a bare keyword — see criticalSeverityPattern.
    if (criticalSeverityPattern.test(plainText)) { return true; }
    return kwError !== null && kwError.test(plainText);
}

function matchesPerf(plainText: string): boolean {
    if (structuralPerfPattern.test(plainText)) { return true; }
    return kwPerf !== null && kwPerf.test(plainText);
}

function classifyLogcat(prefix: string, plainText: string, strict: boolean): SeverityLevel {
    if (prefix === 'E' || prefix === 'F' || prefix === 'A') { return 'error'; }
    // Android frameworks emit perf events at W/ level — e.g.
    //   W/ActivityManager: Slow operation: 51ms so far, now at startProcess: …
    //   W/Choreographer:   Skipped 30 frames!
    // These are semantically performance signals, not ambiguous warnings, so
    // let structural/keyword perf matches promote ahead of the W short-circuit.
    // Non-perf W/ lines still fall through to 'warning' below.
    if (prefix === 'W' && matchesPerf(plainText)) { return 'performance'; }
    if (prefix === 'W') { return 'warning'; }
    if (matchesError(plainText, strict)) { return 'error'; }
    if (matchesPerf(plainText)) { return 'performance'; }
    if (flutterDartContextRe.test(plainText) && memoryPhraseRe.test(plainText)) { return 'performance'; }
    if (kwTodo?.test(plainText)) { return 'todo'; }
    if (prefix === 'V' || prefix === 'D' || kwDebug?.test(plainText)) { return 'debug'; }
    if (kwNotice?.test(plainText)) { return 'notice'; }
    // App-emitted head tag and DB-vendor annotation run before genericSqlPattern so an
    // I/flutter line like "[db] connection pool warming" / "[Drift] …" without a SQL keyword
    // still classifies by tag. Both stay after the W-warning short-circuit on purpose: an
    // explicit W/ from logcat is a stronger signal than a vendor or app tag.
    const tagLevel = matchesTagLevel(plainText);
    if (tagLevel) { return tagLevel; }
    if (matchesDatabaseAnnotation(plainText)) { return 'database'; }
    if (genericSqlPattern.test(plainText)) { return 'database'; }
    return 'info';
}

function classifyNonError(plainText: string): SeverityLevel {
    // Memory phrases without Flutter/Dart context stay info.
    if (memoryPhraseRe.test(plainText) && !flutterDartContextRe.test(plainText)) { return 'info'; }
    if (kwWarn?.test(plainText)) { return 'warning'; }
    // Structural failure phrasing ("could not decode …") with no warn/fail keyword.
    // Not applied on the logcat path on purpose — there the prefix is authority.
    if (structuralWarnPattern.test(plainText)) { return 'warning'; }
    if (matchesPerf(plainText)) { return 'performance'; }
    if (flutterDartContextRe.test(plainText) && memoryPhraseRe.test(plainText)) { return 'performance'; }
    if (kwTodo?.test(plainText)) { return 'todo'; }
    if (kwDebug?.test(plainText)) { return 'debug'; }
    if (kwNotice?.test(plainText)) { return 'notice'; }
    if (genericSqlPattern.test(plainText)) { return 'database'; }
    return 'info';
}
