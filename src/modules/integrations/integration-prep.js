"use strict";
/**
 * Prep checks when an integration is enabled. Runs lightweight validation and
 * reports to the user if something is missing (e.g. Crashlytics needs gcloud + config).
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
exports.runIntegrationPrepCheck = runIntegrationPrepCheck;
const vscode = __importStar(require("vscode"));
const firebase_crashlytics_1 = require("../crashlytics/firebase-crashlytics");
const adb_logcat_capture_1 = require("./adb-logcat-capture");
/** Check if Crashlytics is ready and return an issue string if not. */
async function checkCrashlyticsPrep() {
    try {
        const ctx = await (0, firebase_crashlytics_1.getFirebaseContext)([]);
        if (!ctx || !ctx.available) {
            const hint = ctx?.setupHint ?? 'Check Output for Saropa Crashlytics.';
            return `Crashlytics: ${hint}`;
        }
    }
    catch {
        return 'Crashlytics: prep check failed; open the Crashlytics panel for details.';
    }
    return undefined;
}
/** Run prep checks for the given adapter ids and show a single message about issues. Never throws. */
async function runIntegrationPrepCheck(adapterIds) {
    try {
        if (!Array.isArray(adapterIds) || adapterIds.length === 0) {
            return;
        }
        const ids = adapterIds.filter((id) => typeof id === 'string');
        const issues = [];
        if (ids.includes('crashlytics')) {
            const issue = await checkCrashlyticsPrep();
            if (issue) {
                issues.push(issue);
            }
        }
        if (ids.includes('adbLogcat') && !(0, adb_logcat_capture_1.isAdbAvailable)()) {
            issues.push('adb Logcat: `adb` not found on PATH. Install Android SDK Platform-Tools.');
        }
        if (issues.length > 0) {
            void vscode.window.showWarningMessage(issues.length === 1 ? issues[0] : `Integration setup:\n${issues.join('\n')}`, { modal: false });
        }
    }
    catch {
        // Never surface prep failure to the user as a crash
    }
}
//# sourceMappingURL=integration-prep.js.map