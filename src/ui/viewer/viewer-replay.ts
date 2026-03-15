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
 * Visibility: A floating toggle button in the top-right corner of the log area.
 * The full replay panel (vertical layout) is hidden by default; the toggle or icon
 * bar button reveals it. During active recording, both toggle and panel hide.
 */

export function getReplayBarHtml(): string {
    return /* html */ `
<button id="replay-toggle" class="replay-toggle" title="Replay controls" aria-label="Toggle replay controls">
    <span class="codicon codicon-debug-start"></span>
</button>
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
    var toggleBtn = document.getElementById('replay-toggle');
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

    function hasLines() { return allLines && allLines.length > 0; }

    /** Show or hide the replay bar (uses CSS class so !important rule is overridden). */
    function setReplayBarVisible(visible) {
        if (!bar) return;
        bar.classList.toggle('replay-bar-visible', !!visible);
    }

    /** Show or hide the icon bar replay button. */
    function setReplayIconVisible(visible) {
        if (!ibReplay) return;
        ibReplay.classList.toggle('ib-replay-active', visible);
    }

    /** Show or hide the floating toggle button in the top-right corner. */
    function setToggleVisible(visible) {
        if (toggleBtn) toggleBtn.classList.toggle('replay-toggle-visible', !!visible);
    }

    /** Enable/disable replay controls based on file loaded state and session state. */
    window.setReplayEnabled = function(fileLoaded, sessionActive) {
        replayFileLoaded = fileLoaded;
        replaySessionActive = sessionActive;
        if (sessionActive || !fileLoaded || !hasLines()) {
            setReplayIconVisible(false);
            setToggleVisible(false);
            setReplayBarVisible(false);
            if (window.replayMode) window.exitReplayMode();
        } else if (fileLoaded && hasLines()) {
            setReplayIconVisible(true);
            setToggleVisible(true);
        }
    };

    /** Update icon bar and toggle button icons to reflect play/pause state. */
    function updateReplayIcon(playing) {
        var cls = playing ? 'codicon codicon-debug-pause' : 'codicon codicon-debug-start';
        if (ibReplay) {
            var ic = ibReplay.querySelector('.codicon');
            if (ic) { ic.className = cls; ibReplay.title = playing ? 'Replay (playing)' : 'Replay (paused)'; }
        }
        if (toggleBtn) {
            var tc = toggleBtn.querySelector('.codicon');
            if (tc) { tc.className = cls; toggleBtn.title = playing ? 'Replay (playing)' : 'Replay controls'; }
        }
    }

    /** Toggle the replay bar visibility. */
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

    /** Set speed dropdown to closest option for a given factor (avoids float mismatch e.g. 0.5). */
    function setSpeedSelectValue(factor) {
        if (!speedSelect || !speedSelect.options.length) return;
        var opts = speedSelect.options;
        var best = opts[0];
        var bestDiff = 1e9;
        for (var i = 0; i < opts.length; i++) {
            var val = parseFloat(opts[i].value);
            if (!Number.isFinite(val)) continue;
            var d = Math.abs(val - factor);
            if (d < bestDiff) { bestDiff = d; best = opts[i]; }
        }
        if (best) { speedSelect.value = best.value; replaySpeedFactor = parseFloat(best.value) || 1; }
    }

    /** Apply extension replay config (defaultMode, defaultSpeed, minLineDelayMs, maxDelayMs). */
    function applyReplayConfig(cfg) {
        if (!cfg) return;
        if (cfg.defaultMode === 'fast' || cfg.defaultMode === 'timed') replayTimedMode = (cfg.defaultMode === 'timed');
        if (typeof cfg.defaultSpeed === 'number' && cfg.defaultSpeed > 0) replaySpeedFactor = cfg.defaultSpeed;
        if (typeof cfg.minLineDelayMs === 'number' && cfg.minLineDelayMs >= 0) REPLAY_MIN_MS = cfg.minLineDelayMs;
        if (typeof cfg.maxDelayMs === 'number' && cfg.maxDelayMs > 0) REPLAY_MAX_MS = cfg.maxDelayMs;
        if (typeof cfg.minLineDelayMs === 'number' && cfg.minLineDelayMs >= 0) REPLAY_FAST_MS = Math.max(10, cfg.minLineDelayMs);
        if (modeSelect) modeSelect.value = replayTimedMode ? 'timed' : 'fast';
        if (speedSelect) setSpeedSelectValue(replaySpeedFactor);
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
        var total = hasLines() ? allLines.length : 0;
        if (total === 0) {
            if (window.replayMode) window.exitReplayMode();
            return;
        }
        if (scrubber) {
            scrubber.max = Math.max(0, total - 1);
            scrubber.value = window.replayCurrentIndex;
        }
        if (statusEl) statusEl.textContent = (window.replayCurrentIndex + 1) + ' / ' + total;
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
            setPlayingUi(false);
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

    /** Update play/pause button visibility and icon state. */
    function setPlayingUi(playing) {
        if (playBtn) playBtn.style.display = playing ? 'none' : '';
        if (pauseBtn) pauseBtn.style.display = playing ? '' : 'none';
        updateReplayIcon(playing);
    }

    function exitReplayMode() {
        stopReplayTimer();
        window.replayMode = false;
        setReplayBarVisible(false);
        setPlayingUi(false);
        var canReplay = replayFileLoaded && !replaySessionActive && hasLines();
        setReplayIconVisible(canReplay);
        setToggleVisible(canReplay);
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
        setReplayBarVisible(true);
        replayPlaying = true;
        setPlayingUi(true);
        setReplayIconVisible(true);
        updateReplayUi();
        scheduleNext();
    };

    if (toggleBtn) toggleBtn.addEventListener('click', function() {
        if (typeof window.toggleReplayBar === 'function') window.toggleReplayBar();
    });

    if (modeSelect) modeSelect.addEventListener('change', function() {
        replayTimedMode = (modeSelect.value === 'timed');
    });

    if (playBtn) playBtn.addEventListener('click', function() {
        if (!window.replayMode) return;
        replayPlaying = true;
        setPlayingUi(true);
        scheduleNext();
    });
    if (pauseBtn) pauseBtn.addEventListener('click', function() {
        stopReplayTimer();
        setPlayingUi(false);
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
        setPlayingUi(false);
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
                setPlayingUi(false);
            } else {
                replayPlaying = true;
                setPlayingUi(true);
                scheduleNext();
            }
        }
    });

    /* Ensure bar, toggle and icon are hidden on startup (defense against cached state). */
    setReplayBarVisible(false);
    setToggleVisible(false);
    setReplayIconVisible(false);
})();
`;
}
