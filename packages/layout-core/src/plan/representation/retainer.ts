import type { CompiledSourceDelta } from '../../geometry/delta';
import {
	diffCompiledSources,
	forEachRetainedCompiledRoom,
	forEachRetainedCompiledWall,
} from '../../geometry/delta';
import { PersistentMap } from '../../kernel/persistent-store';
import { countWork } from '../../kernel/work-observer';
import type {
	CompiledLayoutGeometry,
	CompiledLayoutObject,
	CompiledOpening,
	CompiledPhysicalWall,
	CompiledRegion,
	CompiledRoom,
	LayoutBounds2,
} from '../../geometry/types';
import type { LayoutVec2 } from '../../geometry/coordinates';
import {
	accumulateBounds,
	emptyBounds,
	finishedBounds,
	objectCandidate,
	openingCandidate,
	regionCandidate,
	roomFloorCandidate,
	wallCandidatesOf,
	wallPeakHeight,
} from './geometry';
import type { MeasurementContext } from './membership';
import {
	PLAN_VIEWS,
	evaluateLayoutPlan,
	fragmentFor,
	fragmentIndexes,
	measureCandidate,
	measurementContext,
	membershipIndexes,
	parameterIssues,
	planDependsOnTarget,
	sourceMembership,
} from './membership';
import type {
	Candidate,
	PlanEvaluation,
	PlanEvaluationResult,
	PlanFragment,
	PlanMembershipReason,
	PlanParameters,
	PlanSourceContext,
	PlanSourceKind,
	PlanSourceMembership,
	PlanStream,
	PlanStreams,
	PlanSubRef,
	SourceExtent,
	SourcePlan,
} from './types';
import { PLAN_SOURCE_KINDS } from './types';

/* ------------------------------------------------------------------------- *
 * Incremental evaluation
 * ------------------------------------------------------------------------- */

/**
 * One candidate's measured placement, retained **independently of any generation**.
 *
 * This is the unit of reuse. Nothing here depends on the compile generation (only the
 * fragment's `ref` does), so a new generation — every accepted edit — reuses it and
 * recreates only the fragments. Nothing here depends on the parameters either, which is
 * why a parameter change re-derives and a geometry change does not.
 *
 * `extent` is kept although the fragment does not expose it: it is how the next
 * evaluation recognises that this placement is still the one the compiled record
 * describes, without re-deriving it (see `wallUnchanged` and friends).
 */
type PlanEntry = {
	readonly regionKey?: string;
	readonly reason: PlanMembershipReason;
	readonly subRef: PlanSubRef | null;
	readonly plan: SourcePlan;
	readonly extent: SourceExtent;
	readonly placement: { readonly stream: PlanStream; readonly elevationMeters: number } | null;
};

/** One source's retained derivation: its membership row and its placements. */
type SourceRecord = {
	readonly entries: readonly PlanEntry[];
	readonly membership: PlanSourceMembership;
	/** The reconciliation pass that last confirmed this record; duplicate detection only. */
	stamp: number;
};

type KindIndex = {
	/**
	 * Source ids in declared order — ascending by code unit.
	 *
	 * **Replaced, never mutated.** An assembled evaluation captures this array so its lazy
	 * getters can be read later; a `splice` in place would change what an already-returned
	 * plan sees. Copy-on-write shifts the same `O(S)` tail a `splice` would, so the cost is
	 * the same and the captured reference stays honest.
	 */
	ids: readonly string[];
	/**
	 * Derived records, in a persistent map so an assembled evaluation can capture the map
	 * with `fork` — `O(1)` — instead of copying one entry per source. The retainer keeps
	 * writing through its own handle; every fork keeps the root it was taken from.
	 */
	byId: PersistentMap<string, SourceRecord>;
};

/**
 * Two placements of one source, in the order the fragment comparator declares.
 *
 * Within a source every fragment shares its kind and id, so the interval is the whole
 * remaining order — which is why a source's placements can be sorted once, when they are
 * derived, instead of on every evaluation.
 */
function compareEntries(left: PlanEntry, right: PlanEntry): number {
	const leftStart = left.subRef?.kind === 'interval' ? left.subRef.start : 0;
	const rightStart = right.subRef?.kind === 'interval' ? right.subRef.start : 0;
	if (leftStart !== rightStart) return leftStart - rightStart;
	const leftEnd = left.subRef?.kind === 'interval' ? left.subRef.end : 0;
	const rightEnd = right.subRef?.kind === 'interval' ? right.subRef.end : 0;
	return leftEnd - rightEnd;
}

