/**
 * Replay controls: updateReplayUi, scheduleNext, setPlayingUi, exitReplayMode, startReplay, event listeners.
 * Inlined into the same IIFE as viewer-replay so bar, playBtn, scrubber, allLines, etc. are in scope.
 */
export function getReplayControlsScript(): string {
  return `
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
            if (!window.replayMode || !replayPlaying) return;
            window.replayCurrentIndex = next;
            updateReplayUi();
            scheduleNext();
        }, delay);
    }

    function stopReplayTimer() {
        if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
        replayPlaying = false;
    }

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
        setFooterReplayVisible(canReplay);
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
        updateReplayUi();
        scheduleNext();
    };

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
    if (footerReplayBtn) footerReplayBtn.addEventListener('click', function() {
        if (typeof window.toggleReplayBar === 'function') window.toggleReplayBar();
    });
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

    setReplayBarVisible(false);
    setFooterReplayVisible(false);
`;
}
