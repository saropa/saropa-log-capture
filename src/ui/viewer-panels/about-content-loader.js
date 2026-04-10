"use strict";
/**
 * Loads CHANGELOG excerpt for the About panel. Shared by sidebar and pop-out message handlers.
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
exports.buildChangelogUrl = buildChangelogUrl;
exports.formatAboutVersion = formatAboutVersion;
exports.loadAndPostAboutContent = loadAndPostAboutContent;
const vscode = __importStar(require("vscode"));
const marketplace_url_1 = require("../../modules/marketplace-url");
const MAX_EXCERPT_CHARS = 6000;
const MAX_SECTIONS = 3;
/** Build changelog URL from extension id (e.g. saropa.saropa-log-capture). */
function buildChangelogUrl(extensionId) {
    return (0, marketplace_url_1.buildChangelogUrl)(extensionId);
}
/** Build version string for display. */
function formatAboutVersion(version) {
    return version ? `v${version}` : "";
}
/** Load CHANGELOG.md from extension and post aboutContent to webview. Runs async; safe to call from message handler. */
async function loadAndPostAboutContent(extensionUri, extensionVersion, extensionId, post) {
    const version = formatAboutVersion(extensionVersion);
    const changelogUrl = buildChangelogUrl(extensionId);
    try {
        // After repository re-org, the changelog lives under `docs/`, but keep
        // a fallback to the legacy root path to avoid packaging/runtime issues.
        const candidatePaths = ["CHANGELOG.md", "docs/CHANGELOG.md"];
        let buf;
        for (const candidate of candidatePaths) {
            try {
                const uri = vscode.Uri.joinPath(extensionUri, ...candidate.split("/"));
                buf = await vscode.workspace.fs.readFile(uri);
                break;
            }
            catch {
                // Try next candidate.
            }
        }
        if (!buf) {
            throw new Error("CHANGELOG not found");
        }
        const full = Buffer.from(buf).toString("utf-8");
        const sections = full.split(/\n(?=##\s)/);
        const excerpt = sections.slice(0, MAX_SECTIONS).join("\n").slice(0, MAX_EXCERPT_CHARS);
        post({ type: "aboutContent", version, changelogExcerpt: excerpt, changelogUrl });
    }
    catch {
        post({ type: "aboutContent", version, changelogExcerpt: "", changelogUrl });
    }
}
//# sourceMappingURL=about-content-loader.js.map