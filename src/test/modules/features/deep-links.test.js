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
const vscode = __importStar(require("vscode"));
const deep_links_1 = require("../../../modules/features/deep-links");
suite('DeepLinks', () => {
    suite('parseDeepLinkUri', () => {
        test('should parse URI with session and line', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=test.log&line=42');
            const params = (0, deep_links_1.parseDeepLinkUri)(uri);
            assert.ok(params);
            assert.strictEqual(params.session, 'test.log');
            assert.strictEqual(params.line, 42);
        });
        test('should parse URI with session only', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=test.log');
            const params = (0, deep_links_1.parseDeepLinkUri)(uri);
            assert.ok(params);
            assert.strictEqual(params.session, 'test.log');
            assert.strictEqual(params.line, undefined);
        });
        test('should return undefined for wrong path', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/wrong?session=test.log');
            const params = (0, deep_links_1.parseDeepLinkUri)(uri);
            assert.strictEqual(params, undefined);
        });
        test('should return undefined for missing session', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?line=42');
            const params = (0, deep_links_1.parseDeepLinkUri)(uri);
            assert.strictEqual(params, undefined);
        });
        test('should handle invalid line number', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=test.log&line=abc');
            const params = (0, deep_links_1.parseDeepLinkUri)(uri);
            assert.ok(params);
            assert.strictEqual(params.session, 'test.log');
            assert.strictEqual(params.line, undefined);
        });
        test('should handle URL-encoded session names', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=20260128_143200_my%20app.log&line=1');
            const params = (0, deep_links_1.parseDeepLinkUri)(uri);
            assert.ok(params);
            assert.strictEqual(params.session, '20260128_143200_my app.log');
            assert.strictEqual(params.line, 1);
        });
    });
    suite('generateDeepLink', () => {
        test('should generate link with session and line', () => {
            const link = (0, deep_links_1.generateDeepLink)('test.log', 42);
            assert.ok(link.includes('session=test.log'));
            assert.ok(link.includes('line=42'));
            assert.ok(link.startsWith('vscode://saropa.saropa-log-capture/open'));
        });
        test('should generate link with session only', () => {
            const link = (0, deep_links_1.generateDeepLink)('test.log');
            assert.ok(link.includes('session=test.log'));
            assert.ok(!link.includes('line='));
        });
        test('should URL-encode special characters', () => {
            const link = (0, deep_links_1.generateDeepLink)('my app.log', 1);
            assert.ok(link.includes('session=my+app.log') || link.includes('session=my%20app.log'));
        });
        test('should not include line parameter for zero or negative', () => {
            const link1 = (0, deep_links_1.generateDeepLink)('test.log', 0);
            assert.ok(!link1.includes('line='));
            const link2 = (0, deep_links_1.generateDeepLink)('test.log', -1);
            assert.ok(!link2.includes('line='));
        });
        test('should fallback session name when empty string', () => {
            const link = (0, deep_links_1.generateDeepLink)('');
            assert.ok(link.includes('session=session.log'));
        });
        test('should trim session filename', () => {
            const link = (0, deep_links_1.generateDeepLink)('  my.log  ', 1);
            assert.ok(link.includes('session=my.log'));
        });
    });
    suite('parseDeepLinkUri - defensive', () => {
        test('should return undefined for path traversal in session', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=../../../etc/passwd');
            assert.strictEqual((0, deep_links_1.parseDeepLinkUri)(uri), undefined);
        });
        test('should return undefined for session with backslash', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=..\\foo.log');
            assert.strictEqual((0, deep_links_1.parseDeepLinkUri)(uri), undefined);
        });
        test('should return undefined for session starting with slash', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=/absolute.log');
            assert.strictEqual((0, deep_links_1.parseDeepLinkUri)(uri), undefined);
        });
        test('should return undefined for empty session', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=');
            assert.strictEqual((0, deep_links_1.parseDeepLinkUri)(uri), undefined);
        });
        test('should clamp line to safe range (valid line accepted)', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=app.log&line=1');
            const params = (0, deep_links_1.parseDeepLinkUri)(uri);
            assert.ok(params);
            assert.strictEqual(params.line, 1);
        });
        test('should drop line when zero', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=app.log&line=0');
            const params = (0, deep_links_1.parseDeepLinkUri)(uri);
            assert.ok(params);
            assert.strictEqual(params.line, undefined);
        });
        test('should drop line when negative', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=app.log&line=-1');
            const params = (0, deep_links_1.parseDeepLinkUri)(uri);
            assert.ok(params);
            assert.strictEqual(params.line, undefined);
        });
    });
});
//# sourceMappingURL=deep-links.test.js.map