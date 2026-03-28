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
const integration_adapter_constants_1 = require("../../../modules/integrations/integration-adapter-constants");
suite('integration-adapter-constants', () => {
    test('stripUiOnlyIntegrationAdapterIds removes explainWithAi only', () => {
        assert.deepStrictEqual((0, integration_adapter_constants_1.stripUiOnlyIntegrationAdapterIds)(['packages', 'git']), ['packages', 'git']);
        assert.deepStrictEqual((0, integration_adapter_constants_1.stripUiOnlyIntegrationAdapterIds)(['packages', integration_adapter_constants_1.EXPLAIN_WITH_AI_ADAPTER_ID, 'git']), ['packages', 'git']);
        assert.deepStrictEqual((0, integration_adapter_constants_1.stripUiOnlyIntegrationAdapterIds)([integration_adapter_constants_1.EXPLAIN_WITH_AI_ADAPTER_ID]), []);
    });
    test('mergeIntegrationAdaptersForWebview appends explainWithAi when AI enabled', () => {
        assert.deepStrictEqual((0, integration_adapter_constants_1.mergeIntegrationAdaptersForWebview)(['packages'], false), ['packages']);
        assert.deepStrictEqual((0, integration_adapter_constants_1.mergeIntegrationAdaptersForWebview)(['packages'], true), ['packages', integration_adapter_constants_1.EXPLAIN_WITH_AI_ADAPTER_ID]);
    });
    test('mergeIntegrationAdaptersForWebview strips stray explainWithAi from session list before merge', () => {
        assert.deepStrictEqual((0, integration_adapter_constants_1.mergeIntegrationAdaptersForWebview)(['packages', integration_adapter_constants_1.EXPLAIN_WITH_AI_ADAPTER_ID], true), ['packages', integration_adapter_constants_1.EXPLAIN_WITH_AI_ADAPTER_ID]);
        assert.deepStrictEqual((0, integration_adapter_constants_1.mergeIntegrationAdaptersForWebview)(['packages', integration_adapter_constants_1.EXPLAIN_WITH_AI_ADAPTER_ID], false), ['packages']);
    });
});
//# sourceMappingURL=integration-adapter-constants.test.js.map