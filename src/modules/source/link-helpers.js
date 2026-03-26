"use strict";
/** Link generation utilities for markdown export and webview. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGitHubRemote = parseGitHubRemote;
exports.buildVscodeFileUri = buildVscodeFileUri;
exports.buildGitHubFileUrl = buildGitHubFileUrl;
exports.buildGitHubCommitUrl = buildGitHubCommitUrl;
exports.buildMarkdownFileLink = buildMarkdownFileLink;
/** Parse a GitHub remote URL to extract owner/repo slug. */
function parseGitHubRemote(remoteUrl) {
    const m = remoteUrl.match(/github\.com[/:]([^/]+\/[^/.]+)/);
    return m?.[1]?.replace(/\.git$/, '');
}
/** Build a `vscode://file/path:line:col` URI for opening a file at a specific line. */
function buildVscodeFileUri(absolutePath, line, col) {
    const normalized = absolutePath.replace(/\\/g, '/');
    let uri = `vscode://file/${normalized}`;
    if (line !== undefined && line > 0) {
        uri += `:${line}`;
        if (col !== undefined && col > 0) {
            uri += `:${col}`;
        }
    }
    return uri;
}
/** Build a GitHub blob URL for a file at a specific line. */
function buildGitHubFileUrl(remoteUrl, branch, relativePath, line) {
    const slug = parseGitHubRemote(remoteUrl);
    if (!slug || !branch) {
        return undefined;
    }
    const cleanPath = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
    let url = `https://github.com/${slug}/blob/${encodeURI(branch)}/${encodeURI(cleanPath)}`;
    if (line !== undefined && line > 0) {
        url += `#L${line}`;
    }
    return url;
}
/** Build a GitHub commit URL. */
function buildGitHubCommitUrl(remoteUrl, hash) {
    const slug = parseGitHubRemote(remoteUrl);
    if (!slug || !hash) {
        return undefined;
    }
    return `https://github.com/${slug}/commit/${hash}`;
}
/** Build a markdown file link with optional vscode:// and GitHub links. */
function buildMarkdownFileLink(displayText, absolutePath, opts) {
    let md;
    if (absolutePath) {
        const vsUri = buildVscodeFileUri(absolutePath, opts?.line, opts?.col);
        md = `[${displayText}](${vsUri})`;
    }
    else {
        md = `\`${displayText}\``;
    }
    if (opts?.gitContext) {
        const ghUrl = buildGitHubFileUrl(opts.gitContext.remoteUrl, opts.gitContext.branch, opts.gitContext.relativePath, opts.line);
        if (ghUrl) {
            md += ` [[GIT]](${ghUrl})`;
        }
    }
    return md;
}
//# sourceMappingURL=link-helpers.js.map