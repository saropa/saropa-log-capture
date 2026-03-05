/**
 * Session replay: play/pause/stop, scrubber, speed.
 * Uses window.replayMode and window.replayCurrentIndex; viewer-data-viewport
 * clamps visible lines to replayCurrentIndex when replayMode is true.
 *
 * Richer context: When replay is started from the session list, the extension
 * loads the session and can attach session metadata (displayName, tags) and
 * integration data (build, git, test results) for the session timeline. That
 * data can be shown in the replay bar or a side panel. When integration
 * sources are fetched, the extension should persist them to session metadata
 * (SessionMeta.integrations) so the next replay of the same session is faster.
 */

export function getReplayBarHtml(): string {
    return /* html */ `
<div id="replay-bar" class="replay-bar" role="region" aria-label="Session replay controls" style="display: none;">
    <button id="replay-play" class="replay-btn" title="Play" aria-label="Play replay"><span class="codicon codicon-debug-start"></span></button>
    <button id="replay-pause" class="replay-btn" title="Pause" aria-label="Pause replay"><span class="codicon codicon-debug-pause"></span></button>
    <button id="replay-stop" class="replay-btn" title="Stop and exit replay" aria-label="Stop replay"><span class="codicon codicon-debug-stop"></span></button>
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
    var REPLAY_MIN_MS = 10;
    var REPLAY_MAX_MS = 30000;
    var REPLAY_FAST_MS = 50;

    var bar = document.getElementById('replay-bar');
    var playBtn = document.getElementById('replay-play');
    var pauseBtn = document.getElementById('replay-pause');
    var stopBtn = document.getElementById('replay-stop');
    var speedSelect = document.getElementById('replay-speed');
    var scrubber = document.getElementById('replay-scrubber');
    var statusEl = document.getElementById('replay-status');

    function getDelayMs(lineIdx) {
        if (lineIdx <= 0 || !allLines || lineIdx >= allLines.length) return 0;
        var curr = allLines[lineIdx];
        var prev = allLines[lineIdx - 1];
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
        if (typeof renderViewport === 'function') renderViewport(true);
        if (typeof updateFooterText === 'function') updateFooterText();
    }
    window.exitReplayMode = exitReplayMode;

    window.startReplay = function() {
        if (!allLines || allLines.length === 0) return;
        window.replayMode = true;
        window.replayCurrentIndex = 0;
        if (bar) bar.style.display = 'flex';
        replayPlaying = true;
        if (playBtn) playBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = '';
        updateReplayUi();
        scheduleNext();
    };

    if (playBtn) playBtn.addEventListener('click', function() {
        if (!window.replayMode) return;
        replayPlaying = true;
        playBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = '';
        scheduleNext();
    });
    if (pauseBtn) pauseBtn.addEventListener('click', function() {
        stopReplayTimer();
        replayPlaying = false;
        playBtn.style.display = '';
        pauseBtn.style.display = 'none';
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
        updateReplayUi();
    });

    window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'startReplay') {
            if (typeof startReplay === 'function') startReplay();
        }
    });
})();
`;
}
