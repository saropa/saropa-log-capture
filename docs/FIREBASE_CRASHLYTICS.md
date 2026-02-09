# Firebase Crashlytics Integration

Saropa Log Capture can query Firebase Crashlytics for production crash data matching errors found in your debug logs. When you analyze a log line, the extension checks if the same error class or message appears in your Crashlytics dashboard and shows matching crash issues with event counts, affected users, and a direct link to the Firebase Console.

## Prerequisites

1. **Google Cloud SDK** (`gcloud` CLI) installed and on your PATH
2. **Application Default Credentials** configured
3. **Firebase project** with Crashlytics enabled for your app

## Authentication

The extension authenticates via Google Cloud Application Default Credentials (ADC). This is the same mechanism used by `gcloud`, Firebase Admin SDK, and other Google Cloud tools.

### One-time setup

```bash
# 1. Install gcloud CLI (if not already installed)
#    https://cloud.google.com/sdk/docs/install

# 2. Log in and set application default credentials
gcloud auth application-default login
```

This opens a browser for Google OAuth consent. Once authorized, a credential file is stored locally at:
- Windows: `%APPDATA%\gcloud\application_default_credentials.json`
- macOS/Linux: `~/.config/gcloud/application_default_credentials.json`

The extension never reads this file directly. It runs `gcloud auth application-default print-access-token` to get a short-lived OAuth2 Bearer token, which is cached in memory for 30 minutes.

### Required permissions

Your Google account needs the **Firebase Crashlytics Viewer** role (or broader roles like **Editor** / **Owner**) on the Firebase project. If you can see Crashlytics data in the Firebase Console, you have sufficient access.

### Token lifecycle

| Step | Detail |
|------|--------|
| First analysis | Runs `gcloud auth application-default print-access-token` (~500ms) |
| Subsequent analyses | Uses cached token (0ms) |
| After 30 minutes | Token cache expires, next analysis re-fetches |
| Token expired upstream | `gcloud` auto-refreshes from the stored credential file |
| No credentials | Panel shows: "Run: `gcloud auth application-default login`" |

## Project Configuration

The extension needs your Firebase **project ID** and **app ID** to query the correct Crashlytics dataset.

### Auto-detection (recommended)

If your workspace contains a `google-services.json` file (standard for Android/Flutter projects), the extension reads `project_info.project_id` and the first client's `mobilesdk_app_id` automatically. No settings needed.

### Manual override

If auto-detection doesn't work (e.g., the file is in a different repo, or you want to query a different app):

```json
// .vscode/settings.json
{
  "saropaLogCapture.firebase.projectId": "my-firebase-project",
  "saropaLogCapture.firebase.appId": "1:123456789:android:abcdef123456"
}
```

Find these values in the Firebase Console under Project Settings > General.

### Detection priority

1. Extension settings (`saropaLogCapture.firebase.projectId` + `.appId`) if both set
2. `google-services.json` found in workspace (scans up to 3 matches, uses first)
3. Falls back to "not configured" with setup hint

## What It Queries

The extension calls the **Crashlytics topIssues report** REST API:

```
POST https://firebasecrashlytics.googleapis.com/v1beta1/
  projects/{projectId}/apps/{appId}/reports/topIssues:query
```

Request body:
```json
{
  "issueFilters": { "issueErrorTypes": ["FATAL", "NON_FATAL"] },
  "pageSize": 20
}
```

The response contains the top 20 crash issues. The extension filters these client-side by matching error tokens (error class names, quoted strings) extracted from the analyzed log line against issue titles and subtitles.

### What you see in the panel

For each matching issue:
- **Title** (e.g., `java.lang.OutOfMemoryError`)
- **Subtitle** (e.g., `OutOfMemoryError thrown while trying to throw an exception`)
- **Event count** (total crash occurrences)
- **User count** (unique affected users)
- **Console link** to open the issue in Firebase Console

### What is NOT queried

- Individual crash events or stack traces (would require per-issue API calls)
- Firebase Analytics events
- Firebase Performance traces
- Crash-free statistics

These are available in the Firebase Console via the deep link provided.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Install gcloud CLI" | `gcloud` not found on PATH | Install from https://cloud.google.com/sdk |
| "Run: gcloud auth application-default login" | No ADC credentials | Run the login command |
| "Add google-services.json..." | Can't detect project/app | Add the file or set settings manually |
| "0 matches" with Firebase available | No Crashlytics issues match the error tokens | Check Firebase Console directly via the link |
| "Firebase query failed" | Network error or API issue | Check `gcloud auth application-default print-access-token` works |

## Architecture

```
analysis-panel.ts
  └─ runFirebaseLookup()
       └─ firebase-crashlytics.ts
            ├─ isGcloudAvailable()          cached check
            ├─ getAccessToken()             gcloud CLI → 30-min cache
            ├─ detectFirebaseConfig()        settings or google-services.json
            ├─ queryTopIssues()             REST POST → topIssues report
            ├─ matchIssues()                client-side token matching
            └─ fetchJson()                  raw HTTPS with Bearer auth
```

No npm dependencies added. Uses Node.js `https` module and `child_process.execFile`.
