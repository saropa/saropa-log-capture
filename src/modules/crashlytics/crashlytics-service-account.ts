/**
 * Obtain an OAuth2 access token from a Google Cloud service account JSON key file.
 * Used when gcloud ADC is not available (e.g. CI, locked-down machines).
 */

import * as fs from 'fs';
import * as path from 'path';
import { logCrashlytics } from './crashlytics-diagnostics';

const FIREBASE_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

/**
 * Get an access token using the service account key file at keyPath.
 * keyPath must be absolute. Returns undefined on any error (file not found, invalid JSON, auth failure).
 */
export async function getAccessTokenFromServiceAccount(keyPath: string): Promise<string | undefined> {
    try {
        const keyPathResolved = path.resolve(keyPath);
        if (!fs.existsSync(keyPathResolved)) {
            logCrashlytics('error', `Service account key file not found: ${keyPathResolved}`);
            return undefined;
        }
        const keyContent = fs.readFileSync(keyPathResolved, 'utf-8');
        const key = JSON.parse(keyContent) as { client_email?: string; private_key?: string };
        if (!key.client_email || !key.private_key) {
            logCrashlytics('error', 'Service account key file missing client_email or private_key');
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
            logCrashlytics('error', 'Service account auth did not return an access token');
            return undefined;
        }
        logCrashlytics('info', `Access token obtained from service account ${key.client_email}`);
        return token;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logCrashlytics('error', `Service account token failed: ${msg}`);
        return undefined;
    }
}
