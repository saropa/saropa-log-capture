import * as assert from 'assert';
import { linkifyHtml, linkifyUrls } from '../modules/source-linker';

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
        const matches = result.match(/source-link/g);
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
        const result = linkifyHtml('at file.ts:42');
        assert.ok(result.includes('>file.ts:42</a>'));
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
