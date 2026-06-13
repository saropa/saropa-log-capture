/**
 * Representative markup for each in-scope dashboard surface.
 *
 * Each entry mirrors the HTML the surface's client-side render functions actually emit
 * (class names + nesting taken from the render sources), populated with realistic sample
 * data so the screenshot shows true hierarchy, density, and alignment. Codicon glyphs are
 * replaced with plain unicode because the codicon font is not loaded in the harness.
 */

// Reusable bits
const ICON = { ext: '↗', copy: '⧉', close: '✕', refresh: '↻' };

const sqlDashboardStrip = (loadingStates) => `
  <div class="sql-query-history-drift-status" role="status" style="display:block">Drift viewer (from log): http://localhost:8642 · server 3.5.1 · reachable</div>
  <div class="sql-qh-dashboard" style="display:block">
    <div class="sql-qh-stats">
      <div class="sql-qh-stat"><span class="sql-qh-stat-val">128</span><span class="sql-qh-stat-label">Distinct queries</span></div>
      <div class="sql-qh-stat"><span class="sql-qh-stat-val">4,512</span><span class="sql-qh-stat-label">Executions</span></div>
      <div class="sql-qh-stat"><span class="sql-qh-stat-val">842</span><span class="sql-qh-stat-label">Slowest (ms)</span></div>
      <div class="sql-qh-stat"><span class="sql-qh-stat-val">6</span><span class="sql-qh-stat-label">Logs</span></div>
    </div>
    <div class="sql-qh-chart">
      <div class="sql-qh-chart-title">Top queries by count</div>
      <div class="sql-qh-chart-row"><span class="sql-qh-chart-label">SELECT * FROM contacts WHERE…</span><span class="sql-qh-chart-track"><span class="sql-qh-chart-bar" style="width:100%"></span></span><span class="sql-qh-chart-num">1,204</span></div>
      <div class="sql-qh-chart-row"><span class="sql-qh-chart-label">UPDATE sync_state SET ts=…</span><span class="sql-qh-chart-track"><span class="sql-qh-chart-bar" style="width:62%"></span></span><span class="sql-qh-chart-num">742</span></div>
      <div class="sql-qh-chart-row"><span class="sql-qh-chart-label">INSERT INTO events (…)</span><span class="sql-qh-chart-track"><span class="sql-qh-chart-bar" style="width:38%"></span></span><span class="sql-qh-chart-num">455</span></div>
      <div class="sql-qh-chart-row"><span class="sql-qh-chart-label">SELECT id FROM messages…</span><span class="sql-qh-chart-track"><span class="sql-qh-chart-bar" style="width:21%"></span></span><span class="sql-qh-chart-num">251</span></div>
    </div>
    ${loadingStates ? `
    <div class="sql-qh-issues" style="display:block"><div class="sql-qh-async sql-qh-async-loading">Checking for database issues…</div></div>
    <div class="sql-qh-lint" style="display:block"><div class="sql-qh-async sql-qh-async-error">Could not load static code issues <span class="sql-qh-async-detail">(ECONNREFUSED 127.0.0.1:8642)</span></div></div>
    ` : `
    <div class="sql-qh-issues" style="display:block">
      <div class="sql-qh-issues-title">Database issues (Drift Advisor)</div>
      <div class="sql-qh-issue sql-qh-issue-warning"><span class="sql-qh-issue-loc">contacts.email</span><span class="sql-qh-issue-msg">Missing index on frequently-filtered column</span><button class="sql-qh-issue-fix">${ICON.ext}</button></div>
      <div class="sql-qh-issue sql-qh-issue-info"><span class="sql-qh-issue-loc">events</span><span class="sql-qh-issue-msg">Sequential scan detected on large table</span><button class="sql-qh-issue-fix">${ICON.ext}</button></div>
    </div>
    <div class="sql-qh-lint" style="display:block">
      <div class="sql-qh-lint-title">Static code issues (Saropa Lints)</div>
      <div class="sql-qh-lint-advice"><span class="sql-qh-lint-advice-msg">Drift database linters look turned off. Turn them on to catch WHERE-less updates and unclosed databases.</span><button class="sql-qh-lint-enable">Enable Drift linters</button></div>
    </div>
    `}
  </div>`;