function compareCodeUnits(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

/** The index `id` occupies in a sorted id list, by binary search (`ids` stays sorted). */
function insertionPoint(ids: readonly string[], id: string): number {
	let low = 0;
	let high = ids.length;
	while (low < high) {
		const middle = (low + high) >>> 1;
		if (compareCodeUnits(ids[middle]!, id) < 0) low = middle + 1;
		else high = middle;
	}
	return low;
}

function samePoint(left: LayoutVec2, right: LayoutVec2): boolean {
	return left[0] === right[0] && left[1] === right[1];
}

function samePoints(left: readonly LayoutVec2[], right: readonly LayoutVec2[]): boolean {
	if (left === right) return true;
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		const a = left[index]!;
		const b = right[index]!;
		if (a[0] !== b[0] || a[1] !== b[1]) return false;
	}
	return true;
}

/**
 * Does a retained Wall still describe this compiled Wall?
 *
 * The comparison reads **exactly the fields the derivation reads** — the attributes a
 * source's placement is made of — so "unchanged" here means "re-deriving would produce
 * these same entries". It allocates nothing, which is the whole point: an untouched
 * source costs a handful of numeric comparisons instead of a candidate object, a measured
 * candidate, a membership row and a sort insertion.
 *
 * Spans are compared **by interval**, not by array position. The derivation sorts its
 * placements by interval (`compareEntries`), while `solidSpans` arrives in whatever order
 * the compiler emitted, so pairing index to index is only valid when the two orders agree.
 * When they do not, the positional pass fails and the interval-keyed pass decides — which
 * is why an untouched Wall is proved unchanged rather than re-derived. The positional pass
 * exists because it allocates nothing and is the common case.
 */
function wallUnchanged(
	entries: readonly PlanEntry[],
	wall: CompiledPhysicalWall,
	datumMeters: number,
): boolean {
	if (wall.solidSpans.length === 0) {
		// A solid-less Wall still has a **declared height**, and the derivation reads it
		// for the candidate's extent — which is what the depth window measures. Checking
		// only the (empty) plan geometry here would let a height change keep a stale
		// `reason` and `depthBelowCutMeters` on the membership row.
		const entry = entries[0];
		return (
			entries.length === 1 &&
			entry !== undefined &&
			entry.plan.kind === 'polyline' &&
			entry.extent.minY === datumMeters &&
			entry.extent.maxY === datumMeters + wallPeakHeight(wall)
		);
	}
	if (entries.length !== wall.solidSpans.length) return false;
	let positional = true;
	for (let index = 0; index < wall.solidSpans.length; index += 1) {
		if (!spanMatchesEntry(entries[index]!, wall.solidSpans[index]!, datumMeters)) {
			positional = false;
			break;
		}
	}
	if (positional) return true;
	// Same set, different order — or two spans that share an interval at different
	// elevations, which a Wall genuinely has where a lower and an upper solid start and end
	// together. Pair by the **whole derived placement** instead: interval, elevation and
	// plan points. Two spans agreeing on all three are interchangeable, so a bucket is not
	// a guess.
	const expected = new Map<string, number>();
	for (const span of wall.solidSpans) {
		const key = `${span.startDistance}|${span.endDistance}|${datumMeters + span.bottomY}|${datumMeters + span.topY}|${span.start[0]}|${span.start[1]}|${span.end[0]}|${span.end[1]}`;
		expected.set(key, (expected.get(key) ?? 0) + 1);
	}
	for (const entry of entries) {
		const plan = entry.plan;
		if (entry.subRef?.kind !== 'interval' || plan.kind !== 'span') return false;
		const key = `${entry.subRef.start}|${entry.subRef.end}|${entry.extent.minY}|${entry.extent.maxY}|${plan.start[0]}|${plan.start[1]}|${plan.end[0]}|${plan.end[1]}`;
		const remaining = expected.get(key) ?? 0;
		if (remaining === 0) return false;
		expected.set(key, remaining - 1);
	}
	return true;
}

/** Does this retained placement still describe that compiled span, field for field? */
function spanMatchesEntry(
	entry: PlanEntry,
	span: CompiledPhysicalWall['solidSpans'][number],
	datumMeters: number,
): boolean {
	if (
		entry.extent.minY !== datumMeters + span.bottomY ||
		entry.extent.maxY !== datumMeters + span.topY
	)
		return false;
	if (
		entry.subRef?.kind !== 'interval' ||
		entry.subRef.start !== span.startDistance ||
		entry.subRef.end !== span.endDistance
	)
		return false;
	const plan = entry.plan;
	return plan.kind === 'span' && samePoint(plan.start, span.start) && samePoint(plan.end, span.end);
}

