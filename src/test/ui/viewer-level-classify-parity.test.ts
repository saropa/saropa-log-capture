/**
 * Level-classification parity test.
 *
 * There are two copies of the severity classifier and they MUST agree:
 *   - `classifyLevel` (src/modules/analysis/level-classifier.ts) — extension side.
 *   - `classifyLevel` (src/ui/viewer-search-filter/viewer-level-classify.ts) — webview, emitted
 *     as a string template with doubled-backslash regexes and a JSON-injected TAG_LEVEL_MAP.
 * Both files carry "keep in sync" comments but until now nothing enforced it. This guards the
 * hand-mirrored app-head-tag logic (matchesTagLevel / headBracketTagPattern / TAG_LEVEL_MAP) and
 * the doubled-backslash regex transcription, which are easy to drift silently.
 *
 * The whole webview script body is run in a vm so every `var`/`function` it declares (including
 * the default keyword patterns) attaches to the sandbox, then `classifyLevel` is pulled out. The
 * webview copy reads the module globals `strictLevelDetection` (default true) and
 * `stderrTreatAsError` (default false); the extension copy is called with the matching
 * `strict=true, stderrTreatAsError=false`. The corpus is mostly tag/structural-pattern
 * focused, plus a few keyword-DEFAULT cases at the end: the default keyword lists are
 * themselves hand-mirrored (config-normalizers.ts vs the webview `var kw*` lines) and
 * have drifted before ("slow operation" missing from the webview perf default).
 */
import * as assert from 'node:assert';
import { types } from 'node:util';
import * as vm from 'node:vm';
import { buildKeywordPattern, classifyLevel } from '../../modules/analysis/level-classifier';
import { DEFAULT_SEVERITY_KEYWORDS } from '../../modules/config/config-normalizers';
import { getLevelClassifyScript } from '../../ui/viewer-search-filter/viewer-level-classify';

/**
 * Run the emitted webview classifier script in a sandbox and return the sandbox itself:
 * top-level `var`/`function` declarations (classifyLevel, the default kw* regexes) attach
 * to it, so tests can reach both the classifier and the raw default patterns.
 */
function loadWebviewSandbox(): Record<string, unknown> {
    const script = getLevelClassifyScript();
    const sandbox: Record<string, unknown> = {};
    vm.createContext(sandbox);
    vm.runInContext(script + '\nthis.__fn = classifyLevel;', sandbox);
    return sandbox;
}

interface Case { line: string; level: string; note: string; }

const CORPUS: readonly Case[] = [
    { line: '[db] bulkPreload DRIFT WRITE DONE — wrote 185 rows', level: 'database', note: 'app [db] line' },
    { line: '[db] bulkPreload failed mid-batch', level: 'database', note: '[db] beats failed keyword' },
    { line: '[db] Error: lost connection', level: 'error', note: 'structural error beats [db]' },
    { line: '[perf:cold start] first frame 1840ms', level: 'performance', note: '[perf:meta] → performance' },
    { line: '[todo] backfill missing rows', level: 'todo', note: '[todo] → todo' },
    { line: '[warn] disk space low', level: 'warning', note: '[warn] → warning' },
    { line: '[debug] cache warm', level: 'debug', note: '[debug] → debug' },
    { line: '[notice] startup complete', level: 'notice', note: '[notice] → notice' },
    { line: '[unknowntag] hello world', level: 'info', note: 'unrecognized tag stays info' },
    { line: 'I/flutter ( 1): [db] preload done', level: 'database', note: '[db] behind logcat prefix' },
    { line: '[DB] preload done', level: 'database', note: 'case-insensitive [DB]' },
    { line: 'Sqlite3: opened database', level: 'database', note: 'new Sqlite3 vendor prefix' },
    { line: 'bulkPreload wrote 185 rows', level: 'info', note: 'no tag → no promotion' },
    { line: '[log] [database] Drift SLOW 533ms SELECT: SELECT * FROM "activities"', level: 'performance', note: 'Drift SLOW perf beats [database] tag' },
    { line: '[log] [database] Drift REPEAT x8 in ≤500ms INSERT: INSERT INTO "activities"', level: 'performance', note: 'Drift REPEAT perf beats [database] tag' },
    { line: '[log] [database] Drift SELECT: SELECT * FROM "contacts"', level: 'database', note: 'plain Drift statement still database' },
    { line: 'Database query took 2400ms', level: 'performance', note: 'took Xms quantified metric' },
    { line: 'Elapsed duration: 1850ms for sync', level: 'performance', note: 'duration: Xms quantified metric' },
    // Keyword-default parity guards. The default keyword lists exist in three places
    // (config-normalizers.ts, the webview var kwPerf line, package.json) and drifted
    // silently: "slow operation" was missing from the webview default, and bare
    // "performance" lingered in package.json causing noun phrases like "Performance
    // settings" to classify as performance
    // (plans/history/2026.07/2026.07.09/BUG_saropa signal report.md).
    { line: 'W/ActivityManager: Slow operation: 51ms so far, now at startProcess', level: 'performance', note: 'slow operation keyword promotes W/ to performance' },
    { line: '3) Performance settings filtering (maxResults=50)', level: 'info', note: 'bare "Performance" noun phrase stays info' },
];

