# Plan: Share Investigation

**Feature:** Generate a shareable URL for an investigation that teammates can view (read-only) or import.

**Depends on:** Investigation Mode (Task 101) for the investigation data model.

---

## What exists

- Investigation Mode (planned): create named investigations with pinned sources
- .slc bundle export: export investigation as ZIP file
- Deep links: `vscode://saropa.saropa-log-capture/...` URI scheme
- Session metadata with all investigation data

## What's missing

1. **Share URL generation**: Create a URL that others can open
2. **Share storage**: Temporary or cloud storage for shared data
3. **Share viewer**: Read-only view for recipients
4. **Import from URL**: Download and import shared investigation
5. **Expiration/access control**: Time-limited links, optional password

---

## Sub-features

### 1. Share URL Scheme

**Options:**

| Approach | Pros | Cons |
|----------|------|------|
| **A: File-based (.slc over network)** | Simple, uses existing export | Requires file hosting (GitHub, S3, etc.) |
| **B: Deep link + cloud** | One-click open in VS Code | Requires cloud service |
| **C: Gist/GitHub integration** | Free hosting, version control | Requires GitHub account |
| **D: Local server (LAN)** | No cloud dependency | Only works on same network |

**Recommended: Hybrid (A + C)**
- Export to .slc (existing)
- Auto-upload to GitHub Gist (opt-in)
- Generate shareable Gist URL
- Recipient clicks → opens in VS Code → imports investigation

### 2. GitHub Gist Integration

**Implementation:**

Create `src/modules/share/gist-uploader.ts`:

```typescript
interface GistShareResult {
    gistId: string;
    gistUrl: string;           // https://gist.github.com/...
    rawUrl: string;            // Raw file URL for download
    deepLinkUrl: string;       // vscode://saropa...?gist=...
    expiresAt?: number;        // If using expiring gists
}

async function shareViaGist(
    investigation: Investigation
): Promise<GistShareResult> {
    // 1. Export investigation to .slc in memory
    const slcBuffer = await exportInvestigationToBuffer(investigation);
    
    // 2. Convert to base64 for Gist (or use multiple files for large investigations)
    const slcBase64 = slcBuffer.toString('base64');
    
    // 3. Create Gist via GitHub API
    const token = await getGitHubToken();  // From Secret Storage
    
    const gistPayload = {
        description: `Saropa Investigation: ${investigation.name}`,
        public: false,  // Secret gist
        files: {
            'investigation.slc.b64': {
                content: slcBase64
            },
            'README.md': {
                content: generateReadme(investigation)
            }
        }
    };
    
    const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(gistPayload)
    });
    
    const gist = await response.json();
    
    // 4. Generate deep link
    const deepLink = `vscode://saropa.saropa-log-capture/import?gist=${gist.id}`;
    
    return {
        gistId: gist.id,
        gistUrl: gist.html_url,
        rawUrl: gist.files['investigation.slc.b64'].raw_url,
        deepLinkUrl: deepLink
    };
}

function generateReadme(investigation: Investigation): string {
    return `# ${investigation.name}

Shared via [Saropa Log Capture](https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture)

## Open in VS Code

Click this link to open in VS Code:
\`\`\`
vscode://saropa.saropa-log-capture/import?gist=${investigation.id}
\`\`\`

## Contents

- ${investigation.sources.length} pinned sources
- Created: ${new Date(investigation.createdAt).toISOString()}

## Notes

${investigation.notes || 'No notes provided.'}
`;
}
```

### 3. Import from Gist

**Implementation:**

Create `src/modules/share/gist-importer.ts`:

```typescript
async function importFromGist(gistId: string): Promise<Investigation | undefined> {
    // 1. Fetch Gist metadata
    const response = await fetch(`https://api.github.com/gists/${gistId}`);
    if (!response.ok) {
        throw new Error('Gist not found or not accessible');
    }
    
    const gist = await response.json();
    
    // 2. Find the .slc file
    const slcFile = gist.files['investigation.slc.b64'];
    if (!slcFile) {
        throw new Error('Invalid investigation gist: missing .slc file');
    }
    
    // 3. Download and decode
    const base64 = await fetch(slcFile.raw_url).then(r => r.text());
    const slcBuffer = Buffer.from(base64, 'base64');
    
    // 4. Import using existing importSlcBundle
    const tempUri = await writeTempFile(slcBuffer, '.slc');
    const result = await importSlcBundle(tempUri);
    
    // 5. Clean up temp file
    await vscode.workspace.fs.delete(tempUri);
    
    if (result) {
        vscode.window.showInformationMessage(`Imported investigation from gist`);
        return loadInvestigationFromSession(result.mainLogUri);
    }
    
    return undefined;
}
```

### 4. URI Handler

**Implementation:**

Extend existing deep link handler in `src/modules/misc/deep-links.ts`:

```typescript
// Register URI handler for import
vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri) {
        if (uri.path === '/import') {
            const params = new URLSearchParams(uri.query);
            
            const gistId = params.get('gist');
            if (gistId) {
                importFromGist(gistId).catch(err => {
                    vscode.window.showErrorMessage(`Failed to import: ${err.message}`);
                });
                return;
            }
            
            const url = params.get('url');
            if (url) {
                importFromUrl(url).catch(err => {
                    vscode.window.showErrorMessage(`Failed to import: ${err.message}`);
                });
                return;
            }
        }
    }
});
```

### 5. Share UI

**Implementation:**

Add share actions to Investigation panel:

```typescript
// In investigation-panel.ts
async function shareInvestigation(investigation: Investigation): Promise<void> {
    const choice = await vscode.window.showQuickPick([
        { label: '$(github) Share via GitHub Gist', value: 'gist' },
        { label: '$(file-zip) Export as .slc file', value: 'file' },
        { label: '$(link) Copy deep link (local file)', value: 'deeplink' }
    ], {
        title: 'Share Investigation'
    });
    
    if (!choice) return;
    
    switch (choice.value) {
        case 'gist':
            await shareViaGistWithProgress(investigation);
            break;
        case 'file':
            await exportInvestigationToSlc(investigation);
            break;
        case 'deeplink':
            await copyLocalDeepLink(investigation);
            break;
    }
}

