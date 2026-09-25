import type {
	BenchInteractionBoundary,
	BenchInteractionOutcome,
	BenchInteractionPath,
	P23BActionLedger,
	P23BCaptureLedger
} from './bench-types';

/**
 * P23B measurement-only step — action containment (DEV harness).
 *
 * THE DEFECT THIS EXISTS FOR. The existing `p2311:*` component marks are
 * collected with `performance.getEntriesByType('measure')` and reported pooled
 * per fixture session (`nestedMarks`), so "mesh-prebuild 89.6 ms p50" is a
 * number with no action attached to it: it may span rigid edits, bends,
 * authoring clicks and warm-up alike, and `markNestingNote` forbids summing
 * those pooled distributions. This module binds every mark to the action and
 * outcome whose own boundary interval encloses it, so the marks become a
 * containment tree per action instead of a session-wide pool.
 *
 * THREE RULES, each stated because it is what makes the tree honest:
 *
 * 1. CONTAINMENT, NOT PROXIMITY. A mark belongs to an action only when its own
 *    `[startTime, startTime + duration]` interval is inside one of that action's
 *    recorded boundary intervals. Nothing is attributed by "the action that was
 *    open at the time": an action boundary carries the origin rule the method
 *    version already enforces (`input`/`release` are synchronous, `svelte-flush`
 *    and `browser-frame` start where that synchronous input ended), so a mark
 *    inside a boundary is genuinely inside the work that boundary measured.
 *
 * 2. NEVER SUMMED. Every reported value is a distribution over actions (count /
 *    p50 / p95) or one action's own tree. No two node totals are ever added
 *    together to make a bigger number, and a parent's total is never reported as
 *    the sum of its children.
 *
 * 3. TWO VISIBLE REMAINDERS. A mark inside an action's span but outside all of
 *    its boundaries is reported as `unbound` on that action rather than being
 *    quietly folded into `input` or dropped. A mark outside every action's span
 *    is reported in the record's `unattributed` pool, named and counted, never
 *    guessed into the nearest action.
 *
 * Exclusive time is reported only where containment actually holds: a node's
 * `self` is `total - sum(children totals)` when its children are pairwise
 * disjoint and each is fully inside it, and `null` with a stated reason
 * otherwise. A `self` of `null` is a fact about the marks, not a missing number.
 */

/** One `performance.measure` entry, as the DEV harness reads it. */
export type P23BMarkEntry = { name: string; startTime: number; duration: number };

export type P23BContainmentNode = {
	/** `boundary` for one of the action's own measured boundaries, `mark` for a nested `p2311:` mark. */
	kind: 'boundary' | 'mark';
	label: string;
	start: number;
	end: number;
	total: number;
	/** `total` minus the enclosed children's totals; `null` when containment does not hold. */
	self: number | null;
	/** Why `self` is `null`. Never present when `self` is a number. */
	selfUnavailable: string | null;
	children: P23BContainmentNode[];
};

export type P23BContainmentAction = {
	index: number;
	path: BenchInteractionPath;
	outcome: BenchInteractionOutcome;
	start: number;
	end: number;
	roots: P23BContainmentNode[];
	/** Marks inside this action's span that no boundary of it encloses, in time order. */
	unbound: P23BMarkEntry[];
	/**
	 * Attachments whose two intervals are IDENTICAL, so which one encloses which is
	 * not decidable from timestamps. Reported instead of being silently decided:
	 * a nesting that cannot be established cannot be used to price anything.
	 */
	ambiguous: { mark: string; node: string }[];
};

export type P23BContainmentSummary = { count: number; p50: number; p95: number };
export type P23BContainmentNodeSummary = {
	/**
	 * Distribution of this node's totals over every OCCURRENCE in the group. A mark
	 * that fires twice inside one action contributes two values here, so this count
	 * is occurrences, not actions.
	 */
	total: P23BContainmentSummary;
	/** Group actions in which this label occurred at least once. */
	actionsPresent: number;
	/** Most occurrences of this label inside any one action — `> 1` means `total` mixes repeats. */
	maxPerAction: number;
	/**
	 * Distribution of exclusive time, reported ONLY where every occurrence in the
	 * group could be exclusive-priced — so `self` always describes the same
	 * population as `total`. Where any occurrence could not, this is `null` and
	 * `selfWithheld` says how many, rather than reporting a p50 taken over a
	 * different (smaller) set of occurrences than the `total` beside it.
	 */
	self: P23BContainmentSummary | null;
	selfWithheld: string | null;
};