const sqlPanel = (loading) => `
<div class="sql-query-history-panel" style="display:flex;flex-direction:column;height:100vh">
  <div class="sql-query-history-header">
    <span>SQL Query History</span>
    <div class="sql-query-history-actions">
      <button class="sql-query-history-action">${ICON.ext}</button>
      <button class="sql-query-history-action">${ICON.copy}</button>
      <button class="sql-query-history-close">${ICON.close}</button>
    </div>
  </div>
  <div class="sql-query-history-toolbar">
    <input id="sql-query-history-search" type="search" placeholder="Filter queries…" />
  </div>
  ${sqlDashboardStrip(loading)}
  <div class="sql-query-history-list">
    <table class="sql-query-history-table">
      <thead><tr><th class="sql-qh-header">Count</th><th class="sql-qh-header">SQL</th><th class="sql-qh-header">Slow (ms)</th></tr></thead>
      <tbody>
        <tr><td>1,204</td><td>SELECT * FROM contacts WHERE org_id = ?</td><td>312</td></tr>
        <tr><td>742</td><td>UPDATE sync_state SET ts = ? WHERE k = ?</td><td>88</td></tr>
        <tr><td>455</td><td>INSERT INTO events (type, payload, ts) VALUES (?, ?, ?)</td><td>842</td></tr>
      </tbody>
    </table>
  </div>
</div>`;

const crashlyticsPanel = (empty) => `
<div class="crashlytics-panel visible" style="height:100vh">
  <div class="crashlytics-panel-header">
    <span>Crashlytics</span>
    <div class="crashlytics-panel-actions">
      <button class="crashlytics-panel-action">${ICON.refresh}</button>
      <button class="crashlytics-panel-action">${ICON.ext}</button>
      <button class="crashlytics-panel-close">${ICON.close}</button>
    </div>
  </div>
  <div class="cp-filterbar">
    <div class="cp-tabs">
      <button class="cp-tab cp-tab-sel">All</button>
      <button class="cp-tab">Crash</button>
      <button class="cp-tab">ANR</button>
      <button class="cp-tab">Non-fatal</button>
    </div>
    <div class="cp-fcontrols">
      <input class="cp-search" placeholder="Search issues…" />
      <button class="cp-regex">.*</button>
      <select class="cp-fselect"><option>All versions</option></select>
      <select class="cp-fselect"><option>All devices</option></select>
    </div>
  </div>
  <div class="crashlytics-panel-content">
    ${empty ? `<div class="cp-empty">No issues match the current filters</div>` : `
    <div class="cp-item cp-item-fatal">
      <span class="cp-expand-icon">▶</span>
      <div class="cp-title">NullPointerException in ContactSyncWorker.run</div>
      <div class="cp-meta"><span class="cp-badge cp-badge-crash">CRASH</span> <span class="cp-badge cp-badge-regressed">REGRESSED</span> 1,284 events · 312 users · v3.7.2</div>
    </div>
    <div class="cp-item cp-item-nonfatal">
      <span class="cp-expand-icon">▶</span>
      <div class="cp-title">IllegalStateException: Fragment not attached</div>
      <div class="cp-meta"><span class="cp-badge cp-badge-anr">ANR</span> <span class="cp-badge cp-badge-repetitive">REPETITIVE</span> 642 events · 88 users · v3.7.1</div>
    </div>
    <div class="cp-item cp-item-nonfatal">
      <span class="cp-expand-icon">▶</span>
      <div class="cp-title">TimeoutException on /api/contacts</div>
      <div class="cp-meta"><span class="cp-badge cp-badge-nf">NON-FATAL</span> 203 events · 41 users · v3.7.2</div>
    </div>
    <div class="cp-console">Open in Firebase console ${ICON.ext}</div>
    `}
  </div>
</div>`;

