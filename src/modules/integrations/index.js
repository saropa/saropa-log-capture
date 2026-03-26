"use strict";
/**
 * Integration API: types, registry, and context helpers.
 * Providers register with the registry; session lifecycle calls getHeaderContributions
 * and runOnSessionEnd. See docs/history/INTEGRATION_API.md.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIntegrationEndContext = exports.createIntegrationContext = exports.IntegrationRegistry = void 0;
exports.getDefaultIntegrationRegistry = getDefaultIntegrationRegistry;
var registry_1 = require("./registry");
Object.defineProperty(exports, "IntegrationRegistry", { enumerable: true, get: function () { return registry_1.IntegrationRegistry; } });
var context_1 = require("./context");
Object.defineProperty(exports, "createIntegrationContext", { enumerable: true, get: function () { return context_1.createIntegrationContext; } });
Object.defineProperty(exports, "createIntegrationEndContext", { enumerable: true, get: function () { return context_1.createIntegrationEndContext; } });
const registry_2 = require("./registry");
let defaultRegistry;
/** Returns the default integration registry (singleton). Used by session lifecycle. */
function getDefaultIntegrationRegistry() {
    if (!defaultRegistry) {
        defaultRegistry = new registry_2.IntegrationRegistry();
    }
    return defaultRegistry;
}
//# sourceMappingURL=index.js.map