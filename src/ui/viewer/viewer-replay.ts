/**
 * Session replay: play/pause/stop, Timed/Fast mode, speed, scrubber.
 * Uses window.replayMode and window.replayCurrentIndex; viewer-data-viewport
 * clamps visible lines to replayCurrentIndex when replayMode is true.
 *
 * Timing: In Timed mode, delay between lines uses line.elapsedMs (from [+Nms] in file)
 * or timestamp delta; in Fast mode a fixed short delay is used. Config (min/max delay,
 * default speed/mode) is sent with startReplay from the extension.
 *
 * Speed options: 0.1x, 0.25x, 0.5x, 0.75x, 1x, 2x, 5x, 10x. The speed dropdown is
 * set via closest-option matching to avoid float display issues (e.g. 0.5x).
 *
 * ## Footer Actions menu (this script)
 * The popover in `viewer-content-body.ts` holds **Replay**, **Open Quality Report**, and **Export**.
 * Replay toggles the replay bar; export opens the export modal; quality report posts
 * `openQualityReport` to the extension (same as the former context-menu path).
 *
 * **Quality report gating:** `applyFooterQualityReportState()` reads `window.integrationAdapters`
 * (set by `integrationsAdapters` in `viewer-script-messages.ts`). If `'codeQuality'` is missing,
 * the button gets `.is-disabled`, `aria-disabled`, and a tooltip; clicks no-op. Called on script
 * init, whenever `setReplayEnabled` shows the footer, and after each `integrationsAdapters` message
 * — no timers, no recursion (host message is one-way).
 *
 * Visibility: Footer actions hide during an active capture session or when no file/lines are loaded
 * (same rules as before for replay/export).
 */

import { getReplayControlsScript } from './viewer-replay-controls';
import { getReplayTimingScript } from './viewer-replay-timing';

export function getReplayBarHtml(): string {
    return /* html */ `
<div id="replay-bar" class="replay-bar" role="region" aria-label="Session replay controls">
    <div class="replay-btn-row">
        <button id="replay-play" class="replay-btn" title="Play" aria-label="Play replay"><span class="codicon codicon-debug-start"></span></button>
        <button id="replay-pause" class="replay-btn" title="Pause" aria-label="Pause replay"><span class="codicon codicon-debug-pause"></span></button>
        <button id="replay-stop" class="replay-btn" title="Stop and exit replay" aria-label="Stop replay"><span class="codicon codicon-debug-stop"></span></button>
    </div>
    <select id="replay-mode" class="replay-mode" title="Timed uses line deltas; Fast uses fixed delay" aria-label="Replay mode">
        <option value="timed">Timed</option>
        <option value="fast">Fast</option>
    </select>
    <select id="replay-speed" class="replay-speed" title="Playback speed" aria-label="Playback speed">
        <option value="0.1">0.1x</option>
        <option value="0.25">0.25x</option>
        <option value="0.5">0.5x</option>
        <option value="0.75">0.75x</option>
        <option value="1" selected>1x</option>
        <option value="2">2x</option>
        <option value="5">5x</option>
        <option value="10">10x</option>
    </select>
    <input type="range" id="replay-scrubber" class="replay-scrubber" min="0" max="1" value="0" title="Seek to line" aria-label="Replay position">
    <span id="replay-status" class="replay-status" aria-live="polite">0 / 0</span>
</div>`;
}