const performancePanel = () => `
<div class="performance-panel visible" style="height:100vh">
  <div class="performance-panel-header">
    <span>Performance</span>
    <div class="performance-panel-actions">
      <button class="pp-action">${ICON.refresh}</button>
      <button class="pp-close">${ICON.close}</button>
    </div>
  </div>
  <div class="pp-tabs">
    <button class="pp-tab active">Trends</button>
    <button class="pp-tab">Session</button>
    <button class="pp-tab">Database</button>
    <button class="pp-tab">Error rate</button>
  </div>
  <div class="performance-panel-content">
    <div class="pp-er-summary"><span class="pp-er-count pp-er-count-error">42 errors</span> · <span class="pp-er-count pp-er-count-warning">128 warnings</span> · <span class="pp-er-count pp-er-count-spike">3 spikes</span></div>
    <div class="pp-er-chart-container">
      <svg class="pp-er-chart" viewBox="0 0 380 120">
        <line x1="32" y1="96" x2="372" y2="96" class="pp-chart-axis"/>
        <line x1="32" y1="16" x2="32" y2="96" class="pp-chart-axis"/>
        <rect class="pp-er-bar pp-er-bar-warning" x="40" y="60" width="14" height="36"/>
        <rect class="pp-er-bar pp-er-bar-error" x="40" y="40" width="14" height="20"/>
        <rect class="pp-er-bar pp-er-bar-warning" x="70" y="70" width="14" height="26"/>
        <rect class="pp-er-bar pp-er-bar-error" x="70" y="55" width="14" height="15"/>
        <rect class="pp-er-bar pp-er-bar-warning" x="100" y="30" width="14" height="66"/>
        <rect class="pp-er-bar pp-er-bar-error" x="100" y="18" width="14" height="12"/>
        <text class="pp-er-spike-marker" x="107" y="14" text-anchor="middle">⚠</text>
        <text class="pp-chart-label" x="28" y="99" text-anchor="end">0</text>
        <text class="pp-chart-label" x="28" y="60" text-anchor="end">25</text>
      </svg>
    </div>
    <div class="pp-group">
      <div class="pp-group-header"><span class="pp-group-arrow"></span> Frame build <span class="pp-group-count">214 events</span></div>
      <div class="pp-group-stats">avg 8.2ms · p95 16.4ms · max 42ms</div>
      <div class="pp-event-row"><span class="pp-event-metric">42ms</span><span class="pp-event-time">12:04:18</span></div>
      <div class="pp-event-row"><span class="pp-event-metric">31ms</span><span class="pp-event-time">12:04:21</span></div>
    </div>
    <div class="pp-group pp-collapsed">
      <div class="pp-group-header"><span class="pp-group-arrow"></span> DB query <span class="pp-group-count">88 events</span></div>
    </div>
    <table class="pp-trend-table">
      <thead><tr><th>Metric</th><th>Now</th><th>Prev</th><th>Δ</th></tr></thead>
      <tbody>
        <tr><td>Cold start</td><td>1,840ms</td><td>1,620ms</td><td class="pp-trend-up">▲ 14%</td></tr>
        <tr><td>Frame p95</td><td>16.4ms</td><td>18.1ms</td><td class="pp-trend-down">▼ 9%</td></tr>
        <tr><td>Jank rate</td><td>2.1%</td><td>2.1%</td><td class="pp-trend-stable">—</td></tr>
      </tbody>
    </table>
  </div>
</div>`;

