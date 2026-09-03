/**
 * Share collection via GitHub Gist. Exports .slc to buffer, uploads as secret gist, optionally adds README with deep link.
 */

import * as vscode from 'vscode';
import type { Collection } from '../collection/collection-types';
import { exportCollectionToBuffer } from '../export/slc-bundle';
import { getGitHubToken, handleGitHubApiUnauthorized } from './github-auth';
import { logExtensionError } from '../misc/extension-logger';
import type { GistShareResult } from './share-types';
import { buildItemUrl } from '../marketplace-url';

const GIST_API = 'https://api.github.com/gists';

function generateReadme(gistId: string, collection: Collection): string {
    return `# ${collection.name}

Shared via [Saropa Log Capture](${buildItemUrl('saropa.saropa-log-capture')})

## Open in VS Code

Click this link to open in VS Code:
\`\`\`
vscode://saropa.saropa-log-capture/import?gist=${gistId}
\`\`\`

## Contents

- ${collection.sources.length} pinned source(s)
- Created: ${new Date(collection.createdAt).toISOString()}

## Notes

${collection.notes ?? 'No notes provided.'}

## Remove this share

Secret gists do not expire. To delete: open this gist on GitHub and use **Delete** (trash icon).
`;
}

/**
 * Share collection to a GitHub Gist. Optionally pass a prebuilt buffer (e.g. from a size check) to avoid building twice.
 */
export async function shareViaGist(
    collection: Collection,
    workspaceUri: vscode.Uri,
    context: vscode.ExtensionContext,
    prebuiltBuffer?: Buffer,
): Promise<GistShareResult> {
    const slcBuffer = prebuiltBuffer ?? await exportCollectionToBuffer(collection, workspaceUri);
    const slcBase64 = slcBuffer.toString('base64');

    const token = await getGitHubToken(context);
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
    const publicGist = cfg.get<boolean>('share.gistPublic', false);

    const createPayload = {
        description: `Saropa Collection: ${collection.name}`,
        public: publicGist,
        files: {
            'collection.slc.b64': { content: slcBase64 },
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
        // A revoked/expired token (401) must be cleared here — otherwise it stays cached
        // and every retry fails identically with no path back to a working share (bug_044).
        await handleGitHubApiUnauthorized(context, createRes);
        const errBody = await createRes.json().catch(() => ({})) as { message?: string };
        throw new Error(errBody.message ?? 'Failed to create gist');
    }

    const gist = (await createRes.json()) as { id: string; html_url: string; files: Record<string, { raw_url?: string }> };

    const readmeContent = generateReadme(gist.id, collection);
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
        // Non-fatal: gist was created, just no README. Still clear a revoked token so the
        // NEXT share doesn't repeat the same silent failure with stale credentials.
        await handleGitHubApiUnauthorized(context, patchRes).catch((err: unknown) => {
            logExtensionError('gist-uploader', err instanceof Error ? err : String(err));
        });
    }

    const rawUrl = gist.files['collection.slc.b64']?.raw_url ?? '';
    const deepLinkUrl = `vscode://saropa.saropa-log-capture/import?gist=${gist.id}`;

    return {
        gistId: gist.id,
        gistUrl: gist.html_url,
        rawUrl,
        deepLinkUrl,
    };
}
