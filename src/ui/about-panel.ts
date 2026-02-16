/** Sidebar panel showing Saropa company info and project links. */

import * as vscode from 'vscode';
import { getNonce } from './viewer-content';

/** WebviewViewProvider for the About Saropa sidebar panel. */
export class AboutPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private view: vscode.WebviewView | undefined;
    static readonly viewType = 'saropaLogCapture.aboutPanel';

    constructor(private readonly version: string) {}

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
        webviewView.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
        webviewView.webview.html = buildPanelHtml(this.version);
    }

    dispose(): void { /* nothing to clean up */ }

    private async handleMessage(msg: Record<string, unknown>): Promise<void> {
        if (msg.type === 'openLink' && typeof msg.url === 'string') {
            vscode.env.openExternal(vscode.Uri.parse(msg.url)).then(undefined, () => {});
        }
    }
}

interface LinkEntry {
    icon: string;
    title: string;
    badge: string;
    desc: string;
    url: string;
}

const projectLinks: readonly LinkEntry[] = [
    {
        icon: '\u{1F4F1}', title: 'Saropa Contacts',
        badge: 'iOS, Android, Web \u00b7 50K+ downloads \u00b7 \u2605 4.8',
        desc: 'The superpower your address book is missing. An Intelligent Address Book with Business Card Mode, 252+ medical tips, global emergency numbers for 195+ countries, and biometric locking.',
        url: 'https://saropa.com/',
    },
    {
        icon: '\u{1F3E0}', title: 'Home Essentials',
        badge: 'saropa.com',
        desc: 'Your family\u2019s lifestyle backup plan. Secure vault for asset inventory, important documents, medical records, and legacy planning.',
        url: 'https://saropa.com/',
    },
    {
        icon: '\u{1F4CB}', title: 'Saropa Log Capture',
        badge: 'VS Code Marketplace',
        desc: 'The Debugger\u2019s Safety Net. Automatically saves all Debug Console output to persistent log files. No setup required\u2009\u2014\u2009just hit F5 and your logs are safe.',
        url: 'https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture',
    },
    {
        icon: '\u{1F6E1}\uFE0F', title: 'Saropa Claude Guard',
        badge: 'VS Code Marketplace',
        desc: 'AI Governance. Tracks Claude API costs in real-time by tailing local logs. Enforce daily/monthly budgets and monitor spend directly from the status bar.',
        url: 'https://marketplace.visualstudio.com/items?itemName=Saropa.saropa-claude-guard',
    },
    {
        icon: '\u{1F50D}', title: 'saropa_lints',
        badge: 'pub.dev \u00b7 Dart & Flutter',
        desc: '1700+ custom rules. Catch memory leaks, security vulnerabilities (mapped to OWASP Top 10), and runtime crashes. Includes AI-ready diagnostics for faster repairs.',
        url: 'https://pub.dev/packages/saropa_lints',
    },
    {
        icon: '\u{1F9F0}', title: 'saropa_dart_utils',
        badge: 'pub.dev \u00b7 Dart & Flutter',
        desc: 'The Swiss Army library. 280+ production-hardened extension methods for Strings, Dates, and Lists extracted from real-world apps.',
        url: 'https://pub.dev/packages/saropa_dart_utils',
    },
];

const connectLinks: readonly LinkEntry[] = [
    {
        icon: '\u{1F4BB}', title: 'GitHub', badge: 'github.com/saropa',
        desc: 'Source, issues, discussions',
        url: 'https://github.com/saropa/saropa-log-capture',
    },
    {
        icon: '\u{1F4DD}', title: 'Medium', badge: '@saropa-contacts',
        desc: 'Exploring the architecture of connection\u2009\u2014\u2009psychology of relationships, social values, and resilient tech practices.',
        url: 'https://medium.com/@saropa-contacts',
    },
    {
        icon: '\u{1F98B}', title: 'Bluesky', badge: 'saropa.com',
        desc: 'News feed',
        url: 'https://bsky.app/profile/saropa.com',
    },
    {
        icon: '\u{1F4BC}', title: 'LinkedIn', badge: 'Saropa Pty Ltd \u00b7 est. 2010',
        desc: 'Financial services, online security, and secure web communications.',
        url: 'https://www.linkedin.com/company/saropa-pty-ltd',
    },
];

function renderLink(entry: LinkEntry): string {
    return `<div class="ab-link" onclick="openLink('${entry.url}')">
    <span class="ab-link-icon">${entry.icon}</span>
    <span>
        <span class="ab-link-title">${entry.title}</span>
        <span class="ab-link-badge">${entry.badge}</span>
        <span class="ab-link-desc">${entry.desc}</span>
    </span>
</div>`;
}

function buildPanelHtml(version: string): string {
    const nonce = getNonce();
    const projects = projectLinks.map(p => {
        if (p.title === 'Saropa Log Capture' && version) {
            return renderLink({ ...p, badge: `${p.badge} \u00b7 v${version}` });
        }
        return renderLink(p);
    }).join('\n');
    const social = connectLinks.map(renderLink).join('\n');
    return `<!DOCTYPE html><html><head><style nonce="${nonce}">${getStyles()}</style></head><body>
<div class="ab-header">Saropa</div>
<p class="ab-tagline">Built for Resilience. Designed for Peace of Mind.</p>
<p class="ab-blurb">A technology firm rooted in financial services and online security. We build digital safeguards\u2009\u2014\u2009developer extensions that just work and a crisis management platform trusted by 50,000+ users.</p>
<div class="ab-section">Projects</div>
${projects}
<div class="ab-section">Connect</div>
${social}
<script nonce="${nonce}">const v=acquireVsCodeApi();function openLink(u){v.postMessage({type:'openLink',url:u})}</script>
</body></html>`;
}

function getStyles(): string {
    return `body{padding:8px 12px;font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);line-height:1.4}
.ab-header{font-size:1.4em;font-weight:700;margin-bottom:8px}
.ab-tagline{font-weight:600;font-style:italic;opacity:0.9;margin:0 0 6px 0;font-size:0.95em}
.ab-blurb{opacity:0.8;margin:0 0 16px 0;font-size:0.9em}
.ab-section{font-weight:600;font-size:1.05em;margin-bottom:8px;margin-top:12px;border-bottom:1px solid var(--vscode-panel-border);padding-bottom:4px}
.ab-link{display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer;margin-bottom:4px}
.ab-link:hover{background:var(--vscode-list-hoverBackground)}
.ab-link-icon{font-size:1.2em;flex-shrink:0;margin-top:1px}
.ab-link-title{display:block;color:var(--vscode-textLink-foreground);font-weight:500}
.ab-link-badge{display:block;font-size:0.8em;opacity:0.6;margin-top:1px}
.ab-link-desc{display:block;font-size:0.85em;opacity:0.8;margin-top:2px;line-height:1.35}`;
}
