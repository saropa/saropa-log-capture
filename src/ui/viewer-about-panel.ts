/**
 * About Saropa panel HTML and script for the webview.
 *
 * Displays company info, project links, and social links
 * in a slide-out panel following the icon-bar panel pattern.
 */

/** Generate the about panel HTML with static content. */
export function getAboutPanelHtml(): string {
    return /* html */ `
<div id="about-panel" class="about-panel">
    <div class="about-panel-header">
        <span>About Saropa</span>
        <button id="about-panel-close" class="about-panel-close" title="Close">&times;</button>
    </div>
    <div class="about-panel-content">
        <div class="ab-header">Saropa</div>
        <p class="ab-tagline">Built for Resilience. Designed for Peace of Mind.</p>
        <p class="ab-blurb">A technology firm rooted in financial services and online security. We build digital safeguards\u2009\u2014\u2009developer extensions that just work and a crisis management platform trusted by 50,000+ users.</p>
        <div class="ab-section">Projects</div>
        ${getProjectLinksHtml()}
        <div class="ab-section">Connect</div>
        ${getConnectLinksHtml()}
    </div>
</div>`;
}

/** Generate the about panel script. */
export function getAboutPanelScript(): string {
    return /* js */ `
(function() {
    var aboutPanelEl = document.getElementById('about-panel');
    var aboutPanelOpen = false;

    window.openAboutPanel = function() {
        if (!aboutPanelEl) return;
        aboutPanelOpen = true;
        aboutPanelEl.classList.add('visible');
        injectVersion();
    };

    window.closeAboutPanel = function() {
        if (!aboutPanelEl) return;
        aboutPanelEl.classList.remove('visible');
        aboutPanelOpen = false;
        if (typeof clearActivePanel === 'function') clearActivePanel('about');
    };

    function injectVersion() {
        var footer = document.getElementById('footer-text');
        var ver = footer ? footer.getAttribute('data-version') : '';
        var badge = document.getElementById('ab-version-badge');
        if (badge && ver) badge.textContent = ver;
    }

    /* ---- Click handlers ---- */

    if (aboutPanelEl) {
        aboutPanelEl.addEventListener('click', function(e) {
            var link = e.target.closest('.ab-link');
            if (!link) return;
            var url = link.getAttribute('data-url');
            if (url) vscodeApi.postMessage({ type: 'openUrl', url: url });
        });
    }

    /* ---- Close / outside click ---- */

    var closeBtn = document.getElementById('about-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closeAboutPanel);

    document.addEventListener('click', function(e) {
        if (!aboutPanelOpen) return;
        if (aboutPanelEl && aboutPanelEl.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-about');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        closeAboutPanel();
    });
})();
`;
}

interface AboutLink { icon: string; title: string; badge: string; desc: string; url: string }

function linkHtml(l: AboutLink): string {
    return `<div class="ab-link" data-url="${l.url}">
    <span class="ab-link-icon">${l.icon}</span>
    <span>
        <span class="ab-link-title">${l.title}</span>
        <span class="ab-link-badge">${l.badge}</span>
        <span class="ab-link-desc">${l.desc}</span>
    </span>
</div>`;
}

function getProjectLinksHtml(): string {
    return [
        linkHtml({ icon: '\u{1F4F1}', title: 'Saropa Contacts',
            badge: 'iOS, Android, Web \u00b7 50K+ downloads \u00b7 \u2605 4.8',
            desc: 'The superpower your address book is missing. An Intelligent Address Book with Business Card Mode, 252+ medical tips, global emergency numbers for 195+ countries, and biometric locking.',
            url: 'https://saropa.com/' }),
        linkHtml({ icon: '\u{1F3E0}', title: 'Home Essentials', badge: 'saropa.com',
            desc: 'Your family\u2019s lifestyle backup plan. Secure vault for asset inventory, important documents, medical records, and legacy planning.',
            url: 'https://saropa.com/' }),
        linkHtml({ icon: '\u{1F4CB}', title: 'Saropa Log Capture',
            badge: 'VS Code Marketplace <span id="ab-version-badge"></span>',
            desc: 'The Debugger\u2019s Safety Net. Automatically saves all Debug Console output to persistent log files. No setup required\u2009\u2014\u2009just hit F5 and your logs are safe.',
            url: 'https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture' }),
        linkHtml({ icon: '\u{1F6E1}\uFE0F', title: 'Saropa Claude Guard', badge: 'VS Code Marketplace',
            desc: 'AI Governance. Tracks Claude API costs in real-time by tailing local logs. Enforce daily/monthly budgets and monitor spend directly from the status bar.',
            url: 'https://marketplace.visualstudio.com/items?itemName=Saropa.saropa-claude-guard' }),
        linkHtml({ icon: '\u{1F50D}', title: 'saropa_lints', badge: 'pub.dev \u00b7 Dart & Flutter',
            desc: '1700+ custom rules. Catch memory leaks, security vulnerabilities (mapped to OWASP Top 10), and runtime crashes. Includes AI-ready diagnostics for faster repairs.',
            url: 'https://pub.dev/packages/saropa_lints' }),
        linkHtml({ icon: '\u{1F9F0}', title: 'saropa_dart_utils', badge: 'pub.dev \u00b7 Dart & Flutter',
            desc: 'The Swiss Army library. 280+ production-hardened extension methods for Strings, Dates, and Lists extracted from real-world apps.',
            url: 'https://pub.dev/packages/saropa_dart_utils' }),
    ].join('\n');
}

function getConnectLinksHtml(): string {
    return [
        linkHtml({ icon: '\u{1F4BB}', title: 'GitHub', badge: 'github.com/saropa',
            desc: 'Source, issues, discussions',
            url: 'https://github.com/saropa/saropa-log-capture' }),
        linkHtml({ icon: '\u{1F4DD}', title: 'Medium', badge: '@saropa-contacts',
            desc: 'Exploring the architecture of connection\u2009\u2014\u2009psychology of relationships, social values, and resilient tech practices.',
            url: 'https://medium.com/@saropa-contacts' }),
        linkHtml({ icon: '\u{1F98B}', title: 'Bluesky', badge: 'saropa.com',
            desc: 'News feed',
            url: 'https://bsky.app/profile/saropa.com' }),
        linkHtml({ icon: '\u{1F4BC}', title: 'LinkedIn', badge: 'Saropa Pty Ltd \u00b7 est. 2010',
            desc: 'Financial services, online security, and secure web communications.',
            url: 'https://www.linkedin.com/company/saropa-pty-ltd' }),
    ].join('\n');
}
