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
const file_retention_1 = require("../../../modules/config/file-retention");
suite('File retention', () => {
    suite('selectFilesToTrash', () => {
        test('returns empty when maxLogFiles <= 0', () => {
            const stats = [{ name: 'a.log', mtime: 100 }];
            assert.deepStrictEqual((0, file_retention_1.selectFilesToTrash)(stats, 0), []);
            assert.deepStrictEqual((0, file_retention_1.selectFilesToTrash)(stats, -1), []);
        });
        test('returns empty when count <= maxLogFiles', () => {
            const stats = [
                { name: 'a.log', mtime: 100 },
                { name: 'b.log', mtime: 200 },
            ];
            assert.deepStrictEqual((0, file_retention_1.selectFilesToTrash)(stats, 2), []);
            assert.deepStrictEqual((0, file_retention_1.selectFilesToTrash)(stats, 5), []);
        });
        test('returns oldest first when over limit', () => {
            const stats = [
                { name: 'new.log', mtime: 300 },
                { name: 'old.log', mtime: 100 },
                { name: 'mid.log', mtime: 200 },
            ];
            // 3 files, max 2 → trash 1 (oldest)
            assert.deepStrictEqual((0, file_retention_1.selectFilesToTrash)(stats, 2), ['old.log']);
        });
        test('trashes exactly count - maxLogFiles', () => {
            const stats = [
                { name: '1.log', mtime: 100 },
                { name: '2.log', mtime: 200 },
                { name: '3.log', mtime: 300 },
                { name: '4.log', mtime: 400 },
                { name: '5.log', mtime: 500 },
            ];
            assert.deepStrictEqual((0, file_retention_1.selectFilesToTrash)(stats, 3), ['1.log', '2.log']);
            assert.deepStrictEqual((0, file_retention_1.selectFilesToTrash)(stats, 1), ['1.log', '2.log', '3.log', '4.log']);
        });
        test('trashes one when two files and maxLogFiles 1', () => {
            const stats = [
                { name: 'new.log', mtime: 200 },
                { name: 'old.log', mtime: 100 },
            ];
            assert.deepStrictEqual((0, file_retention_1.selectFilesToTrash)(stats, 1), ['old.log']);
        });
        test('does not mutate input', () => {
            const stats = [
                { name: 'a.log', mtime: 200 },
                { name: 'b.log', mtime: 100 },
            ];
            (0, file_retention_1.selectFilesToTrash)(stats, 1);
            assert.strictEqual(stats[0].name, 'a.log');
            assert.strictEqual(stats[1].name, 'b.log');
        });
    });
    suite('expandGroupsForTrash', () => {
        test('ungrouped candidates pass through unchanged', () => {
            const meta = new Map([
                ['a.log', {}],
                ['b.log', {}],
            ]);
            const out = (0, file_retention_1.expandGroupsForTrash)(['a.log', 'b.log'], meta, undefined);
            assert.deepStrictEqual([...out].sort(), ['a.log', 'b.log']);
        });
        test('skips an active-group member entirely', () => {
            const meta = new Map([
                ['a.log', { groupId: 'g1' }],
                ['b.log', { groupId: 'g1' }],
                ['c.log', {}],
            ]);
            // Candidate a.log is in the active group g1 \u2014 must be skipped.
            const out = (0, file_retention_1.expandGroupsForTrash)(['a.log', 'c.log'], meta, 'g1');
            assert.deepStrictEqual([...out].sort(), ['c.log']);
        });
        test('expands a closed-group candidate to every member', () => {
            const meta = new Map([
                ['a.log', { groupId: 'g1' }],
                ['b.log', { groupId: 'g1' }],
                ['c.log', { groupId: 'g1' }],
            ]);
            // Candidate a.log \u2192 expands to all three members of g1 (group is closed, no active id).
            const out = (0, file_retention_1.expandGroupsForTrash)(['a.log'], meta, undefined);
            assert.deepStrictEqual([...out].sort(), ['a.log', 'b.log', 'c.log']);
        });
        test('dedupes when multiple candidates belong to the same closed group', () => {
            const meta = new Map([
                ['a.log', { groupId: 'g1' }],
                ['b.log', { groupId: 'g1' }],
            ]);
            // Two candidates, both in g1 \u2192 output is still just {a, b} (not duplicated).
            const out = (0, file_retention_1.expandGroupsForTrash)(['a.log', 'b.log'], meta, undefined);
            assert.deepStrictEqual([...out].sort(), ['a.log', 'b.log']);
        });
        test('separates closed-group expansion from active-group skip', () => {
            const meta = new Map([
                ['a1.log', { groupId: 'open' }],
                ['a2.log', { groupId: 'open' }],
                ['b1.log', { groupId: 'closed' }],
                ['b2.log', { groupId: 'closed' }],
                ['c.log', {}],
            ]);
            // a1 is in the active group 'open' \u2192 skipped. b1 is in closed group \u2192 expands to b1+b2.
            // c is ungrouped \u2192 passes through. Result: {b1, b2, c}.
            const out = (0, file_retention_1.expandGroupsForTrash)(['a1.log', 'b1.log', 'c.log'], meta, 'open');
            assert.deepStrictEqual([...out].sort(), ['b1.log', 'b2.log', 'c.log']);
        });
    });
});
//# sourceMappingURL=file-retention.test.js.map