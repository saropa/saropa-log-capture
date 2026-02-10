/** Link generation utilities for markdown export and webview. */

/** Context needed to generate GitHub links for a file. */
export interface GitLinkContext {
    readonly remoteUrl: string;
    readonly branch: string;
    readonly relativePath: string;
}

/** Parse a GitHub remote URL to extract owner/repo slug. */
export function parseGitHubRemote(remoteUrl: string): string | undefined {
    const m = remoteUrl.match(/github\.com[/:]([^/]+\/[^/.]+)/);
    return m?.[1]?.replace(/\.git$/, '');
}

/** Build a `vscode://file/path:line:col` URI for opening a file at a specific line. */
export function buildVscodeFileUri(absolutePath: string, line?: number, col?: number): string {
    const normalized = absolutePath.replace(/\\/g, '/');
    let uri = `vscode://file/${normalized}`;
    if (line !== undefined && line > 0) {
        uri += `:${line}`;
        if (col !== undefined && col > 0) { uri += `:${col}`; }
    }
    return uri;
}

/** Build a GitHub blob URL for a file at a specific line. */
export function buildGitHubFileUrl(
    remoteUrl: string, branch: string, relativePath: string, line?: number,
): string | undefined {
    const slug = parseGitHubRemote(remoteUrl);
    if (!slug || !branch) { return undefined; }
    const cleanPath = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
    let url = `https://github.com/${slug}/blob/${encodeURI(branch)}/${encodeURI(cleanPath)}`;
    if (line !== undefined && line > 0) { url += `#L${line}`; }
    return url;
}

/** Build a GitHub commit URL. */
export function buildGitHubCommitUrl(remoteUrl: string, hash: string): string | undefined {
    const slug = parseGitHubRemote(remoteUrl);
    if (!slug || !hash) { return undefined; }
    return `https://github.com/${slug}/commit/${hash}`;
}

/** Build a markdown file link with optional vscode:// and GitHub links. */
export function buildMarkdownFileLink(
    displayText: string, absolutePath: string | undefined,
    line?: number, col?: number, gitContext?: GitLinkContext,
): string {
    let md: string;
    if (absolutePath) {
        const vsUri = buildVscodeFileUri(absolutePath, line, col);
        md = `[${displayText}](${vsUri})`;
    } else {
        md = `\`${displayText}\``;
    }
    if (gitContext) {
        const ghUrl = buildGitHubFileUrl(
            gitContext.remoteUrl, gitContext.branch, gitContext.relativePath, line,
        );
        if (ghUrl) { md += ` [[GIT]](${ghUrl})`; }
    }
    return md;
}
