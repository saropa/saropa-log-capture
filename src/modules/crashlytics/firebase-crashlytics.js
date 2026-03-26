"use strict";
/** Firebase Crashlytics integration — queries crash data via REST API with gcloud or service account auth. */
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
exports.gcloudInstallUrl = void 0;
exports.getAccessToken = getAccessToken;
exports.detectFirebaseConfig = detectFirebaseConfig;
exports.findBestGoogleServicesJson = findBestGoogleServicesJson;
exports.clearIssueListCache = clearIssueListCache;
exports.getGcloudInstallCommand = getGcloudInstallCommand;
exports.getCrashlyticsStatus = getCrashlyticsStatus;
exports.getFirebaseContext = getFirebaseContext;
exports.updateIssueState = updateIssueState;
exports.getCrashEventDetail = getCrashEventDetail;
exports.getCrashEvents = getCrashEvents;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const crashlytics_io_1 = require("./crashlytics-io");
const crashlytics_service_account_1 = require("./crashlytics-service-account");
const crashlytics_diagnostics_1 = require("./crashlytics-diagnostics");
const crashlytics_api_1 = require("./crashlytics-api");
let gcloudAvailable;
let cachedToken;
let lastDiagnostic;
const tokenTtl = 30 * 60_000;
async function isGcloudAvailable() {
    if (gcloudAvailable !== undefined) {
        return gcloudAvailable;
    }
    try {
        await (0, crashlytics_io_1.runCmd)('gcloud', ['--version']);
        gcloudAvailable = true;
        (0, crashlytics_diagnostics_1.logCrashlytics)('info', 'Google Cloud CLI found');
    }
    catch (err) {
        gcloudAvailable = false;
        lastDiagnostic = (0, crashlytics_diagnostics_1.classifyGcloudError)(err);
        (0, crashlytics_diagnostics_1.logCrashlytics)('error', `gcloud check: ${lastDiagnostic.message}`);
    }
    return gcloudAvailable;
}
/** Resolve service account key path (absolute or relative to workspace root). */
function resolveServiceAccountKeyPath(configuredPath) {
    const trimmed = configuredPath.trim();
    if (!trimmed) {
        return undefined;
    }
    if (path.isAbsolute(trimmed)) {
        return trimmed;
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return path.resolve(trimmed);
    }
    return path.join(folder.uri.fsPath, trimmed);
}
/** Get an access token: service account key file if configured, else gcloud ADC (cached 30 min). */
async function getAccessToken() {
    if (cachedToken && Date.now() < cachedToken.expires) {
        return cachedToken.token;
    }
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
    const serviceAccountPath = cfg.get('serviceAccountKeyPath', '');
    const resolvedPath = resolveServiceAccountKeyPath(serviceAccountPath);
    if (resolvedPath) {
        const token = await (0, crashlytics_service_account_1.getAccessTokenFromServiceAccount)(resolvedPath);
        if (token) {
            cachedToken = { token, expires: Date.now() + tokenTtl };
            return token;
        }
        lastDiagnostic = { step: 'token', errorType: 'auth', message: 'Service account key failed. Check path and file contents, or use gcloud.', checkedAt: Date.now() };
    }
    try {
        const token = await (0, crashlytics_io_1.runCmd)('gcloud', ['auth', 'application-default', 'print-access-token']);
        if (!token) {
            lastDiagnostic = { step: 'token', errorType: 'auth', message: 'gcloud returned empty token', checkedAt: Date.now() };
            (0, crashlytics_diagnostics_1.logCrashlytics)('error', 'gcloud returned empty access token');
            return undefined;
        }
        cachedToken = { token, expires: Date.now() + tokenTtl };
        (0, crashlytics_diagnostics_1.logCrashlytics)('info', 'Access token retrieved');
        return token;
    }
    catch (err) {
        lastDiagnostic = (0, crashlytics_diagnostics_1.classifyTokenError)(err);
        (0, crashlytics_diagnostics_1.logCrashlytics)('error', `Token fetch: ${lastDiagnostic.message}`);
        return undefined;
    }
}
/** Detect Firebase config from workspace google-services.json or extension settings. */
async function detectFirebaseConfig() {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
    const projectId = cfg.get('projectId', '');
    const appId = cfg.get('appId', '');
    if (projectId && appId) {
        (0, crashlytics_diagnostics_1.logCrashlytics)('info', `Config from settings: project=${projectId}`);
        return { projectId, appId };
    }
    return scanGoogleServicesJson(projectId, appId);
}
const nodeModulesExclude = '**/node_modules/**';
/** Prefer android/app/ for Flutter/Android; then any google-services.json. Runs both searches in parallel. */
async function findBestGoogleServicesJson() {
    const [android, anyFiles] = await Promise.all([
        vscode.workspace.findFiles('**/android/**/google-services.json', nodeModulesExclude, 5),
        vscode.workspace.findFiles('**/google-services.json', nodeModulesExclude, 5),
    ]);
    return android.length > 0 ? android[0] : anyFiles[0];
}
async function scanGoogleServicesJson(fallbackProject, fallbackApp) {
    const file = await findBestGoogleServicesJson();
    if (!file) {
        (0, crashlytics_diagnostics_1.logCrashlytics)('info', 'No google-services.json found in workspace (searched android/** and **)');
        lastDiagnostic = { step: 'config', errorType: 'config', message: `No google-services.json found. ${crashlytics_diagnostics_1.firebaseConfigSetupHint}`, checkedAt: Date.now() };
        return undefined;
    }
    try {
        const raw = await vscode.workspace.fs.readFile(file);
        const json = JSON.parse(Buffer.from(raw).toString('utf-8'));
        const projectId = fallbackProject || json.project_info?.project_id;
        const client = json.client?.[0];
        const appId = fallbackApp || client?.client_info?.mobilesdk_app_id;
        if (projectId && appId) {
            const rel = vscode.workspace.asRelativePath(file);
            (0, crashlytics_diagnostics_1.logCrashlytics)('info', `Config from ${rel}: project=${projectId}`);
            return { projectId, appId };
        }
        const missing = !projectId ? 'projectId' : 'appId';
        (0, crashlytics_diagnostics_1.logCrashlytics)('error', `google-services.json missing ${missing}`);
        lastDiagnostic = { step: 'config', errorType: 'config', message: `google-services.json found but missing ${missing}`, checkedAt: Date.now() };
        return undefined;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        (0, crashlytics_diagnostics_1.logCrashlytics)('error', `Failed to parse google-services.json: ${msg}`);
        lastDiagnostic = { step: 'config', errorType: 'config', message: `Failed to parse google-services.json`, technicalDetails: msg, checkedAt: Date.now() };
        return undefined;
    }
}
/** Clear all cached state so the next query re-checks gcloud, token, and issues. */
function clearIssueListCache() {
    gcloudAvailable = undefined;
    cachedToken = undefined;
    lastDiagnostic = undefined;
    (0, crashlytics_api_1.clearApiCache)();
}
/** Install page for the Google Cloud CLI (gcloud), required for Crashlytics API access. */
exports.gcloudInstallUrl = 'https://docs.cloud.google.com/sdk/docs/install-sdk';
/** OS-specific one-liner to install gcloud (for copy/paste in terminal). Empty if no recommended command. */
function getGcloudInstallCommand() {
    switch (process.platform) {
        case 'win32':
            return 'winget install -e --id Google.CloudSDK';
        case 'darwin':
            return 'brew install --cask google-cloud-sdk';
        default:
            return '';
    }
}
/** Lightweight readiness check (token + config only, no API call). For status bar. Uses getAccessToken so service-account-only works without gcloud. */
async function getCrashlyticsStatus() {
    try {
        const token = await getAccessToken();
        if (!token) {
            return { status: 'setup' };
        }
        const config = await detectFirebaseConfig();
        if (!config) {
            return { status: 'setup' };
        }
        return { status: 'ready' };
    }
    catch {
        return { status: 'setup' };
    }
}
/** Query Firebase Crashlytics for issues matching error tokens. Never throws; returns a safe context on any failure. Token is tried first (service account or gcloud) so SA-only users never hit the gcloud step. */
async function getFirebaseContext(errorTokens) {
    const safeEmpty = (setupStep, setupHint, setupChecklist) => ({ available: false, setupStep, setupHint, setupChecklist, issues: [], diagnostics: lastDiagnostic });
    lastDiagnostic = undefined;
    try {
        const token = await getAccessToken();
        if (!token) {
            const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
            const saPath = resolveServiceAccountKeyPath(cfg.get('serviceAccountKeyPath', ''));
            if (saPath) {
                return safeEmpty('token', 'Service account key failed. Check path and file, or clear the setting to use gcloud.', { gcloud: 'ok', token: 'missing', config: 'pending' });
            }
            const gcloudOk = await isGcloudAvailable();
            if (!gcloudOk) {
                return safeEmpty('gcloud', `Install Google Cloud CLI from ${exports.gcloudInstallUrl}`, { gcloud: 'missing', token: 'pending', config: 'pending' });
            }
            return safeEmpty('token', 'Run: gcloud auth application-default login', { gcloud: 'ok', token: 'missing', config: 'pending' });
        }
        const config = await detectFirebaseConfig();
        if (!config) {
            return safeEmpty('config', crashlytics_diagnostics_1.firebaseConfigSetupHint, { gcloud: 'ok', token: 'ok', config: 'missing' });
        }
        const consoleUrl = `https://console.firebase.google.com/project/${config.projectId}/crashlytics/app/${config.appId}/issues`;
        const fullChecklist = { gcloud: 'ok', token: 'ok', config: 'ok' };
        try {
            const issues = await (0, crashlytics_api_1.queryTopIssues)(config, token, errorTokens);
            (0, crashlytics_diagnostics_1.logCrashlytics)('info', `Fetched ${issues.length} Crashlytics issues`);
            const diag = issues.length === 0 ? (lastDiagnostic ?? (0, crashlytics_api_1.getLastApiDiagnostic)()) : undefined;
            return { available: true, issues, consoleUrl, queriedAt: Date.now(), diagnostics: diag, setupChecklist: fullChecklist };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            (0, crashlytics_diagnostics_1.logCrashlytics)('error', `Issue query failed: ${msg}`);
            if (!lastDiagnostic) {
                lastDiagnostic = { step: 'api', errorType: 'network', message: msg, checkedAt: Date.now() };
            }
            return { available: true, issues: [], consoleUrl, queriedAt: Date.now(), diagnostics: lastDiagnostic, setupChecklist: fullChecklist };
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        (0, crashlytics_diagnostics_1.logCrashlytics)('error', `getFirebaseContext failed: ${msg}`);
        lastDiagnostic = { step: 'api', errorType: 'network', message: msg, checkedAt: Date.now() };
        return { available: false, setupStep: 'gcloud', setupHint: 'Unexpected error; check Output for Saropa Crashlytics', issues: [], diagnostics: lastDiagnostic, setupChecklist: { gcloud: 'missing', token: 'pending', config: 'pending' } };
    }
}
/** Update a Crashlytics issue state (close or mute). Returns true on success. Never throws. */
async function updateIssueState(issueId, state) {
    try {
        const token = await getAccessToken();
        if (!token) {
            return false;
        }
        const config = await detectFirebaseConfig();
        if (!config) {
            return false;
        }
        return await (0, crashlytics_api_1.updateIssueState)(config, token, issueId, state);
    }
    catch {
        return false;
    }
}
/** Fetch crash events for a specific issue, returning multi-event structure with pagination. */
async function getCrashEventDetail(issueId) {
    const multi = await getCrashEvents(issueId);
    return multi?.events[multi.currentIndex];
}
/** Fetch multiple crash events for an issue (cached). Never throws. */
async function getCrashEvents(issueId) {
    try {
        const token = await getAccessToken();
        if (!token) {
            return undefined;
        }
        const config = await detectFirebaseConfig();
        if (!config) {
            return undefined;
        }
        return await (0, crashlytics_api_1.getCrashEvents)(token, config, issueId);
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=firebase-crashlytics.js.map