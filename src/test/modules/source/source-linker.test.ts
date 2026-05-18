import * as assert from 'assert';
import { linkifyHtml, linkifyUrls } from '../../../modules/source/source-linker';

suite('linkifyHtml', () => {
    test('should linkify simple file:line pattern', () => {
        const result = linkifyHtml('Error at file.ts:42');
        assert.ok(result.includes('class="source-link"'));
        assert.ok(result.includes('data-path="file.ts"'));
        assert.ok(result.includes('data-line="42"'));
    });

    test('should linkify file:line:col pattern', () => {
        const result = linkifyHtml('at file.ts:42:10');
        assert.ok(result.includes('data-col="10"'));
    });

    test('should linkify Dart package URI', () => {
        const result = linkifyHtml('package:myapp/src/widget.dart:128');
        assert.ok(result.includes('data-path="package:myapp/src/widget.dart"'));
        assert.ok(result.includes('data-line="128"'));
    });

    /* bug_001: contacts' replaceLocalPackagePath() rewrites package:saropa/ to ./lib/
       before embedding the stack in the message body. The new unwrapped Dart shape
       always lands here — must linkify or stack frames lose their click-to-source. */
    test('should linkify Dart workspace-relative ./lib/ path with line:col', () => {
        const result = linkifyHtml('#0      Foo.bar (./lib/services/location.dart:42:9)');
        assert.ok(result.includes('data-path="./lib/services/location.dart"'));
        assert.ok(result.includes('data-line="42"'));
        assert.ok(result.includes('data-col="9"'));
    });

    test('should linkify Unix absolute path', () => {
        const result = linkifyHtml('  at /home/user/project/src/main.ts:55');
        assert.ok(result.includes('data-path="/home/user/project/src/main.ts"'));
    });

    test('should linkify Python traceback', () => {
        const result = linkifyHtml('  File "app/models.py:23"');
        assert.ok(result.includes('data-path="app/models.py"'));
        assert.ok(result.includes('data-line="23"'));
    });

    test('should linkify Go path', () => {
        const result = linkifyHtml('main.go:14:2: undefined: foo');
        assert.ok(result.includes('data-path="main.go"'));
        assert.ok(result.includes('data-line="14"'));
        assert.ok(result.includes('data-col="2"'));
    });

    test('should linkify path with dots in directory', () => {
        const result = linkifyHtml('src/utils/v2.0/parser.ts:99');
        assert.ok(result.includes('data-path="src/utils/v2.0/parser.ts"'));
    });

    test('should not linkify URL with port number', () => {
        const result = linkifyHtml('http://localhost:8080');
        assert.ok(!result.includes('source-link'));
    });

    test('should not linkify https URL with port', () => {
        const result = linkifyHtml('https://example.com:443/path');
        assert.ok(!result.includes('source-link'));
    });

    test('should preserve HTML tags around links', () => {
        const result = linkifyHtml('<span style="color:#f55">at file.ts:42</span>');
        assert.ok(result.includes('<span style="color:#f55">'));
        assert.ok(result.includes('</span>'));
        assert.ok(result.includes('source-link'));
    });

    test('should not match inside HTML tags', () => {
        const result = linkifyHtml('<span data-x="foo.ts:10">text</span>');
        // The data-x attribute should not be linkified
        assert.strictEqual(result, '<span data-x="foo.ts:10">text</span>');
    });

    test('should handle plain text with no matches', () => {
        const input = 'Just a regular log message';
        assert.strictEqual(linkifyHtml(input), input);
    });

    test('should handle text with no colons', () => {
        const input = 'no colons here';
        assert.strictEqual(linkifyHtml(input), input);
    });

    test('should handle empty string', () => {
        assert.strictEqual(linkifyHtml(''), '');
    });

    test('should linkify multiple matches in one line', () => {
        const result = linkifyHtml('error in file.ts:10 see also utils.ts:20');
        // Count the anchor opener specifically. `source-link` on its own would
        // also match the per-segment `source-link-seg` spans inside each <a>.
        const matches = result.match(/<a class="source-link"/g);
        assert.strictEqual(matches?.length, 2);
    });

    test('should not match unknown extensions', () => {
        const result = linkifyHtml('data.xyz:42');
        assert.ok(!result.includes('source-link'));
    });

    test('should linkify Rust source path', () => {
        const result = linkifyHtml('src/main.rs:15:5');
        assert.ok(result.includes('data-path="src/main.rs"'));
    });

    test('should linkify C++ source path', () => {
        const result = linkifyHtml('src/engine.cpp:200');
        assert.ok(result.includes('data-path="src/engine.cpp"'));
    });

    test('should linkify Ruby source path', () => {
        const result = linkifyHtml('app/controllers/users_controller.rb:42');
        assert.ok(result.includes('data-path="app/controllers/users_controller.rb"'));
    });

    test('should escape special characters in link text', () => {
        // Filename now lives inside a per-segment span; the :line tail is
        // appended raw after the segment span(s).
        const result = linkifyHtml('at file.ts:42');
        assert.ok(result.includes('file.ts</span>:42</a>'));
    });

    // --- Per-segment hover spans for Ctrl+click filter ---

    test('should wrap each folder + filename in a source-link-seg span with cumulative prefix', () => {
        const result = linkifyHtml('  at ./lib/database/foo.dart:42');
        // Leading ./ merges into the first folder so segment 1 is "./lib/"
        // (not a useless "./" alone) — clicking "./" would have filtered to
        // every relative path in the log.
        assert.ok(result.includes('<span class="source-link-seg" data-prefix="./lib/">./lib/</span>'));
        assert.ok(result.includes('<span class="source-link-seg" data-prefix="./lib/database/">database/</span>'));
        assert.ok(result.includes('<span class="source-link-seg" data-prefix="./lib/database/foo.dart">foo.dart</span>'));
    });

    test('should preserve the line:col tail as plain text after the segment spans', () => {
        const result = linkifyHtml('at ./lib/foo.dart:42:5');
        // The :42:5 is the tail — must not be inside any source-link-seg
        // span because it is not a clickable path segment.
        assert.ok(result.includes('>foo.dart</span>:42:5</a>'));
    });

    test('should segment a package: URI by slash, keeping the URI scheme in the first segment', () => {
        const result = linkifyHtml('at package:myapp/src/widget.dart:128');
        // package:myapp has no slash before the colon, so the FIRST segment
        // is "package:myapp/" — the URI scheme rides with the first folder.
        assert.ok(result.includes('<span class="source-link-seg" data-prefix="package:myapp/">package:myapp/</span>'));
        assert.ok(result.includes('<span class="source-link-seg" data-prefix="package:myapp/src/">src/</span>'));
        assert.ok(result.includes('<span class="source-link-seg" data-prefix="package:myapp/src/widget.dart">widget.dart</span>'));
    });

    // --- Dart stack_trace Trace.toString() format: path SPACE line:col ---
    // Real frames from contacts-app dart:developer log(stackTrace:) output.
    // The package emits `<uri> <line>:<col>  <member>` with a space between
    // filename and line:col, not a colon. Linkifier must handle both shapes.

    test('should linkify Trace format with space-separated line:col', () => {
        const result = linkifyHtml('      ./lib/main.dart 392:5                                         _initFirebaseAppCheck');
        assert.ok(result.includes('class="source-link"'));
        assert.ok(result.includes('data-path="./lib/main.dart"'));
        assert.ok(result.includes('data-line="392"'));
        assert.ok(result.includes('data-col="5"'));
    });

    test('should linkify long Trace path with multiple spaces before line:col', () => {
        const result = linkifyHtml('      ./lib/database/debug/isar_drift_row_count_audit.dart 242:13  IsarDriftRowCountAudit.logComparison');
        assert.ok(result.includes('data-path="./lib/database/debug/isar_drift_row_count_audit.dart"'));
        assert.ok(result.includes('data-line="242"'));
        assert.ok(result.includes('data-col="13"'));
    });

    test('should NOT linkify Trace-shape prose without col (line-only)', () => {
        // `foo.dart 42 description` shouldn't link — too ambiguous to be a frame.
        const result = linkifyHtml('see foo.dart 42 description');
        assert.ok(!result.includes('source-link'));
    });

    test('should still linkify normal colon-attached form alongside Trace form', () => {
        // Regression: combined regex must not break the original branch.
        const result = linkifyHtml('Error at file.ts:42:10');
        assert.ok(result.includes('data-path="file.ts"'));
        assert.ok(result.includes('data-line="42"'));
        assert.ok(result.includes('data-col="10"'));
    });
});

