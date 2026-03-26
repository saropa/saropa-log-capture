"use strict";
/**
 * In-app help content for Firebase Crashlytics (all content lives in the panel Help section).
 * All content is rendered inside the Crashlytics panel.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCrashlyticsHelpSections = getCrashlyticsHelpSections;
const GCLOUD_INSTALL_URL = 'https://docs.cloud.google.com/sdk/docs/install-sdk';
function link(url, text) {
    return `<a class="cp-help-link" href="#" data-action="openUrl" data-url="${escapeAttr(url)}">${escapeHtml(text)}</a>`;
}
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function getCrashlyticsHelpSections() {
    return [
        {
            title: 'Overview',
            html: `<p>Saropa Log Capture queries Firebase Crashlytics for production crash data matching errors in your debug logs. When you analyze a log line, the extension checks if the same error class or message appears in Crashlytics and shows matching issues with event counts, affected users, and a link to the Firebase Console.</p>`,
        },
        {
            title: 'Prerequisites',
            html: `<ol>
<li><strong>Google Cloud SDK</strong> (<code>gcloud</code> CLI) installed and on your PATH</li>
<li><strong>Application Default Credentials</strong> configured</li>
<li><strong>Firebase project</strong> with Crashlytics enabled for your app</li>
</ol>`,
        },
        {
            title: 'Authentication',
            html: `<p>The extension uses Google Cloud Application Default Credentials (ADC), the same as <code>gcloud</code> and Firebase Admin SDK.</p>
<p><strong>One-time setup:</strong> Run <code>gcloud auth application-default login</code>. This opens a browser for Google OAuth. Credentials are stored locally (Windows: <code>%APPDATA%\\gcloud\\application_default_credentials.json</code>; macOS/Linux: <code>~/.config/gcloud/application_default_credentials.json</code>). The extension does not read this file; it runs <code>gcloud auth application-default print-access-token</code> to get a short-lived token, cached in memory for 30 minutes.</p>
<p><strong>Permissions:</strong> Your account needs the <strong>Firebase Crashlytics Viewer</strong> role (or Editor/Owner) on the Firebase project. If you can see Crashlytics in the Firebase Console, you have enough access.</p>
<p><strong>Token lifecycle:</strong> First analysis runs gcloud or reads a service account key (~500ms). Later analyses use the cached token (0ms). After 30 minutes the cache expires and the next analysis re-fetches. If the token expires upstream, gcloud auto-refreshes from the stored credential file.</p>
<p><strong>Service account (alternative):</strong> When gcloud is not available (e.g. CI), set <code>saropaLogCapture.firebase.serviceAccountKeyPath</code> to the path of a Google Cloud service account JSON key. Create the key in Google Cloud Console (IAM &amp; Admin → Service Accounts → Keys → Add key → JSON) and grant the account <strong>Firebase Crashlytics Viewer</strong>. Do not commit the key; add it to <code>.gitignore</code>.</p>`,
        },
        {
            title: 'Project configuration',
            html: `<p>The extension needs your Firebase <strong>project ID</strong> and <strong>app ID</strong>.</p>
<p><strong>Auto-detection:</strong> If the workspace has a <code>google-services.json</code> file (Android/Flutter), the extension reads <code>project_info.project_id</code> and the first client's <code>mobilesdk_app_id</code>. No settings needed.</p>
<p><strong>Manual override:</strong> In <code>.vscode/settings.json</code> set <code>saropaLogCapture.firebase.projectId</code> and <code>saropaLogCapture.firebase.appId</code>. Find these in Firebase Console under Project Settings → General.</p>
<p><strong>Detection priority:</strong> (1) Extension settings if both set; (2) <code>google-services.json</code> in workspace (android/ paths preferred, then other matches, up to 5, excluding node_modules); (3) not configured with setup hint.</p>`,
        },
        {
            title: 'What it queries',
            html: `<p>The extension calls the <strong>Crashlytics topIssues report</strong> REST API (<code>POST .../reports/topIssues:query</code>) and gets the top 20 issues. It filters client-side by matching error tokens from the analyzed log line against issue titles and subtitles.</p>
<p><strong>In the panel</strong> you see for each match: title, subtitle, event count, user count, expand chevron for stack trace, and a Console link. Clicking an issue fetches the latest crash event's stack trace; frames are classified as APP or FW; app frames matching workspace files are clickable.</p>
<p><strong>Not queried:</strong> Firebase Analytics, Performance traces, crash-free statistics — use the Firebase Console link for those.</p>`,
        },
        {
            title: 'Caching',
            html: `<p>Crash event detail is cached to disk to avoid repeated API calls. Location: <code>{logDirectory}/.crashlytics/{issueId}.json</code> (default <code>reports/.crashlytics/</code>). Written after a successful fetch; read before an API call (if cache exists, returns immediately). No TTL — crash events are immutable. To force a re-fetch, delete the cached JSON for that issue ID.</p>`,
        },
        {
            title: 'Troubleshooting',
            html: `<p>Use the <strong>Troubleshooting</strong> table in the setup area above. If you see &quot;Install gcloud CLI&quot;, install from ${link(GCLOUD_INSTALL_URL, 'Google Cloud SDK')}. If you see &quot;Run: gcloud auth application-default login&quot;, run that command. For &quot;Add google-services.json&quot;, add the file or set project/app in settings. For &quot;0 matches&quot;, check Firebase Console via the link. For &quot;Firebase query failed&quot;, verify <code>gcloud auth application-default print-access-token</code> works.</p>`,
        },
        {
            title: 'Architecture',
            html: `<p>Analysis runs <code>runFirebaseLookup()</code> (gcloud check, get token, detect config, query topIssues, match issues). Fetching crash detail uses <code>readCachedDetail()</code> then <code>getCrashEventDetail()</code> (REST GET events), <code>parseEventResponse()</code>, <code>writeCacheDetail()</code>, and frame classification with <code>isFrameworkFrame()</code>. Service-account auth uses <code>google-auth-library</code> when <code>serviceAccountKeyPath</code> is set; otherwise Node <code>https</code> and <code>child_process.execFile</code> for gcloud token.</p>`,
        },
    ];
}
//# sourceMappingURL=crashlytics-help-content.js.map