/**
 * Event listener registration for decoration settings panel controls.
 * Extracted from viewer-deco-settings.ts to keep it under the line limit.
 *
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getDecoSettingsListenersScript(): string {
    return /* javascript */ `
/* Register event listeners for settings panel controls. */
var decoSettingsBtn = document.getElementById('deco-settings-btn');
var decoCloseBtn = document.querySelector('.deco-settings-close');
var decoOptDot = document.getElementById('deco-opt-dot');
var decoOptCounter = document.getElementById('deco-opt-counter');
var decoOptCounterOnBlank = document.getElementById('deco-opt-counter-on-blank');
var decoOptTimestamp = document.getElementById('deco-opt-timestamp');
var decoOptMilliseconds = document.getElementById('deco-opt-milliseconds');
var decoOptElapsed = document.getElementById('deco-opt-elapsed');
var decoOptSessionElapsed = document.getElementById('deco-opt-session-elapsed');
var decoOptBar = document.getElementById('deco-opt-bar');
var decoOptQuality = document.getElementById('deco-opt-quality');
var decoOptCategoryBadge = document.getElementById('deco-opt-category-badge');
var decoOptLintBadge = document.getElementById('deco-opt-lint-badge');
var decoOptLineColors = document.getElementById('deco-opt-line-colors');
var decoLineColorSelect = document.getElementById('deco-line-color-mode');
var decoOptStripSourceTag = document.getElementById('deco-opt-strip-source-tag');
var decoStackDefaultState = document.getElementById('deco-stack-default-state');
var decoStackPreviewCount = document.getElementById('deco-stack-preview-count');

if (decoSettingsBtn) decoSettingsBtn.addEventListener('click', toggleDecoSettings);
if (decoCloseBtn) decoCloseBtn.addEventListener('click', closeDecoSettings);
if (decoOptDot) decoOptDot.addEventListener('change', onDecoOptionChange);
if (decoOptCounter) decoOptCounter.addEventListener('change', onDecoOptionChange);
if (decoOptCounterOnBlank) decoOptCounterOnBlank.addEventListener('change', onDecoOptionChange);
if (decoOptTimestamp) decoOptTimestamp.addEventListener('change', onDecoOptionChange);
if (decoOptMilliseconds) decoOptMilliseconds.addEventListener('change', onDecoOptionChange);
if (decoOptElapsed) decoOptElapsed.addEventListener('change', onDecoOptionChange);
if (decoOptSessionElapsed) decoOptSessionElapsed.addEventListener('change', onDecoOptionChange);
if (decoOptBar) decoOptBar.addEventListener('change', onDecoOptionChange);
if (decoOptQuality) decoOptQuality.addEventListener('change', onDecoOptionChange);
if (decoOptCategoryBadge) decoOptCategoryBadge.addEventListener('change', onDecoOptionChange);
if (decoOptLintBadge) decoOptLintBadge.addEventListener('change', onDecoOptionChange);
if (decoOptLineColors) decoOptLineColors.addEventListener('change', onDecoOptionChange);
if (decoLineColorSelect) decoLineColorSelect.addEventListener('change', onDecoOptionChange);
if (decoOptStripSourceTag) decoOptStripSourceTag.addEventListener('change', onDecoOptionChange);
var decoOptStructuredParsing = document.getElementById('deco-opt-structured-parsing');
var decoOptShowPidTid = document.getElementById('deco-opt-show-pid-tid');
var decoOptShowLevelPrefix = document.getElementById('deco-opt-show-level-prefix');
if (decoOptStructuredParsing) decoOptStructuredParsing.addEventListener('change', onDecoOptionChange);
if (decoOptShowPidTid) decoOptShowPidTid.addEventListener('change', onDecoOptionChange);
if (decoOptShowLevelPrefix) decoOptShowLevelPrefix.addEventListener('change', onDecoOptionChange);
if (decoStackDefaultState) decoStackDefaultState.addEventListener('change', onDecoOptionChange);
if (decoStackPreviewCount) decoStackPreviewCount.addEventListener('change', onDecoOptionChange);

/* Close panel when clicking outside it or the gear button. */
document.addEventListener('click', function(e) {
    if (!decoSettingsOpen) return;
    var panel = document.getElementById('deco-settings');
    var gearBtn = document.getElementById('deco-settings-btn');
    if (panel && !panel.contains(e.target) && gearBtn !== e.target) {
        closeDecoSettings();
    }
});
`;
}
