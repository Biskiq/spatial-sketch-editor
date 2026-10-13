/**
 * P23.6 — exact numeric input parsing and presentation formatting for the
 * Inspector's canonical precision editors.
 *
 * Display is bounded (`3.00`, `121.6`) while stored precision never mutates:
 * change handlers parse the full typed value and the canonical Layout
 * planners own all validity. In particular a blank field is **invalid, not
 * zero** (`Number('') === 0` would silently commit 0 — catastrophic for
 * Junction X/Z and Wall Angle, where zero is a legal value): blank and
 * non-finite input restores the formatted fallback and commits nothing, so
 * state and history stay untouched.
 */

export function formatMeters(value: number): string {
	return value.toFixed(2);
}

export function formatDegrees(value: number): string {
	return value.toFixed(1);
}

export type ExactNumberParse =
	| { ok: true; value: number }
	| { ok: false; display: string; reason: 'blank' | 'non-finite' };

export function parseExactNumber(
	raw: string,
	fallback: number,
	format: (value: number) => string = String
): ExactNumberParse {
	if (!raw.trim()) return { ok: false, display: format(fallback), reason: 'blank' };
	const value = Number(raw);
	if (!Number.isFinite(value)) return { ok: false, display: format(fallback), reason: 'non-finite' };
	return { ok: true, value };
}
