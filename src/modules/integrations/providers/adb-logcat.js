"use strict";
/**
 * Integration provider for adb logcat: captures Android system log alongside
 * the debug session. Streaming lines are spawned via onSessionStartStreaming
 * (Phase 2 provider pattern); header and sidecar are handled at session
 * boundaries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adbLogcatProvider = void 0;
const child_process_1 = require("child_process");
const adb_logcat_capture_1 = require("../adb-logcat-capture");
/**
 * Enabled when explicitly listed in integrations.adapters OR when the
 * debug adapter is Dart/Flutter (auto-detect). The isAdbAvailable() check
 * is deferred to onSessionStartStreaming to avoid spawning a process on
 * every isEnabled call.
 */
function checkEnabled(context) {
    const explicit = (context.config.integrationsAdapters ?? []).includes('adbLogcat');
    const autoDetect = context.sessionContext.debugAdapterType === 'dart';
    return explicit || autoDetect;
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
        return checkEnabled(context);
    },
    onSessionStartSync(context) {
        if (!checkEnabled(context)) {
            return undefined;
        }
        const version = getAdbVersion();
        if (!version) {
            return undefined;
        }
        return [{ kind: 'header', lines: [`adb: ${version}`] }];
    },
    onSessionStartStreaming(context, writer) {
        if (!(0, adb_logcat_capture_1.isAdbAvailable)()) {
            return;
        }
        const lc = context.config.integrationsAdbLogcat;
        (0, adb_logcat_capture_1.startLogcatCapture)({
            ...lc,
            outputChannel: context.outputChannel,
            onLine: (raw) => writer.writeLine(raw, 'logcat', new Date()),
        });
    },
    onProcessId(processId) {
        (0, adb_logcat_capture_1.setLogcatPidFilter)(processId);
    },
    async onSessionEnd(context) {
        if (!checkEnabled(context)) {
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