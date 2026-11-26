// ---------------------------------------------------------------------------
// Exact binary64 adjacent values and outward-rounded interval arithmetic
// ---------------------------------------------------------------------------

const f64View = new Float64Array(1);
const u64View = new BigUint64Array(f64View.buffer);

/** Smallest IEEE-754 binary64 value strictly greater than `x`. */
export function nextUp(x: number): number {
	if (Number.isNaN(x) || x === Infinity) return x;
	if (x === -Infinity) return -Number.MAX_VALUE;
	if (x === 0) return Number.MIN_VALUE;
	f64View[0] = x;
	u64View[0] = x > 0 ? u64View[0]! + 1n : u64View[0]! - 1n;
	return f64View[0]!;
}

/** Largest IEEE-754 binary64 value strictly less than `x`. */
export function nextDown(x: number): number {
	return -nextUp(-x);
}

/** Closed real interval `[lo, hi]` with outward-rounded operations. */
export type Iv = { readonly lo: number; readonly hi: number };

/** Enclose a stored world coordinate by its adjacent binary64 values. */
export function ivEncloseWorld(x: number): Iv {
	return { lo: nextDown(x), hi: nextUp(x) };
}

export function ivAdd(a: Iv, b: Iv): Iv {
	return { lo: nextDown(a.lo + b.lo), hi: nextUp(a.hi + b.hi) };
}

export function ivSub(a: Iv, b: Iv): Iv {
	return { lo: nextDown(a.lo - b.hi), hi: nextUp(a.hi - b.lo) };
}

export function ivMul(a: Iv, b: Iv): Iv {
	const p1 = a.lo * b.lo;
	const p2 = a.lo * b.hi;
	const p3 = a.hi * b.lo;
	const p4 = a.hi * b.hi;
	return {
		lo: nextDown(Math.min(p1, p2, p3, p4)),
		hi: nextUp(Math.max(p1, p2, p3, p4)),
	};
}
