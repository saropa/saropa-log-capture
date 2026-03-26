"use strict";
/**
 * Extension-wide logging to the "Saropa Log Capture" output channel.
 *
 * Set the channel once from the extension entry point (setExtensionLogger).
 * All log calls then append to that channel so users and support can inspect
 * errors and warnings in one place.
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
exports.setExtensionLogger = setExtensionLogger;
exports.getExtensionLogger = getExtensionLogger;
exports.logExtensionError = logExtensionError;
exports.logExtensionWarn = logExtensionWarn;
exports.logExtensionInfo = logExtensionInfo;
const vscode = __importStar(require("vscode"));
let channel;
/**
 * Set the output channel used for extension logging. Call once at activation.
 */
function setExtensionLogger(outputChannel) {
    channel = outputChannel;
}
/**
 * Get the current logger channel. If never set, creates a fallback channel.
 */
function getExtensionLogger() {
    if (channel) {
        return channel;
    }
    channel = vscode.window.createOutputChannel('Saropa Log Capture');
    return channel;
}
/**
 * Log an error with optional context. Use for failures and unexpected conditions.
 */
function logExtensionError(context, messageOrError) {
    const msg = typeof messageOrError === 'string' ? messageOrError : messageOrError.message;
    getExtensionLogger().appendLine(`[${context}] ERROR ${msg}`);
}
/**
 * Log a warning. Use for recoverable or degraded behavior.
 */
function logExtensionWarn(context, message) {
    getExtensionLogger().appendLine(`[${context}] WARN ${message}`);
}
/**
 * Log an info message. Use sparingly (e.g. session start/stop, retention).
 */
function logExtensionInfo(context, message) {
    getExtensionLogger().appendLine(`[${context}] ${message}`);
}
//# sourceMappingURL=extension-logger.js.map