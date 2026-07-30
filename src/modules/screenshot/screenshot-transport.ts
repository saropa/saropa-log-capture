/**
 * Capture transport selection (plan 114 follow-up): VM `_flutter.screenshot` first,
 * adb screencap as the fallback that actually works on modern Flutter.
 *
 * The VM extension is absent from current SDKs ("Method not found" — see
 * adb-screenshot.ts for the verification), but is kept as the first attempt because
 * it is chrome-free and covers older SDKs and non-Android targets where adb cannot
 * help. Once a VM Service URI answers "method not found" the VM attempt is skipped
 * for that URI (no point paying a socket round-trip per capture); a new URI (new
 * run / hot restart) probes again.
 */

/** The VM-reply signature of a removed/renamed service extension. */
const METHOD_NOT_FOUND = /method not found|unavailable/i;

interface TransportDeps {
    readonly vm: (wsUri: string) => Promise<Uint8Array>;
    readonly adb: () => Promise<Uint8Array>;
    readonly log: (message: string) => void;
}

/** Build the capturePng function the capturer uses; memoizes VM-dead per URI. */
export function makeCaptureTransport(deps: TransportDeps): (wsUri: string) => Promise<Uint8Array> {
    let vmDeadForUri = '';
    return async (wsUri: string): Promise<Uint8Array> => {
        if (vmDeadForUri !== wsUri) {
            try {
                return await deps.vm(wsUri);
            } catch (vmErr) {
                const msg = vmErr instanceof Error ? vmErr.message : String(vmErr);
                if (METHOD_NOT_FOUND.test(msg)) {
                    vmDeadForUri = wsUri;
                    deps.log('screenshot: _flutter.screenshot unavailable on this Flutter version — switching to adb screencap for this run');
                } else {
                    // Transient VM failure (timeout, socket drop): still try adb this once,
                    // but keep probing the VM on later captures.
                    deps.log(`screenshot: VM capture failed (${msg}) — trying adb screencap`);
                }
            }
        }
        return deps.adb();
    };
}
