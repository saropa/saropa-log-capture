/**
 * Unit test for formatFrameMemberFirst (webview core script). Extracts the single
 * function source from the generated script string and evaluates it in a vm with
 * minimal stripTags / escapeHtml stubs, so the regex + reorder behavior is exercised
 * without standing up the whole webview scope.
 */
import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getViewerDataHelpersCore } from '../../ui/viewer/viewer-data-helpers-core';

/** Slice out `function <name>(...) { ... }` up to its column-0 closing brace. */
function extractFunction(script: string, name: string): string {
    const start = script.indexOf('function ' + name + '(');
    assert.ok(start >= 0, 'expected ' + name + ' in generated core script');
    const end = script.indexOf('\n}', start);
    assert.ok(end > start, 'expected a closing brace for ' + name);
    return script.slice(start, end + 2);
}

function loadFormatter(): (html: string) => string {
    const src = extractFunction(getViewerDataHelpersCore(), 'formatFrameMemberFirst');
    const sandbox: Record<string, unknown> = {
        stripTags: (h: string) =>
            String(h ?? '').replace(/<[^>]*>/g, '')
                .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
        escapeHtml: (t: string) =>
            t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    };
    vm.createContext(sandbox);
    vm.runInContext(src + '\nthis.__fn = formatFrameMemberFirst;', sandbox);
    return sandbox.__fn as (html: string) => string;
}

suite('formatFrameMemberFirst', () => {
    test('should move dart:async to a right-aligned source tag and lead with the member', () => {
        const fn = loadFormatter();
        // item.html always carries HTML-escaped frame text (raw `<` becomes `&lt;`
        // upstream, else it would render as a broken tag), so `<fn>` arrives escaped.
        const out = fn('dart:async                                  Future.timeout.&lt;fn&gt;');
        assert.strictEqual(
            out,
            'Future.timeout.&lt;fn&gt; <span class="frame-lib-src">dart:async</span>',
        );
    });

    test('should keep a dart: frame that carries a file:line in the source tag', () => {
        const fn = loadFormatter();
        const out = fn('dart:async/future_impl.dart 23:45    _CompleterImpl.complete');
        assert.strictEqual(
            out,
            '_CompleterImpl.complete <span class="frame-lib-src">dart:async/future_impl.dart 23:45</span>',
        );
    });

    test('should leave an unlinkified app frame unchanged (no source-link to lift)', () => {
        const fn = loadFormatter();
        // In production every app frame is linkified before reaching the formatter, so a
        // bare path arriving here has no <a> to preserve — reordering it would mean a
        // plain-text rebuild, which we deliberately do NOT do. Pass it through untouched.
        const input = './lib/main.dart 543:5                _runBackgroundStartupTasks';
        assert.strictEqual(fn(input), input);
    });

    test('should leave single-spaced dart: prose unchanged', () => {
        const fn = loadFormatter();
        const input = 'dart:async is a Dart core library';
        assert.strictEqual(fn(input), input);
    });

    test('should lead with the member and float a linkified app path right', () => {
        const fn = loadFormatter();
        const link =
            '<a class="source-link" data-path="./lib/views/home/country_tab.dart" data-line="58" data-col="7">' +
            '<span class="source-link-seg" data-prefix="./lib/">./lib/</span>' +
            '<span class="source-link-seg" data-prefix="./lib/views/">views/</span>' +
            '<span class="source-link-seg" data-prefix="./lib/views/home/">home/</span>' +
            '<span class="source-link-seg" data-prefix="./lib/views/home/country_tab.dart">country_tab.dart</span> 58:7</a>';
        const out = fn(link + '   _CountryTabState.initState');
        assert.strictEqual(
            out,
            '_CountryTabState.initState <span class="frame-lib-src">' + link + '</span>',
        );
    });

    test('should preserve the source-link element byte-for-byte when reordering', () => {
        const fn = loadFormatter();
        // The <a> carries data-path/line/col + per-segment spans that drive click-to-open
        // and Ctrl+click filtering; a plain-text rebuild would destroy them. Assert the
        // element survives exactly, only relocated into the right-aligned source tag.
        const link =
            '<a class="source-link" data-path="./lib/main.dart" data-line="543" data-col="5">' +
            '<span class="source-link-seg" data-prefix="./lib/">./lib/</span>' +
            '<span class="source-link-seg" data-prefix="./lib/main.dart">main.dart</span> 543:5</a>';
        const out = fn(link + '          _runBackgroundStartupTasks');
        assert.ok(out.startsWith('_runBackgroundStartupTasks '), 'member should lead');
        assert.ok(out.includes(link), 'the <a> element must survive intact');
        assert.ok(out.includes('class="frame-lib-src"'), 'path moves to the source tag');
    });

    test('should keep an escaped <fn> in an app member when reordering', () => {
        const fn = loadFormatter();
        const link = '<a class="source-link" data-path="./lib/x.dart" data-line="9" data-col="1">x.dart 9:1</a>';
        const out = fn(link + '  _S.build.&lt;fn&gt;');
        assert.strictEqual(
            out,
            '_S.build.&lt;fn&gt; <span class="frame-lib-src">' + link + '</span>',
        );
    });
});
