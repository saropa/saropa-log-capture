"use strict";
/**
 * Obtain an OAuth2 access token from a Google Cloud service account JSON key file.
 * Used when gcloud ADC is not available (e.g. CI, locked-down machines).
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
exports.getAccessTokenFromServiceAccount = getAccessTokenFromServiceAccount;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crashlytics_diagnostics_1 = require("./crashlytics-diagnostics");
const FIREBASE_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
/**
 * Get an access token using the service account key file at keyPath.
 * keyPath must be absolute. Returns undefined on any error (file not found, invalid JSON, auth failure).
 */
async function getAccessTokenFromServiceAccount(keyPath) {
    try {
        const keyPathResolved = path.resolve(keyPath);
        if (!fs.existsSync(keyPathResolved)) {
            (0, crashlytics_diagnostics_1.logCrashlytics)('error', `Service account key file not found: ${keyPathResolved}`);
            return undefined;
        }
        const keyContent = fs.readFileSync(keyPathResolved, 'utf-8');
        const key = JSON.parse(keyContent);
        if (!key.client_email || !key.private_key) {
            (0, crashlytics_diagnostics_1.logCrashlytics)('error', 'Service account key file missing client_email or private_key');
            return undefined;
        }
        const { JWT } = await import('google-auth-library');
        const client = new JWT({
            email: key.client_email,
            key: key.private_key,
            scopes: [FIREBASE_SCOPE],
        });
        const res = await client.authorize();
        const token = res.access_token ?? undefined;
        if (!token) {
            (0, crashlytics_diagnostics_1.logCrashlytics)('error', 'Service account auth did not return an access token');
            return undefined;
        }
        (0, crashlytics_diagnostics_1.logCrashlytics)('info', `Access token obtained from service account ${key.client_email}`);
        return token;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        (0, crashlytics_diagnostics_1.logCrashlytics)('error', `Service account token failed: ${msg}`);
        return undefined;
    }
}
//# sourceMappingURL=crashlytics-service-account.js.map