suite('level classification — extension/webview parity', () => {
    const sandbox = loadWebviewSandbox();
    const webview = sandbox.__fn as (text: string, category: string) => string;

    for (const c of CORPUS) {
        test(c.level + ' — ' + c.note, () => {
            assert.strictEqual(
                classifyLevel(c.line, 'stdout', true, false), c.level,
                'extension classifyLevel disagreed on ' + JSON.stringify(c.line),
            );
            assert.strictEqual(
                webview(c.line, 'stdout'), c.level,
                'webview classifyLevel disagreed on ' + JSON.stringify(c.line),
            );
        });
    }

    test('every corpus line classifies identically in both copies (drift guard)', () => {
        const mismatches = CORPUS.filter(
            (c) => classifyLevel(c.line, 'stdout', true, false) !== webview(c.line, 'stdout'),
        );
        assert.deepStrictEqual(
            mismatches.map((c) => c.note), [],
            'extension/webview classifiers drifted — these lines classify differently',
        );
    });

    // The webview's built-in `var kw*` regexes are a hand-transcribed copy of
    // buildKeywordPattern(DEFAULT_SEVERITY_KEYWORDS[level]) and are LIVE from webview
    // load until the first settings broadcast overwrites them. They drifted once
    // ("slow operation" missing from kwPerf), and the corpus above only samples the
    // performance level — this structural pin covers all six levels so any future
    // drift in any level fails here, not in a user's briefly-misclassified lines.
    suite('webview default kw* regexes pinned to DEFAULT_SEVERITY_KEYWORDS', () => {
        const KW_VARS: ReadonlyArray<readonly [string, readonly string[]]> = [
            ['kwError', DEFAULT_SEVERITY_KEYWORDS.error],
            ['kwWarn', DEFAULT_SEVERITY_KEYWORDS.warning],
            ['kwPerf', DEFAULT_SEVERITY_KEYWORDS.performance],
            ['kwTodo', DEFAULT_SEVERITY_KEYWORDS.todo],
            ['kwDebug', DEFAULT_SEVERITY_KEYWORDS.debug],
            ['kwNotice', DEFAULT_SEVERITY_KEYWORDS.notice],
        ];

        for (const [varName, keywords] of KW_VARS) {
            test(varName + ' matches buildKeywordPattern of the code default', () => {
                const expected = buildKeywordPattern(keywords);
                const actual = sandbox[varName] as RegExp | undefined;
                // instanceof RegExp is realm-bound and the kw* regexes were constructed
                // inside the vm sandbox realm — util.types.isRegExp is cross-realm safe.
                assert.ok(actual && types.isRegExp(actual), varName + ' must be a RegExp in the webview script');
                assert.ok(expected, 'code default keyword list for ' + varName + ' must be non-empty');
                assert.strictEqual(actual.source, expected.source, varName + ' webview default drifted from DEFAULT_SEVERITY_KEYWORDS');
                assert.strictEqual(actual.flags, expected.flags, varName + ' webview default flags drifted');
            });
        }
    });
});
