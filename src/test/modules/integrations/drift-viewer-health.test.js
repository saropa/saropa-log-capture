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
const drift_viewer_health_1 = require("../../../modules/integrations/drift-viewer-health");
suite('drift-viewer-health', () => {
    let origFetch;
    beforeEach(() => {
        origFetch = globalThis.fetch;
    });
    afterEach(() => {
        globalThis.fetch = origFetch;
    });
    test('fetchDriftViewerHealth returns ok and version on 200 JSON', async () => {
        globalThis.fetch = (async (url) => {
            assert.ok(String(url).includes('/api/health'));
            return {
                ok: true,
                json: async () => ({ ok: true, version: '2.10.0', extensionConnected: false }),
            };
        });
        const r = await (0, drift_viewer_health_1.fetchDriftViewerHealth)('http://127.0.0.1:8642');
        assert.strictEqual(r.ok, true);
        assert.strictEqual(r.version, '2.10.0');
        assert.strictEqual(r.extensionConnected, false);
    });
    test('fetchDriftViewerHealth strips trailing slash before /api/health', async () => {
        let seen = '';
        globalThis.fetch = (async (url) => {
            seen = String(url);
            return { ok: true, json: async () => ({ ok: true }) };
        });
        await (0, drift_viewer_health_1.fetchDriftViewerHealth)('http://127.0.0.1:8642/');
        assert.strictEqual(seen, 'http://127.0.0.1:8642/api/health');
    });
    test('fetchDriftViewerHealth returns ok false on HTTP error', async () => {
        globalThis.fetch = (async () => ({
            ok: false,
            status: 503,
            json: async () => ({}),
        }));
        const r = await (0, drift_viewer_health_1.fetchDriftViewerHealth)('http://127.0.0.1:8642');
        assert.strictEqual(r.ok, false);
        assert.ok(r.error?.includes('503'), r.error);
    });
    test('fetchDriftViewerHealth returns ok false on network failure', async () => {
        globalThis.fetch = (async () => {
            throw new Error('ECONNREFUSED');
        });
        const r = await (0, drift_viewer_health_1.fetchDriftViewerHealth)('http://127.0.0.1:9');
        assert.strictEqual(r.ok, false);
        assert.ok(r.error?.includes('ECONNREFUSED'), r.error);
    });
});
//# sourceMappingURL=drift-viewer-health.test.js.map