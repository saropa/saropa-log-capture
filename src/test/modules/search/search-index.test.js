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
const search_index_1 = require("../../../modules/search/search-index");
suite('SearchIndexManager', () => {
    test('should initialize with log directory URI', () => {
        const uri = vscode.Uri.file('/test/logs');
        const manager = new search_index_1.SearchIndexManager(uri);
        assert.ok(manager);
    });
    test('should return 0 for total line count when no index', () => {
        const uri = vscode.Uri.file('/test/logs');
        const manager = new search_index_1.SearchIndexManager(uri);
        assert.strictEqual(manager.getTotalLineCount(), 0);
    });
    test('should return 0 for total size when no index', () => {
        const uri = vscode.Uri.file('/test/logs');
        const manager = new search_index_1.SearchIndexManager(uri);
        assert.strictEqual(manager.getTotalSize(), 0);
    });
    test('should clear cached index', () => {
        const uri = vscode.Uri.file('/test/logs');
        const manager = new search_index_1.SearchIndexManager(uri);
        manager.clear();
        assert.strictEqual(manager.getTotalLineCount(), 0);
    });
    test('should handle non-existent directory gracefully', async () => {
        const uri = vscode.Uri.file('/nonexistent/path/logs');
        const manager = new search_index_1.SearchIndexManager(uri);
        const index = await manager.rebuild();
        assert.strictEqual(index.files.length, 0);
        assert.strictEqual(index.version, 1);
    });
});
//# sourceMappingURL=search-index.test.js.map