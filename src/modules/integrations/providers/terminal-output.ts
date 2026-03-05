/**
 * Terminal output integration: captures Integrated Terminal output during
 * session and writes it to basename.terminal.log at session end. Capture
 * is started/stopped by session lifecycle; this provider only contributes at end.
 */

import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { getTerminalCaptureBuffer, stopTerminalCapture } from '../terminal-capture';

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('terminal');
}

export const terminalOutputProvider: IntegrationProvider = {
    id: 'terminal',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        stopTerminalCapture();
        const buffer = getTerminalCaptureBuffer();
        if (buffer.length === 0) { return undefined; }
        const cfg = context.config.integrationsTerminal;
        if (!cfg.writeSidecar) { return undefined; }
        const content = buffer.join('\n');
        const payload = { sidecar: `${context.baseFileName}.terminal.log`, lineCount: buffer.length };
        return [
            { kind: 'meta', key: 'terminal', payload },
            { kind: 'sidecar', filename: `${context.baseFileName}.terminal.log`, content, contentType: 'utf8' },
        ];
    },
};
