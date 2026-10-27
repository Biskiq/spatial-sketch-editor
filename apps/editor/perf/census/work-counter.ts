/**
 * Node-side work collection for the deterministic censuses (T1.P02.S06 C).
 *
 * Installs the `layout-core` work observer around one measured operation and
 * returns what it counted. Counts are the census evidence ("census, not
 * timing"); span durations are kept only as a coarse sanity read and are never
 * cited.
 */
import { setWorkObserver } from '@portfolio/layout-core';

export type WorkCounts = Readonly<Record<string, number>>;

export type CountedWork<T> = { readonly result: T; readonly counts: WorkCounts };

function collector(): { counts: Record<string, number>; restore: () => void } {
	const counts: Record<string, number> = Object.create(null);
	const previous = setWorkObserver({
		span(name) {
			counts[`span:${name}`] = (counts[`span:${name}`] ?? 0) + 1;
		},
		count(name, amount) {
			counts[name] = (counts[name] ?? 0) + amount;
		}
	});
	return { counts, restore: () => void setWorkObserver(previous) };
}

export function countWork<T>(work: () => T): CountedWork<T> {
	const { counts, restore } = collector();
	try {
		return { result: work(), counts };
	} finally {
		restore();
	}
}

export async function countWorkAsync<T>(work: () => Promise<T>): Promise<CountedWork<T>> {
	const { counts, restore } = collector();
	try {
		return { result: await work(), counts };
	} finally {
		restore();
	}
}

/**
 * Legacy named global passes. This list excludes capture, validation helpers,
 * storage copies, output assembly and byte streaming; zero is NOT proof that
 * an entire operation is sublinear. A compile call can also be incremental.
 */
export const WHOLE_DOCUMENT_PASSES = [
	'span:structural-pre',
	'span:topology-pre',
	'span:face-extraction',
	'span:room-reconciliation',
	'span:structural-post',
	'span:topology-post',
	'span:opening-set',
	'span:portal-relations',
	'span:compile'
] as const;

export function wholeDocumentPasses(counts: WorkCounts): number {
	return WHOLE_DOCUMENT_PASSES.reduce((sum, name) => sum + (counts[name] ?? 0), 0);
}

/** Affected-entity work (I1 class 1): the entities every compile evaluates. */
export function entityEvaluations(counts: WorkCounts): number {
	return (
		(counts['compile:walls'] ?? 0) +
		(counts['compile:junctions'] ?? 0) +
		(counts['compile:openings'] ?? 0) +
		(counts['compile:rooms'] ?? 0)
	);
}

/** Pair visits (I2) at the three indexed-join candidates (H3). */
export function pairVisits(counts: WorkCounts): number {
	return (counts['pairs:room-opening'] ?? 0) + (counts['pairs:wall-opening'] ?? 0) + (counts['pairs:face-room'] ?? 0);
}

/**
 * Every counted pair loop's visits (the owner's D1 ruling): the three join
 * candidates plus the topology gates' Junction×Junction and Wall×Wall loops,
 * the curve-crossing gate, the Wall×query-AABB reconciliation and the
 * object×Room scan. Same-component evaluations are a subset and not added.
 */
export function allPairVisits(counts: WorkCounts): number {
	return Object.entries(counts)
		.filter(([name]) => name.startsWith('pairs:') && !name.endsWith(':same-component'))
		.reduce((sum, [, value]) => sum + value, 0);
}

/** Logical lookup units at their call sites; indexed endpoint reads also emit
 * lookup:junctions. This sum no longer measures exclusively linear scans. */
export function lookupVisits(counts: WorkCounts): number {
	return Object.entries(counts)
		.filter(([name]) => name.startsWith('lookup:'))
		.reduce((sum, [, value]) => sum + value, 0);
}