function openingUnchanged(
	entries: readonly PlanEntry[],
	opening: CompiledOpening,
	datumMeters: number,
): boolean {
	if (entries.length !== 1) return false;
	const entry = entries[0]!;
	const plan = entry.plan;
	return (
		entry.extent.minY === datumMeters + opening.sillHeight &&
		entry.extent.maxY === datumMeters + opening.sillHeight + opening.height &&
		entry.subRef?.kind === 'interval' &&
		entry.subRef.start === opening.offset &&
		entry.subRef.end === opening.offset + opening.width &&
		plan.kind === 'polyline' &&
		samePoints(plan.polyline, opening.centerPolyline)
	);
}

function objectUnchanged(entries: readonly PlanEntry[], object: CompiledLayoutObject): boolean {
	if (entries.length !== 1) return false;
	const entry = entries[0]!;
	const plan = entry.plan;
	return (
		entry.extent.minY === object.worldAabb.min[1] &&
		entry.extent.maxY === object.worldAabb.max[1] &&
		entry.subRef === null &&
		plan.kind === 'polygon' &&
		samePoints(plan.polygon, object.planFootprint)
	);
}

function roomFloorUnchanged(entries: readonly PlanEntry[], room: CompiledRoom): boolean {
	if (entries.length !== 1) return false;
	const entry = entries[0]!;
	const plan = entry.plan;
	return (
		entry.extent.minY === room.floorElevation &&
		entry.extent.maxY === room.floorElevation &&
		entry.subRef === null &&
		plan.kind === 'polygon' &&
		samePoints(plan.polygon, room.floorPolygon)
	);
}

/** A retainer's handle; see `createPlanRetainer`. */
export type PlanRetainer = {
	/** The Plan for this compiled Layout, parameters and context — exactly what
	 * `evaluateLayoutPlan` returns, reusing the sources that did not change. */
	evaluate(
		compiled: CompiledLayoutGeometry,
		parameters: PlanParameters,
		context: PlanSourceContext,
	): PlanEvaluationResult;
	/** Drop every retained record; the next evaluation derives every source again. */
	clear(): void;
};

/**
 * Create an evaluator that retains what the previous evaluation derived.
 *
 * **Why this exists.** `evaluateLayoutPlan` is a pure function of the whole compiled
 * Layout: every call re-sorts every source id, re-measures every candidate and sorts
 * every fragment, so changing one Wall costs the same as changing all of them. That is
 * `O(N log N)` work for a `k = 1` edit, and it is the last whole-project term left in the
 * interaction path after the compiler stopped recompiling unaffected geometry.
 *
 * A retainer keeps, per source, the **derivation** (membership row and placements) rather
 * than the evaluation. The only per-generation work is the fragment objects themselves,
 * because each one carries the generation it was compiled at; that is a property of the
 * ratified correspondence, not of this implementation, so the materialized
 * `O(F)` fragment pass is a genuine floor and is charged exactly once per generation.
 *
 * **What it does per evaluation.**
 *
 * - *Nothing changed* — same derivation inputs, same generation, same compiled object —
 *  returns the retained result: `O(1)`. * - *New generation, same derivation inputs* (every accepted edit): asks the compiler's
 *  root difference which records changed and re-derives exactly those; with no provable
 *  difference it walks every source once instead. **No sort of any kind**: the declared
 *  order is maintained with the records, so the fragment array is produced by walking
 *  it, not by sorting into it — and it is produced only if someone reads it.
 * - *Parameters changed* (cut height, depth, lateral span, filter, reveal): re-derives
 *  every source — the order is still maintained, so nothing is sorted.
 * - *Source ids added or removed*: the id list is updated by binary-search insertion when
 *  a few ids change, and rebuilt (one sort) when many do.
 *
 * It remembers **one** derivation signature. A caller that alternates between two
 * parameter sets would re-derive on every call, so a host with genuinely interleaved
 * consumers should hold one retainer per set; the editor reads one set per evaluation.
 *
 * **What it cannot remove.** Without evidence, the walk over the compiled sources is
 * `Omega(N)`: proving that an untouched source really is untouched means reading it. It
 * does not ask that question when the compiler can answer it: `diffCompiledSources`
 * compares the two compiled snapshots' persistent roots, so an ordinary accepted edit
 * re-derives only the records whose identity changed and compares nothing. Everything
 * that difference cannot prove — a cold snapshot, an insertion or removal, an Opening
 * that changed host, a Room that stopped compiling, a hand-built geometry — falls back to
 * the complete walk, which is still allocation-free per source and still sorts nothing.
 * The output itself is produced on demand (see `assemble`), so an edit that is never
 * rendered costs neither the comparison walk nor the fragment pass.
 *
 * **Exactness.** This is not a second definition of the family. It uses the same
 * candidate builders, the same `measureCandidate`, the same `sourceMembership` and the
 * same `fragmentFor` as `evaluateLayoutPlan`; it differs only in *how it reaches the
 * declared order* (maintained, not sorted) and in *when it does the work* (on the source
 * that changed). Anything it cannot prove it reproduces — a source id shared by two
 * kinds, or duplicated within one — is handed to the reference evaluator and the retained
 * state is dropped, so a disagreement is impossible rather than unlikely.
 *
 * `compiled` is assumed immutable, like every other consumer of compiled geometry, and
 * the generation is assumed to describe the content it was compiled from (the host
 * already relies on both: it keys its own retention on the generation).
 */
