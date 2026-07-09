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
 * `strict=true, stderrTreatAsError=false`. The corpus is deliberately tag/structural-pattern
 * focused so keyword-list defaults are not a confounder.
 */
import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { classifyLevel } from '../../modules/analysis/level-classifier';
import { getLevelClassifyScript } from '../../ui/viewer-search-filter/viewer-level-classify';

/** Run the emitted webview classifier script in a sandbox and return its classifyLevel. */
function loadWebviewClassifier(): (text: string, category: string) => string {
    const script = getLevelClassifyScript();
    const sandbox: Record<string, unknown> = {};
    vm.createContext(sandbox);
    vm.runInContext(script + '\nthis.__fn = classifyLevel;', sandbox);
    return sandbox.__fn as (text: string, category: string) => string;
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
];

suite('level classification — extension/webview parity', () => {
    const webview = loadWebviewClassifier();

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
});