export type P23BContainmentRecord = {
	/** Stated on every record so a reader cannot mistake it for a summed breakdown. */
	note: string;
	/** Total marks offered to the builder, and how many found a home. */
	marks: { observed: number; attributed: number; unbound: number; unattributed: number };
	actions: P23BContainmentAction[];
	/** Marks outside every action span. Pooled by name; never attributed to an action. */
	unattributed: ({ name: string } & P23BContainmentSummary & { totalMs: number })[];
};

export type P23BContainmentByPath = Partial<
	Record<
		BenchInteractionPath,
		{
			/** Actions this group's distributions are taken over, after the report's own exclusions. */
			actions: number;
			/** Leading actions dropped as warm-up, per path, exactly as the interaction report does. */
			warmupExcluded: number;
			/** Actions dropped because their outcome was not in the requested set. */
			excludedByOutcome: number;
			/** Per nested-mark distribution over the group's occurrences. */
			nodes: Record<string, P23BContainmentNodeSummary>;
			/** Per boundary distribution (the group's own measured boundaries, same population). */
			boundaries: Record<string, P23BContainmentNodeSummary>;
			/** Marks inside the action but outside its boundaries, per name. */
			unbound: Record<string, P23BContainmentSummary>;
		}
	>
>;

/**
 * The interaction report's own population rule, applied to containment: leading
 * warm-up actions per path are excluded, and only the requested outcomes are
 * reported. Without it a containment number would describe a different
 * population than the boundary numbers beside it in the same record.
 */
export type P23BContainmentPopulation = {
	warmup?: number;
	outcomes?: readonly BenchInteractionOutcome[];
};

const NOTE =
	'Containment, not a breakdown: each mark is attached to the single action boundary interval that encloses it, exclusive time is reported only where children are disjoint and fully contained, and no two distributions in this record may be summed (see markNestingNote). Numbers are advisory — one machine, one session.';

/**
 * Build one containment record from a capture ledger plus the `p2311:` marks
 * observed while it ran. Pure: the caller reads the entries, this decides what
 * they belong to.
 *
 * `p2311:p23b:*` measures are the interaction's OWN boundary marks and are
 * ignored here — the ledger already carries those boundaries with their true
 * origin, and reading them twice would double-count the same work.
 */
export function buildP23BContainment(
	ledger: P23BCaptureLedger,
	entries: readonly P23BMarkEntry[]
): P23BContainmentRecord {
	const nested = entries.filter(
		(entry) => entry.name.startsWith('p2311:') && !entry.name.startsWith('p2311:p23b:')
	);
	const consumed = new Set<P23BMarkEntry>();
	const actions: P23BContainmentAction[] = [];

	for (const action of ledger.actions) {
		if (action.status !== 'completed' || action.path === null) continue;
		const boundaries = action.samples.filter(isInterval);
		if (boundaries.length === 0) continue;
		const start = Math.min(...boundaries.map((sample) => sample.start as number));
		const end = Math.max(...boundaries.map((sample) => sample.end as number));
		const inside = nested.filter(
			(entry) => entry.startTime >= start && entry.startTime + entry.duration <= end
		);
		const roots = buildBoundaryForest(boundaries);
		const unbound: P23BMarkEntry[] = [];
		const ambiguous: { mark: string; node: string }[] = [];
		for (const entry of inside) {
			const home = innermostNode(roots, entry);
			if (!home) {
				unbound.push(entry);
				continue;
			}
			// Identical bounds mean the two measures are indistinguishable in time:
			// the parent/child choice below is then an artifact of read order, so it is
			// reported rather than relied on.
			if (home.start === entry.startTime && home.end === entry.startTime + entry.duration) {
				ambiguous.push({ mark: entry.name, node: home.label });
			}
			home.children.push({
				kind: 'mark',
				label: entry.name,
				start: entry.startTime,
				end: entry.startTime + entry.duration,
				total: entry.duration,
				self: entry.duration,
				selfUnavailable: null,
				children: []
			});
			consumed.add(entry);
		}
		for (const node of walk(roots)) finalizeSelf(node);
		for (const node of walk(roots)) node.children.sort((a, b) => a.start - b.start);
		unbound.sort((a, b) => a.startTime - b.startTime);
		actions.push({
			index: action.index,
			path: action.path,
			outcome: action.outcome ?? 'unclassified',
			start,
			end,
			roots,
			unbound,
			ambiguous
		});
	}

	const leftover = nested.filter((entry) => !consumed.has(entry) && !actions.some((action) => insideAction(action, entry)));
	return {
		note: NOTE,
		marks: {
			observed: nested.length,
			attributed: consumed.size,
			unbound: actions.reduce((count, action) => count + action.unbound.length, 0),
			unattributed: leftover.length
		},
		actions,
		unattributed: summarizeMarks(leftover)
	};
}

