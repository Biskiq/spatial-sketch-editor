/**
 * Distribution statistics for the on-demand performance harness (T3.P03.S02).
 *
 * The performance contract requires sample counts, median, p75, p95, p99 and
 * max, per-run values and run-to-run spread. Ten milestone samples make p95/p99
 * coarse tail estimates (often the maximum), so every summary carries its count
 * and the report states that limit instead of implying precise population
 * percentiles.
 */

export type Stats = {
	readonly count: number;
	readonly min: number;
	readonly median: number;
	readonly p75: number;
	readonly p95: number;
	readonly p99: number;
	readonly max: number;
	readonly values: readonly number[];
};

/** Linear-interpolated quantile over an ascending copy (0 ≤ q ≤ 1). */
export function quantile(sorted: readonly number[], q: number): number {
	if (sorted.length === 0) return Number.NaN;
	if (sorted.length === 1) return sorted[0]!;
	const position = (sorted.length - 1) * q;
	const lower = Math.floor(position);
	const upper = Math.ceil(position);
	if (lower === upper) return sorted[lower]!;
	return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

export function summarize(values: readonly number[]): Stats {
	const sorted = [...values].sort((a, b) => a - b);
	return {
		count: sorted.length,
		min: sorted[0] ?? Number.NaN,
		median: quantile(sorted, 0.5),
		p75: quantile(sorted, 0.75),
		p95: quantile(sorted, 0.95),
		p99: quantile(sorted, 0.99),
		max: sorted[sorted.length - 1] ?? Number.NaN,
		values: sorted
	};
}

/** Round for a stable, readable report without pretending to sub-ms precision. */
export function round(value: number, digits = 2): number {
	if (!Number.isFinite(value)) return value;
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

/** One decimal-free summary line. */
export function formatStats(stats: Stats): string {
	return `n=${stats.count} median=${round(stats.median)} p75=${round(stats.p75)} p95=${round(stats.p95)} p99=${round(stats.p99)} max=${round(stats.max)}`;
}