const signalPanel = () => `
<div class="signal-panel visible" style="height:100vh">
  <div class="signal-panel-header">
    <span>Signals</span>
    <div class="signal-panel-actions">
      <button class="signal-panel-copy-md">${ICON.copy}</button>
      <button class="signal-panel-close">${ICON.close}</button>
    </div>
  </div>
  <div class="signal-panel-content">
    <div class="signal-section">
      <button class="signal-section-header expanded"><span class="signal-section-emoji">🔥</span><span class="signal-section-title">This log</span><span class="signal-section-toggle"></span></button>
      <div class="signal-section-body">
        <div class="signal-performance-hero">
          <span class="signal-hero-sparkline-wrap"><span class="signal-hero-sparkline-label">Errors</span></span>
          <span class="signal-hero-metrics">42 errors · 128 warnings · snapshot at 12:04</span>
        </div>
        <div class="signal-tw-filter">
          <button class="signal-tw-chip signal-tw-chip-active">All</button>
          <button class="signal-tw-chip">1h</button>
          <button class="signal-tw-chip">15m</button>
        </div>
        <div class="signal-signal-trend-row signal-sev-critical signal-jumpable" style="display:flex;justify-content:space-between;padding:4px 0">
          <span>NullPointerException in SyncWorker <span class="signal-recurring-badge">↻</span><span class="signal-trend-up">↑</span></span>
          <span class="signal-hotfile-meta">×12</span>
        </div>
        <div class="signal-signal-trend-row signal-sev-high signal-jumpable" style="display:flex;justify-content:space-between;padding:4px 0">
          <span>Slow query &gt; 800ms <span class="signal-trend-down">↓</span></span>
          <span class="signal-hotfile-meta">×4</span>
        </div>
      </div>
    </div>
    <div class="signal-section">
      <button class="signal-section-header"><span class="signal-section-emoji">📁</span><span class="signal-section-title">Hot files</span><span class="signal-section-toggle"></span></button>
    </div>
    <div class="signal-section">
      <button class="signal-section-header expanded"><span class="signal-section-emoji">🧭</span><span class="signal-section-title">Environment</span><span class="signal-section-toggle"></span></button>
      <div class="signal-section-body">
        <div class="signal-environment-list">
          <div class="signal-env-group"><div class="signal-env-title">Device</div>
            <div class="signal-env-row"><span>Model</span><span>Pixel 8 Pro</span></div>
            <div class="signal-env-row"><span>OS</span><span>Android 15</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;

const qualityLines = () => `
<div style="padding:8px;font-family:var(--vscode-editor-font-family);font-size:13px">
  <div class="line-quality-high" style="padding:2px 4px"><span class="quality-badge qb-high">92%</span> at ContactRepository.fetch (contact_repository.dart:142)</div>
  <div class="line-quality-med" style="padding:2px 4px"><span class="quality-badge qb-med">64%</span> at SyncWorker.run (sync_worker.dart:88)</div>
  <div class="line-quality-low" style="padding:2px 4px"><span class="quality-badge qb-low">31%</span> at LegacyImporter.parse (legacy_importer.dart:512)</div>
  <div style="padding:2px 4px"><span class="quality-badge qb-high">88%</span> at MessageBus.dispatch (message_bus.dart:24)</div>
</div>`;

const optionsPanel = () => `
<div class="options-panel visible" style="height:100vh">
  <div class="options-header"><span>Options</span><button class="options-close">${ICON.close}</button></div>
  <div class="options-search-wrapper"><input id="options-search" placeholder="Search settings…" /><button class="options-search-clear visible">${ICON.close}</button></div>
  <div class="options-content">
    <div class="options-section">
      <div class="options-section-title">Display</div>
      <label class="options-row"><input type="checkbox" checked /><span>Wrap long lines</span></label>
      <label class="options-row"><input type="checkbox" /><span>Show timestamps</span></label>
      <div class="options-row"><span>Row density</span><select><option>Comfortable</option></select></div>
      <div class="options-hint">Adjusts spacing between log lines</div>
    </div>
    <div class="options-section">
      <div class="options-section-title">Log Sources</div>
      <fieldset class="tier-radio-group"><legend>Flutter <span class="tier-hint">app + framework</span></legend>
        <label><input type="radio" name="t" checked />All</label>
        <label><input type="radio" name="t" />App only</label>
      </fieldset>
      <fieldset class="tier-radio-group tier-radio-group-spaced"><legend>Device <span class="tier-hint">OS + platform</span></legend>
        <label><input type="radio" name="d" checked />All</label>
        <label><input type="radio" name="d" />None</label>
      </fieldset>
    </div>
    <div class="options-section">
      <div class="options-section-title">Actions</div>
      <button class="options-action-btn">Reset to default</button>
      <button class="options-integrations-btn">${ICON.refresh} Integrations…</button>
    </div>
  </div>
