import * as assert from 'assert';
import { stripAnsi, escapeHtml, ansiToHtml } from '../../../modules/capture/ansi';

suite('ANSI Module', () => {

    suite('stripAnsi', () => {
        test('should return plain text unchanged', () => {
            assert.strictEqual(stripAnsi('hello world'), 'hello world');
        });

        test('should strip SGR color codes', () => {
            assert.strictEqual(stripAnsi('\x1b[31mred\x1b[0m'), 'red');
        });

        test('should strip cursor and erase codes', () => {
            assert.strictEqual(stripAnsi('\x1b[2Jhello\x1b[H'), 'hello');
        });

        test('should handle empty string', () => {
            assert.strictEqual(stripAnsi(''), '');
        });

        test('should strip multiple codes in sequence', () => {
            assert.strictEqual(stripAnsi('\x1b[1m\x1b[31mbold red\x1b[0m'), 'bold red');
        });
    });

    suite('escapeHtml', () => {
        test('should escape angle brackets', () => {
            assert.strictEqual(escapeHtml('<script>'), '&lt;script&gt;');
        });

        test('should escape ampersands', () => {
            assert.strictEqual(escapeHtml('a & b'), 'a &amp; b');
        });

        test('should escape quotes', () => {
            assert.strictEqual(escapeHtml('"hello" & \'world\''), '&quot;hello&quot; &amp; &#39;world&#39;');
        });

        test('should return plain text unchanged', () => {
            assert.strictEqual(escapeHtml('hello world'), 'hello world');
        });

        test('should handle empty string', () => {
            assert.strictEqual(escapeHtml(''), '');
        });
    });

    suite('ansiToHtml', () => {
        test('should return HTML-escaped text when no ANSI codes', () => {
            assert.strictEqual(ansiToHtml('hello <world>'), 'hello &lt;world&gt;');
        });

        // Foreground ANSI is intentionally dropped — severity color is owned by
        // item.level so the level filter and on-row color can never disagree.
        // See plans/history/2026.05/2026.05.15/054_plan-viewer-stack-noise-filter-layout.md Item D.
        test('should drop red foreground (no color span emitted)', () => {
            assert.strictEqual(ansiToHtml('\x1b[31mred\x1b[0m'), 'red');
        });

        test('should drop bright foreground (no color span emitted)', () => {
            assert.strictEqual(ansiToHtml('\x1b[91mbright red\x1b[0m'), 'bright red');
        });

        test('should never emit a color: style for any foreground code', () => {
            for (const code of [30, 31, 32, 33, 34, 35, 36, 37, 90, 91, 92, 93, 94, 95, 96, 97]) {
                const result = ansiToHtml(`\x1b[${code}mtext\x1b[0m`);
                assert.ok(!result.includes('color:'), `code ${code} must not emit a color: style`);
            }
        });

        test('should convert bold text', () => {
            assert.strictEqual(
                ansiToHtml('\x1b[1mbold\x1b[0m'),
                '<span style="font-weight:bold">bold</span>',
            );
        });

        test('should keep non-color SGR attributes while dropping the foreground', () => {
            // Bold survives; the red foreground is discarded.
            const result = ansiToHtml('\x1b[1;31mbold red\x1b[0m');
            assert.ok(!result.includes('color:'), 'foreground color must be dropped');
            assert.ok(result.includes('font-weight:bold'), 'bold attribute must survive');
            assert.ok(result.includes('bold red'));
        });

        test('should close trailing open span', () => {
            // Uses bold (not foreground) since foreground no longer opens a span.
            const result = ansiToHtml('\x1b[1mbold text');
            assert.ok(result.endsWith('</span>'));
            assert.ok(result.includes('font-weight:bold'));
        });

        test('should handle background colors', () => {
            const result = ansiToHtml('\x1b[41mred bg\x1b[0m');
            assert.ok(result.includes('background-color:var(--vscode-terminal-ansiRed, #cd3131)'));
        });

        test('should handle dim text', () => {
            const result = ansiToHtml('\x1b[2mdim\x1b[0m');
            assert.ok(result.includes('opacity:0.7'));
        });

        test('should handle italic text', () => {
            const result = ansiToHtml('\x1b[3mitalic\x1b[0m');
            assert.ok(result.includes('font-style:italic'));
        });

        test('should handle underline text', () => {
            const result = ansiToHtml('\x1b[4munderline\x1b[0m');
            assert.ok(result.includes('text-decoration:underline'));
        });

        test('should HTML-escape text before ANSI conversion', () => {
            const result = ansiToHtml('\x1b[31m<b>not bold</b>\x1b[0m');
            assert.ok(result.includes('&lt;b&gt;not bold&lt;/b&gt;'));
            assert.ok(!result.includes('<b>'));
        });

        test('should strip non-SGR ANSI codes', () => {
            const result = ansiToHtml('\x1b[2Jhello\x1b[H world');
            assert.strictEqual(result, 'hello world');
        });

        test('should handle empty string', () => {
            assert.strictEqual(ansiToHtml(''), '');
        });

        test('should handle string with only ANSI codes', () => {
            assert.strictEqual(ansiToHtml('\x1b[0m'), '');
        });

        test('should handle reset mid-stream (foreground dropped, text preserved)', () => {
            const result = ansiToHtml('\x1b[31mred\x1b[0m plain');
            assert.strictEqual(result, 'red plain');
        });

        test('should handle color change without reset (both foregrounds dropped)', () => {
            const result = ansiToHtml('\x1b[31mred\x1b[32mgreen\x1b[0m');
            assert.strictEqual(result, 'redgreen');
            assert.ok(!result.includes('color:'));
        });

        test('should handle default foreground reset (no-op since foreground is dropped)', () => {
            const result = ansiToHtml('\x1b[31mred\x1b[39mdefault');
            assert.strictEqual(result, 'reddefault');
        });

        test('should ignore unknown SGR codes', () => {
            const result = ansiToHtml('\x1b[999mtext\x1b[0m');
            assert.ok(result.includes('text'));
        });
    });
});
