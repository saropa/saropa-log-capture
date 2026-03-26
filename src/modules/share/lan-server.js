"use strict";
/**
 * Temporary LAN HTTP server to serve an investigation .slc file so teammates on the same network can download it.
 * Use for enterprise / no-GitHub sharing. Call stopLanShareServer() to stop the server.
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
exports.getLocalIP = getLocalIP;
exports.startShareServer = startShareServer;
exports.stopLanShareServer = stopLanShareServer;
exports.isLanShareServerRunning = isLanShareServerRunning;
const http = __importStar(require("http"));
const os = __importStar(require("os"));
const slc_bundle_1 = require("../export/slc-bundle");
let activeServer = null;
/** Get first non-internal IPv4 address, or 127.0.0.1. */
function getLocalIP() {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        const list = ifaces[name];
        if (!list) {
            continue;
        }
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
async function startShareServer(investigation, workspaceUri) {
    const buffer = await (0, slc_bundle_1.exportInvestigationToBuffer)(investigation, workspaceUri);
    if (activeServer) {
        activeServer.close();
        activeServer = null;
    }
    const server = http.createServer((req, res) => {
        if (req.url === '/' || req.url === '/investigation.slc') {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', 'attachment; filename="investigation.slc"');
            res.end(buffer);
        }
        else {
            res.writeHead(404);
            res.end('Not found');
        }
    });
    await new Promise((resolve, reject) => {
        server.listen(0, () => {
            server.removeListener('error', reject);
            resolve();
        });
        server.once('error', reject);
    });
    const addr = server.address();
    const port = typeof addr === 'object' && addr !== null && 'port' in addr && typeof addr.port === 'number'
        ? addr.port
        : 0;
    if (!port) {
        server.close();
        throw new Error('Could not get server port');
    }
    activeServer = server;
    const ip = getLocalIP();
    const url = `http://${ip}:${port}/investigation.slc`;
    const stop = () => {
        if (activeServer === server) {
            activeServer.close();
            activeServer = null;
        }
    };
    return { url, stop };
}
/** Stop the active LAN share server if any. */
function stopLanShareServer() {
    if (activeServer) {
        activeServer.close();
        activeServer = null;
    }
}
/** True if a LAN share server is currently running. */
function isLanShareServerRunning() {
    return activeServer !== null;
}
//# sourceMappingURL=lan-server.js.map