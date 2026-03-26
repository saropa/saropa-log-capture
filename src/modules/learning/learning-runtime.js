"use strict";
/**
 * Initializes noise-learning services (workspace-scoped). Accessed from activation and handlers.
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
exports.initLearningRuntime = initLearningRuntime;
exports.getLearningStore = getLearningStore;
exports.getInteractionTracker = getInteractionTracker;
exports.flushLearningBuffer = flushLearningBuffer;
const vscode = __importStar(require("vscode"));
const interaction_tracker_1 = require("./interaction-tracker");
const learning_store_1 = require("./learning-store");
let store;
let tracker;
function initLearningRuntime(context, sessionManager) {
    store = new learning_store_1.LearningStore(context.workspaceState);
    tracker = new interaction_tracker_1.InteractionTracker({
        store,
        getSessionId: () => sessionManager.getActiveSession()?.fileUri.toString() ?? "none",
        getMaxLineLength: () => vscode.workspace.getConfiguration("saropaLogCapture").get("learning.maxStoredLineLength", 2000) ?? 2000,
        isEnabled: () => vscode.workspace.getConfiguration("saropaLogCapture").get("learning.enabled", true) !== false,
    });
}
function getLearningStore() {
    return store;
}
function getInteractionTracker() {
    return tracker;
}
async function flushLearningBuffer() {
    await tracker?.flush();
}
//# sourceMappingURL=learning-runtime.js.map