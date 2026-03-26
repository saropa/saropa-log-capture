"use strict";
/**
 * Share investigation via GitHub Gist. Exports .slc to buffer, uploads as secret gist, optionally adds README with deep link.
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
exports.shareViaGist = shareViaGist;
const vscode = __importStar(require("vscode"));
const slc_bundle_1 = require("../export/slc-bundle");
const github_auth_1 = require("./github-auth");
const marketplace_url_1 = require("../marketplace-url");
const GIST_API = 'https://api.github.com/gists';
function generateReadme(gistId, investigation) {
    return `# ${investigation.name}

Shared via [Saropa Log Capture](${(0, marketplace_url_1.buildItemUrl)('saropa.saropa-log-capture')})

## Open in VS Code

Click this link to open in VS Code:
\`\`\`
vscode://saropa.saropa-log-capture/import?gist=${gistId}
\`\`\`

## Contents

- ${investigation.sources.length} pinned source(s)
- Created: ${new Date(investigation.createdAt).toISOString()}

## Notes

${investigation.notes ?? 'No notes provided.'}

## Remove this share

Secret gists do not expire. To delete: open this gist on GitHub and use **Delete** (trash icon).
`;
}
/**
 * Share investigation to a GitHub Gist. Optionally pass a prebuilt buffer (e.g. from a size check) to avoid building twice.
 */
async function shareViaGist(investigation, workspaceUri, context, prebuiltBuffer) {
    const slcBuffer = prebuiltBuffer ?? await (0, slc_bundle_1.exportInvestigationToBuffer)(investigation, workspaceUri);
    const slcBase64 = slcBuffer.toString('base64');
    const token = await (0, github_auth_1.getGitHubToken)(context);
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
    const publicGist = cfg.get('share.gistPublic', false);
    const createPayload = {
        description: `Saropa Investigation: ${investigation.name}`,
        public: publicGist,
        files: {
            'investigation.slc.b64': { content: slcBase64 },
        },
    };
    const createRes = await fetch(GIST_API, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(createPayload),
    });
    if (!createRes.ok) {
        const errBody = await createRes.json().catch(() => ({}));
        throw new Error(errBody.message ?? 'Failed to create gist');
    }
    const gist = (await createRes.json());
    const readmeContent = generateReadme(gist.id, investigation);
    const patchRes = await fetch(`${GIST_API}/${gist.id}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            files: {
                ...gist.files,
                'README.md': { content: readmeContent },
            },
        }),
    });
    if (!patchRes.ok) {
        // Non-fatal: gist was created, just no README
    }
    const rawUrl = gist.files['investigation.slc.b64']?.raw_url ?? '';
    const deepLinkUrl = `vscode://saropa.saropa-log-capture/import?gist=${gist.id}`;
    return {
        gistId: gist.id,
        gistUrl: gist.html_url,
        rawUrl,
        deepLinkUrl,
    };
}
//# sourceMappingURL=gist-uploader.js.map