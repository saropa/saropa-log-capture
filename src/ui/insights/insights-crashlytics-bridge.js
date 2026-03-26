"use strict";
/**
 * Async bridge between debug-side recurring errors and Crashlytics production issues.
 *
 * Runs after the Insights panel renders: matches local error fingerprints
 * against Crashlytics issues and posts production badges back to the webview.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCrashlyticsBridge = startCrashlyticsBridge;
const firebase_crashlytics_1 = require("../../modules/crashlytics/firebase-crashlytics");
const crashlytics_diagnostics_1 = require("../../modules/crashlytics/crashlytics-diagnostics");
const bridgeTimeout = 10_000;
/** Post a message to the webview, silently ignoring disposed panels. */
function safePost(panel, message) {
    try {
        panel.webview.postMessage(message);
    }
    catch { /* panel disposed */ }
}
/** Start the async Crashlytics bridge and post results back to the webview panel. */
function startCrashlyticsBridge(panel, errors) {
    if (errors.length === 0) {
        return;
    }
    safePost(panel, { type: 'productionBridgeLoading' });
    let settled = false;
    const finish = (bridges, reason) => {
        if (settled) {
            return;
        }
        settled = true;
        clearTimeout(timer);
        (0, crashlytics_diagnostics_1.getOutputChannel)().appendLine(`Crashlytics bridge: ${reason}`);
        safePost(panel, { type: 'productionBridgeResults', bridges });
    };
    const timer = setTimeout(() => {
        finish({}, 'timed out after 10 s');
    }, bridgeTimeout);
    (0, firebase_crashlytics_1.getFirebaseContext)([]).then((ctx) => {
        if (!ctx.available) {
            finish({}, `not available — ${ctx.setupHint ?? 'unknown reason'}`);
            return;
        }
        const bridges = ctx.issues.length > 0
            ? matchErrorsToIssues(errors, ctx.issues) : {};
        const count = Object.keys(bridges).length;
        finish(bridges, `matched ${count} of ${errors.length} errors against ${ctx.issues.length} issues`);
    }).catch((err) => {
        finish({}, `error — ${err instanceof Error ? err.message : String(err)}`);
    });
}
function matchErrorsToIssues(errors, issues) {
    const bridges = {};
    for (const err of errors) {
        const words = extractMatchWords(err);
        for (const issue of issues) {
            const combined = (issue.title + ' ' + issue.subtitle).toLowerCase();
            if (words.some(w => combined.includes(w))) {
                bridges[err.hash] = `${issue.eventCount} events, ${issue.userCount} users`;
                break;
            }
        }
    }
    return bridges;
}
function extractMatchWords(err) {
    const text = (err.exampleLine + ' ' + err.normalizedText).toLowerCase();
    return text.split(/\s+/).filter(w => w.length > 5 && !/^[<[\d]/.test(w));
}
//# sourceMappingURL=insights-crashlytics-bridge.js.map