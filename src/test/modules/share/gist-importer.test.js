"use strict";
/**
 * Unit tests for share/gist-importer (importFromUrl validation and error messages).
 */
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
const gist_importer_1 = require("../../../modules/share/gist-importer");
suite('GistImporter', () => {
    suite('importFromUrl', () => {
        test('rejects non-https URL', async () => {
            const store = {};
            await assert.rejects(() => (0, gist_importer_1.importFromUrl)('http://example.com/collection.slc', store), (err) => err.message.includes('https'));
        });
        test('rejects invalid URL', async () => {
            const store = {};
            await assert.rejects(() => (0, gist_importer_1.importFromUrl)('not-a-url', store), (err) => err.message.includes('https'));
        });
        test('rejects disallowed URL with guidance (same-network http or file)', async () => {
            const store = {};
            try {
                await (0, gist_importer_1.importFromUrl)('http://example.com/inv.slc', store);
                assert.fail('expected importFromUrl to throw');
            }
            catch (err) {
                const msg = err.message;
                assert.ok(msg.includes('same-network') || msg.includes('file://'), 'error should guide user to allowed URL types');
            }
        });
    });
});
//# sourceMappingURL=gist-importer.test.js.map