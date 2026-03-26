"use strict";
/**
 * Terminal output integration: captures Integrated Terminal output during
 * session and writes it to basename.terminal.log at session end. Capture
 * is started/stopped by session lifecycle; this provider only contributes at end.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.terminalOutputProvider = void 0;
const terminal_capture_1 = require("../terminal-capture");
function isEnabled(context) {
    return (context.config.integrationsAdapters ?? []).includes('terminal');
}
exports.terminalOutputProvider = {
    id: 'terminal',
    isEnabled(context) {
        return isEnabled(context);
    },
    async onSessionEnd(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        (0, terminal_capture_1.stopTerminalCapture)();
        const buffer = (0, terminal_capture_1.getTerminalCaptureBuffer)();
        if (buffer.length === 0) {
            return undefined;
        }
        const cfg = context.config.integrationsTerminal;
        if (!cfg.writeSidecar) {
            return undefined;
        }
        const content = buffer.join('\n');
        const payload = { sidecar: `${context.baseFileName}.terminal.log`, lineCount: buffer.length };
        return [
            { kind: 'meta', key: 'terminal', payload },
            { kind: 'sidecar', filename: `${context.baseFileName}.terminal.log`, content, contentType: 'utf8' },
        ];
    },
};
//# sourceMappingURL=terminal-output.js.map