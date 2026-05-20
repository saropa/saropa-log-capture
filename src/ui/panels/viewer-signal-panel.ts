/**
 * Signal panel: single-scroll unified view.
 * Two signal lists: "Signals in this log" (current session) and "All signals" (cross-session).
 * No duplication — every signal kind rendered through the same unified RecurringSignalEntry list.
 * State A (no log): All signals + Hot files. State B (log open): Performance + This log + All signals.
 */
import { t } from '../../l10n';
import { getPerformancePanelHtml } from './viewer-performance-panel';
import { getSignalPanelScriptContent, type SignalScriptStrings } from './viewer-signal-panel-script';

const SIGNAL_STORAGE_KEY = 'signalSectionState';

/** Generate the Signal panel HTML: one narrative (This log → Across your logs → Environment). */
export function getSignalPanelHtml(): string {
    const sessionDetails = t('signal.sessionDetails');
    const sessionDetailsHint = t('signal.sessionDetailsHint');
    const thisLog = t('signal.thisLog');
    const thisLogEmpty = t('signal.thisLogEmpty');
    const acrossYourLogs = t('signal.acrossYourLogs');
    const emptyHotFiles = t('signal.emptyHotFiles');
    return /* html */ `
<div id="signal-panel" class="signal-panel" role="region" aria-label="${t('signal.panel.region')}">
    <div class="signal-panel-header">
        <span>${t('signal.panel.title')}</span>
        <div class="signal-panel-actions">
            <button id="signal-panel-open-tab" class="signal-panel-copy-md" title="${t('signal.panel.openTab.title')}" aria-label="${t('signal.panel.openTab.label')}">
                <span class="codicon codicon-link-external"></span>
            </button>
            <button id="signal-panel-copy-md" class="signal-panel-copy-md" title="${t('signal.panel.copyMd.title')}" aria-label="${t('signal.panel.copyMd.label')}">
                <span class="codicon codicon-copy"></span>
            </button>
            <button id="signal-panel-close" class="signal-panel-close" title="${t('signal.panel.close')}" aria-label="${t('signal.panel.close')}">&times;</button>
        </div>
    </div>
    <div id="signal-scroll" class="signal-panel-content">
        <!-- Current log at a glance (no section header) -->
        <div id="signal-hero-block" class="signal-hero-block" aria-hidden="true" style="display:none">
            <div id="signal-performance-scope" class="signal-scope-label" style="display:none">${t('signal.panel.currentLog')} <span id="signal-current-log-label"></span></div>
            <div id="signal-performance-hero" class="signal-performance-hero" style="display:none" aria-live="polite"></div>
        </div>
        <!-- Session details (collapsed by default) -->
        <section id="signal-section-session-details" class="signal-section signal-section-session-details" aria-hidden="true" style="display:none">
            <button type="button" class="signal-section-header" id="signal-header-session-details" aria-expanded="false" aria-controls="signal-body-session-details">
                <span class="signal-section-emoji" aria-hidden="true">📊</span>
                <span class="signal-section-title">${sessionDetails}</span>
                <span class="signal-section-toggle" aria-hidden="true"></span>
            </button>
            <div id="signal-body-session-details" class="signal-section-body" style="display:none">
                <p class="signal-session-details-hint">${sessionDetailsHint}</p>
                ${getPerformancePanelHtml('signal-')}
            </div>
        </section>
        <!-- This log (State B only): unified signals from current session -->
        <section id="signal-section-this-log" class="signal-section" aria-hidden="true" style="display:none">
            <button type="button" class="signal-section-header" id="signal-header-this-log" aria-expanded="true" aria-controls="signal-body-this-log">
                <span class="signal-section-emoji" aria-hidden="true">📄</span>
                <span class="signal-section-title">${thisLog}</span>
                <span class="signal-section-toggle" aria-hidden="true"></span>
            </button>
            <div id="signal-body-this-log" class="signal-section-body">
                <div id="signal-this-log-empty" class="signal-this-log-empty signal-hotfiles-empty" style="display:none"><span class="signal-margin-emoji" aria-hidden="true">ℹ️</span>${thisLogEmpty}</div>
                <div class="signal-narrative-block">
                    <div class="signal-narrative-subtitle"><span class="signal-margin-emoji" aria-hidden="true">📡</span><span id="signals-in-log-summary">${t('signal.panel.inLogSummary')}</span></div>
                    <!-- Time-window filter (Fu7) — applies to "Signals in this log" only.
                         Cross-session signals further down the panel have no meaningful single-session timestamp. -->
                    <div class="signal-tw-filter" role="group" aria-label="${t('signal.panel.twFilter.label')}">
                        <button type="button" class="signal-tw-chip signal-tw-chip-active" data-tw="all" aria-pressed="true">${t('signal.panel.tw.all')}</button>
                        <button type="button" class="signal-tw-chip" data-tw="5000" aria-pressed="false">${t('signal.panel.tw.5s')}</button>
                        <button type="button" class="signal-tw-chip" data-tw="30000" aria-pressed="false">${t('signal.panel.tw.30s')}</button>
                        <button type="button" class="signal-tw-chip" data-tw="300000" aria-pressed="false">${t('signal.panel.tw.5min')}</button>
                    </div>
                    <div id="signals-in-log-list" class="signal-hotfiles-list"></div>
                </div>
            </div>
        </section>
        <!-- Across your logs: recurring errors + hot files -->
        <section id="signal-section-across-logs" class="signal-section">
            <button type="button" class="signal-section-header" id="signal-header-across-logs" aria-expanded="true" aria-controls="signal-body-across-logs">
                <span class="signal-section-emoji" aria-hidden="true">🔁</span>
                <span class="signal-section-title">${acrossYourLogs}</span>
                <span class="signal-section-toggle" aria-hidden="true"></span>
            </button>
            <div id="signal-body-across-logs" class="signal-section-body">
                <!-- Filter suggestions (plan 053-A) — pending noise-learning suggestions. Block self-hides
                     when no pending suggestions exist so empty-state UI doesn't appear. -->
                <div class="signal-narrative-block" id="signal-suggestions-block" style="display:none">
                    <div class="signal-narrative-subtitle"><span class="signal-margin-emoji" aria-hidden="true">💡</span><span id="signal-suggestions-summary">${t('signal.panel.suggestions')}</span></div>
                    <div id="signal-suggestions-list" class="signal-suggestions-list"></div>
                </div>
                <div class="signal-narrative-block">
                    <div class="signal-narrative-subtitle"><span class="signal-margin-emoji" aria-hidden="true">📁</span><span id="signal-hotfiles-summary">${t('signal.panel.hotfiles')}</span></div>
                    <div id="signal-hotfiles-empty" class="signal-hotfiles-empty" style="display:none"><span class="signal-margin-emoji" aria-hidden="true">ℹ️</span>${emptyHotFiles}</div>
                    <div id="signal-hotfiles-list" class="signal-hotfiles-list"></div>
                </div>
                <div class="signal-narrative-block">
                    <div class="signal-narrative-subtitle"><span class="signal-margin-emoji" aria-hidden="true">📡</span><span id="signal-trends-summary">${t('signal.panel.allSignals')}</span></div>
                    <div id="signal-trends-empty" class="signal-hotfiles-empty" style="display:none"><span class="signal-margin-emoji" aria-hidden="true">ℹ️</span>${t('signal.panel.trendsEmpty')}</div>
                    <div id="signal-trends-list" class="signal-hotfiles-list"></div>
                    <div id="signal-trends-footer" class="signal-recurring-footer">
                        <span id="signal-export-summary" class="recurring-footer-action" title="${t('signal.panel.exportSummary.title')}">${t('signal.panel.exportSummary')}</span>
                    </div>
                </div>
                <div class="signal-narrative-block" id="signal-cooccurrence-block" style="display:none">
                    <div class="signal-narrative-subtitle"><span class="signal-margin-emoji" aria-hidden="true">🔗</span><span id="signal-cooccurrence-summary">${t('signal.panel.related')}</span></div>
                    <div id="signal-cooccurrence-list" class="signal-hotfiles-list"></div>
                </div>
            </div>
        </section>
        <!-- Environment -->
        <section id="signal-section-environment" class="signal-section">
            <button type="button" class="signal-section-header" id="signal-header-environment" aria-expanded="false" aria-controls="signal-body-environment">
                <span class="signal-section-emoji" aria-hidden="true">⚙️</span>
                <span class="signal-section-title" id="signal-environment-summary">${t('signal.panel.environment')}</span>
                <span class="signal-section-toggle" aria-hidden="true"></span>
            </button>
            <div id="signal-body-environment" class="signal-section-body" style="display:none">
                <div id="signal-environment-list" class="signal-environment-list"></div>
            </div>
        </section>
    </div>
</div>`;
}

/** Generate the Signal panel script. Single scroll; context-aware sections (State A vs B). */
export function getSignalPanelScript(): string {
    const strings: SignalScriptStrings = {
        heroSparklineTitle: t('signal.heroSparklineTitle'),
        heroLoading: t('signal.heroLoading'),
        heroNoSamplingHint: t('signal.heroNoSamplingHint'),
        errorsInLogEmpty: t('signal.errorsInLogEmpty'),
        emptyRecurring: t('signal.emptyRecurring'),
        emptyHotFiles: t('signal.emptyHotFiles'),
        thisLogEmpty: t('signal.thisLogEmpty'),
        sessionTrendLabel: t('signal.sessionTrendLabel'),
        topOfTotal: t('signal.topOfTotal'),
        heroNoErrorsWarnings: t('signal.heroNoErrorsWarnings'),
        sectionErrorsInLog: t('signal.sectionErrorsInLog'),
    };
    return getSignalPanelScriptContent(SIGNAL_STORAGE_KEY, strings);
}
