/**
 * Pre-P23B.8 follow-up — M1 record builder (DEV only, pure).
 *
 * One M1 session per runtime produces ONE record. This module decides what that
 * record says; the harness page only collects inputs and the CDP runner only
 * adds the presentation-grade section. Everything here is pure, so the rows the
 * record reports are pinned by unit tests instead of by the capture.
 *
 * THREE RULES ARE ENFORCED HERE, because they are what make M1's numbers
 * readable rather than merely present:
 *
 * 1. ONE POPULATION. A class's boundary rows, mark rows and release spans are all
 *    taken over the same actions: completed actions with a resolved path, the
 *    leading warm-up excluded per path, accepted outcomes only — exactly the
 *    interaction report's own rule. A mark p50 and the boundary p50 beside it
 *    therefore describe the same actions.
 *
 * 2. KEYED, SELF-ONLY-WHERE-PRICEABLE. Mark and boundary rows use the S7 keyed
 *    shape and take their exclusive time from the containment record's own rule
 *    (reported only when every occurrence in the class can be exclusive-priced),
 *    so nothing is summed across nodes and a withheld self is visible.
 *
 * 3. EVERY ROW CARRIES ITS SIGNAL AND ITS COVERAGE. The release-side row is the
 *    existing `browser-frame` PROXY unless a presentation-grade signal is
 *    present, and it states how many releases it covers. The gesture row states
 *    its frame count, its drag count and how many frames fell inside the
 *    product's pointermove windows. The long-frame row states its release
 *    coverage and whether the runtime reported the entry type at all.
 */
import {
	summarizeContainmentByPath,
	type P23BContainmentNodeSummary,
	type P23BContainmentRecord
} from '$lib/bench/p23b-containment';
import type {
	BenchInteractionOutcome,
	BenchInteractionPath,
	P23BActionLedger,
	P23BCaptureLedger
} from '$lib/bench/bench-types';
import {
	P23B_M1_LONG_FRAME_DEFINITION,
	P23B_M1_PRESENTED_FRAME_DEFINITION,
	P23B_M1_RELEASE_PROXY_DEFINITION,
	type P23BM1GestureFrameSeries,
	type P23BM1IntervalSeries,
	type P23BM1LongFrameEntry,
	type P23BM1LongFrameSummary,
	summarizeIntervals,
	summarizeLongFrames
} from '$lib/bench/p23b-m1-frame-timing';

/** The S7 keyed row: named fields, exclusive time only where it is priceable. */
export type P23BM1KeyedRow = {
	count: number;
	p50: number;
	p95: number;
	exclusiveSelf: { count: number; p50: number; p95: number } | null;
	/** Why exclusive self is withheld; the containment record's own stated reason. */
	exclusiveSelfWithheld: string | null;
	/** Occurrences of this label inside one action, at most. `> 1` means repeats. */
	maxPerAction: number;
	/** Actions this label occurred in. */
	actionsPresent: number;
};

/** One accepted release's own interval, so a presentation clock can be correlated to it. */
export type P23BM1ReleaseSpan = {
	actionIndex: number;
	path: BenchInteractionPath;
	outcome: BenchInteractionOutcome;
	start: number;
	end: number;
	/** The proxy boundary for the same action, when the action recorded one. */
	browserFrame: { start: number; end: number } | null;
};

export type P23BM1ClassRow = {
	fixtureId: string;
	sessionId: string;
	actionClass: string;
	actionPath: BenchInteractionPath;
	ledger: {
		recordedActions: number | null;
		fixtureResets: number | null;
		droppedBoundaries: number | null;
		settled: boolean | null;
	};
	population: {
		rule: string;
		acceptedIncludingWarmup: number;
		warmupExcluded: number;
		measuredAccepted: number;
		outcomes: Partial<Record<BenchInteractionOutcome, number>>;
	};
	boundaries: Record<string, P23BM1KeyedRow>;
	marks: Record<string, P23BM1KeyedRow>;
	/** Marks inside the action but outside its boundaries, per name (the containment record's own shape). */
	unboundInsideActions: Record<string, { count: number; p50: number; p95: number }>;
	/** The `commit-capture` mark's own row (D7), or `null` when the class never reached it. */
	commitCapture: P23BM1KeyedRow | null;
	/** Accepted release spans, the population a presentation clock is correlated against. */
	releaseSpans: P23BM1ReleaseSpan[];
	releaseRow: {
		signal: 'presented-frame' | 'proxy';
		definition: string;
		distribution: P23BM1IntervalSeries;
		coverage: { releases: number; coveredReleases: number; coveredShare: number };
		/** The proxy row is reported beside a presentation-grade row, never replaced by it. */
		proxy: { definition: string; distribution: P23BM1IntervalSeries; coverage: { releases: number; coveredReleases: number; coveredShare: number } };
	};
	gestureFrames: P23BM1GestureFrameSeries | null;
	longFrames: P23BM1LongFrameSummary;
};