/**
 * Group a record's per-action trees by path and report distributions. This is
 * the only aggregation: a mark's p50 over many actions, never a total that
 * pretends independent work adds up.
 */
export function summarizeContainmentByPath(
	record: P23BContainmentRecord,
	population: P23BContainmentPopulation = {}
): P23BContainmentByPath {
	const byPath: P23BContainmentByPath = {};
	const totals = new Map<string, Map<string, number[]>>();
	const selves = new Map<string, Map<string, number[]>>();
	const boundaryTotals = new Map<string, Map<string, number[]>>();
	const boundarySelves = new Map<string, Map<string, number[]>>();
	const unboundTotals = new Map<string, Map<string, number[]>>();
	/** Occurrences per label inside one action, so repeats are visible and never silently pooled. */
	const occurrencesPerAction = new Map<string, Map<string, number[]>>();
	const selfWithheldCounts = new Map<string, Map<string, number>>();
	const counts = new Map<BenchInteractionPath, { used: number; warmup: number; outcome: number }>();
	const seen = new Map<BenchInteractionPath, number>();
	const warmup = Math.max(0, population.warmup ?? 0);

	for (const action of record.actions) {
		const index = seen.get(action.path) ?? 0;
		seen.set(action.path, index + 1);
		const countsForPath = counts.get(action.path) ?? { used: 0, warmup: 0, outcome: 0 };
		if (index < warmup) {
			countsForPath.warmup += 1;
			counts.set(action.path, countsForPath);
			continue;
		}
		if (population.outcomes && !population.outcomes.includes(action.outcome)) {
			countsForPath.outcome += 1;
			counts.set(action.path, countsForPath);
			continue;
		}
		countsForPath.used += 1;
		counts.set(action.path, countsForPath);
		const labelsThisAction = new Map<string, number>();
		for (const node of walk(action.roots)) {
			const target = node.kind === 'mark' ? totals : boundaryTotals;
			const selfTarget = node.kind === 'mark' ? selves : boundarySelves;
			push(target, action.path, node.label, node.total);
			labelsThisAction.set(node.label, (labelsThisAction.get(node.label) ?? 0) + 1);
			if (node.self !== null) push(selfTarget, action.path, node.label, node.self);
			else increment(selfWithheldCounts, action.path, node.label);
		}
		for (const [label, occurrences] of labelsThisAction) {
			push(occurrencesPerAction, action.path, label, occurrences);
		}
		for (const entry of action.unbound) push(unboundTotals, action.path, entry.name, entry.duration);
	}

	for (const [path, pathCounts] of counts) {
		const nodes: Record<string, P23BContainmentNodeSummary> = {};
		for (const [label, values] of totals.get(path) ?? []) {
			const selfValues = selves.get(path)?.get(label) ?? [];
			const withheld = selfWithheldCounts.get(path)?.get(label) ?? 0;
			const perAction = occurrencesPerAction.get(path)?.get(label) ?? [];
			nodes[label] = {
				total: summarize(values),
				actionsPresent: perAction.length,
				maxPerAction: perAction.length > 0 ? Math.max(...perAction) : 0,
				self: withheld === 0 && selfValues.length === values.length ? summarize(selfValues) : null,
				selfWithheld:
					withheld === 0
						? null
						: `${withheld} of ${values.length} occurrences could not be exclusive-priced (overlapping contained marks)`
			};
		}
		const boundaries: Record<string, P23BContainmentNodeSummary> = {};
		for (const [label, values] of boundaryTotals.get(path) ?? []) {
			const selfValues = boundarySelves.get(path)?.get(label) ?? [];
			const withheld = selfWithheldCounts.get(path)?.get(label) ?? 0;
			const perAction = occurrencesPerAction.get(path)?.get(label) ?? [];
			boundaries[label] = {
				total: summarize(values),
				actionsPresent: perAction.length,
				maxPerAction: perAction.length > 0 ? Math.max(...perAction) : 0,
				self: withheld === 0 && selfValues.length === values.length ? summarize(selfValues) : null,
				selfWithheld:
					withheld === 0
						? null
						: `${withheld} of ${values.length} occurrences could not be exclusive-priced (overlapping contained marks)`
			};
		}
		const unbound: Record<string, P23BContainmentSummary> = {};
		for (const [label, values] of unboundTotals.get(path) ?? []) unbound[label] = summarize(values);
		byPath[path] = {
			actions: pathCounts.used,
			warmupExcluded: pathCounts.warmup,
			excludedByOutcome: pathCounts.outcome,
			nodes,
			boundaries,
			unbound
		};
	}
	return byPath;
}

