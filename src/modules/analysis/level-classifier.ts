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

/** Valid severity levels. */
export type SeverityLevel = 'info' | 'warning' | 'error' | 'performance' | 'todo' | 'debug' | 'notice' | 'database';

// ── Structural patterns (hardcoded, not user-configurable) ──────────────

const logcatLevelPattern = /^([VDIWEFA])\//;
/** Threadtime format: `MM-DD HH:MM:SS.mmm  PID  TID LEVEL TAG: message` (from `adb logcat -v threadtime`). */
const threadtimeLevelPattern = /^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+\d+\s+\d+\s+([VDIWEFA])\s/;
// Drift SQL statement logs can contain enum values like "ApplicationLogError" in args.
const driftStatementPattern = /\bDrift:\s+Sent\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\b/i;

/** Strict structural error: keyword in label position (`Error:`, `[error]`), Dart private types, Null check. */
const strictStructuralErrorPattern = /\w*(?:error|exception)\s*[:\]!]|\[(?:error|exception|fatal|panic|critical)\]|_\w*(?:Error|Exception)\b|Null check operator/i;
/** Loose structural error: bare `error`/`exception` with negative lookahead, Dart private types, Null check. */
const looseStructuralErrorPattern = /\b(?:error|exception)(?!\s+(?:handl|recover|logg|report|track|manag|prone|bound|callback|safe))\b|_\w*(?:Error|Exception)\b|Null check operator/i;

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

/** True when the line is a Drift SQL trace (`Drift: Sent …`). */
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
    return kwError !== null && kwError.test(plainText);
}

function matchesPerf(plainText: string): boolean {
    if (structuralPerfPattern.test(plainText)) { return true; }
    return kwPerf !== null && kwPerf.test(plainText);
}

function classifyLogcat(prefix: string, plainText: string, strict: boolean): SeverityLevel {
    if (prefix === 'E' || prefix === 'F' || prefix === 'A') { return 'error'; }
    if (prefix === 'W') { return 'warning'; }
    if (matchesError(plainText, strict)) { return 'error'; }
    if (matchesPerf(plainText)) { return 'performance'; }
    if (flutterDartContextRe.test(plainText) && memoryPhraseRe.test(plainText)) { return 'performance'; }
    if (kwTodo?.test(plainText)) { return 'todo'; }
    if (prefix === 'V' || prefix === 'D' || kwDebug?.test(plainText)) { return 'debug'; }
    if (kwNotice?.test(plainText)) { return 'notice'; }
    if (genericSqlPattern.test(plainText)) { return 'database'; }
    return 'info';
}

function classifyNonError(plainText: string): SeverityLevel {
    // Memory phrases without Flutter/Dart context stay info.
    if (memoryPhraseRe.test(plainText) && !flutterDartContextRe.test(plainText)) { return 'info'; }
    if (kwWarn?.test(plainText)) { return 'warning'; }
    if (matchesPerf(plainText)) { return 'performance'; }
    if (flutterDartContextRe.test(plainText) && memoryPhraseRe.test(plainText)) { return 'performance'; }
    if (kwTodo?.test(plainText)) { return 'todo'; }
    if (kwDebug?.test(plainText)) { return 'debug'; }
    if (kwNotice?.test(plainText)) { return 'notice'; }
    if (genericSqlPattern.test(plainText)) { return 'database'; }
    return 'info';
}
