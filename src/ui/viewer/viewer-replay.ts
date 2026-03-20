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
 * Visibility: The replay panel (horizontal layout) is anchored to the bottom-right
 * of the log area. It is hidden by default; the footer **Replay** button toggles it.
 * During active recording, the panel hides.
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
    var footerReplayBtn = document.getElementById('footer-replay-btn');

    var replaySessionActive = false;
    var replayFileLoaded = false;

    function hasLines() { return allLines && allLines.length > 0; }

    function setReplayBarVisible(visible) {
        if (!bar) return;
        bar.classList.toggle('replay-bar-visible', !!visible);
        if (typeof syncJumpButtonInset === 'function') syncJumpButtonInset();
    }

    function setFooterReplayVisible(visible) {
        if (!footerReplayBtn) return;
        footerReplayBtn.classList.toggle('footer-replay-visible', !!visible);
    }

    window.setReplayEnabled = function(fileLoaded, sessionActive) {
        replayFileLoaded = fileLoaded;
        replaySessionActive = sessionActive;
        if (sessionActive || !fileLoaded || !hasLines()) {
            setFooterReplayVisible(false);
            setReplayBarVisible(false);
            if (window.replayMode) window.exitReplayMode();
        } else if (fileLoaded && hasLines()) {
            setFooterReplayVisible(true);
        }
    };

    function updateReplayIcon(playing) {
        if (!footerReplayBtn) return;
        var ic = footerReplayBtn.querySelector('.codicon');
        var cls = playing ? 'codicon codicon-debug-pause' : 'codicon codicon-debug-start';
        if (ic) ic.className = cls;
        footerReplayBtn.title = playing ? 'Replay playing — click to show or hide controls' : 'Replay log — click to show or hide controls';
        footerReplayBtn.setAttribute('aria-label', playing ? 'Replay playing' : 'Replay log');
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

    ${getReplayTimingScript()}
    ${getReplayControlsScript()}
})();
`;
}