export type P23BM1D1Row = {
	row: 'wall-authoring' | 'whole-room-move-bridge';
	mark: 'release';
	fixtureId: string;
	actionClass: string;
	p50: number;
	p95: number;
	count: number;
	/** P23B.6's S1b numbers for the same row and fixture, for comparison ONLY. */
	comparison: { capture: string; before: number; after: number; note: string };
};

export type P23BM1FixtureSummary = {
	fixtureId: string;
	classes: P23BM1ClassRow[];
	settled: boolean;
	droppedBoundaries: number;
};

export type P23BM1Record = {
	schema: {
		note: string;
		keyed: string;
		population: string;
		releaseSide: string;
		advisory: string;
	};
	protocol: string;
	provenance: Record<string, unknown>;
	fixtures: P23BM1FixtureSummary[];
	d1: { note: string; rows: P23BM1D1Row[] };
	d7: { note: string; rows: { fixtureId: string; actionClass: string; mark: P23BM1KeyedRow | null }[] };
	d13: { note: string; coverageLimit: string };
	limitations: string[];
};

/** P23B.6's S1b final-head numbers, read from its closed record. Comparison only. */
export const P23B6_S1B_D1_COMPARISON = {
	'wall-authoring': {
		capture: 'P23B.6 S1b final-head (headless Chrome 152)',
		before: 2147.0,
		after: 3601.2,
		note: 'all-curved Wall-authoring release p50 ms; UNRESOLVED increase, re-read here as comparison only (never as a delta claim against a differently-run capture)'
	},
	'whole-room-move-bridge': {
		capture: 'P23B.6 S1b final-head (headless Chrome 152)',
		before: 73.4,
		after: 493.4,
		note: 'all-curved Whole-Room move release p50 ms; UNRESOLVED increase, re-read here as comparison only (never as a delta claim against a differently-run capture)'
	}
} as const;

export const P23B_M1_WARMUP_RULE =
	'completed actions with a resolved path, in ledger order, per path: the leading warm-up actions are excluded, then only accepted outcomes are reported. The same rule the interaction report uses, so a mark row and the boundary row beside it describe the same actions.';

export const P23B_M1_D13_NOTE =
	'D13 — the accepted partial baseline (P23B.0-durable disposition A) covers synchronous press/move-phase boundaries only; it has no post-release flush/frame coverage and no end-to-end settlement claim. M1 does not extend, re-capture or rewrite it: this session is new advisory evidence, not a baseline.';

/**
 * The interaction report's own population rule, applied over a ledger so the
 * release spans can be taken from the SAME actions the mark rows describe.
 */
export function m1Population(
	ledger: P23BCaptureLedger | null,
	path: BenchInteractionPath,
	warmup: number
): { measured: P23BActionLedger[]; acceptedIncludingWarmup: number; excludedByOutcome: number } {
	const completed = (ledger?.actions ?? []).filter(
		(action): action is P23BActionLedger & { path: BenchInteractionPath } =>
			action.status === 'completed' && action.path !== null
	);
	const ofPath = completed.filter((action) => action.path === path);
	const warmupActions = ofPath.slice(0, Math.max(0, warmup));
	const rest = ofPath.slice(warmupActions.length);
	return {
		measured: rest.filter((action) => action.outcome === 'accepted'),
		acceptedIncludingWarmup: ofPath.filter((action) => action.outcome === 'accepted').length,
		excludedByOutcome: rest.filter((action) => action.outcome !== 'accepted').length
	};
}

function keyedRow(row: P23BContainmentNodeSummary): P23BM1KeyedRow {
	return {
		count: row.total.count,
		p50: row.total.p50,
		p95: row.total.p95,
		exclusiveSelf: row.self ? { count: row.self.count, p50: row.self.p50, p95: row.self.p95 } : null,
		exclusiveSelfWithheld: row.selfWithheld,
		maxPerAction: row.maxPerAction,
		actionsPresent: row.actionsPresent
	};
}

