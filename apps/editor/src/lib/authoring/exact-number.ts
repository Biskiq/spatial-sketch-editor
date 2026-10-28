/**
 * Exact numeric input parsing, shared by every authoring domain.
 *
 * Display is bounded (`3.00`, `121.6`) while stored precision never mutates:
 * change handlers parse the full typed value and the domain's planners own all
 * validity. In particular a blank field is **invalid, not zero**
 * (`Number('') === 0` would silently commit 0): blank and non-finite input
 * restore the formatted fallback and commit nothing.
 */

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
