/**
 * Share investigation via GitHub Gist. Exports .slc to buffer, uploads as secret gist, optionally adds README with deep link.
 */

import * as vscode from 'vscode';
import type { Investigation } from '../investigation/investigation-types';
import { exportInvestigationToBuffer } from '../export/slc-bundle';
import { getGitHubToken } from './github-auth';
import type { GistShareResult } from './share-types';

const GIST_API = 'https://api.github.com/gists';

function generateReadme(gistId: string, investigation: Investigation): string {
    return `# ${investigation.name}

Shared via [Saropa Log Capture](https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture)

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
export async function shareViaGist(
    investigation: Investigation,
    workspaceUri: vscode.Uri,
    context: vscode.ExtensionContext,
    prebuiltBuffer?: Buffer,
): Promise<GistShareResult> {
    const slcBuffer = prebuiltBuffer ?? await exportInvestigationToBuffer(investigation, workspaceUri);
    const slcBase64 = slcBuffer.toString('base64');

    const token = await getGitHubToken(context);
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
    const publicGist = cfg.get<boolean>('share.gistPublic', false);

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
        const errBody = await createRes.json().catch(() => ({})) as { message?: string };
        throw new Error(errBody.message ?? 'Failed to create gist');
    }

    const gist = (await createRes.json()) as { id: string; html_url: string; files: Record<string, { raw_url?: string }> };

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
