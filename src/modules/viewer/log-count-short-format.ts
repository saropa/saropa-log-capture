/**
 * Compact integer counts for log viewer UI (toolbar badges, etc.).
 * Must match `formatLogCountShort` in `viewer-tag-selection-guard.ts` (embedded webview script).
 */
function formatScaledCount(value: number, unit: string): string {
	let s: string;
	if (value >= 100) {
		s = Math.floor(value).toString();
	} else if (value >= 10) {
		s = value.toFixed(1);
	} else if (Math.abs(value - Math.round(value)) < 1e-9) {
		s = value.toFixed(0);
	} else {
		s = value.toFixed(1);
	}
	return `${s.replace(/\.0$/, "")}${unit}`;
}

export function formatLogCountShort(n: number): string {
	const x = Math.floor(Number(n));
	if (!Number.isFinite(x) || x < 0) {
		return "0";
	}
	if (x < 1000) {
		return String(x);
	}
	if (x < 1_000_000) {
		return formatScaledCount(x / 1000, "k");
	}
	if (x < 1_000_000_000) {
		return formatScaledCount(x / 1_000_000, "M");
	}
	return formatScaledCount(x / 1_000_000_000, "B");
}
