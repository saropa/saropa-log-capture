// cspell:disable

import { tagLevelMapJson } from '../../modules/analysis/tag-level-dictionary';

/**
 * Level classification patterns and the classifyLevel() webview function.
 * Mirrors level-classifier.ts (extension side). Keep structural patterns in sync.
 * Keyword patterns are rebuilt at runtime when severityKeywords config arrives.
 * TAG_LEVEL_MAP is baked in from tag-level-dictionary.ts (the single source of truth)
 * because this script is a string template and cannot import at webview runtime.
 */
export function getLevelClassifyScript(): string {
    return /* javascript */ `
// App-emitted head-tag dictionary, injected from tag-level-dictionary.ts. Keep the
// lookup mirror (headBracketTagPattern/matchesTagLevel below) in sync with that module.
var TAG_LEVEL_MAP = ${tagLevelMapJson()};
// ── Structural patterns (hardcoded) ─────────────────────────────────
// The '(' in the strict error char class catches the "<Type>Exception (detail)" shape
// (e.g. "PermissionDeniedException (no OS grant on file)") — without it that line fell
// through to 'info' and never reached the Errors filter. Mirrors level-classifier.ts.
// Strict drops /i on Error/Exception so prose like "classification error:" (lowercase)
// stays info — Dart label/type conventions are PascalCase. Bracket form (case-insensitive)
// is split into strictBracketErrorPattern so explicit [ERROR]/[error] tags still match.
// Private-type alt requires _[A-Z]… (PascalCase) to avoid matching snake_case identifiers
// like avoid_print_error — Dart private types are always _PascalCase.
// First alt is (?:Error|Exception)…, NOT \\w*(?:Error|Exception)… : the leading \\w* is
// redundant for an unanchored .test() (TypeError: still matches via Error: at offset 4) but
// caused O(n²) backtracking on long word-runs (~2.3 s for one 50 KB base64 line), freezing the
// host scan (issue #30). Dropping it is boolean-equivalent + linear. Mirrors level-classifier.ts.
var strictStructuralErrorPattern = /(?:Error|Exception)\\s*[:\\]!(]|_[A-Z]\\w*(?:Error|Exception)\\b|Null check operator/;
var strictBracketErrorPattern = /\\[(?:error|exception|fatal|panic)\\]/i;
var looseStructuralErrorPattern = /\\b(?:error|exception)(?!\\s+(?:handl|recover|logg|report|track|manag|prone|bound|callback|safe))\\b|_[A-Z]\\w*(?:Error|Exception)\\b|Null check operator/i;
// "critical" only signals error in a structural context (critical:, [critical], critical
// error/failure/exception/fault) — bare "critical" matches noun phrases like "critical CSS".
// Mirrors criticalSeverityPattern in level-classifier.ts. Keep in sync.
var criticalSeverityPattern = /\\[critical\\]|\\bcritical\\s*:|\\bcritical\\s+(?:errors?|failures?|exceptions?|faults?)\\b/i;
// Flutter framework exception banner: strict/loose patterns miss 'Exception caught by <lib>'
// because the phrase has no colon/bracket. Mirror extension-side level-classifier.ts.
var flutterExceptionBannerPattern = /\\bException caught by\\b/i;
var driftStatementPattern = /\\bDrift(?:\\:\\s+Sent|\\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\\s*\\:)\\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\\b/i;
// Drift's own perf annotations (SLOW <n>ms, REPEAT xN batches) carry the app's [database] head
// tag but are performance signals, not routine SQL — classify as performance so the Database
// filter can be off while they still surface under Performance. Mirrors level-classifier.ts.
var driftPerfPattern = /\\bDrift\\s+(?:SLOW\\s+\\d+\\s*ms|REPEAT\\s+x\\d+)\\b/i;
// Curated DB-vendor tokens. Mirrors level-classifier.ts. Bare "DB" / "SQL"
// are excluded to avoid false positives on common English text.
var databaseVendorTokensSrc = '(?:Drift|Isar|Sqlite3|Sqlite|Sqflite|Hive|Realm|Postgres|MySQL|MongoDB?|Prisma|DynamoDB)';
// Bracket tag at line head containing a DB vendor token (e.g. "[IsarDriftRowCountAudit] ...").
// Anchored to line start (after optional logcat/threadtime/[log] shells) so a
// mid-message "[Drift]" mention does not promote the whole line to database.
var databaseBracketTagPattern = new RegExp(
    '^(?:[VDIWEFA]\\\\/[^:]*:\\\\s*)?'
    + '(?:\\\\d{2}-\\\\d{2}\\\\s+\\\\d{2}:\\\\d{2}:\\\\d{2}\\\\.\\\\d{3}\\\\s+\\\\d+\\\\s+\\\\d+\\\\s+[VDIWEFA]\\\\s+[^:]*:\\\\s*)?'
    + '(?:\\\\[log\\\\]\\\\s*)?'
    + '\\\\[[^\\\\]]*' + databaseVendorTokensSrc + '[^\\\\]]*\\\\]',
    'i',
);
// "Vendor:" prefix at line head (e.g. "DRIFT: VM Service WebSocket connect failed").
var databaseColonPrefixPattern = new RegExp(
    '^(?:[VDIWEFA]\\\\/[^:]*:\\\\s*)?'
    + '(?:\\\\d{2}-\\\\d{2}\\\\s+\\\\d{2}:\\\\d{2}:\\\\d{2}\\\\.\\\\d{3}\\\\s+\\\\d+\\\\s+\\\\d+\\\\s+[VDIWEFA]\\\\s+[^:]*:\\\\s*)?'
    + '(?:\\\\[log\\\\]\\\\s*)?'
    + databaseVendorTokensSrc + '\\\\s*:',
    'i',
);
function matchesDatabaseAnnotation(plainText) {
    return databaseBracketTagPattern.test(plainText)
        || databaseColonPrefixPattern.test(plainText);
}
// App-emitted head bracket tag → level. Mirrors headBracketTagPattern/matchesTagLevel in
// tag-level-dictionary.ts; same optional logcat/threadtime/[log] shells, captures the first
// [tag] inner text (group 1) and splits on the first colon so [db:phase 2] resolves to 'db'.
var headBracketTagPattern = new RegExp(
    '^(?:[VDIWEFA]\\\\/[^:]*:\\\\s*)?'
    + '(?:\\\\d{2}-\\\\d{2}\\\\s+\\\\d{2}:\\\\d{2}:\\\\d{2}\\\\.\\\\d{3}\\\\s+\\\\d+\\\\s+\\\\d+\\\\s+[VDIWEFA]\\\\s+[^:]*:\\\\s*)?'
    + '(?:\\\\[log\\\\]\\\\s*)?'
    + '\\\\[([^\\\\]]+)\\\\]',
);
function tagNameBeforeColon(rawTag) {
    var colon = rawTag.indexOf(':');
    var name = colon === -1 ? rawTag : rawTag.slice(0, colon);
    return name.trim().toLowerCase();
}
function lookupTagLevel(tagName) {
    return TAG_LEVEL_MAP[tagName.toLowerCase()] || null;
}
function matchesTagLevel(plainText) {
    var m = headBracketTagPattern.exec(plainText);
    if (!m || !m[1]) return null;
    return lookupTagLevel(tagNameBeforeColon(m[1]));
}
var structuralPerfPattern = /\\b(skipped\\s+\\d+\\s+frames?|gc\\s+(?:pause|freed|concurrent)|took\\s+\\d+(?:\\.\\d+)?\\s*(?:ms|s)\\b|duration\\s*:\\s*\\d+(?:\\.\\d+)?\\s*(?:ms|s)\\b)\\b/i;
// Structural warning: "could not / unable to / failed to / cannot <verb>" failure phrasing
// with no warn/fail keyword (e.g. "databaseDecode: could not decode …"). Mirrors level-classifier.ts.
// Negative lookahead excludes perception/cognition verbs ("cannot see/tell/think") so
// prose comments embedded in saropa-lint reports don't classify as warnings.
var structuralWarnPattern = /\\b(?:could\\s*not|couldn't|cannot|unable\\s+to|failed\\s+to)\\s+(?!(?:see|tell|say|imagine|think|know|believe|recall|remember|hear|feel|guess|understand|wait|help)\\b)\\w/i;
var strictLevelDetection = true;
var stderrTreatAsError = false;
var flutterDartContextRe = /(?:^[VDIW]\\/(?:flutter|dart)[\\s:]|package\\/(?:flutter|dart)\\b)/i;
var memoryPhraseRe = /\\b(Memory\\s*:\\s*\\d+|memory\\s+(?:pressure|usage|leak)|(?:old|new)\\s+gen\\s|retained\\s+\\d+|leak\\s+detected|potential\\s+leak)\\b/i;
var genericSqlPattern = /\\bSELECT\\b.{1,80}\\bFROM\\b|\\bINSERT\\s+INTO\\b|\\bUPDATE\\b\\s+\\S+\\s+SET\\b|\\bDELETE\\s+FROM\\b|\\bCREATE\\s+(?:TABLE|INDEX|VIEW)\\b|\\bALTER\\s+(?:TABLE|INDEX)\\b|\\bDROP\\s+(?:TABLE|INDEX|VIEW)\\b|\\bPRAGMA\\s+\\w+/i;

var logcatLevelPattern = /^([VDIWEFA])\\//;
var logcatLetterAnywhere = /\\b([VDIWEFA])\\//;
var threadtimeLevelPattern = /^\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2}\\.\\d{3}\\s+\\d+\\s+\\d+\\s+([VDIWEFA])\\s/;

// ── Keyword patterns (rebuilt from config) ──────────────────────────
var kwError = /\\b(fatal|panic)\\b/i;
var kwWarn = /\\b(warn|warning|caution|fail|failed|failure)\\b/i;
var kwPerf = /\\b(perf|dropped\\s+frame|fps|framerate|jank|stutter|choreographer|doing\\s+too\\s+much\\s+work|anr|application\\s+not\\s+responding|slow\\s+operation)\\b/i;
var kwTodo = /\\b(TODO|FIXME|HACK|XXX|BUG|KLUDGE|WORKAROUND)\\b/i;
var kwDebug = /\\b(breadcrumb|trace|debug)\\b/i;
var kwNotice = /\\b(notice|note|important)\\b/i;

function escapeRegexKw(s) {
    return s.replace(/[.*+?^$` + '{}' + `()|[\\]\\\\]/g, '\\\\$&');
}

function buildKeywordPattern(keywords) {
    if (!keywords || keywords.length === 0) return null;
    var alts = keywords.map(function(k) { return escapeRegexKw(k).replace(/\\s+/g, '\\\\s+'); });
    return new RegExp('\\\\b(' + alts.join('|') + ')\\\\b', 'i');
}

function applySeverityKeywords(kw) {
    if (!kw) return;
    kwError = buildKeywordPattern(kw.error);
    kwWarn = buildKeywordPattern(kw.warning);
    kwPerf = buildKeywordPattern(kw.performance);
    kwTodo = buildKeywordPattern(kw.todo);
    kwDebug = buildKeywordPattern(kw.debug);
    kwNotice = buildKeywordPattern(kw.notice);
}

function isDriftSqlStatementLine(plainText) {
    return driftStatementPattern.test(plainText);
}

function matchesError(plainText) {
    var sp = strictLevelDetection ? strictStructuralErrorPattern : looseStructuralErrorPattern;
    if (sp.test(plainText)) return true;
    // Bracket label form only fires in strict mode — loose mode already matches via the
    // bare \\berror\\b keyword. Strict drops /i to filter lowercase "error:" in prose,
    // so brackets need their own /i regex to stay unambiguous.
    if (strictLevelDetection && strictBracketErrorPattern.test(plainText)) return true;
    // Flutter banner: unambiguous error marker regardless of strict mode.
    if (flutterExceptionBannerPattern.test(plainText)) return true;
    // "critical" is structural, not a bare keyword — see criticalSeverityPattern.
    if (criticalSeverityPattern.test(plainText)) return true;
    return kwError !== null && kwError.test(plainText);
}

function matchesPerf(plainText) {
    if (structuralPerfPattern.test(plainText)) return true;
    return kwPerf !== null && kwPerf.test(plainText);
}

function classifyLevel(plainText, category) {
    if (stderrTreatAsError && category === 'stderr') return 'error';
    // Drift SLOW/REPEAT perf annotations win over the [database] tag and Drift SQL grouping —
    // performance signals, not DB traffic. Mirrors level-classifier.ts. Keep in sync.
    if (driftPerfPattern.test(plainText)) return 'performance';
    if (driftStatementPattern.test(plainText)) return 'database';
    var lcm = logcatLevelPattern.exec(plainText) || threadtimeLevelPattern.exec(plainText);
    if (lcm) {
        var L = lcm[1];
        if (L === 'E' || L === 'F' || L === 'A') return 'error';
        // Android frameworks emit perf events at W/ (e.g. W/ActivityManager: Slow operation,
        // W/Choreographer: Skipped N frames). Let perf matches promote above the W short-circuit
        // so they are classified as 'performance' instead of generic 'warning'.
        if (L === 'W' && matchesPerf(plainText)) return 'performance';
        if (L === 'W') return 'warning';
        if (matchesError(plainText)) return 'error';
        if (matchesPerf(plainText)) return 'performance';
        if (flutterDartContextRe.test(plainText) && memoryPhraseRe.test(plainText)) return 'performance';
        if (kwTodo && kwTodo.test(plainText)) return 'todo';
        if (L === 'V' || L === 'D') return 'debug';
        if (kwDebug && kwDebug.test(plainText)) return 'debug';
        if (kwNotice && kwNotice.test(plainText)) return 'notice';
        // App-emitted head tag and DB-vendor annotation run before genericSqlPattern so an
        // I/flutter line like "[db] connection pool warming" / "[Drift] …" with no SQL keyword
        // still classifies by tag. Both stay after the W-warning short-circuit on purpose: an
        // explicit W/ from logcat is a stronger signal than a vendor or app tag.
        var lcTagLevel = matchesTagLevel(plainText);
        if (lcTagLevel) return lcTagLevel;
        if (matchesDatabaseAnnotation(plainText)) return 'database';
        if (genericSqlPattern.test(plainText)) return 'database';
        return 'info';
    }
    if (matchesError(plainText)) return 'error';
    // Explicit app-emitted head tag ([db] …, [perf:phase 2] …) wins over the generic
    // warning/perf keyword sweep so "[db] bulkPreload failed" is database, not warning.
    // Runs AFTER the error check so "[db] Error: lost connection" still classifies as error.
    var tagLevel = matchesTagLevel(plainText);
    if (tagLevel) return tagLevel;
    // matchesDatabaseAnnotation keeps the non-bracket "Vendor:" colon-prefix arm (e.g.
    // "DRIFT: VM Service WebSocket connect failed"); the head-tag dictionary above
    // supersedes its bracket arm. Both sit ahead of the keyword sweep for the same reason.
    if (matchesDatabaseAnnotation(plainText)) return 'database';
    if (memoryPhraseRe.test(plainText) && !flutterDartContextRe.test(plainText)) return 'info';
    if (kwWarn && kwWarn.test(plainText)) return 'warning';
    // Structural failure phrasing ("could not decode …") with no warn/fail keyword.
    // Not applied on the logcat path above on purpose — there the prefix is authority.
    if (structuralWarnPattern.test(plainText)) return 'warning';
    if (matchesPerf(plainText)) return 'performance';
    if (flutterDartContextRe.test(plainText) && memoryPhraseRe.test(plainText)) return 'performance';
    if (kwTodo && kwTodo.test(plainText)) return 'todo';
    if (kwDebug && kwDebug.test(plainText)) return 'debug';
    if (kwNotice && kwNotice.test(plainText)) return 'notice';
    if (genericSqlPattern.test(plainText)) return 'database';
    return 'info';
}`;
}
