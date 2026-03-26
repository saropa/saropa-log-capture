"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReplayTimingScript = getReplayTimingScript;
/**
 * Replay timing: constants, getDelayMs, applyReplayConfig, setSpeedSelectValue.
 * Inlined into the same IIFE as viewer-replay so allLines, replayTimedMode, replaySpeedFactor are in scope.
 */
function getReplayTimingScript() {
    return `
    var REPLAY_MIN_MS = 10;
    var REPLAY_MAX_MS = 30000;
    var REPLAY_FAST_MS = 50;

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
`;
}
//# sourceMappingURL=viewer-replay-timing.js.map