suite('linkifyUrls', () => {
    test('should linkify HTTP URL', () => {
        const result = linkifyUrls('visit http://example.com for info');
        assert.ok(result.includes('class="url-link"'));
        assert.ok(result.includes('data-url="http://example.com"'));
    });

    test('should linkify HTTPS URL', () => {
        const result = linkifyUrls('see https://example.com/path?q=1');
        assert.ok(result.includes('data-url="https://example.com/path?q=1"'));
    });

    test('should not linkify inside HTML tags', () => {
        const result = linkifyUrls('<a href="https://example.com">text</a>');
        assert.strictEqual(result, '<a href="https://example.com">text</a>');
    });

    test('should strip trailing punctuation from URL', () => {
        const result = linkifyUrls('see https://example.com/page.');
        assert.ok(result.includes('data-url="https://example.com/page"'));
        assert.ok(result.includes('</a>.'));
    });

    test('should not double-escape HTML entities in URLs', () => {
        const result = linkifyUrls('https://example.com?a=1&amp;b=2');
        assert.ok(result.includes('data-url="https://example.com?a=1&amp;b=2"'));
        assert.ok(!result.includes('&amp;amp;'));
    });

    test('should return unchanged text without URLs', () => {
        const input = 'no urls here';
        assert.strictEqual(linkifyUrls(input), input);
    });

    test('should return unchanged text without protocol', () => {
        const input = 'no protocol://here';
        assert.strictEqual(linkifyUrls(input), input);
    });

    test('should handle empty string', () => {
        assert.strictEqual(linkifyUrls(''), '');
    });

    test('should linkify multiple URLs', () => {
        const result = linkifyUrls('http://a.com and https://b.com');
        const matches = result.match(/url-link/g);
        assert.strictEqual(matches?.length, 2);
    });

    test('should not double-linkify existing source-link anchors', () => {
        const input = '<a class="source-link" data-path="file.ts" data-line="1">file.ts:1</a>';
        assert.strictEqual(linkifyUrls(input), input);
    });
});
