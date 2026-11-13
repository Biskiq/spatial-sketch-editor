/** Least-squares fit y = a + b·x, with R² and a raw-curve fallback below 0.8. */

export function linearFit(points) {
	const usable = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
	const n = usable.length;
	if (n < 2) return null;
	const meanX = usable.reduce((s, p) => s + p.x, 0) / n;
	const meanY = usable.reduce((s, p) => s + p.y, 0) / n;
	let sxx = 0;
	let sxy = 0;
	for (const p of usable) {
		sxx += (p.x - meanX) ** 2;
		sxy += (p.x - meanX) * (p.y - meanY);
	}
	if (sxx === 0) return null;
	const b = sxy / sxx;
	const a = meanY - b * meanX;
	let ssRes = 0;
	let ssTot = 0;
	for (const p of usable) {
		ssRes += (p.y - (a + b * p.x)) ** 2;
		ssTot += (p.y - meanY) ** 2;
	}
	const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
	return { a, b, r2, n, usable: r2 >= 0.8, raw: usable.map((p) => [p.x, p.y]) };
}

export function median(values) {
	if (values.length === 0) return null;
	const sorted = [...values].sort((x, y) => x - y);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function percentile(values, p) {
	if (values.length === 0) return null;
	const sorted = [...values].sort((x, y) => x - y);
	const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
	return sorted[index];
}

/**
 * Largest light count within a frame budget. A fit is used only when R² ≥ 0.8;
 * otherwise the largest *measured* count that met the budget is reported and
 * marked, never extrapolated.
 */
export function budgetFromFit(fit, budgetMs) {
	if (!fit || fit.b < 0) return null;
	const value = (budgetMs - fit.a) / fit.b;
	return Math.max(0, Math.floor(value));
}

export function largestMeasuredWithin(rows, budgetMs) {
	const passing = rows.filter((row) => row.medianMs <= budgetMs).map((row) => row.count);
	return passing.length === 0 ? null : Math.max(...passing);
}

/**
 * Whether a sweep rises monotonically (within a 5 % tolerance). A fit through a
 * non-monotonic curve is an artefact of one point, so the raw curve is reported
 * instead even when R² is high.
 */
export function isMonotonic(points) {
	for (let i = 1; i < points.length; i += 1) {
		const previous = points[i - 1].y;
		const current = points[i].y;
		if (current < previous * 0.95) return false;
	}
	return true;
}

/** The largest tested x within a budget, plus the first tested x above it. */
export function measuredBudget(points, budgetMs) {
	const sorted = [...points].sort((a, b) => a.x - b.x);
	let best = null;
	let nextTested = null;
	for (const point of sorted) {
		if (point.y <= budgetMs) best = point.x;
		else {
			nextTested = point.x;
			break;
		}
	}
	return { measured: best, nextTested };
}
