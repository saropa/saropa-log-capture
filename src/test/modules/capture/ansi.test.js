"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const ansi_1 = require("../../../modules/capture/ansi");
suite('ANSI Module', () => {
    suite('stripAnsi', () => {
        test('should return plain text unchanged', () => {
            assert.strictEqual((0, ansi_1.stripAnsi)('hello world'), 'hello world');
        });
        test('should strip SGR color codes', () => {
            assert.strictEqual((0, ansi_1.stripAnsi)('\x1b[31mred\x1b[0m'), 'red');
        });
        test('should strip cursor and erase codes', () => {
            assert.strictEqual((0, ansi_1.stripAnsi)('\x1b[2Jhello\x1b[H'), 'hello');
        });
        test('should handle empty string', () => {
            assert.strictEqual((0, ansi_1.stripAnsi)(''), '');
        });
        test('should strip multiple codes in sequence', () => {
            assert.strictEqual((0, ansi_1.stripAnsi)('\x1b[1m\x1b[31mbold red\x1b[0m'), 'bold red');
        });
    });
    suite('escapeHtml', () => {
        test('should escape angle brackets', () => {
            assert.strictEqual((0, ansi_1.escapeHtml)('<script>'), '&lt;script&gt;');
        });
        test('should escape ampersands', () => {
            assert.strictEqual((0, ansi_1.escapeHtml)('a & b'), 'a &amp; b');
        });
        test('should escape quotes', () => {
            assert.strictEqual((0, ansi_1.escapeHtml)('"hello" & \'world\''), '&quot;hello&quot; &amp; &#39;world&#39;');
        });
        test('should return plain text unchanged', () => {
            assert.strictEqual((0, ansi_1.escapeHtml)('hello world'), 'hello world');
        });
        test('should handle empty string', () => {
            assert.strictEqual((0, ansi_1.escapeHtml)(''), '');
        });
    });
    suite('ansiToHtml', () => {
        test('should return HTML-escaped text when no ANSI codes', () => {
            assert.strictEqual((0, ansi_1.ansiToHtml)('hello <world>'), 'hello &lt;world&gt;');
        });
        test('should convert red foreground', () => {
            assert.strictEqual((0, ansi_1.ansiToHtml)('\x1b[31mred\x1b[0m'), '<span style="color:var(--vscode-terminal-ansiRed, #cd3131)">red</span>');
        });
        test('should convert bold text', () => {
            assert.strictEqual((0, ansi_1.ansiToHtml)('\x1b[1mbold\x1b[0m'), '<span style="font-weight:bold">bold</span>');
        });
        test('should handle combined SGR parameters', () => {
            const result = (0, ansi_1.ansiToHtml)('\x1b[1;31mbold red\x1b[0m');
            assert.ok(result.includes('color:var(--vscode-terminal-ansiRed, #cd3131)'));
            assert.ok(result.includes('font-weight:bold'));
            assert.ok(result.includes('bold red'));
        });
        test('should close trailing open span', () => {
            const result = (0, ansi_1.ansiToHtml)('\x1b[32mgreen text');
            assert.ok(result.endsWith('</span>'));
            assert.ok(result.includes('color:var(--vscode-terminal-ansiGreen, #0dbc79)'));
        });
        test('should handle bright foreground colors', () => {
            assert.strictEqual((0, ansi_1.ansiToHtml)('\x1b[91mbright red\x1b[0m'), '<span style="color:var(--vscode-terminal-ansiBrightRed, #f14c4c)">bright red</span>');
        });
        test('should handle background colors', () => {
            const result = (0, ansi_1.ansiToHtml)('\x1b[41mred bg\x1b[0m');
            assert.ok(result.includes('background-color:var(--vscode-terminal-ansiRed, #cd3131)'));
        });
        test('should handle dim text', () => {
            const result = (0, ansi_1.ansiToHtml)('\x1b[2mdim\x1b[0m');
            assert.ok(result.includes('opacity:0.7'));
        });
        test('should handle italic text', () => {
            const result = (0, ansi_1.ansiToHtml)('\x1b[3mitalic\x1b[0m');
            assert.ok(result.includes('font-style:italic'));
        });
        test('should handle underline text', () => {
            const result = (0, ansi_1.ansiToHtml)('\x1b[4munderline\x1b[0m');
            assert.ok(result.includes('text-decoration:underline'));
        });
        test('should HTML-escape text before ANSI conversion', () => {
            const result = (0, ansi_1.ansiToHtml)('\x1b[31m<b>not bold</b>\x1b[0m');
            assert.ok(result.includes('&lt;b&gt;not bold&lt;/b&gt;'));
            assert.ok(!result.includes('<b>'));
        });
        test('should strip non-SGR ANSI codes', () => {
            const result = (0, ansi_1.ansiToHtml)('\x1b[2Jhello\x1b[H world');
            assert.strictEqual(result, 'hello world');
        });
        test('should handle empty string', () => {
            assert.strictEqual((0, ansi_1.ansiToHtml)(''), '');
        });
        test('should handle string with only ANSI codes', () => {
            assert.strictEqual((0, ansi_1.ansiToHtml)('\x1b[0m'), '');
        });
        test('should handle reset mid-stream', () => {
            const result = (0, ansi_1.ansiToHtml)('\x1b[31mred\x1b[0m plain');
            assert.strictEqual(result, '<span style="color:var(--vscode-terminal-ansiRed, #cd3131)">red</span> plain');
        });
        test('should handle color change without reset', () => {
            const result = (0, ansi_1.ansiToHtml)('\x1b[31mred\x1b[32mgreen\x1b[0m');
            assert.ok(result.includes('color:var(--vscode-terminal-ansiRed, #cd3131)'));
            assert.ok(result.includes('color:var(--vscode-terminal-ansiGreen, #0dbc79)'));
            assert.ok(result.includes('red'));
            assert.ok(result.includes('green'));
        });
        test('should handle default foreground reset', () => {
            const result = (0, ansi_1.ansiToHtml)('\x1b[31mred\x1b[39mdefault');
            assert.ok(result.includes('color:var(--vscode-terminal-ansiRed, #cd3131)'));
            assert.ok(result.includes('red'));
            assert.ok(result.includes('default'));
        });
        test('should ignore unknown SGR codes', () => {
            const result = (0, ansi_1.ansiToHtml)('\x1b[999mtext\x1b[0m');
            assert.ok(result.includes('text'));
        });
    });
});
//# sourceMappingURL=ansi.test.js.map