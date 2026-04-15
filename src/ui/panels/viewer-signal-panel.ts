/**
 * Signal panel: single-scroll unified view (Unified Signal Model).
 * One narrative — Cases, Recurring errors, Hot files, Performance — no tabs.
 * State A (no log): Cases + Recurring + Hot files. State B (log selected): Performance + Recurring + Cases.
 * Plan: bugs/history/20260317/041_plan-unify-investigation-recurring-performance.md
 */
import { t } from '../../l10n';
import { getPerformancePanelHtml } from './viewer-performance-panel';
import { getSignalPanelScriptContent, type SignalScriptStrings } from './viewer-signal-panel-script';

const SIGNAL_STORAGE_KEY = 'signalSectionState';

/** Generate the Signal panel HTML: one narrative (This log → Your cases → Across your logs → Environment). */
export function getSignalPanelHtml(): string {
    const sectionErrorsInLog = t('signal.sectionErrorsInLog');
    const errorsInLogEmpty = t('signal.errorsInLogEmpty');
    const sessionDetails = t('signal.sessionDetails');
    const sessionDetailsHint = t('signal.sessionDetailsHint');
    const thisLog = t('signal.thisLog');
    const thisLogEmpty = t('signal.thisLogEmpty');
    const yourCases = t('signal.yourCases');
    const acrossYourLogs = t('signal.acrossYourLogs');
    const emptyCases = t('signal.emptyCases');
    const emptyRecurring = t('signal.emptyRecurring');
    const emptyHotFiles = t('signal.emptyHotFiles');
    return /* html */ `
<div id="signal-panel" class="signal-panel" role="region" aria-label="Signals">
    <div class="signal-panel-header">
        <span>Signals</span>
        <div class="signal-panel-actions">
            <button id="signal-panel-open-tab" class="signal-panel-copy-md" title="Open in new tab" aria-label="Open Signals in new tab">
                <span class="codicon codicon-link-external"></span>
            </button>
            <button id="signal-panel-copy-md" class="signal-panel-copy-md" title="Copy to Markdown" aria-label="Copy to Markdown">
                <span class="codicon codicon-copy"></span>
            </button>
            <button id="signal-panel-close" class="signal-panel-close" title="Close" aria-label="Close">&times;</button>
        </div>
    </div>
    <div id="signal-scroll" class="signal-panel-content">
        <!-- Current log at a glance (no section header) -->
        <div id="signal-hero-block" class="signal-hero-block" aria-hidden="true" style="display:none">
            <div id="signal-performance-scope" class="signal-scope-label" style="display:none">Current log: <span id="signal-current-log-label"></span></div>
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
        <!-- This log (State B only): errors + recurring in this log -->
        <section id="signal-section-this-log" class="signal-section" aria-hidden="true" style="display:none">
            <button type="button" class="signal-section-header" id="signal-header-this-log" aria-expanded="true" aria-controls="signal-body-this-log">
                <span class="signal-section-emoji" aria-hidden="true">📄</span>
                <span class="signal-section-title">${thisLog}</span>
                <span class="signal-section-toggle" aria-hidden="true"></span>
            </button>
            <div id="signal-body-this-log" class="signal-section-body">
                <div id="signal-this-log-empty" class="signal-this-log-empty signal-hotfiles-empty" style="display:none"><span class="signal-margin-emoji" aria-hidden="true">ℹ️</span>${thisLogEmpty}</div>
                <div id="signal-this-log-content" class="signal-this-log-content">
                    <div class="signal-narrative-block">
                        <div class="signal-narrative-subtitle"><span class="signal-margin-emoji" aria-hidden="true">⚠️</span><span id="signal-errors-in-log-subtitle">${sectionErrorsInLog}</span></div>
                        <div id="signal-errors-in-log-list" class="signal-errors-in-log-list"></div>
                        <div id="signal-errors-in-log-empty" class="signal-hotfiles-empty" style="display:none">${errorsInLogEmpty}</div>
                    </div>
                    <div class="signal-narrative-block">
                        <div class="signal-narrative-subtitle"><span class="signal-margin-emoji" aria-hidden="true">🔁</span><span id="signal-recurring-in-log-summary">Recurring in this log</span></div>
                        <div id="signal-recurring-in-log-list" class="recurring-list-inner"></div>
                    </div>
                    <div class="signal-narrative-block">
                        <div class="signal-narrative-subtitle"><span class="signal-margin-emoji" aria-hidden="true">📡</span><span id="signals-in-log-summary">All signals in this log</span></div>
                        <div id="signals-in-log-list" class="signal-hotfiles-list"></div>
                    </div>
                </div>
            </div>
        </section>
        <!-- Your cases -->
        <section id="signal-section-cases" class="signal-section">
            <button type="button" class="signal-section-header" id="signal-header-cases" aria-expanded="true" aria-controls="signal-body-cases">
                <span class="signal-section-emoji" aria-hidden="true">📌</span>
                <span class="signal-section-title">${yourCases}</span>
                <span class="signal-section-toggle" aria-hidden="true"></span>
            </button>
            <div id="signal-body-cases" class="signal-section-body">
                <div class="session-investigations">
                    <p id="signal-cases-hint" class="session-investigations-hint">Pin sessions and files to search and export together.</p>
                    <div id="signal-cases-loading" class="session-loading-label" style="display:none">Loading…</div>
                    <div id="signal-cases-empty" class="signal-hotfiles-empty" style="display:none">${emptyCases}</div>
                    <div id="signal-cases-list" class="session-investigations-list"></div>
                    <div id="signal-cases-view-all" class="signal-view-all" style="display:none"><span id="signal-cases-view-all-link">View All</span></div>
                    <div id="signal-cases-create-row" class="session-investigations-create-row">
                        <button id="signal-cases-create" class="session-investigations-create">+ Create Investigation...</button>
                    </div>
                    <div id="signal-cases-create-form" class="session-investigations-create-form" style="display:none">
                        <input type="text" id="signal-cases-name-input" class="session-investigations-name-input" placeholder="e.g., Auth Timeout Bug #1234" maxlength="100" />
                        <div class="session-investigations-create-form-actions">
                            <button type="button" id="signal-cases-create-confirm" class="session-investigations-create-confirm">Create</button>
                            <button type="button" id="signal-cases-create-cancel" class="session-investigations-create-cancel">Cancel</button>
                        </div>
                        <div id="signal-cases-create-error" class="session-investigations-create-error" style="display:none"></div>
                    </div>
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
                <div class="signal-narrative-block">
                    <div id="signal-recurring-loading" class="recurring-loading" style="display:none">Loading error data…</div>
                    <div id="signal-recurring-list" class="recurring-list-inner"></div>
                    <div id="signal-recurring-empty" class="recurring-empty signal-hotfiles-empty" style="display:none"><span class="signal-margin-emoji" aria-hidden="true">ℹ️</span>${emptyRecurring}</div>
                    <div id="signal-recurring-footer" class="signal-recurring-footer">
                        <span id="signal-export-summary" class="recurring-footer-action" title="Export recurring errors and hot files">Export summary</span>
                    </div>
                </div>
                <div class="signal-narrative-block">
                    <div class="signal-narrative-subtitle"><span class="signal-margin-emoji" aria-hidden="true">📁</span><span id="signal-hotfiles-summary">Frequently modified files</span></div>
                    <div id="signal-hotfiles-empty" class="signal-hotfiles-empty" style="display:none"><span class="signal-margin-emoji" aria-hidden="true">ℹ️</span>${emptyHotFiles}</div>
                    <div id="signal-hotfiles-list" class="signal-hotfiles-list"></div>
                </div>
                <div class="signal-narrative-block">
                    <div class="signal-narrative-subtitle"><span class="signal-margin-emoji" aria-hidden="true">📡</span><span id="signal-trends-summary">All signals</span></div>
                    <div id="signal-trends-empty" class="signal-hotfiles-empty" style="display:none"><span class="signal-margin-emoji" aria-hidden="true">ℹ️</span>No signals across sessions yet. Errors, warnings, performance, and SQL patterns will appear here as you capture logs.</div>
                    <div id="signal-trends-list" class="signal-hotfiles-list"></div>
                </div>
            </div>
        </section>
        <!-- Environment -->
        <section id="signal-section-environment" class="signal-section">
            <button type="button" class="signal-section-header" id="signal-header-environment" aria-expanded="false" aria-controls="signal-body-environment">
                <span class="signal-section-emoji" aria-hidden="true">⚙️</span>
                <span class="signal-section-title" id="signal-environment-summary">Environment</span>
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
        addToCase: t('signal.addToCase'),
        heroSparklineTitle: t('signal.heroSparklineTitle'),
        heroLoading: t('signal.heroLoading'),
        heroNoSamplingHint: t('signal.heroNoSamplingHint'),
        errorsInLogEmpty: t('signal.errorsInLogEmpty'),
        emptyCases: t('signal.emptyCases'),
        emptyRecurring: t('signal.emptyRecurring'),
        emptyHotFiles: t('signal.emptyHotFiles'),
        thisLogEmpty: t('signal.thisLogEmpty'),
        sessionTrendLabel: t('signal.sessionTrendLabel'),
        topOfTotal: t('signal.topOfTotal'),
        sourcesCount: t('signal.sourcesCount'),
        updatedAgo: t('signal.updatedAgo'),
        heroNoErrorsWarnings: t('signal.heroNoErrorsWarnings'),
        sectionErrorsInLog: t('signal.sectionErrorsInLog'),
    };
    return getSignalPanelScriptContent(SIGNAL_STORAGE_KEY, strings);
}
