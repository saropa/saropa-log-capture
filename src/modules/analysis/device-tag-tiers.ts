/**
 * Curated classification of Android logcat tags into device-critical vs device-other.
 *
 * Device-critical: tags whose errors/warnings can indicate real problems
 * affecting the user's app (crashes, kills, ANR, OOM). Always visible
 * regardless of the Device checkbox state.
 *
 * Device-other: everything else from the Android OS. Hidden by default,
 * severity demoted to neutral.
 *
 * The critical set is intentionally small and grows conservatively.
 * If uncertain, a tag stays in device-other (hidden by default).
 */

/** Device log tier for display and filtering. */
export type DeviceTier = 'flutter' | 'device-critical' | 'device-other';

/**
 * Logcat tags whose errors/warnings can indicate real problems for the user's app.
 * Lowercase for case-insensitive matching.
 */
const criticalTags = new Set([
	'androidruntime',       // Fatal exceptions, native crashes
	'activitymanager',      // Process killed, ANR, force stop
	'system.err',           // stderr output (may include app-relevant errors)
	'art',                  // ART runtime errors (OOM, GC issues)
	'lowmemorykiller',      // Process killed for memory pressure
	'inputdispatcher',      // ANR-related input timeouts
	'windowmanager',        // App window lifecycle issues
	'dalvikvm',             // Older runtime errors
	'zygote',               // Process fork failures
	'choreographer',        // Main thread jank — reports app behavior, not device state
]);

/**
 * Classify a logcat tag into a device tier.
 *
 * @param tag - The raw logcat tag (e.g. "flutter", "SettingsState", "AndroidRuntime")
 * @returns The tier for display and filtering decisions
 */
export function getDeviceTier(tag: string | undefined): DeviceTier {
	if (!tag) { return 'device-other'; }
	const lower = tag.toLowerCase();
	if (lower === 'flutter') { return 'flutter'; }
	if (criticalTags.has(lower)) { return 'device-critical'; }
	return 'device-other';
}

/**
 * Check if a tier should bypass the Device visibility checkbox.
 * Device-critical lines are always visible to prevent missing real errors.
 */
export function isTierAlwaysVisible(tier: DeviceTier): boolean {
	return tier === 'flutter' || tier === 'device-critical';
}
