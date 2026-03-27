/**
 * Best-effort GET /api/health against the Drift debug server (Log Capture extension host).
 * Used to show "reachable" next to a URL discovered from log lines.
 */

export interface DriftViewerHealthResult {
  readonly ok: boolean;
  readonly version?: string;
  readonly extensionConnected?: boolean;
  readonly error?: string;
}

const HEALTH_TIMEOUT_MS = 2500;

/**
 * @param baseUrl - e.g. http://127.0.0.1:8642 (trailing slash tolerated)
 */
export async function fetchDriftViewerHealth(baseUrl: string): Promise<DriftViewerHealthResult> {
  const trimmed = baseUrl.replace(/\/$/, "");
  const url = `${trimmed}/api/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      ok?: boolean;
      version?: string;
      extensionConnected?: boolean;
    };
    return {
      ok: !!data.ok,
      version: typeof data.version === "string" ? data.version : undefined,
      extensionConnected: typeof data.extensionConnected === "boolean" ? data.extensionConnected : undefined,
    };
  } catch (e) {
    clearTimeout(timer);
    const err = e instanceof Error ? e.message : String(e);
    return { ok: false, error: err };
  }
}