</div>`;

const performanceDbTab = () => `
<div class="performance-panel visible" style="height:100vh">
  <div class="performance-panel-header"><span>Performance</span><div class="performance-panel-actions"><button class="pp-action">${ICON.refresh}</button><button class="pp-close">${ICON.close}</button></div></div>
  <div class="pp-tabs"><button class="pp-tab">Trends</button><button class="pp-tab">Session</button><button class="pp-tab active">Database</button><button class="pp-tab">Error rate</button></div>
  <div class="performance-panel-content">
    <div class="pp-db-view">
      <div class="pp-db-drift-row"><span class="pp-db-drift-title">Schema drift detected.</span> The running database is 3 migrations behind the bundled schema. <button class="pp-db-drift-open">Open</button></div>
      <div class="pp-db-time-filter-bar"><span>Showing 14:02–14:09 (7 min)</span><button class="pp-db-clear-time">Clear</button></div>
      <div class="pp-db-summary">128 distinct queries · 4,512 executions · slowest 842 ms</div>
      <div class="pp-db-timeline">
        <div class="pp-db-timeline-label">Query volume <span class="pp-db-timeline-hint">(drag to filter)</span></div>
        <div class="pp-db-timeline-track"><div class="pp-db-bars">
          ${[30, 55, 40, 80, 62, 95, 48, 70, 35, 58, 42, 88].map((h) => `<div class="pp-db-bar-wrap"><div class="pp-db-bar" style="height:${h}%"></div></div>`).join('')}
        </div></div>
      </div>
      <div class="pp-db-table-title">Slowest queries</div>
      <table class="pp-db-table"><thead><tr><th>Query</th><th>Count</th><th>Max</th></tr></thead><tbody>
        <tr><td>SELECT * FROM contacts WHERE org_id = ?</td><td>1,204</td><td>312</td></tr>
        <tr><td>INSERT INTO events (type, payload, ts) VALUES (?, ?, ?)</td><td>455</td><td>842</td></tr>
        <tr><td>UPDATE sync_state SET ts = ? WHERE k = ?</td><td>742</td><td>88</td></tr>
      </tbody></table>
    </div>
  </div>
</div>`;

// Inline log-content surface: renders at the user-adjustable --log-font-size, so its drilldown
// detail intentionally uses relative em sizing. Body wrapper mimics a log row.
const sqlDrilldown = () => `
<div style="padding:10px 12px;font-family:var(--vscode-editor-font-family);font-size:var(--log-font-size,13px);color:var(--vscode-foreground)">
  <div>SQL fingerprint repeated 47× &nbsp;<button class="sql-repeat-drilldown-toggle">hide samples</button></div>
  <div class="sql-repeat-drilldown-detail">
    <div class="sql-repeat-drilldown-meta"><span class="sql-repeat-drilldown-meta-label">First:</span>14:02:11<span class="sql-repeat-drilldown-meta-label" style="margin-left:10px">Last:</span>14:09:48</div>
    <div class="sql-repeat-drilldown-fp">fp: a3f9c2e1b7d4</div>
    <div class="sql-repeat-drilldown-snippet">SELECT * FROM contacts WHERE org_id = ? AND archived = 0 ORDER BY updated_at DESC</div>
    <div class="sql-repeat-drilldown-variant-title">Variants (3)</div>
    <div class="sql-repeat-drilldown-variant"><span class="sql-repeat-drilldown-variant-count">22×</span>org_id = 5</div>
    <div class="sql-repeat-drilldown-variant"><span class="sql-repeat-drilldown-variant-count">15×</span>org_id = 12</div>
    <div class="sql-repeat-drilldown-more">…and 1 more variant</div>
    <div class="sql-repeat-drilldown-actions"><button class="sql-repeat-static-sources">Find in source</button></div>
  </div>
</div>`;

export const SURFACES = [
    { name: 'sql-history', html: sqlPanel(false) },
    { name: 'sql-history-loading', html: sqlPanel(true) },
    { name: 'crashlytics', html: crashlyticsPanel(false) },
    { name: 'crashlytics-empty', html: crashlyticsPanel(true) },
    { name: 'performance', html: performancePanel() },
    { name: 'performance-db', html: performanceDbTab() },
    { name: 'options', html: optionsPanel() },
    { name: 'sql-drilldown', html: sqlDrilldown() },
    { name: 'signals', html: signalPanel() },
    { name: 'quality-badges', html: qualityLines() },
];