export function getReplayScript(): string {
  return /* javascript */ `
(function() {
    window.replayMode = false;
    window.replayCurrentIndex = 0;
    var replayPlaying = false;
    var replayTimer = null;
    var replaySpeedFactor = 1;
    var replayTimedMode = true;

    var bar = document.getElementById('replay-bar');
    var playBtn = document.getElementById('replay-play');
    var pauseBtn = document.getElementById('replay-pause');
    var stopBtn = document.getElementById('replay-stop');
    var modeSelect = document.getElementById('replay-mode');
    var speedSelect = document.getElementById('replay-speed');
    var scrubber = document.getElementById('replay-scrubber');
    var statusEl = document.getElementById('replay-status');
    var footerActionsMenu = document.getElementById('footer-actions-menu');
    var footerActionsBtn = document.getElementById('footer-actions-btn');
    var footerActionsPopover = document.getElementById('footer-actions-popover');
    var replayActionBtn = footerActionsPopover ? footerActionsPopover.querySelector('[data-action="replay"]') : null;
    var qualityReportBtn = footerActionsPopover ? footerActionsPopover.querySelector('[data-action="open-quality-report"]') : null;
    var exportActionBtn = footerActionsPopover ? footerActionsPopover.querySelector('[data-action="export"]') : null;

    var qualityReportDisabledTitle = 'Enable the codeQuality integration to generate quality reports.';
    var qualityReportEnabledTitle = 'Open session quality report (.quality.json sidecar)';

    function applyFooterQualityReportState() {
        if (!qualityReportBtn) return;
        var ids = (typeof window !== 'undefined' && Array.isArray(window.integrationAdapters)) ? window.integrationAdapters : [];
        var on = ids.indexOf('codeQuality') >= 0;
        qualityReportBtn.classList.toggle('is-disabled', !on);
        qualityReportBtn.setAttribute('title', on ? qualityReportEnabledTitle : qualityReportDisabledTitle);
        if (!on) {
            qualityReportBtn.setAttribute('aria-disabled', 'true');
        } else {
            qualityReportBtn.removeAttribute('aria-disabled');
        }
    }
    window.applyFooterQualityReportState = applyFooterQualityReportState;

    var replaySessionActive = false;
    var replayFileLoaded = false;

    function hasLines() { return allLines && allLines.length > 0; }

    function setReplayBarVisible(visible) {
        if (!bar) return;
        bar.classList.toggle('replay-bar-visible', !!visible);
        if (typeof syncJumpButtonInset === 'function') syncJumpButtonInset();
    }

    function setFooterActionsVisible(visible) {
        if (!footerActionsMenu) return;
        footerActionsMenu.classList.toggle('footer-actions-visible', !!visible);
        if (!visible) footerActionsMenu.classList.remove('footer-actions-open');
    }

    function setFooterActionsOpen(open) {
        if (!footerActionsMenu || !footerActionsBtn) return;
        if (!footerActionsMenu.classList.contains('footer-actions-visible')) return;
        footerActionsMenu.classList.toggle('footer-actions-open', !!open);
        footerActionsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    window.setReplayEnabled = function(fileLoaded, sessionActive) {
        replayFileLoaded = fileLoaded;
        replaySessionActive = sessionActive;
        if (sessionActive || !fileLoaded || !hasLines()) {
            setFooterActionsVisible(false);
            setReplayBarVisible(false);
            if (window.replayMode) window.exitReplayMode();
        } else if (fileLoaded && hasLines()) {
            setFooterActionsVisible(true);
            applyFooterQualityReportState();
        }
    };

    function updateReplayAction(playing) {
        if (!replayActionBtn) return;
        var ic = replayActionBtn.querySelector('.codicon');
        var cls = playing ? 'codicon codicon-debug-pause' : 'codicon codicon-debug-start';
        if (ic) ic.className = cls;
        replayActionBtn.title = playing ? 'Replay playing' : 'Replay log';
        replayActionBtn.setAttribute('aria-label', playing ? 'Replay playing' : 'Replay log');
    }

    window.toggleReplayBar = function() {
        if (!bar) return;
        if (replaySessionActive || !replayFileLoaded) return;
        if (!hasLines()) return;
        if (!window.replayMode) {
            if (typeof window.startReplay === 'function') window.startReplay();
            return;
        }
        var visible = bar.classList.contains('replay-bar-visible');
        setReplayBarVisible(!visible);
    };

    if (footerActionsBtn) {
        footerActionsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            setFooterActionsOpen(!(footerActionsMenu && footerActionsMenu.classList.contains('footer-actions-open')));
        });
    }
    if (replayActionBtn) {
        replayActionBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            setFooterActionsOpen(false);
            if (typeof window.toggleReplayBar === 'function') window.toggleReplayBar();
        });
    }
    if (exportActionBtn) {
        exportActionBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            setFooterActionsOpen(false);
            if (typeof window.openExportModal === 'function') window.openExportModal();
        });
    }
    if (qualityReportBtn) {
        qualityReportBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (qualityReportBtn.classList.contains('is-disabled')) return;
            setFooterActionsOpen(false);
            vscodeApi.postMessage({ type: 'openQualityReport' });
        });
    }
    applyFooterQualityReportState();
    document.addEventListener('click', function(e) {
        if (!footerActionsMenu) return;
        if (!footerActionsMenu.contains(e.target)) setFooterActionsOpen(false);
    });

    ${getReplayTimingScript()}
    ${getReplayControlsScript()}
})();
`;
}
