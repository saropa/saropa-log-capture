/**
 * "Project state" slide-out panel (plan 055 Stage 3): a passive, read-only session panel answering
 * "what is the state of the code that produced this log?" — branch, last commit, dirty tree, and the
 * "may already be fixed" changelog signal. Follows the icon-bar panel pattern (mirrors the About
 * panel): host builds the body HTML and posts it; this script only manages open/close and injection.
 */

import { t } from '../../l10n';

/** Panel container HTML, slotted into #panel-slot. Body is filled by `projectStateData` messages. */
export function getProjectStatePanelHtml(): string {
    return /* html */ `
<div id="project-state-panel" class="project-state-panel" role="region" aria-label="${t('viewer.projectState.region')}">
    <div class="project-state-panel-header">
        <span>${t('viewer.projectState.region')}</span>
        <button id="project-state-panel-close" class="project-state-panel-close" title="${t('viewer.projectState.close.title')}" aria-label="${t('viewer.projectState.close.label')}"><span class="codicon codicon-close"></span></button>
    </div>
    <div id="project-state-content" class="project-state-panel-content">
        <div class="ps-empty">${t('viewer.projectState.loading')}</div>
    </div>
</div>`;
}

/** Open/close + data injection script. Requests fresh data on each open (state changes between runs). */
export function getProjectStatePanelScript(): string {
    return /* js */ `
(function() {
    var panelEl = document.getElementById('project-state-panel');
    var contentEl = document.getElementById('project-state-content');
    var panelOpen = false;

    window.openProjectStatePanel = function() {
        if (!panelEl) return;
        panelOpen = true;
        panelEl.classList.add('visible');
        if (contentEl) contentEl.innerHTML = '<div class="ps-empty">' + vt('viewer.projectState.loading') + '</div>';
        if (typeof vscodeApi !== 'undefined') vscodeApi.postMessage({ type: 'requestProjectStateData' });
        requestAnimationFrame(function() {
            var first = panelEl.querySelector('button');
            if (first) first.focus();
        });
    };

    window.closeProjectStatePanel = function() {
        if (!panelEl) return;
        panelEl.classList.remove('visible');
        panelOpen = false;
        if (typeof clearActivePanel === 'function') clearActivePanel('projectState');
        var ibBtn = document.getElementById('ib-project-state');
        if (ibBtn) ibBtn.focus();
    };

    window.addEventListener('message', function(e) {
        if (!e.data || e.data.type !== 'projectStateData') return;
        if (!contentEl) return;
        /* Host-built, fully escaped HTML (project-state-handler.ts) — same trusted-innerHTML pattern
           as the crashlytics detail and About changelog. Empty body => nothing to say (passive). */
        contentEl.innerHTML = e.data.html
            ? e.data.html
            : '<div class="ps-empty">' + vt('viewer.projectState.empty') + '</div>';
    });

    var closeBtn = document.getElementById('project-state-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closeProjectStatePanel);

    document.addEventListener('click', function(e) {
        if (!panelOpen) return;
        if (panelEl && panelEl.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-project-state');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        closeProjectStatePanel();
    });
})();
`;
}
