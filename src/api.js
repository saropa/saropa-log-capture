"use strict";
/**
 * Runtime implementation of the public extension API.
 *
 * Bridges internal SessionManager listeners and IntegrationRegistry to the
 * standard vscode.Event pattern. Created once during activation; disposed
 * during deactivation.
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
exports.createApi = createApi;
const vscode = __importStar(require("vscode"));
const integrations_1 = require("./modules/integrations");
/** Create the public API object, wiring it to the given SessionManager. */
function createApi(sessionManager) {
    const lineEmitter = new vscode.EventEmitter();
    const splitEmitter = new vscode.EventEmitter();
    const startEmitter = new vscode.EventEmitter();
    const endEmitter = new vscode.EventEmitter();
    const lineListener = (data) => {
        lineEmitter.fire({
            text: data.text,
            isMarker: data.isMarker,
            lineCount: data.lineCount,
            category: data.category,
            timestamp: data.timestamp,
            sourcePath: data.sourcePath,
            sourceLine: data.sourceLine,
            watchHits: data.watchHits,
        });
    };
    sessionManager.addLineListener(lineListener);
    const splitListener = (newUri, partNumber, totalParts) => {
        splitEmitter.fire({ newUri, partNumber, totalParts });
    };
    sessionManager.addSplitListener(splitListener);
    const api = {
        onDidWriteLine: lineEmitter.event,
        onDidSplitFile: splitEmitter.event,
        onDidStartSession: startEmitter.event,
        onDidEndSession: endEmitter.event,
        getSessionInfo() {
            return buildSessionInfo(sessionManager);
        },
        writeLine(text, options) {
            sessionManager.writeLine(text, options?.category ?? 'console', options?.timestamp ?? new Date());
        },
        insertMarker(text) {
            sessionManager.insertMarker(text);
        },
        registerIntegrationProvider(provider) {
            const registry = (0, integrations_1.getDefaultIntegrationRegistry)();
            registry.register(provider);
            return new vscode.Disposable(() => {
                registry.unregister(provider.id);
            });
        },
    };
    return {
        api,
        fireSessionStart: (event) => startEmitter.fire(event),
        fireSessionEnd: (event) => endEmitter.fire(event),
        dispose: () => {
            sessionManager.removeLineListener(lineListener);
            sessionManager.removeSplitListener(splitListener);
            lineEmitter.dispose();
            splitEmitter.dispose();
            startEmitter.dispose();
            endEmitter.dispose();
        },
    };
}
/** Build a read-only session info snapshot from the session manager. */
function buildSessionInfo(sessionManager) {
    const session = sessionManager.getActiveSession();
    if (!session) {
        if (sessionManager.activeSessionCount > 0) {
            return { isActive: true, isPaused: false, lineCount: 0 };
        }
        return undefined;
    }
    return {
        isActive: true,
        isPaused: session.state === 'paused',
        lineCount: session.lineCount,
        fileUri: session.fileUri,
        debugAdapterType: session.sessionContext.debugAdapterType,
        projectName: session.sessionContext.projectName,
    };
}
//# sourceMappingURL=api.js.map