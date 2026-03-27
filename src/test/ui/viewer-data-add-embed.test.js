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
/**
 * Regression tests for the embedded `addToData` script (string extraction).
 * Guards single-parse semantics and database-only SQL fingerprint repeat keys.
 */
const assert = __importStar(require("node:assert"));
const viewer_data_add_1 = require("../../ui/viewer/viewer-data-add");
function extractAddToDataBlock(script) {
    const start = script.indexOf('function addToData(');
    const end = script.indexOf('\nfunction toggleStackGroup(');
    if (start < 0 || end < 0 || end <= start) {
        return '';
    }
    return script.slice(start, end);
}
suite('viewer-data-add embed', () => {
    test('addToData calls parseSqlFingerprint(plain) exactly once', () => {
        const block = extractAddToDataBlock((0, viewer_data_add_1.getViewerDataAddScript)());
        assert.ok(block.length > 0, 'expected addToData block');
        const matches = block.match(/parseSqlFingerprint\(plain\)/g);
        assert.strictEqual(matches ? matches.length : 0, 1, 'duplicate parseSqlFingerprint(plain) reintroduces per-line cost and drift risk');
    });
    test('SQL repeat key requires database tag (false positive: Drift text without tag)', () => {
        const block = extractAddToDataBlock((0, viewer_data_add_1.getViewerDataAddScript)());
        assert.ok(block.includes('sTag === \'database\'') && block.includes('sqlMeta.fingerprint'), 'repeat hash must gate sqlfp on source tag so non-database Drift-shaped noise does not use fingerprint key');
        assert.ok(!block.includes('sqlMetaRepeat'), 'legacy sqlMetaRepeat name should stay removed to avoid two-parse regression');
    });
    test('new stack-header row defaults to fully expanded (not stack preview)', () => {
        const block = extractAddToDataBlock((0, viewer_data_add_1.getViewerDataAddScript)());
        assert.ok(block.length > 0, 'expected addToData block');
        assert.ok(block.includes("type: 'stack-header'") && block.includes('frameCount: 1, collapsed: false'), 'new traces should default to expanded so frames are not hidden behind [+N more]');
        assert.ok(!block.includes("frameCount: 1, collapsed: 'preview'"), 'regression: preview default would hide frames until user expands');
    });
});
//# sourceMappingURL=viewer-data-add-embed.test.js.map