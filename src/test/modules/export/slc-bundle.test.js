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
const slc_bundle_1 = require("../../../modules/export/slc-bundle");
suite('slc-bundle', () => {
    suite('isSlcManifestValid', () => {
        test('accepts valid manifest with version 1 and mainLog', () => {
            assert.strictEqual((0, slc_bundle_1.isSlcManifestValid)({ version: 1, mainLog: 'session.log', parts: [] }), true);
            assert.strictEqual((0, slc_bundle_1.isSlcManifestValid)({ version: 1, mainLog: 'a.log', parts: ['a_002.log'], displayName: 'Foo' }), true);
        });
        test('accepts valid manifest with version 2 and sidecars', () => {
            assert.strictEqual((0, slc_bundle_1.isSlcManifestValid)({ version: 2, mainLog: 'session.log', parts: [] }), true);
            assert.strictEqual((0, slc_bundle_1.isSlcManifestValid)({ version: 2, mainLog: 'a.log', parts: [], sidecars: ['a.perf.json'] }), true);
        });
        test('rejects unsupported version', () => {
            assert.strictEqual((0, slc_bundle_1.isSlcManifestValid)({ version: 3, mainLog: 'x.log', parts: [] }), false);
            assert.strictEqual((0, slc_bundle_1.isSlcManifestValid)({ version: 0, mainLog: 'x.log', parts: [] }), false);
        });
        test('accepts valid v3 investigation manifest', () => {
            assert.strictEqual((0, slc_bundle_1.isSlcManifestValid)({
                version: 3,
                type: 'investigation',
                investigation: { name: 'My Investigation', sources: [] },
            }), true);
            assert.strictEqual((0, slc_bundle_1.isSlcManifestValid)({
                version: 3,
                type: 'investigation',
                investigation: { name: 'X', sources: [{ type: 'session', filename: 'a.log', label: 'A' }] },
            }), true);
        });
        test('rejects missing mainLog', () => {
            assert.strictEqual((0, slc_bundle_1.isSlcManifestValid)({ version: 1, mainLog: '', parts: [] }), false);
        });
        test('rejects non-string mainLog', () => {
            assert.strictEqual((0, slc_bundle_1.isSlcManifestValid)({ version: 1, mainLog: undefined, parts: [] }), false);
        });
    });
});
//# sourceMappingURL=slc-bundle.test.js.map