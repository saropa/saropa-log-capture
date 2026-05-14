// cspell:disable

/**
 * Level classification patterns and the classifyLevel() webview function.
 * Mirrors level-classifier.ts (extension side). Keep structural patterns in sync.
 * Keyword patterns are rebuilt at runtime when severityKeywords config arrives.
 */
export function getLevelClassifyScript(): string {
    return /* javascript */ `
// ── Structural patterns (hardcoded) ─────────────────────────────────
// The '(' in the strict error char class catches the "<Type>Exception (detail)" shape
// (e.g. "PermissionDeniedException (no OS grant on file)") — without it that line fell
// through to 'info' and never reached the Errors filter. Mirrors level-classifier.ts.
var strictStructuralErrorPattern = /\\w*(?:error|exception)\\s*[:\\]!(]|\\[(?:error|exception|fatal|panic|critical)\\]|_\\w*(?:Error|Exception)\\b|Null check operator/i;
var looseStructuralErrorPattern = /\\b(?:error|exception)(?!\\s+(?:handl|recover|logg|report|track|manag|prone|bound|callback|safe))\\b|_\\w*(?:Error|Exception)\\b|Null check operator/i;
// Flutter framework exception banner: strict/loose patterns miss 'Exception caught by <lib>'
// because the phrase has no colon/bracket. Mirror extension-side level-classifier.ts.
var flutterExceptionBannerPattern = /\\bException caught by\\b/i;
var driftStatementPattern = /\\bDrift(?:\\:\\s+Sent|\\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\\s*\\:)\\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\\b/i;
// Curated DB-vendor tokens. Mirrors level-classifier.ts. Bare "DB" / "SQL"
// are excluded to avoid false positives on common English text.
var databaseVendorTokensSrc = '(?:Drift|Isar|Sqlite|Sqflite|Hive|Realm|Postgres|MySQL|MongoDB?)';
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
var structuralPerfPattern = /\\b(skipped\\s+\\d+\\s+frames?|gc\\s+(?:pause|freed|concurrent))\\b/i;
// Structural warning: "could not / unable to / failed to / cannot <verb>" failure phrasing
// with no warn/fail keyword (e.g. "databaseDecode: could not decode …"). Mirrors level-classifier.ts.
var structuralWarnPattern = /\\b(?:could\\s*not|couldn't|cannot|unable\\s+to|failed\\s+to)\\s+\\w/i;
var strictLevelDetection = true;
var stderrTreatAsError = false;
var flutterDartContextRe = /(?:^[VDIW]\\/(?:flutter|dart)[\\s:]|package\\/(?:flutter|dart)\\b)/i;
var memoryPhraseRe = /\\b(Memory\\s*:\\s*\\d+|memory\\s+(?:pressure|usage|leak)|(?:old|new)\\s+gen\\s|retained\\s+\\d+|leak\\s+detected|potential\\s+leak)\\b/i;
var genericSqlPattern = /\\bSELECT\\b.{1,80}\\bFROM\\b|\\bINSERT\\s+INTO\\b|\\bUPDATE\\b\\s+\\S+\\s+SET\\b|\\bDELETE\\s+FROM\\b|\\bCREATE\\s+(?:TABLE|INDEX|VIEW)\\b|\\bALTER\\s+(?:TABLE|INDEX)\\b|\\bDROP\\s+(?:TABLE|INDEX|VIEW)\\b|\\bPRAGMA\\s+\\w+/i;

var logcatLevelPattern = /^([VDIWEFA])\\//;
var logcatLetterAnywhere = /\\b([VDIWEFA])\\//;
var threadtimeLevelPattern = /^\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2}\\.\\d{3}\\s+\\d+\\s+\\d+\\s+([VDIWEFA])\\s/;

// ── Keyword patterns (rebuilt from config) ──────────────────────────
var kwError = /\\b(fatal|panic|critical)\\b/i;
var kwWarn = /\\b(warn|warning|caution|fail|failed|failure)\\b/i;
var kwPerf = /\\b(perf|performance|dropped\\s+frame|fps|framerate|jank|stutter|choreographer|doing\\s+too\\s+much\\s+work|anr|application\\s+not\\s+responding)\\b/i;
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
    // Flutter banner: unambiguous error marker regardless of strict mode.
    if (flutterExceptionBannerPattern.test(plainText)) return true;
    return kwError !== null && kwError.test(plainText);
}

function matchesPerf(plainText) {
    if (structuralPerfPattern.test(plainText)) return true;
    return kwPerf !== null && kwPerf.test(plainText);
}

function classifyLevel(plainText, category) {
    if (stderrTreatAsError && category === 'stderr') return 'error';
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
        // DB-vendor annotation runs before genericSqlPattern so an I/flutter line
        // like "[Drift] connection pool warming" with no SQL keyword still
        // classifies as database. Stays after W-warning short-circuit on
        // purpose: an explicit W/ from logcat is a stronger signal than a tag.
        if (matchesDatabaseAnnotation(plainText)) return 'database';
        if (genericSqlPattern.test(plainText)) return 'database';
        return 'info';
    }
    if (matchesError(plainText)) return 'error';
    // DB-vendor bracket tags and "Vendor:" prefixes promote to database BEFORE the
    // generic warning/perf keyword sweep — without this, lines like
    // "DRIFT: VM Service WebSocket connect failed" classify as 'warning' (via
    // the "failed" keyword) and "[IsarDriftRowCountAudit] ..." as 'info', so
    // the Database level filter could not hide them as a group. Error still
    // wins above this check.
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
