"use strict";
/**
 * Parse Saropa Drift Advisor "DRIFT DEBUG SERVER" console banners and extract the viewer URL.
 *
 * **Streaming model:** Drift prints the version on the banner line and the `http://127.0.0.1:port`
 * URL a few lines later inside an ASCII frame. The accumulator keeps a short ring buffer of recent
 * plain-text lines so a URL line still pairs with an earlier banner without multi-line regex.
 *
 * **False positives:** A bare localhost URL is ignored unless a banner line appears in the ring;
 * this avoids treating unrelated `127.0.0.1` mentions as the Drift viewer.
 *
 * **Embed sync:** `viewer-drift-debug-server-from-log-script.ts` mirrors the URL/banner heuristics
 * for the webview; keep behavior aligned when changing patterns here.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripAsciiBoxNoise = stripAsciiBoxNoise;
exports.extractDriftViewerHttpUrl = extractDriftViewerHttpUrl;
exports.isDriftDebugServerBannerLine = isDriftDebugServerBannerLine;
exports.extractDriftDebugServerVersion = extractDriftDebugServerVersion;
exports.createDriftDebugServerLogAccumulator = createDriftDebugServerLogAccumulator;
const RING_MAX = 24;
/** HTTP(S) origin for the embedded Drift web viewer (127.0.0.1 or localhost, any port). */
const VIEWER_URL_RE = /https?:\/\/(?:127\.0\.0\.1|localhost):\d+/;
/**
 * Strip common box-drawing / column chars so the URL can be found inside ASCII frames.
 */
function stripAsciiBoxNoise(s) {
    return s.replace(/[│┃║╔╗╚╝╠╣╦╩╬├┤┬┴┼═\-]/g, " ").replace(/\s+/g, " ").trim();
}
/** First http://127.0.0.1:port or http://localhost:port in the line, normalized (no trailing slash). */
function extractDriftViewerHttpUrl(plain) {
    if (!plain) {
        return null;
    }
    const cleaned = stripAsciiBoxNoise(plain);
    const m = cleaned.match(VIEWER_URL_RE);
    if (!m) {
        return null;
    }
    let u = m[0];
    if (u.endsWith("/")) {
        u = u.slice(0, -1);
    }
    return u;
}
function isDriftDebugServerBannerLine(plain) {
    return /DRIFT DEBUG SERVER/i.test(plain);
}
/** Version badge e.g. v2.10.0 in the banner line. */
function extractDriftDebugServerVersion(plain) {
    if (!isDriftDebugServerBannerLine(plain)) {
        return null;
    }
    const vm = plain.match(/\bv(\d+\.\d+\.\d+)\b/);
    return vm ? vm[1] : null;
}
/**
 * Stateful parser: call once per log line (plain text). Returns a detection when a viewer URL
 * appears in context of a recent DRIFT DEBUG SERVER banner in the ring buffer.
 */
function createDriftDebugServerLogAccumulator() {
    const ring = [];
    let lastBannerVersion = null;
    return {
        push(plain) {
            if (!plain) {
                return null;
            }
            ring.push(plain);
            if (ring.length > RING_MAX) {
                ring.shift();
            }
            if (isDriftDebugServerBannerLine(plain)) {
                lastBannerVersion = extractDriftDebugServerVersion(plain);
            }
            const url = extractDriftViewerHttpUrl(plain);
            if (!url) {
                return null;
            }
            const sawBanner = ring.some((line) => isDriftDebugServerBannerLine(line));
            if (!sawBanner) {
                return null;
            }
            return { baseUrl: url, version: lastBannerVersion };
        },
        reset() {
            ring.length = 0;
            lastBannerVersion = null;
        },
    };
}
//# sourceMappingURL=drift-debug-server-log-parse.js.map