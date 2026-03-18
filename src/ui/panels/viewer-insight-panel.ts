/**
 * Insight panel: single-scroll unified view (Unified Insight Model).
 * One narrative — Cases, Recurring errors, Hot files, Performance — no tabs.
 * State A (no log): Cases + Recurring + Hot files. State B (log selected): Performance + Recurring + Cases.
 * Plan: bugs/history/20260317/041_plan-unify-investigation-recurring-performance.md
 */
import { t } from '../../l10n';
import { getPerformancePanelHtml } from './viewer-performance-panel';
import { getInsightPanelScriptContent, type InsightScriptStrings } from './viewer-insight-panel-script';

const INSIGHT_STORAGE_KEY = 'insightSectionState';

/** Generate the Insight panel HTML: one narrative (This log → Your cases → Across your logs → Environment). */
export function getInsightPanelHtml(): string {
    const sectionErrorsInLog = t('insight.sectionErrorsInLog');
    const errorsInLogEmpty = t('insight.errorsInLogEmpty');
    const sessionDetails = t('insight.sessionDetails');
    const sessionDetailsHint = t('insight.sessionDetailsHint');
    const thisLog = t('insight.thisLog');
    const thisLogEmpty = t('insight.thisLogEmpty');
    const yourCases = t('insight.yourCases');
    const acrossYourLogs = t('insight.acrossYourLogs');
    const emptyCases = t('insight.emptyCases');
    const emptyRecurring = t('insight.emptyRecurring');
    const emptyHotFiles = t('insight.emptyHotFiles');
    return /* html */ `
<div id="insight-panel" class="insight-panel" role="region" aria-label="Insight">
    <div class="insight-panel-header">
        <span>Insight</span>
        <button id="insight-panel-close" class="insight-panel-close" title="Close" aria-label="Close">&times;</button>
    </div>
    <div id="insight-scroll" class="insight-panel-content">
        <!-- Current log at a glance (no section header) -->
        <div id="insight-hero-block" class="insight-hero-block" aria-hidden="true" style="display:none">
            <div id="insight-performance-scope" class="insight-scope-label" style="display:none">Current log: <span id="insight-current-log-label"></span></div>
            <div id="insight-performance-hero" class="insight-performance-hero" style="display:none" aria-live="polite"></div>
        </div>
        <!-- Session details (collapsed by default) -->
        <section id="insight-section-session-details" class="insight-section insight-section-session-details" aria-hidden="true" style="display:none">
            <button type="button" class="insight-section-header" id="insight-header-session-details" aria-expanded="false" aria-controls="insight-body-session-details">
                <span class="insight-section-emoji" aria-hidden="true">📊</span>
                <span class="insight-section-title">${sessionDetails}</span>
                <span class="insight-section-toggle" aria-hidden="true"></span>
            </button>
            <div id="insight-body-session-details" class="insight-section-body" style="display:none">
                <p class="insight-session-details-hint">${sessionDetailsHint}</p>
                ${getPerformancePanelHtml('insight-')}
            </div>
        </section>
        <!-- This log (State B only): errors + recurring in this log -->
        <section id="insight-section-this-log" class="insight-section" aria-hidden="true" style="display:none">
            <button type="button" class="insight-section-header" id="insight-header-this-log" aria-expanded="true" aria-controls="insight-body-this-log">
                <span class="insight-section-emoji" aria-hidden="true">📄</span>
                <span class="insight-section-title">${thisLog}</span>
                <span class="insight-section-toggle" aria-hidden="true"></span>
            </button>
            <div id="insight-body-this-log" class="insight-section-body">
                <div id="insight-this-log-empty" class="insight-this-log-empty insight-hotfiles-empty" style="display:none"><span class="insight-margin-emoji" aria-hidden="true">ℹ️</span>${thisLogEmpty}</div>
                <div id="insight-this-log-content" class="insight-this-log-content">
                    <div class="insight-narrative-block">
                        <div class="insight-narrative-subtitle"><span class="insight-margin-emoji" aria-hidden="true">⚠️</span><span id="insight-errors-in-log-subtitle">${sectionErrorsInLog}</span></div>
                        <div id="insight-errors-in-log-list" class="insight-errors-in-log-list"></div>
                        <div id="insight-errors-in-log-empty" class="insight-hotfiles-empty" style="display:none">${errorsInLogEmpty}</div>
                    </div>
                    <div class="insight-narrative-block">
                        <div class="insight-narrative-subtitle"><span class="insight-margin-emoji" aria-hidden="true">🔁</span><span id="insight-recurring-in-log-summary">Recurring in this log</span></div>
                        <div id="insight-recurring-in-log-list" class="recurring-list-inner"></div>
                    </div>
                </div>
            </div>
        </section>
        <!-- Your cases -->
        <section id="insight-section-cases" class="insight-section">
            <button type="button" class="insight-section-header" id="insight-header-cases" aria-expanded="true" aria-controls="insight-body-cases">
                <span class="insight-section-emoji" aria-hidden="true">📌</span>
                <span class="insight-section-title">${yourCases}</span>
                <span class="insight-section-toggle" aria-hidden="true"></span>
            </button>
            <div id="insight-body-cases" class="insight-section-body">
                <div class="session-investigations">
                    <p id="insight-cases-hint" class="session-investigations-hint">Pin sessions and files to search and export together.</p>
                    <div id="insight-cases-loading" class="session-loading-label" style="display:none">Loading…</div>
                    <div id="insight-cases-empty" class="insight-hotfiles-empty" style="display:none">${emptyCases}</div>
                    <div id="insight-cases-list" class="session-investigations-list"></div>
                    <div id="insight-cases-view-all" class="insight-view-all" style="display:none"><span id="insight-cases-view-all-link">View All</span></div>
                    <div id="insight-cases-create-row" class="session-investigations-create-row">
                        <button id="insight-cases-create" class="session-investigations-create">+ Create Investigation...</button>
                    </div>
                    <div id="insight-cases-create-form" class="session-investigations-create-form" style="display:none">
                        <input type="text" id="insight-cases-name-input" class="session-investigations-name-input" placeholder="e.g., Auth Timeout Bug #1234" maxlength="100" />
                        <div class="session-investigations-create-form-actions">
                            <button type="button" id="insight-cases-create-confirm" class="session-investigations-create-confirm">Create</button>
                            <button type="button" id="insight-cases-create-cancel" class="session-investigations-create-cancel">Cancel</button>
                        </div>
                        <div id="insight-cases-create-error" class="session-investigations-create-error" style="display:none"></div>
                    </div>
                </div>
            </div>
        </section>
        <!-- Across your logs: recurring errors + hot files -->
        <section id="insight-section-across-logs" class="insight-section">
            <button type="button" class="insight-section-header" id="insight-header-across-logs" aria-expanded="true" aria-controls="insight-body-across-logs">
                <span class="insight-section-emoji" aria-hidden="true">🔁</span>
                <span class="insight-section-title">${acrossYourLogs}</span>
                <span class="insight-section-toggle" aria-hidden="true"></span>
            </button>
            <div id="insight-body-across-logs" class="insight-section-body">
                <div class="insight-narrative-block">
                    <div id="insight-recurring-loading" class="recurring-loading" style="display:none">Loading error data…</div>
                    <div id="insight-recurring-list" class="recurring-list-inner"></div>
                    <div id="insight-recurring-empty" class="recurring-empty insight-hotfiles-empty" style="display:none"><span class="insight-margin-emoji" aria-hidden="true">ℹ️</span>${emptyRecurring}</div>
                    <div id="insight-recurring-footer" class="insight-recurring-footer">
                        <span id="insight-export-summary" class="recurring-footer-action" title="Export recurring errors and hot files">Export summary</span>
                    </div>
                </div>
                <div class="insight-narrative-block">
                    <div class="insight-narrative-subtitle"><span class="insight-margin-emoji" aria-hidden="true">📁</span><span id="insight-hotfiles-summary">Frequently modified files</span></div>
                    <div id="insight-hotfiles-empty" class="insight-hotfiles-empty" style="display:none"><span class="insight-margin-emoji" aria-hidden="true">ℹ️</span>${emptyHotFiles}</div>
                    <div id="insight-hotfiles-list" class="insight-hotfiles-list"></div>
                </div>
            </div>
        </section>
        <!-- Environment -->
        <section id="insight-section-environment" class="insight-section">
            <button type="button" class="insight-section-header" id="insight-header-environment" aria-expanded="false" aria-controls="insight-body-environment">
                <span class="insight-section-emoji" aria-hidden="true">⚙️</span>
                <span class="insight-section-title" id="insight-environment-summary">Environment</span>
                <span class="insight-section-toggle" aria-hidden="true"></span>
            </button>
            <div id="insight-body-environment" class="insight-section-body" style="display:none">
                <div id="insight-environment-list" class="insight-environment-list"></div>
            </div>
        </section>
    </div>
</div>`;
}

/** Generate the Insight panel script. Single scroll; context-aware sections (State A vs B). */
export function getInsightPanelScript(): string {
    const strings: InsightScriptStrings = {
        addToCase: t('insight.addToCase'),
        heroSparklineTitle: t('insight.heroSparklineTitle'),
        heroLoading: t('insight.heroLoading'),
        heroNoSamplingHint: t('insight.heroNoSamplingHint'),
        errorsInLogEmpty: t('insight.errorsInLogEmpty'),
        emptyCases: t('insight.emptyCases'),
        emptyRecurring: t('insight.emptyRecurring'),
        emptyHotFiles: t('insight.emptyHotFiles'),
        thisLogEmpty: t('insight.thisLogEmpty'),
        sessionTrendLabel: t('insight.sessionTrendLabel'),
        topOfTotal: t('insight.topOfTotal'),
        sourcesCount: t('insight.sourcesCount'),
        updatedAgo: t('insight.updatedAgo'),
        heroNoErrorsWarnings: t('insight.heroNoErrorsWarnings'),
        sectionErrorsInLog: t('insight.sectionErrorsInLog'),
    };
    return getInsightPanelScriptContent(INSIGHT_STORAGE_KEY, strings);
}