function releaseSpansOf(actions: readonly P23BActionLedger[], path: BenchInteractionPath): P23BM1ReleaseSpan[] {
	const spans: P23BM1ReleaseSpan[] = [];
	for (const action of actions) {
		const release = action.samples.find(
			(sample) => sample.boundary === 'release' && typeof sample.start === 'number' && typeof sample.end === 'number'
		);
		if (!release || release.start === undefined || release.end === undefined) continue;
		const frame = action.samples.find(
			(sample) =>
				sample.boundary === 'browser-frame' && typeof sample.start === 'number' && typeof sample.end === 'number'
		);
		spans.push({
			actionIndex: action.index,
			path,
			outcome: action.outcome ?? 'unclassified',
			start: release.start,
			end: release.end,
			browserFrame:
				frame && frame.start !== undefined && frame.end !== undefined
					? { start: frame.start, end: frame.end }
					: null
		});
	}
	return spans;
}

/** One fixture+class capture → one reported class row. */
export function summarizeM1Class(input: {
	fixtureId: string;
	sessionId: string;
	actionClass: string;
	actionPath: BenchInteractionPath;
	ledger: P23BCaptureLedger | null;
	containment: P23BContainmentRecord;
	warmup: number;
	gestureFrames: P23BM1GestureFrameSeries | null;
	/** The class's long-frame window (item (b2)), or `null` when no window was opened. */
	longFrameWindow: { entries: readonly P23BM1LongFrameEntry[]; supported: boolean } | null;
}): P23BM1ClassRow {
	const { measured, acceptedIncludingWarmup, excludedByOutcome } = m1Population(
		input.ledger,
		input.actionPath,
		input.warmup
	);
	const byPath = summarizeContainmentByPath(input.containment, {
		warmup: input.warmup,
		outcomes: ['accepted']
	})[input.actionPath];
	const marks = Object.fromEntries(
		Object.entries(byPath?.nodes ?? {}).map(([label, row]) => [label, keyedRow(row)])
	);
	const boundaries = Object.fromEntries(
		Object.entries(byPath?.boundaries ?? {}).map(([label, row]) => [label, keyedRow(row)])
	);
	const unbound = Object.fromEntries(
		Object.entries(byPath?.unbound ?? {}).map(([label, row]) => [label, { ...row }])
	);
	const releaseSpans = releaseSpansOf(measured, input.actionPath);
	const frameValues = releaseSpans
		.map((span) => span.browserFrame)
		.filter((frame): frame is { start: number; end: number } => frame !== null)
		.map((frame) => Math.max(0, frame.end - frame.start));
	const outcomes: Partial<Record<BenchInteractionOutcome, number>> = {};
	for (const action of input.ledger?.actions ?? []) {
		if (action.status !== 'completed') continue;
		const key = action.path ?? action.intent;
		if (key !== input.actionPath) continue;
		const outcome = action.outcome ?? 'unclassified';
		outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
	}
	return {
		fixtureId: input.fixtureId,
		sessionId: input.sessionId,
		actionClass: input.actionClass,
		actionPath: input.actionPath,
		ledger: {
			recordedActions: input.ledger?.actions.length ?? null,
			fixtureResets: input.ledger?.fixtureResets ?? null,
			droppedBoundaries: input.ledger?.droppedBoundaries ?? null,
			settled: input.ledger?.settled ?? null
		},
		population: {
			rule: P23B_M1_WARMUP_RULE,
			acceptedIncludingWarmup,
			warmupExcluded: Math.min(input.warmup, acceptedIncludingWarmup),
			measuredAccepted: measured.length,
			outcomes
		},
		boundaries,
		marks,
		unboundInsideActions: unbound,
		commitCapture: marks['p2311:commit-capture'] ?? null,
		releaseSpans,
		releaseRow: {
			// The page-side record always reports the PROXY: only the CDP runner may
			// replace it with a presentation-grade row, and it does so explicitly.
			signal: 'proxy',
			definition: P23B_M1_RELEASE_PROXY_DEFINITION,
			distribution: summarizeIntervals(frameValues),
			coverage: {
				releases: releaseSpans.length,
				coveredReleases: frameValues.length,
				coveredShare: releaseSpans.length > 0 ? frameValues.length / releaseSpans.length : 0
			},
			proxy: {
				definition: P23B_M1_RELEASE_PROXY_DEFINITION,
				distribution: summarizeIntervals(frameValues),
				coverage: {
					releases: releaseSpans.length,
					coveredReleases: frameValues.length,
					coveredShare: releaseSpans.length > 0 ? frameValues.length / releaseSpans.length : 0
				}
			}
		},
		gestureFrames: input.gestureFrames,
		longFrames: input.longFrameWindow
			? summarizeLongFrames(
					input.longFrameWindow.entries,
					releaseSpans,
					input.longFrameWindow.supported,
					input.longFrameWindow.supported
						? null
						: 'NOT MEASURED — this runtime did not report long-animation-frame entries.'
				)
			: summarizeLongFrames(
					[],
					releaseSpans,
					false,
					'NOT MEASURED — no long-frame window was opened for this class.'
				)
	};
}