export function createPlanRetainer(): PlanRetainer {
	let derivation: string | null = null;
	let generation: string | null = null;
	let retainedSource: WeakRef<CompiledLayoutGeometry> | null = null;
	let result: PlanEvaluationResult | null = null;
	let pass = 0;
	/** False when two Walls host the same Opening id, whose record is derived by first host. */
	let openingsAreUnique = true;
	const indexes = new Map<PlanSourceKind, KindIndex>();
	for (const kind of PLAN_SOURCE_KINDS) {
		indexes.set(kind, { ids: [], byId: PersistentMap.from<string, SourceRecord>([]) });
	}

	function clear(): void {
		derivation = null;
		generation = null;
		retainedSource = null;
		result = null;
		pass = 0;
		openingsAreUnique = true;
		for (const kind of PLAN_SOURCE_KINDS) {
			const index = indexes.get(kind)!;
			index.ids = [];
			// A fresh map, not a cleared one: evaluations already assembled keep the root
			// their own fork captured.
			index.byId = PersistentMap.from<string, SourceRecord>([]);
		}
	}

	/** The same compiled object as last time, when the runtime can still see it. */
	function sameSource(compiled: CompiledLayoutGeometry): boolean {
		return retainedSource !== null && retainedSource.deref() === compiled;
	}

	function rememberSource(compiled: CompiledLayoutGeometry): void {
		retainedSource = typeof WeakRef === 'function' ? new WeakRef(compiled) : null;
	}

	/**
	 * Reconcile one kind against its compiled records, in one walk.
	 *
	 * Returns the ids this pass added, or `null` when this kind cannot be reproduced
	 * incrementally — a source id appears twice in the kind, which the reference evaluator
	 * merges into one membership row and this retainer does not model.
	 */
	/** Derive one source's entries and membership row from its candidates, and retain it. */
	function derive(
		kind: PlanSourceKind,
		id: string,
		candidates: readonly Candidate[],
		measurement: MeasurementContext,
	): void {
		const measured = candidates.map((candidate) => measureCandidate(candidate, measurement));
		const entries: PlanEntry[] = measured.map((entry) => ({
			reason: entry.reason,
			regionKey: entry.candidate.regionKey,
			subRef: entry.candidate.subRef,
			plan: entry.candidate.plan,
			extent: entry.candidate.extent,
			placement: entry.placement,
		}));
		// Within one source every placement sorts by the same interval the fragment
		// comparator uses, so the maintained order is the declared order.
		entries.sort(compareEntries);
		indexes
			.get(kind)!
			.byId.set(id, { entries, membership: sourceMembership(id, measured), stamp: pass });
		countWork('plan:source-derived');
		countWork(`plan:source-derived:${kind}`);
	}

	function walkWalls(
		geometry: CompiledLayoutGeometry,
		visit: (wall: CompiledPhysicalWall) => void,
	): void {
		// The retained world iterates its persistent root in slot order — the same order as
		// `geometry.walls` — without allocating the legacy array. Hand-built snapshots have
		// no world, so they fall back to the array property.
		if (!forEachRetainedCompiledWall(geometry, visit))
			for (const wall of geometry.walls) visit(wall);
	}

	function walkRooms(geometry: CompiledLayoutGeometry, visit: (room: CompiledRoom) => void): void {
		if (!forEachRetainedCompiledRoom(geometry, visit))
			for (const room of geometry.rooms) visit(room);
	}

	function reconcileKind<T>(
		kind: PlanSourceKind,
		walk: (visit: (record: T) => void) => void,
		idOf: (record: T) => string,
		candidatesOf: (record: T) => readonly Candidate[],
		unchanged: (previous: readonly PlanEntry[], record: T) => boolean,
		measurement: MeasurementContext,
		rederive: boolean,
	): string[] | null {
		const index = indexes.get(kind)!;
		const walked: string[] = [];
		const fresh: string[] = [];
		let duplicate = false;
		walk((record) => {
			if (duplicate) return;
			const id = idOf(record);
			const previous = index.byId.get(id);
			// A second record with a source id this pass already confirmed: the reference
			// merges both into one row, which is not a shape this retainer models.
			if (previous !== undefined && previous.stamp === pass) {
				duplicate = true;
				return;
			}
			walked.push(id);
			// The cold/fallback path's own work: one comparison per compiled source. A proven
			// delta must report **zero** of these, which is what makes "the edit did not walk
			// its neighbours" a falsifiable count rather than a claim.
			countWork('plan:source-compared');
			if (previous !== undefined && !rederive && unchanged(previous.entries, record)) {
				previous.stamp = pass;
				return;
			}
			derive(kind, id, candidatesOf(record), measurement);
			if (previous === undefined) fresh.push(id);
		});
		if (duplicate) return null;

		// Records the walk did not confirm. `size` is read **after** the walk on purpose:
		// a fresh source's `derive` inserted into the same map, and it also appears in
		// `walked`, so the two cancel. Hoisting this above the walk would silently leak
		// stale ids and emit sources that no longer compile.
		const removed = index.byId.size - walked.length;
		if (fresh.length === 0 && removed === 0) return fresh;
		if (removed > 0) {
			const stale: string[] = [];
			for (const [id, record] of index.byId) if (record.stamp !== pass) stale.push(id);
			for (const id of stale) index.byId.delete(id);
		}
		// A few new ids are merged into the maintained order by binary-search insertion; a
		// structural change rebuilds it with the one sort this retainer ever performs. The
		// array is replaced rather than spliced: see `KindIndex.ids`.
		if (removed === 0 && fresh.length <= 8) {
			let ids = index.ids;
			for (const id of fresh) {
				const at = insertionPoint(ids, id);
				ids = [...ids.slice(0, at), id, ...ids.slice(at)];
			}
			index.ids = ids;
			return fresh;
		}
		index.ids = [...walked].sort(compareCodeUnits);
		return fresh;
	}

	/**
	 * Build the evaluation an interactive host receives: exact values, produced only when
	 * they are asked for.
	 *
	 * **Why the output is demand-driven.** The ratified output is the complete fragment,
	 * membership and bounds set, and a consumer that asks for it must get exactly that —
	 * `Omega(F)` fragments, each carrying the generation it was compiled at. What the
	 * editor's live path actually asks for on an accepted edit is much smaller: one
	 * selected source's fragment, one source's membership row, and (on a click) the
	 * eligible set. Producing the complete output eagerly charged every edit for what only
	 * a click or a panel needed. The getters below keep the contract exactly as it is and
	 * move the cost to whoever reads it, which is the difference between "the output is
	 * `Omega(F)`" (true, and unavoidable) and "an edit must produce it" (false).
	 *
	 * **Why the sources are captured.** The getters run later than this function, possibly
	 * after the retainer has evaluated a newer generation. They therefore read a snapshot —
	 * each kind's id array (already replaced, never mutated) and a fork of its persistent
	 * record map (`O(1)`, sharing the root) — and never the retainer's live index. Without
	 * that, holding one plan across a later evaluation would materialize the *newer*
	 * sources under the *older* generation, which is exactly the kind of quiet divergence
	 * this file exists to avoid.
	 */
	function assemble(
		parameters: PlanParameters,
		context: PlanSourceContext,
		measurement: MeasurementContext,
	): PlanEvaluation {
		let membershipRows: PlanSourceMembership[] | null = null;
		let fragmentRows: PlanFragment[] | null = null;
		let streamRows: PlanStreams | null = null;
		let unmatched: string[] | null = null;
		let bounds: LayoutBounds2 | null = null;
		let boundsReady = false;
		const firstFragment = new Map<string, PlanFragment>();

		// This evaluation's sources, captured now: see the doc block above.
		const sources = PLAN_SOURCE_KINDS.map((kind) => {
			const index = indexes.get(kind)!;
			return { kind, ids: index.ids, byId: index.byId.fork() };
		});

		// Kinds in declared order, ids in ascending order, placements in interval order:
		// the maintained order *is* the order a whole-population sort would produce.
		const eachSource = (
			visit: (kind: PlanSourceKind, id: string, record: SourceRecord) => void,
		): void => {
			for (const source of sources) {
				for (const id of source.ids) {
					const record = source.byId.get(id);
					if (record !== undefined) visit(source.kind, id, record);
				}
			}
		};

		const fragmentOf = (sourceId: string): PlanFragment | undefined => {
			const cached = firstFragment.get(sourceId);
			if (cached !== undefined) return cached;
			for (const source of sources) {
				const record = source.byId.get(sourceId);
				if (record === undefined) continue;
				for (const entry of record.entries) {
					const placement = entry.placement;
					if (placement === null) continue;
					const fragment = fragmentFor(
						context.generationId,
						sourceId,
						source.kind,
						entry.subRef,
						entry.plan,
						placement.stream,
						record.membership.reason,
						placement.elevationMeters,
					);
					firstFragment.set(sourceId, fragment);
					return fragment;
				}
				return undefined;
			}
			return undefined;
		};

		const plan: PlanEvaluation = {
			generationId: context.generationId,
			datumMeters: context.datumMeters,
			cutHeightMeters: parameters.cutHeightMeters,
			cutElevationMeters: measurement.cutElevation,
			depthMeters: parameters.depthMeters,
			lateralSpanHalfWidthMeters: parameters.lateralSpanHalfWidthMeters,
			target: context.target,
			sourceKindFilter:
				parameters.sourceKindFilter === null ? null : [...parameters.sourceKindFilter],
			reveal: [...parameters.reveal],
			get streams(): PlanStreams {
				if (streamRows === null) {
					const all = plan.fragments;
					streamRows = {
						cut: all.filter((fragment) => fragment.ref.stream === 'cut'),
						projected: all.filter((fragment) => fragment.ref.stream === 'projected'),
						hidden: all.filter((fragment) => fragment.ref.stream === 'hidden'),
						symbol: all.filter((fragment) => fragment.ref.stream === 'symbol'),
					};
				}
				return streamRows;
			},
			get fragments(): readonly PlanFragment[] {
				if (fragmentRows !== null) return fragmentRows;
				const rows: PlanFragment[] = [];
				// Which sources already contributed a row, so a source's **first** placement can
				// adopt the object `planFragmentOf` may already have handed out, while its other
				// placements still get their own fragment.
				const emitted = new Set<string>();
				eachSource((kind, id, record) => {
					for (const entry of record.entries) {
						const placement = entry.placement;
						if (placement === null) continue;
						const first = !emitted.has(id);
						emitted.add(id);
						const known = first ? firstFragment.get(id) : undefined;
						const fragment =
							known ??
							fragmentFor(
								context.generationId,
								id,
								kind,
								entry.subRef,
								entry.plan,
								placement.stream,
								record.membership.reason,
								placement.elevationMeters,
							);
						if (first) firstFragment.set(id, fragment);
						rows.push(fragment);
					}
				});
				fragmentRows = rows;
				fragmentIndexes.set(rows, firstFragment);
				countWork('plan:output-fragments', rows.length);
				return rows;
			},
			get membership(): readonly PlanSourceMembership[] {
				if (membershipRows !== null) return membershipRows;
				const rows: PlanSourceMembership[] = [];
				const bySource = new Map<string, PlanSourceMembership>();
				eachSource((_kind, id, record) => {
					rows.push(record.membership);
					bySource.set(id, record.membership);
				});
				membershipRows = rows;
				membershipIndexes.set(rows, bySource);
				countWork('plan:output-membership', rows.length);
				return rows;
			},
			get unmatchedRevealIds(): readonly string[] {
				if (unmatched === null) {
					unmatched = [];
					for (const id of measurement.reveal) {
						const hosted = sources.some((source) => source.byId.has(id));
						if (!hosted) unmatched.push(id);
					}
					unmatched.sort();
				}
				return unmatched;
			},
			get bounds(): LayoutBounds2 | null {
				if (!boundsReady) {
					const state = emptyBounds();
					eachSource((_kind, _id, record) => {
						for (const entry of record.entries)
							if (entry.placement !== null) accumulateBounds(state, entry.plan);
					});
					bounds = finishedBounds(state);
					boundsReady = true;
				}
				return bounds;
			},
		};
		PLAN_VIEWS.set(plan, {
			fragmentOf,
			membershipOf(sourceId) {
				for (const source of sources) {
					const record = source.byId.get(sourceId);
					if (record !== undefined) return record.membership;
				}
				return null;
			},
		});
		return plan;
	}

	/** The compiler's own delta, when it can prove one; `null` means "walk everything". */
	function deltaOf(compiled: CompiledLayoutGeometry): CompiledSourceDelta | null {
		const previous = retainedSource === null ? undefined : retainedSource.deref();
		if (previous === undefined || previous === compiled) return null;
		return diffCompiledSources(previous, compiled) ?? null;
	}

	/**
	 * Apply a proven delta: re-derive exactly the records it names, and nothing else.
	 *
	 * Returns `false` when the delta does not fit the retained source set — an id the
	 * retainer does not host, or an Opening whose first host is not the Wall that changed.
	 * **It validates before it mutates**: a delta that will be refused derives nothing, so
	 * the caller's complete walk starts from the records the delta would have left behind
	 * untouched. (A partial apply would be harmless for output — the walk compares against
	 * whatever it finds — but its own `stamp` bookkeeping would read as a duplicate id and
	 * throw the retention away.)
	 */
	function applyDelta(
		delta: CompiledSourceDelta,
		measurement: MeasurementContext,
		datumMeters: number,
	): boolean {
		if (!openingsAreUnique) return false;
		const walls = indexes.get('wall')!.byId;
		const openings = indexes.get('opening')!.byId;
		const rooms = indexes.get('room-floor')!.byId;
		const objects = indexes.get('object')!.byId;

		// 1. Validate. Nothing is derived until every source the delta names is proved to be
		// one this retainer hosts — a refusal must leave the retained state as it was.
		for (const wall of delta.walls) {
			if (!walls.has(wall.wallId)) return false;
			for (const opening of wall.openings) if (!openings.has(opening.openingId)) return false;
		}
		for (const room of delta.rooms) if (!rooms.has(room.roomId)) return false;
		if (delta.objects !== null)
			for (const object of delta.objects) if (!objects.has(object.objectId)) return false;

		// 2. Derive exactly what the records say changed.
		for (const wall of delta.walls) {
			derive('wall', wall.wallId, wallCandidatesOf(wall, datumMeters), measurement);
			// A Wall record changing does not mean its Openings changed: they are their own
			// compiled records, and the Plan's derivation reads their own fields. Deriving
			// every Opening of a changed Wall would make a Wall's height charge its neighbours'
			// windows for no reason, so the same per-source predicate the fallback uses decides.
			for (const opening of wall.openings) {
				const retained = openings.get(opening.openingId)!;
				if (!openingUnchanged(retained.entries, opening, datumMeters)) {
					derive(
						'opening',
						opening.openingId,
						[openingCandidate(opening, datumMeters)],
						measurement,
					);
				}
			}
		}
		for (const room of delta.rooms) {
			// A Room's compiled record embeds the bounds of the Walls around it, so a Wall edit
			// replaces it without necessarily changing what the Plan reads from it.
			if (!roomFloorUnchanged(rooms.get(room.roomId)!.entries, room)) {
				derive('room-floor', room.roomId, [roomFloorCandidate(room)], measurement);
			}
		}
		if (delta.objects !== null) {
			// The delta names exactly the object records whose reference the rebuild
			// replaced, and the compiler proved the unit's ids are unchanged in order, so
			// every other object's retained derivation still describes that same record.
			for (const object of delta.objects) {
				derive('object', object.objectId, [objectCandidate(object)], measurement);
			}
		}
		countWork('plan:source-delta-applied');
		return true;
	}

	/** The complete walk: the cold path, and the fallback whenever a delta is not proven. */
	function reconcileAll(
		compiled: CompiledLayoutGeometry,
		measurement: MeasurementContext,
		rederive: boolean,
	): boolean {
		const openingList: CompiledOpening[] = [];
		const openingIds = new Set<string>();
		openingsAreUnique = true;
		walkWalls(compiled, (wall) => {
			for (const opening of wall.openings) {
				if (openingIds.has(opening.openingId)) {
					openingsAreUnique = false;
					continue;
				}
				openingIds.add(opening.openingId);
				openingList.push(opening);
			}
		});
		const walls = reconcileKind<CompiledPhysicalWall>(
			'wall',
			(visit) => walkWalls(compiled, visit),
			(wall) => wall.wallId,
			(wall) => wallCandidatesOf(wall, measurement.datumMeters),
			(previous, wall) => wallUnchanged(previous, wall, measurement.datumMeters),
			measurement,
			rederive,
		);
		const openingsAdded =
			walls === null
				? null
				: reconcileKind<CompiledOpening>(
						'opening',
						(visit) => {
							for (const opening of openingList) visit(opening);
						},
						(opening) => opening.openingId,
						(opening) => [openingCandidate(opening, measurement.datumMeters)],
						(previous, opening) => openingUnchanged(previous, opening, measurement.datumMeters),
						measurement,
						rederive,
					);
		const objectsAdded =
			openingsAdded === null
				? null
				: reconcileKind<CompiledLayoutObject>(
						'object',
						(visit) => {
							for (const object of compiled.objects) visit(object);
						},
						(object) => object.objectId,
						(object) => [objectCandidate(object)],
						objectUnchanged,
						measurement,
						rederive,
					);
		const roomsAdded =
			objectsAdded === null
				? null
				: reconcileKind<CompiledRoom>(
						'room-floor',
						(visit) => walkRooms(compiled, visit),
						(room) => room.roomId,
						(room) => [roomFloorCandidate(room)],
						roomFloorUnchanged,
						measurement,
						rederive,
					);
		const regionsAdded =
			roomsAdded === null
				? null
				: reconcileKind<CompiledRegion>(
						'region',
						(visit) => compiled.regions.forEach(visit),
						(region) => region.regionId,
						(region) => [regionCandidate(region)],
						(entries, region) => entries[0]?.regionKey === region.cacheKey,
						measurement,
						rederive,
					);
		// A source id shared by two kinds is merged into one membership row by the
		// reference and by nothing else; ask it rather than modelling that here.
		const addedIds = [
			...(walls ?? []),
			...(openingsAdded ?? []),
			...(objectsAdded ?? []),
			...(roomsAdded ?? []),
			...(regionsAdded ?? []),
		];
		return (
			regionsAdded !== null &&
			!addedIds.some((id) => {
				let kinds = 0;
				for (const kind of PLAN_SOURCE_KINDS) if (indexes.get(kind)!.byId.has(id)) kinds += 1;
				return kinds > 1;
			})
		);
	}

	return {
		evaluate(compiled, parameters, context) {
			const issues = parameterIssues(parameters, context);
			if (issues.length > 0) {
				const invalidContext = issues.every((issue) => issue.path.startsWith('$.context'));
				return {
					kind: 'refused',
					code: invalidContext ? 'invalid-context' : 'invalid-parameters',
					issues,
				};
			}

			// Everything the derivation reads, in one unambiguous string. The generation is
			// deliberately absent: a new generation changes the fragments, never a derivation.
			const nextDerivation = JSON.stringify([
				context.datumMeters,
				parameters.cutHeightMeters,
				parameters.depthMeters,
				parameters.lateralSpanHalfWidthMeters,
				parameters.sourceKindFilter,
				parameters.reveal,
				planDependsOnTarget(parameters) ? context.target : null,
			]);
			if (
				result !== null &&
				generation === context.generationId &&
				derivation === nextDerivation &&
				sameSource(compiled)
			) {
				return result;
			}

			pass += 1;
			const measurement = measurementContext(parameters, context);
			const rederive = derivation !== nextDerivation;
			// Ask the compiler's persistent roots first. Their answer is a difference between
			// two proven roots — not a caller's claim about which entities are dirty — and
			// `null` means "cannot prove it", which is the complete walk below.
			const delta = rederive ? null : deltaOf(compiled);
			const applied = delta !== null && applyDelta(delta, measurement, measurement.datumMeters);
			if (!applied && !reconcileAll(compiled, measurement, rederive)) {
				clear();
				return evaluateLayoutPlan(compiled, parameters, context);
			}

			const evaluated: PlanEvaluationResult = {
				kind: 'evaluated',
				plan: assemble(parameters, context, measurement),
			};
			derivation = nextDerivation;
			generation = context.generationId;
			rememberSource(compiled);
			result = evaluated;
			return evaluated;
		},
		clear,
	};
}
