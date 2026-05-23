/**
 * Locate the gcloud executable.
 *
 * Why this exists (bug_008): `winget install Google.CloudSDK` is a per-user install that updates the
 * user PATH, but a VS Code window launched BEFORE that install inherits a stale environment, so a bare
 * `gcloud` call resolves to nothing — the user "installed gcloud" yet every command fails with
 * "'gcloud' is not recognized". Probing the known install directories on disk lets us find and run the
 * real binary even when PATH has not refreshed, so the common case works without a full VS Code restart.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** Resolved gcloud command (absolute path or bare 'gcloud'); cached after first resolution. */
let cachedCmd: string | undefined;

/**
 * Candidate absolute paths for the gcloud launcher, in priority order. On Windows the launcher is the
 * `gcloud.cmd` shim (the bare `gcloud` is a POSIX shell script that cmd.exe cannot run); elsewhere it
 * is the `gcloud` script. Covers winget/per-user, all-users, and manual installs.
 */
function candidatePaths(): string[] {
    const home = os.homedir();
    if (process.platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');
        const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
        const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
        const rel = path.join('Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd');
        return [
            path.join(localAppData, rel),
            path.join(programFiles, rel),
            path.join(programFilesX86, rel),
            path.join(home, 'google-cloud-sdk', 'bin', 'gcloud.cmd'),
        ];
    }
    return [
        '/usr/local/bin/gcloud',
        '/usr/lib/google-cloud-sdk/bin/gcloud',
        '/opt/homebrew/share/google-cloud-sdk/bin/gcloud',
        path.join(home, 'google-cloud-sdk', 'bin', 'gcloud'),
        '/snap/bin/gcloud',
    ];
}

/** First gcloud install path that exists on disk, or undefined if none are present. */
export function findGcloudInKnownLocations(): string | undefined {
    for (const candidate of candidatePaths()) {
        try {
            if (fs.existsSync(candidate)) { return candidate; }
        } catch {
            // Unreadable path (permissions, transient FS error) — treat as absent and keep probing.
        }
    }
    return undefined;
}

/**
 * The gcloud command to invoke: an absolute install path when one exists on disk (robust against a
 * stale PATH), otherwise the bare `gcloud` so a correctly-configured PATH still works. Cached because
 * the answer does not change within a session; call {@link resetGcloudLocatorCache} after an install.
 */
export function resolveGcloudCmd(): string {
    if (cachedCmd !== undefined) { return cachedCmd; }
    cachedCmd = findGcloudInKnownLocations() ?? 'gcloud';
    return cachedCmd;
}

/** Forget the cached gcloud path so the next resolve re-probes disk (e.g. after the user installs gcloud). */
export function resetGcloudLocatorCache(): void {
    cachedCmd = undefined;
}
