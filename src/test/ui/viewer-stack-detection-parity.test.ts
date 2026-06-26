/**
 * Stack-frame DETECTION parity + corpus test.
 *
 * There are two copies of the "is this line a stack frame?" rule set, and they MUST agree:
 *   - `isStackFrameLine`  (src/modules/analysis/stack-parser.ts) — runs extension-side on RAW text.
 *   - `isStackFrameText`  (src/ui/viewer/viewer-script.ts)       — runs in the webview on HTML.
 * Every comment in both files says "keep in sync", but until now nothing enforced it. If they
 * drift, detection silently works in one path (e.g. the analysis panel) and not the other (live
 * rendering), which is the failure the corpus below guards against.
 *
 * Input shapes differ on purpose: the webview copy receives HTML where `<` is already escaped to
 * `&lt;` (item.html is always escaped upstream) and `stripTags` decodes it back. So a raw `<fn>`
 * fed straight to `isStackFrameText` would be deleted as a bogus tag — the test feeds it `esc(line)`
 * to mirror production exactly, while the extension copy gets the raw line.
 *
 * The webview function is extracted from the generated script string and evaluated in a vm with
 * `viewerPreserveAsciiBoxArt = true` (the default `getViewerScript` bakes), the setting under which
 * the two copies are designed to agree on the `│ … │` banner branch.
 */
import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { isStackFrameLine } from '../../modules/analysis/stack-parser';
import { getViewerScript } from '../../ui/viewer/viewer-script';

/** Slice out `function <name>(...) { ... }` up to its column-0 closing brace. */
function extractFunction(script: string, name: string): string {
    const start = script.indexOf('function ' + name + '(');
    assert.ok(start >= 0, 'expected ' + name + ' in generated viewer script');
    const end = script.indexOf('\n}', start);
    assert.ok(end > start, 'expected a column-0 closing brace for ' + name);
    return script.slice(start, end + 2);
}

