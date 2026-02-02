import * as assert from 'assert';
import { stripAnsi, escapeHtml, ansiToHtml } from '../modules/ansi';

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

        test('should convert red foreground', () => {
            assert.strictEqual(
                ansiToHtml('\x1b[31mred\x1b[0m'),
                '<span style="color:#cd3131">red</span>',
            );
        });

        test('should convert bold text', () => {
            assert.strictEqual(
                ansiToHtml('\x1b[1mbold\x1b[0m'),
                '<span style="font-weight:bold">bold</span>',
            );
        });

        test('should handle combined SGR parameters', () => {
            const result = ansiToHtml('\x1b[1;31mbold red\x1b[0m');
            assert.ok(result.includes('color:#cd3131'));
            assert.ok(result.includes('font-weight:bold'));
            assert.ok(result.includes('bold red'));
        });

        test('should close trailing open span', () => {
            const result = ansiToHtml('\x1b[32mgreen text');
            assert.ok(result.endsWith('</span>'));
            assert.ok(result.includes('color:#0dbc79'));
        });

        test('should handle bright foreground colors', () => {
            assert.strictEqual(
                ansiToHtml('\x1b[91mbright red\x1b[0m'),
                '<span style="color:#f14c4c">bright red</span>',
            );
        });

        test('should handle background colors', () => {
            const result = ansiToHtml('\x1b[41mred bg\x1b[0m');
            assert.ok(result.includes('background-color:#cd3131'));
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

        test('should handle reset mid-stream', () => {
            const result = ansiToHtml('\x1b[31mred\x1b[0m plain');
            assert.strictEqual(result, '<span style="color:#cd3131">red</span> plain');
        });

        test('should handle color change without reset', () => {
            const result = ansiToHtml('\x1b[31mred\x1b[32mgreen\x1b[0m');
            assert.ok(result.includes('color:#cd3131'));
            assert.ok(result.includes('color:#0dbc79'));
            assert.ok(result.includes('red'));
            assert.ok(result.includes('green'));
        });

        test('should handle default foreground reset', () => {
            const result = ansiToHtml('\x1b[31mred\x1b[39mdefault');
            assert.ok(result.includes('color:#cd3131'));
            assert.ok(result.includes('red'));
            assert.ok(result.includes('default'));
        });

        test('should ignore unknown SGR codes', () => {
            const result = ansiToHtml('\x1b[999mtext\x1b[0m');
            assert.ok(result.includes('text'));
        });
    });
});
