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
const assert = __importStar(require("node:assert"));
const metadata_loader_1 = require("../../../modules/session/metadata-loader");
/** Build a minimal LoadedMeta for testing filterByTime. */
function makeMeta(filename) {
    return { filename, meta: { lineCount: 0 } };
}
/** Format a Date into the `YYYYMMDD_HHMMSS` log filename prefix. */
function formatLogDatePrefix(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
suite('MetadataLoader', () => {
    suite('parseSessionDate', () => {
        test('should parse standard log filename', () => {
            const ts = (0, metadata_loader_1.parseSessionDate)('20260224_163302_flutter.log');
            const d = new Date(ts);
            assert.strictEqual(d.getFullYear(), 2026);
            assert.strictEqual(d.getMonth(), 1); // February = 1
            assert.strictEqual(d.getDate(), 24);
            assert.strictEqual(d.getHours(), 16);
            assert.strictEqual(d.getMinutes(), 33);
            assert.strictEqual(d.getSeconds(), 2);
        });
        test('should parse filename without extension', () => {
            const ts = (0, metadata_loader_1.parseSessionDate)('20250101_000000');
            const d = new Date(ts);
            assert.strictEqual(d.getFullYear(), 2025);
            assert.strictEqual(d.getMonth(), 0); // January = 0
            assert.strictEqual(d.getDate(), 1);
        });
        test('should return 0 for non-matching filename', () => {
            assert.strictEqual((0, metadata_loader_1.parseSessionDate)('readme.txt'), 0);
        });
        test('should return 0 for empty string', () => {
            assert.strictEqual((0, metadata_loader_1.parseSessionDate)(''), 0);
        });
        test('should handle midnight boundary', () => {
            const ts = (0, metadata_loader_1.parseSessionDate)('20260101_235959_test.log');
            const d = new Date(ts);
            assert.strictEqual(d.getHours(), 23);
            assert.strictEqual(d.getMinutes(), 59);
            assert.strictEqual(d.getSeconds(), 59);
        });
        test('should handle subfolder prefix', () => {
            const ts = (0, metadata_loader_1.parseSessionDate)('20260224_120000_app.log');
            assert.ok(ts > 0, 'Should parse date from filename with subfolder prefix');
        });
    });
    suite('filterByTime', () => {
        const dayMs = 24 * 60 * 60 * 1000;
        const fixedNow = new Date(2026, 2, 26, 12, 0, 0).getTime();
        const recent = makeMeta(`${formatLogDatePrefix(new Date(fixedNow - (5 * dayMs)))}_app.log`);
        test('should return all metas for "all" range', () => {
            const metas = [makeMeta('20200101_000000_old.log'), recent];
            const result = (0, metadata_loader_1.filterByTime)(metas, 'all');
            assert.strictEqual(result.length, 2);
        });
        test('should filter out old sessions for 24h range', () => {
            const old = makeMeta('20200101_000000_ancient.log');
            const within24h = makeMeta(`${formatLogDatePrefix(new Date(fixedNow - (2 * 60 * 60 * 1000)))}_within.log`);
            const result = (0, metadata_loader_1.filterByTime)([old, recent, within24h], '24h', fixedNow);
            // The old one from 2020 should definitely be filtered out
            assert.ok(!result.some(m => m.filename === '20200101_000000_ancient.log'));
            // A session from 2 hours ago should stay in the 24h window.
            assert.ok(result.some(m => m.filename === within24h.filename));
            // A session from 5 days ago should not remain in the 24h window.
            assert.ok(!result.some(m => m.filename === recent.filename));
        });
        test('should keep recent sessions for 30d range', () => {
            const result = (0, metadata_loader_1.filterByTime)([recent], '30d', fixedNow);
            // A session from 5 days ago should pass the 30d filter.
            assert.strictEqual(result.length, 1);
        });
        test('should return empty for empty input', () => {
            const result = (0, metadata_loader_1.filterByTime)([], '7d');
            assert.strictEqual(result.length, 0);
        });
        test('should filter out unparseable filenames', () => {
            const bad = makeMeta('not-a-date.log');
            const result = (0, metadata_loader_1.filterByTime)([bad], '24h', fixedNow);
            // parseSessionDate returns 0 which is 1970 — always filtered out
            assert.strictEqual(result.length, 0);
        });
    });
});
//# sourceMappingURL=metadata-loader.test.js.map