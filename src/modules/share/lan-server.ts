/**
 * Temporary LAN HTTP server to serve an investigation .slc file so teammates on the same network can download it.
 * Use for enterprise / no-GitHub sharing. Call stopLanShareServer() to stop the server.
 */

import * as http from 'http';
import * as os from 'os';
import * as vscode from 'vscode';
import type { Investigation } from '../investigation/investigation-types';
import { exportInvestigationToBuffer } from '../export/slc-bundle';

let activeServer: http.Server | null = null;

/** Get first non-internal IPv4 address, or 127.0.0.1. */
export function getLocalIP(): string {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        const list = ifaces[name];
        if (!list) continue;
        for (const iface of list) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

/**
 * Start a temporary HTTP server that serves the investigation as .slc. Returns the download URL and a stop function.
 * Only one server can be active at a time; starting another stops the previous one.
 */
export async function startShareServer(
    investigation: Investigation,
    workspaceUri: vscode.Uri,
): Promise<{ url: string; stop: () => void }> {
    const buffer = await exportInvestigationToBuffer(investigation, workspaceUri);

    if (activeServer) {
        activeServer.close();
        activeServer = null;
    }

    const server = http.createServer((req, res) => {
        if (req.url === '/' || req.url === '/investigation.slc') {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', 'attachment; filename="investigation.slc"');
            res.end(buffer);
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    });

    await new Promise<void>((resolve, reject) => {
        server.listen(0, () => {
            server.removeListener('error', reject);
            resolve();
        });
        server.once('error', reject);
    });

    const addr = server.address();
    const port =
        typeof addr === 'object' && addr !== null && 'port' in addr && typeof (addr as { port?: number }).port === 'number'
            ? (addr as { port: number }).port
            : 0;
    if (!port) {
        server.close();
        throw new Error('Could not get server port');
    }

    activeServer = server;
    const ip = getLocalIP();
    const url = `http://${ip}:${port}/investigation.slc`;

    const stop = (): void => {
        if (activeServer === server) {
            activeServer.close();
            activeServer = null;
        }
    };

    return { url, stop };
}

/** Stop the active LAN share server if any. */
export function stopLanShareServer(): void {
    if (activeServer) {
        activeServer.close();
        activeServer = null;
    }
}

/** True if a LAN share server is currently running. */
export function isLanShareServerRunning(): boolean {
    return activeServer !== null;
}