export function buildP23BM1Record(input: {
	provenance: Record<string, unknown>;
	protocol: string;
	classes: readonly P23BM1ClassRow[];
	fixtureOrder: readonly string[];
	limitations: readonly string[];
}): P23BM1Record {
	const fixtureIds = [...new Set(input.classes.map((row) => row.fixtureId))];
	const fixtures: P23BM1FixtureSummary[] = fixtureIds.map((fixtureId) => {
		const classes = input.classes.filter((row) => row.fixtureId === fixtureId);
		return {
			fixtureId,
			classes,
			settled: classes.every((row) => row.ledger.settled === true),
			droppedBoundaries: classes.reduce((sum, row) => sum + (row.ledger.droppedBoundaries ?? 0), 0)
		};
	});
	const d1Rows: P23BM1D1Row[] = [];
	for (const row of ['wall-authoring', 'whole-room-move-bridge'] as const) {
		for (const fixture of fixtures) {
			// Matched on the CLASS, not the path: D1's second row is a drag that rides the
			// shared `plan-drag-edit` path, so the path alone would pick the wrong class.
			const entry = fixture.classes.find((candidate) => candidate.actionClass.endsWith(`:${row}`));
			const release = entry?.boundaries['release'];
			if (!entry || !release) continue;
			d1Rows.push({
				row,
				mark: 'release',
				fixtureId: fixture.fixtureId,
				actionClass: entry.actionClass,
				p50: release.p50,
				p95: release.p95,
				count: release.count,
				comparison: P23B6_S1B_D1_COMPARISON[row]
			});
		}
	}
	return {
		schema: {
			note: 'Pre-P23B.8 follow-up M1 — one runtime, one protocol, both D1 rows, the gesture-frame series, the release-side row with its signal label and coverage, long-frame incidence, D7 and the D13 note. ADVISORY: one machine, one DEV session. Not a baseline, not a budget, no threshold, no ratchet and no baseline file is read or written.',
			keyed:
				'Mark/boundary rows are keyed by label: { count, p50, p95, exclusiveSelf|null, exclusiveSelfWithheld, maxPerAction, actionsPresent }. exclusiveSelf is reported only where every occurrence in the class could be exclusive-priced (the containment rule). Nothing here may be summed across labels, across classes or across release windows.',
			population: P23B_M1_WARMUP_RULE,
			releaseSide:
				'A release row is labelled `presented-frame` only when a presentation-grade signal was correlated to it (the CDP runner adds that section); otherwise it is the existing `browser-frame` PROXY and is labelled one, with its coverage. The long-frame row is an incidence row and is never presented-frame latency.',
			advisory: 'One machine, DEV, advisory numbers only. No statistical claim and no numeric target.'
		},
		protocol: input.protocol,
		provenance: { ...input.provenance, fixtureOrder: [...input.fixtureOrder] },
		fixtures,
		d1: {
			note: 'D1 — both P23B.6 final-capture rows re-read on this runtime beside P23B.6 S1b final-head numbers. COMPARISON ONLY: a differently-run capture is never a delta claim; the increases stay UNRESOLVED unless this session explains them, and repeating one is a finding, not a fix.',
			rows: d1Rows
		},
		d7: {
			note: 'D7 — the post-fix `commit-capture` number (the product mark in the commit path). Pre-fix browser evidence was 107–149 ms; ABSENT here with a reason means the class never reached a commit.',
			rows: input.classes
				.filter((row) => row.commitCapture !== null)
				.map((row) => ({ fixtureId: row.fixtureId, actionClass: row.actionClass, mark: row.commitCapture }))
		},
		d13: {
			note: 'D13 is NOTED beside M1 session, not folded into it.',
			coverageLimit: P23B_M1_D13_NOTE
		},
		limitations: [...input.limitations]
	};
}

/** The row labels the record's release section may carry; the runner sets them explicitly. */
export const P23B_M1_RELEASE_SIGNALS = {
	presented: P23B_M1_PRESENTED_FRAME_DEFINITION,
	proxy: P23B_M1_RELEASE_PROXY_DEFINITION,
	longFrames: P23B_M1_LONG_FRAME_DEFINITION
} as const;