async function shareViaGistWithProgress(investigation: Investigation): Promise<void> {
    const result = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Sharing investigation...' },
        () => shareViaGist(investigation)
    );
    
    const action = await vscode.window.showInformationMessage(
        'Investigation shared!',
        'Copy Link',
        'Open Gist'
    );
    
    if (action === 'Copy Link') {
        await vscode.env.clipboard.writeText(result.deepLinkUrl);
        vscode.window.showInformationMessage('Deep link copied to clipboard');
    } else if (action === 'Open Gist') {
        await vscode.env.openExternal(vscode.Uri.parse(result.gistUrl));
    }
}
```

### 6. GitHub Token Management

**Implementation:**

Create `src/modules/share/github-auth.ts`:

```typescript
const GITHUB_TOKEN_KEY = 'saropa.githubToken';

async function getGitHubToken(): Promise<string> {
    // 1. Check Secret Storage
    const stored = await context.secrets.get(GITHUB_TOKEN_KEY);
    if (stored) return stored;
    
    // 2. Prompt user to authenticate
    const action = await vscode.window.showInformationMessage(
        'GitHub authentication required to share via Gist',
        'Authenticate',
        'Cancel'
    );
    
    if (action !== 'Authenticate') {
        throw new Error('GitHub authentication required');
    }
    
    // 3. Use VS Code's built-in GitHub auth
    const session = await vscode.authentication.getSession('github', ['gist'], { createIfNone: true });
    
    // 4. Store token for future use
    await context.secrets.store(GITHUB_TOKEN_KEY, session.accessToken);
    
    return session.accessToken;
}
```

### 7. Configuration

**Settings:**

```json
{
    "saropaLogCapture.share.defaultMethod": {
        "type": "string",
        "enum": ["gist", "file"],
        "default": "gist",
        "description": "Default sharing method for investigations"
    },
    "saropaLogCapture.share.gistPublic": {
        "type": "boolean",
        "default": false,
        "description": "Create public gists (visible to anyone) vs. secret gists (link-only access)"
    },
    "saropaLogCapture.share.includeNotes": {
        "type": "boolean",
        "default": true,
        "description": "Include investigation notes in shared gists"
    }
}
```

### 8. Files to create/modify

| File | Change |
|------|--------|
| `src/modules/share/gist-uploader.ts` | New: upload to GitHub Gist |
| `src/modules/share/gist-importer.ts` | New: import from Gist |
| `src/modules/share/github-auth.ts` | New: GitHub token management |
| `src/modules/share/share-types.ts` | New: share data model |
| `src/modules/misc/deep-links.ts` | Handle import URI |
| `src/ui/investigation/investigation-panel.ts` | Add share actions |
| `package.json` | Add settings, URI handler capability |
| `l10n.ts` + bundles | Add localization strings |

---

## Alternative: Self-Hosted Option

For enterprise users who can't use GitHub:

**Implementation:**

Create `src/modules/share/file-server.ts`:

```typescript
// Simple HTTP server for LAN sharing
async function startShareServer(investigation: Investigation): Promise<{
    url: string;
    stop: () => void;
}> {
    const port = await findFreePort();
    const slcBuffer = await exportInvestigationToBuffer(investigation);
    
    const server = http.createServer((req, res) => {
        if (req.url === '/investigation.slc') {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', 'attachment; filename="investigation.slc"');
            res.end(slcBuffer);
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    });
    
    server.listen(port);
    
    const ip = getLocalIP();
    return {
        url: `http://${ip}:${port}/investigation.slc`,
        stop: () => server.close()
    };
}
```

---

## Phases

### Phase 1: File export (baseline)
- Export investigation as .slc (already done via Investigation Mode)
- Generate local deep link to .slc file
- Copy link to clipboard

### Phase 2: GitHub Gist integration
- GitHub authentication via VS Code
- Upload to Gist
- Generate shareable deep link
- Import from Gist URL

### Phase 3: UX polish
- Share button in investigation panel
- Quick-share menu
- Share history (recent shares)
- Expire old shares (cleanup command)

### Phase 4: Enterprise options
- Self-hosted file server (LAN)
- S3/Azure Blob upload (configurable endpoint)
- Team namespace (shared investigations folder)

---

## Considerations

- **Size limits**: GitHub Gist has 100MB limit. Warn if investigation is too large.
- **Privacy**: Make clear that gists (even secret) are stored on GitHub. Offer local-only option.
- **Authentication**: Use VS Code's built-in GitHub auth for seamless experience.
- **Expiration**: Secret gists don't expire. Consider documenting how to delete.
- **Offline**: Gist sharing requires internet. File export works offline.
- **Permissions**: Recipients need VS Code + Saropa extension installed.

---

## Effort Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1 | 1-2 days | Investigation Mode |
| Phase 2 | 3-4 days | Phase 1 |
| Phase 3 | 2-3 days | Phase 2 |
| Phase 4 | 3-4 days | Phase 3 (optional) |
| **Total** | **9-13 days** | |

---

## Success Criteria

1. User creates investigation with 3 sessions
2. Clicks "Share" → authenticates with GitHub → gets shareable link
3. Teammate clicks link → VS Code opens → investigation imports
4. Teammate can view all pinned sources and search results
5. Works without GitHub via .slc file export/import