/** HTML-escape exactly as the upstream pipeline does before a line reaches isStackFrameText. */
function esc(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Load the webview's isStackFrameText (with its stripTags dependency) into a vm sandbox. */
function loadWebviewDetector(): (html: string) => boolean {
    const script = getViewerScript(1000, true);
    const src =
        extractFunction(script, 'stripTags') + '\n' +
        extractFunction(script, 'isStackFrameText') + '\n' +
        'this.__fn = isStackFrameText;';
    const sandbox: Record<string, unknown> = { viewerPreserveAsciiBoxArt: true };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    return sandbox.__fn as (html: string) => boolean;
}

/** Labeled corpus: every entry is fed to BOTH detectors and must classify the same way. */
interface Case { line: string; frame: boolean; note: string; }

const CORPUS: readonly Case[] = [
    // --- JS / Node: leading "at " ---
    { line: '    at Object.foo (/app/index.js:10:5)', frame: true, note: 'node: at Object.foo (...)' },
    { line: '    at <anonymous>', frame: true, note: 'node: at <anonymous>' },
    { line: '    at Module._compile (node:internal/modules/cjs/loader:1241:14)', frame: true, note: 'node: at Module._compile (node:internal...)' },
    { line: 'at the start of the day', frame: false, note: 'prose: "at" with no leading indent' },

    // --- Dart numbered "#N " ---
    { line: '#0      main (package:foo/main.dart:1:1)', frame: true, note: 'dart: #0 main (...)' },
    { line: '  #12   SomeClass.method', frame: true, note: 'dart: indented #12 member' },
    { line: 'issue #5 was filed today', frame: false, note: 'prose: "#5" not at line start' },
    { line: '#hashtag is not a number', frame: false, note: 'prose: #word not #digit' },

    // --- Python "  File \"...\"" ---
    { line: '  File "/app/main.py", line 42, in <module>', frame: true, note: 'python: File "..." line 42' },
    { line: 'File "main.py" was opened', frame: false, note: 'prose: File "..." with no indent' },

    // --- Box gutter "│ " vs paired banners ---
    { line: '│ #0  main (package:foo/main.dart:1:1)', frame: true, note: 'single gutter bar + frame' },
    { line: '│          │', frame: false, note: 'paired empty bars (banner)' },
    { line: '│  DRIFT DEBUG SERVER  │', frame: false, note: 'paired content bars (banner)' },
    { line: '│', frame: false, note: 'lone bar, no trailing space' },

    // --- Dart package: (line start) ---
    { line: 'package:flutter/src/widgets/framework.dart 1234:5  State.build', frame: true, note: 'dart: package: at line start' },
    { line: '  package:drift/runtime/executor.dart 5:5  X.y', frame: true, note: 'dart: indented package: trimmed' },

    // --- Dart SDK no-path "dart:lib   member" ---
    { line: '      dart:async                                  Future.timeout.<fn>', frame: true, note: 'dart: SDK padded member with <fn>' },
    { line: 'dart:core                       print', frame: true, note: 'dart: SDK bare lib + member' },
    { line: '      dart:async/future_impl.dart 23:45    _CompleterImpl.complete', frame: true, note: 'dart: SDK lib with file:line + member' },
    { line: 'dart:async is a Dart core library', frame: false, note: 'prose: single-spaced dart: sentence' },

    // --- Indented file.ext:line (Go / generic) + audit guard ---
    { line: '\t/usr/local/go/src/runtime/panic.go:914 +0x21f', frame: true, note: 'go: panic.go:914 +0x21f' },
    { line: '  lib/src/foo.dart:42:7', frame: true, note: 'generic: file.dart:42:7' },
    { line: '  vendor/pkg/file.rb:88', frame: true, note: 'generic: file.rb:88 at EOL' },
    { line: '  async_barrier_utils.dart:11  AsyncBarrierUtils', frame: false, note: 'audit: file:line + prose description' },

    // --- Dart Trace.toString() "path SPACE line:col SPACES member" ---
    { line: '      ./lib/views/home/country_tab.dart 58:7  _CountryTabState.initState', frame: true, note: 'trace: ./lib path 58:7 member' },
    { line: '      ./lib/utils/foo.dart 184:15                 Utils._findAll', frame: true, note: 'trace: long padding before member' },
    { line: '  async_barrier_utils.dart 11  AsyncBarrierUtils', frame: false, note: 'audit: no slash in path, space line' },

    // --- Mid-line Dart source paths ---
    { line: 'ServerContext.log package:saropa/src/server.dart:202:35', frame: true, note: 'midline: member package:...dart:202:35' },
    { line: '      ⠀ » _Executor.run package:drift/interceptor.dart:163:25', frame: true, note: 'midline: braille » prefix + package:' },
    { line: '      ⠀ » Interceptor._log (./lib/database/drift_debug.dart:92:5)', frame: true, note: 'midline: parenthesized ./lib path' },
    // Drift interceptor logs a single content line ending with the " » Member (./path)"
    // call-site annotation. Real message text precedes the » , so it is NOT a frame — it
    // must stay a normal 'database' line (regression: it was eaten into a stack group and
    // vanished under the Database filter).
    { line: '[log] [database] Drift SLOW 119ms SELECT: SELECT * FROM "country_states" ORDER BY "id" LIMIT 1000  » DriftDebugInterceptor._lightLog (./lib/database/drift/drift_debug_interceptor.dart:282:5)', frame: false, note: 'drift inline source-ref annotation — content before »' },

    // --- Pure negatives ---
    { line: '', frame: false, note: 'empty string' },
    { line: '     ', frame: false, note: 'whitespace only' },
    { line: '[log] Tab Navigation: Countries', frame: false, note: 'plain app log line' },
    { line: 'Loading config from main.dart', frame: false, note: 'mentions .dart, no line number' },
    { line: 'I/flutter (1234): some message', frame: false, note: 'logcat line' },
    { line: 'see foo.dart 42 in the docs', frame: false, note: 'prose: file + number, no indent/colon' },
    { line: '| col1 | col2 | col3 |', frame: false, note: 'markdown table row (ASCII | excluded)' },
];

suite('stack-frame detection — extension/webview parity', () => {
    const webview = loadWebviewDetector();

    for (const c of CORPUS) {
        test((c.frame ? 'FRAME — ' : 'plain — ') + c.note, () => {
            assert.strictEqual(
                isStackFrameLine(c.line), c.frame,
                'isStackFrameLine disagreed on ' + JSON.stringify(c.line),
            );
            // Webview copy gets HTML-escaped input, exactly as item.html is built upstream.
            assert.strictEqual(
                webview(esc(c.line)), c.frame,
                'isStackFrameText disagreed on ' + JSON.stringify(c.line),
            );
        });
    }

    test('every corpus line classifies identically in both copies (drift guard)', () => {
        const mismatches = CORPUS.filter((c) => isStackFrameLine(c.line) !== webview(esc(c.line)));
        assert.deepStrictEqual(
            mismatches.map((c) => c.note), [],
            'extension/webview detectors drifted — these lines classify differently',
        );
    });
});
