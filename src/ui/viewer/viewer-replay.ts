/**
 * Session replay: play/pause/stop, Timed/Fast mode, speed, scrubber.
 * Uses window.replayMode and window.replayCurrentIndex; viewer-data-viewport
 * clamps visible lines to replayCurrentIndex when replayMode is true.
 *
 * Timing: In Timed mode, delay between lines uses line.elapsedMs (from [+Nms] in file)
 * or timestamp delta; in Fast mode a fixed short delay is used. Config (min/max delay,
 * default speed/mode) is sent with startReplay from the extension.
 *
 * Richer context: When replay is started from the session list, the extension
 * loads the session and can attach session metadata (displayName, tags) and
 * integration data (build, git, test results) for the session timeline.
 */

export function getReplayBarHtml(): string {
    return /* html */ `
<div id="replay-bar" class="replay-bar" role="region" aria-label="Session replay controls" style="display: none;">
    <button id="replay-play" class="replay-btn" title="Play" aria-label="Play replay"><span class="codicon codicon-debug-start"></span></button>
    <button id="replay-pause" class="replay-btn" title="Pause" aria-label="Pause replay"><span class="codicon codicon-debug-pause"></span></button>
    <button id="replay-stop" class="replay-btn" title="Stop and exit replay" aria-label="Stop replay"><span class="codicon codicon-debug-stop"></span></button>
    <span class="replay-mode-label">Mode:</span>
    <select id="replay-mode" class="replay-mode" title="Timed uses line deltas when available; Fast uses fixed short delay" aria-label="Replay mode">
        <option value="timed">Timed</option>
        <option value="fast">Fast</option>
    </select>
    <span class="replay-speed-label">Speed:</span>
    <select id="replay-speed" class="replay-speed" title="Playback speed" aria-label="Playback speed">
        <option value="0.5">0.5x</option>
        <option value="1" selected>1x</option>
        <option value="2">2x</option>
        <option value="5">5x</option>
    </select>
    <input type="range" id="replay-scrubber" class="replay-scrubber" min="0" max="1" value="0" title="Seek to line" aria-label="Replay position" />
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
    var REPLAY_MIN_MS = 10;
    var REPLAY_MAX_MS = 30000;
    var REPLAY_FAST_MS = 50;

    var bar = document.getElementById('replay-bar');
    var playBtn = document.getElementById('replay-play');
    var pauseBtn = document.getElementById('replay-pause');
    var stopBtn = document.getElementById('replay-stop');
    var modeSelect = document.getElementById('replay-mode');
    var speedSelect = document.getElementById('replay-speed');
    var scrubber = document.getElementById('replay-scrubber');
    var statusEl = document.getElementById('replay-status');
    var ibReplay = document.getElementById('ib-replay');

    /** Track whether a recording session is active (hide replay controls during recording). */
    var replaySessionActive = false;
    /** Track whether we're viewing a loaded file (enable replay controls when true). */
    var replayFileLoaded = false;

    /** Show or hide the icon bar replay button. */
    function setReplayIconVisible(visible) {
        if (!ibReplay) return;
        ibReplay.classList.toggle('ib-replay-active', visible);
    }

    /** Enable/disable replay icon based on file loaded state and session state. */
    window.setReplayEnabled = function(fileLoaded, sessionActive) {
        replayFileLoaded = fileLoaded;
        replaySessionActive = sessionActive;
        if (sessionActive || !fileLoaded) {
            setReplayIconVisible(false);
            if (bar) bar.style.display = 'none';
            if (window.replayMode) {
                window.exitReplayMode();
            }
        } else if (fileLoaded && !window.replayMode) {
            setReplayIconVisible(true);
        }
    };

    /** Update the icon bar replay icon to reflect play/pause state. */
    function updateReplayIcon(playing) {
        if (!ibReplay) return;
        var icon = ibReplay.querySelector('.codicon');
        if (!icon) return;
        icon.className = playing ? 'codicon codicon-debug-pause' : 'codicon codicon-debug-start';
        ibReplay.title = playing ? 'Replay (playing)' : 'Replay (paused)';
    }

    /** Toggle the replay bar visibility. */
    window.toggleReplayBar = function() {
        if (!bar) return;
        if (replaySessionActive || !replayFileLoaded) return;
        if (!window.replayMode) {
            if (typeof window.startReplay === 'function') window.startReplay();
            return;
        }
        var visible = bar.style.display !== 'none';
        bar.style.display = visible ? 'none' : 'flex';
    };

    /** Apply extension replay config (defaultMode, defaultSpeed, minLineDelayMs, maxDelayMs). */
    function applyReplayConfig(cfg) {
        if (!cfg) return;
        if (cfg.defaultMode === 'fast' || cfg.defaultMode === 'timed') replayTimedMode = (cfg.defaultMode === 'timed');
        if (typeof cfg.defaultSpeed === 'number' && cfg.defaultSpeed > 0) replaySpeedFactor = cfg.defaultSpeed;
        if (typeof cfg.minLineDelayMs === 'number' && cfg.minLineDelayMs >= 0) REPLAY_MIN_MS = cfg.minLineDelayMs;
        if (typeof cfg.maxDelayMs === 'number' && cfg.maxDelayMs > 0) REPLAY_MAX_MS = cfg.maxDelayMs;
        if (typeof cfg.minLineDelayMs === 'number' && cfg.minLineDelayMs >= 0) REPLAY_FAST_MS = Math.max(10, cfg.minLineDelayMs);
        if (modeSelect) modeSelect.value = replayTimedMode ? 'timed' : 'fast';
        if (speedSelect) {
            var v = String(replaySpeedFactor);
            if ([0.5, 1, 2, 5].indexOf(replaySpeedFactor) >= 0) speedSelect.value = v;
        }
    }

    /** Delay before showing line at lineIdx: Timed = elapsedMs or timestamp delta (clamped); Fast = fixed. */
    function getDelayMs(lineIdx) {
        if (lineIdx <= 0 || !allLines || lineIdx >= allLines.length) return 0;
        if (!replayTimedMode) return Math.max(REPLAY_MIN_MS, REPLAY_FAST_MS / replaySpeedFactor);
        var curr = allLines[lineIdx];
        var prev = allLines[lineIdx - 1];
        if (curr && curr.elapsedMs != null && curr.elapsedMs >= 0) {
            var scaled = curr.elapsedMs / replaySpeedFactor;
            return Math.max(REPLAY_MIN_MS, Math.min(REPLAY_MAX_MS, scaled));
        }
        if (curr && prev && curr.timestamp && prev.timestamp) {
            var delta = curr.timestamp - prev.timestamp;
            if (delta < 0) return REPLAY_FAST_MS;
            var scaled = delta / replaySpeedFactor;
            return Math.max(REPLAY_MIN_MS, Math.min(REPLAY_MAX_MS, scaled));
        }
        return REPLAY_FAST_MS / replaySpeedFactor;
    }

    function updateReplayUi() {
        var total = allLines ? allLines.length : 0;
        if (scrubber) {
            scrubber.max = Math.max(0, total - 1);
            scrubber.value = window.replayCurrentIndex;
        }
        if (statusEl) statusEl.textContent = (window.replayCurrentIndex + 1) + ' / ' + (total || 0);
        if (typeof renderViewport === 'function') renderViewport(true);
        if (autoScroll !== undefined && typeof window.setProgrammaticScroll === 'function' && logEl) {
            window.setProgrammaticScroll();
            suppressScroll = true;
            var ch = 0;
            if (typeof prefixSums !== 'undefined' && prefixSums && window.replayCurrentIndex + 1 < prefixSums.length) {
                ch = prefixSums[window.replayCurrentIndex + 1] || 0;
            } else if (allLines) {
                for (var i = 0; i < window.replayCurrentIndex && i < allLines.length; i++) ch += allLines[i].height;
            }
            logEl.scrollTop = Math.max(0, ch - logEl.clientHeight / 2);
            suppressScroll = false;
        }
    }

    function scheduleNext() {
        if (!replayPlaying || !allLines || allLines.length === 0) return;
        var next = window.replayCurrentIndex + 1;
        if (next >= allLines.length) {
            replayPlaying = false;
            if (playBtn) playBtn.style.display = '';
            if (pauseBtn) pauseBtn.style.display = 'none';
            updateReplayIcon(false);
            if (statusEl) statusEl.textContent = 'Complete';
            if (typeof renderViewport === 'function') renderViewport(true);
            return;
        }
        var delay = getDelayMs(next);
        replayTimer = setTimeout(function() {
            replayTimer = null;
            if (!window.replayMode || !replayPlaying) return; /* avoid race if user stopped replay */
            window.replayCurrentIndex = next;
            updateReplayUi();
            scheduleNext();
        }, delay);
    }

    function stopReplayTimer() {
        if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
        replayPlaying = false;
    }

    function exitReplayMode() {
        stopReplayTimer();
        window.replayMode = false;
        if (bar) bar.style.display = 'none';
        if (playBtn) playBtn.style.display = '';
        if (pauseBtn) pauseBtn.style.display = 'none';
        updateReplayIcon(false);
        if (replayFileLoaded && !replaySessionActive) {
            setReplayIconVisible(true);
        } else {
            setReplayIconVisible(false);
        }
        if (typeof renderViewport === 'function') renderViewport(true);
        if (typeof updateFooterText === 'function') updateFooterText();
    }
    window.exitReplayMode = exitReplayMode;

    window.startReplay = function(msg) {
        if (!allLines || allLines.length === 0) return;
        if (replaySessionActive) return;
        if (msg && msg.replayConfig) applyReplayConfig(msg.replayConfig);
        window.replayMode = true;
        window.replayCurrentIndex = 0;
        if (bar) bar.style.display = 'flex';
        replayPlaying = true;
        if (playBtn) playBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = '';
        setReplayIconVisible(true);
        updateReplayIcon(true);
        updateReplayUi();
        scheduleNext();
    };

    if (modeSelect) modeSelect.addEventListener('change', function() {
        replayTimedMode = (modeSelect.value === 'timed');
    });

    if (playBtn) playBtn.addEventListener('click', function() {
        if (!window.replayMode) return;
        replayPlaying = true;
        playBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = '';
        updateReplayIcon(true);
        scheduleNext();
    });
    if (pauseBtn) pauseBtn.addEventListener('click', function() {
        stopReplayTimer();
        replayPlaying = false;
        playBtn.style.display = '';
        pauseBtn.style.display = 'none';
        updateReplayIcon(false);
    });
    if (stopBtn) stopBtn.addEventListener('click', exitReplayMode);
    if (speedSelect) speedSelect.addEventListener('change', function() {
        replaySpeedFactor = parseFloat(speedSelect.value) || 1;
    });
    if (scrubber) scrubber.addEventListener('input', function() {
        if (!window.replayMode) return;
        var raw = parseInt(scrubber.value, 10);
        if (isNaN(raw)) return;
        stopReplayTimer();
        var total = allLines ? allLines.length : 0;
        window.replayCurrentIndex = Math.max(0, Math.min(total - 1, raw));
        replayPlaying = false;
        if (playBtn) playBtn.style.display = '';
        if (pauseBtn) pauseBtn.style.display = 'none';
        updateReplayIcon(false);
        updateReplayUi();
    });

    window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'startReplay') {
            if (typeof window.startReplay === 'function') window.startReplay(e.data);
        }
        if (e.data && e.data.type === 'setReplayConfig' && e.data.replayConfig) {
            applyReplayConfig(e.data.replayConfig);
        }
    });

    /* Space = play/pause when replay is active and focus is not in an input. */
    document.addEventListener('keydown', function(ev) {
        if (!window.replayMode || ev.repeat) return;
        var tag = (ev.target && ev.target.tagName) ? ev.target.tagName.toUpperCase() : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (ev.code === 'Space' || ev.key === ' ') {
            ev.preventDefault();
            if (replayPlaying) {
                stopReplayTimer();
                replayPlaying = false;
                if (playBtn) playBtn.style.display = '';
                if (pauseBtn) pauseBtn.style.display = 'none';
                updateReplayIcon(false);
            } else {
                replayPlaying = true;
                if (playBtn) playBtn.style.display = 'none';
                if (pauseBtn) pauseBtn.style.display = '';
                updateReplayIcon(true);
                scheduleNext();
            }
        }
    });
})();
`;
}
