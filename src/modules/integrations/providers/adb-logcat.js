"use strict";
/**
 * Integration provider for adb logcat: captures Android system log alongside
 * the debug session. Live lines are streamed via onLine callback (set up in
 * session-lifecycle-init); this provider handles header and sidecar at
 * session boundaries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adbLogcatProvider = void 0;
const child_process_1 = require("child_process");
const adb_logcat_capture_1 = require("../adb-logcat-capture");
function isEnabled(context) {
    return (context.config.integrationsAdapters ?? []).includes('adbLogcat');
}
function getAdbVersion() {
    try {
        const out = (0, child_process_1.execFileSync)('adb', ['version'], { timeout: 5000, encoding: 'utf-8' });
        const m = /Android Debug Bridge version (\S+)/.exec(out);
        return m?.[1];
    }
    catch {
        return undefined;
    }
}
exports.adbLogcatProvider = {
    id: 'adbLogcat',
    isEnabled(context) {
        return isEnabled(context);
    },
    onSessionStartSync(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const version = getAdbVersion();
        if (!version) {
            return undefined;
        }
        return [{ kind: 'header', lines: [`adb: ${version}`] }];
    },
    async onSessionEnd(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        (0, adb_logcat_capture_1.stopLogcatCapture)();
        const lines = (0, adb_logcat_capture_1.getLogcatBuffer)();
        (0, adb_logcat_capture_1.clearLogcatBuffer)();
        const cfg = context.config.integrationsAdbLogcat;
        if (!cfg.writeSidecar || lines.length === 0) {
            return undefined;
        }
        const sidecarName = `${context.baseFileName}.logcat.log`;
        return [
            {
                kind: 'meta',
                key: 'adbLogcat',
                payload: { lineCount: lines.length, sidecar: sidecarName },
            },
            {
                kind: 'sidecar',
                filename: sidecarName,
                content: lines.join('\n'),
                contentType: 'utf8',
            },
        ];
    },
};
//# sourceMappingURL=adb-logcat.js.map