/** Percentile used everywhere in this record (nearest-rank, upper). */
export function percentile(values: readonly number[], pct: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * pct) - 1)] ?? 0;
}

type Interval = { boundary: BenchInteractionBoundary; duration: number; start: number; end: number };

function isInterval(sample: P23BActionLedger['samples'][number]): sample is P23BActionLedger['samples'][number] & Interval {
	return typeof sample.start === 'number' && typeof sample.end === 'number';
}

/** The action's own boundaries as a forest, ordered as the ledger recorded them. */
function buildBoundaryForest(samples: readonly Interval[]): P23BContainmentNode[] {
	const nodes: P23BContainmentNode[] = samples.map((sample) => ({
		kind: 'boundary',
		label: sample.boundary,
		start: sample.start,
		end: sample.end,
		total: Math.max(0, sample.end - sample.start),
		self: null,
		selfUnavailable: null,
		children: []
	}));
	// Smallest enclosing interval wins, so `reactive` inside `release` is a child
	// of `release` rather than of the press that scheduled it.
	const roots: P23BContainmentNode[] = [];
	for (const node of [...nodes].sort((a, b) => a.start - b.start || b.end - a.end)) {
		const parent = innermostNode(roots, { name: node.label, startTime: node.start, duration: node.total });
		if (parent) parent.children.push(node);
		else roots.push(node);
	}
	return roots;
}

/** The smallest node interval containing the given mark, or `null`. */
function innermostNode(nodes: readonly P23BContainmentNode[], mark: P23BMarkEntry): P23BContainmentNode | null {
	let best: P23BContainmentNode | null = null;
	const visit = (list: readonly P23BContainmentNode[]): void => {
		for (const node of list) {
			if (contains(node, mark)) {
				if (!best || node.total < best.total) best = node;
				visit(node.children);
			}
		}
	};
	visit(nodes);
	return best;
}

function contains(node: P23BContainmentNode, mark: P23BMarkEntry): boolean {
	return mark.startTime >= node.start && mark.startTime + mark.duration <= node.end;
}

/**
 * Exclusive time, or an explicit refusal. The condition is stated rather than
 * assumed: children must be pairwise disjoint and each fully inside the parent.
 * Two marks that merely overlap in time cannot both be subtracted from it.
 */
function finalizeSelf(node: P23BContainmentNode): void {
	if (node.children.length === 0) {
		node.self = node.total;
		node.selfUnavailable = null;
		return;
	}
	const ordered = [...node.children].sort((a, b) => a.start - b.start || a.end - b.end);
	for (let index = 0; index < ordered.length; index += 1) {
		const child = ordered[index]!;
		if (child.start < node.start || child.end > node.end) {
			node.self = null;
			node.selfUnavailable = `contained mark ${child.label} is not fully inside ${node.label}`;
			return;
		}
		const previous = ordered[index - 1];
		if (previous && child.start < previous.end) {
			node.self = null;
			node.selfUnavailable = `contained marks ${previous.label} and ${child.label} overlap inside ${node.label}`;
			return;
		}
	}
	const children = ordered.reduce((sum, child) => sum + child.total, 0);
	node.self = Math.max(0, node.total - children);
	node.selfUnavailable = null;
}

function* walk(nodes: readonly P23BContainmentNode[]): Generator<P23BContainmentNode> {
	for (const node of nodes) {
		yield node;
		yield* walk(node.children);
	}
}

function insideAction(action: P23BContainmentAction, mark: P23BMarkEntry): boolean {
	return mark.startTime >= action.start && mark.startTime + mark.duration <= action.end;
}

function summarizeMarks(entries: readonly P23BMarkEntry[]): P23BContainmentRecord['unattributed'] {
	const groups = new Map<string, number[]>();
	for (const entry of entries) {
		const values = groups.get(entry.name) ?? [];
		values.push(entry.duration);
		groups.set(entry.name, values);
	}
	return [...groups]
		.map(([name, values]) => ({
			name,
			...summarize(values),
			totalMs: values.reduce((sum, value) => sum + value, 0)
		}))
		.sort((a, b) => b.p50 - a.p50);
}

function push(
	target: Map<string, Map<string, number[]>>,
	path: string,
	label: string,
	value: number
): void {
	const byLabel = target.get(path) ?? new Map<string, number[]>();
	const values = byLabel.get(label) ?? [];
	values.push(value);
	byLabel.set(label, values);
	target.set(path, byLabel);
}

function increment(target: Map<string, Map<string, number>>, path: string, label: string): void {
	const byLabel = target.get(path) ?? new Map<string, number>();
	byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
	target.set(path, byLabel);
}

function summarize(values: readonly number[]): P23BContainmentSummary {
	return { count: values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95) };
}
