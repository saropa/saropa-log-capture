/**
 * Audio playback for log events in the viewer.
 *
 * Plays sound notifications when warnings or errors appear in the log.
 * Sounds are loaded from the extension's audio directory.
 */

/**
 * Returns the JavaScript code for audio playback in the webview.
 */
export function getAudioScript(extensionUri: string): string {
    return /* javascript */ `
/** Whether audio notifications are enabled. */
var audioEnabled = false;

/** Volume level for audio playback (0.0 to 1.0). */
var audioVolume = 0.3;

/** Minimum milliseconds between sounds of the same level (rate limiting). */
var audioRateLimit = 2000;

/** Tracks last play time for each level (for rate limiting). */
var lastPlayTime = {
    error: 0,
    warning: 0
};

/** Audio elements for different log levels. */
var audioElements = {
    error: null,
    warning: null
};

/**
 * Initialize audio elements with sound files from extension.
 * Audio files are loaded from the extension's audio directory.
 */
// BUG FIX: extensionUri already points to the audio/ directory
// (built via joinPath(extensionUri, 'audio')), so appending /audio/ again
// created a doubled path like audio/audio/swipe_low.mp3.
function initAudio() {
    try {
        audioElements.error = new Audio('${extensionUri}/swipe_low.mp3');
        audioElements.warning = new Audio('${extensionUri}/pop.mp3');
    } catch (e) {
        console.error('Failed to initialize audio:', e);
    }
}

/**
 * Toggle audio notifications on/off.
 */
function toggleAudio() {
    audioEnabled = !audioEnabled;
    updateAudioButton();
    if (audioEnabled && !audioElements.error) {
        initAudio();
    }
}

/**
 * Update the audio button style and tooltip to reflect current state.
 * Swaps between bell (🔔) and muted bell (🔕) emoji.
 */
function updateAudioButton() {
    var btn = document.getElementById('audio-toggle');
    if (!btn) return;
    btn.innerHTML = audioEnabled ? '\\ud83d\\udd14' : '\\ud83d\\udd15';
    btn.title = audioEnabled
        ? 'Audio ON (click to mute)'
        : 'Audio OFF (click to unmute)';
    if (audioEnabled) {
        btn.classList.remove('toggle-inactive');
    } else {
        btn.classList.add('toggle-inactive');
    }
}

/**
 * Play a sound for a specific log level.
 * Called automatically when new lines are added.
 * Respects volume setting and rate limiting.
 */
function playAudioForLevel(level) {
    if (!audioEnabled || !audioElements[level]) return;

    // Rate limiting: check if enough time has passed since last play
    var now = Date.now();
    if (now - lastPlayTime[level] < audioRateLimit) return;

    try {
        var audio = audioElements[level].cloneNode();
        audio.volume = audioVolume;
        audio.play().catch(function(e) {
            // Silently fail if audio playback is blocked
        });
        lastPlayTime[level] = now;
    } catch (e) {
        // Ignore audio errors
    }
}

/**
 * Set the audio volume (0-100 from slider, converted to 0.0-1.0).
 */
function setAudioVolume(value) {
    audioVolume = Math.max(0, Math.min(100, value)) / 100;
}

/**
 * Preview a sound (for testing volume/audio settings).
 */
function previewAudioSound(level) {
    if (!audioElements[level]) {
        if (!audioElements.error) initAudio();
        if (!audioElements[level]) return;
    }
    try {
        var audio = audioElements[level].cloneNode();
        audio.volume = audioVolume;
        audio.play().catch(function(e) {
            // Silently fail if audio playback is blocked
        });
    } catch (e) {
        // Ignore audio errors
    }
}

/**
 * Hook into line addition to play sounds for new errors/warnings.
 * Wraps the original addToData function.
 */
var _origAddToData = typeof addToData === 'function' ? addToData : null;
if (_origAddToData) {
    addToData = function(html, isMarker, category, ts, fw) {
        _origAddToData(html, isMarker, category, ts, fw);
        if (!isMarker && audioEnabled) {
            var plain = stripTags(html);
            var level = classifyLevel(plain, category);
            if (level === 'error' || level === 'warning') {
                playAudioForLevel(level);
            }
        }
        return;
    };
}

// Register audio toggle button click handler
var audioToggleBtn = document.getElementById('audio-toggle');
if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', toggleAudio);
    updateAudioButton();
}
`;
}
