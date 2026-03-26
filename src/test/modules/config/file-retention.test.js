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
});
//# sourceMappingURL=file-retention.test.js.map