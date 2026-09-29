/**
 * Pre-P23B.8 follow-up M1 — per-action attribution (DEV only, pure).
 *
 * WHAT THIS IS. A reading of rows M1 already collected, grouped into the four
 * phases the follow-up's attribution pass asks to separate — geometry
 * COMPUTATION, state INSTALLATION, Plan RENDERING and PRESENTATION — so that a
 * per-action question ("what does one whole-Room move actually spend its time
 * on?") can be answered from the class's own keyed rows instead of from a
 * paragraph about them. It measures nothing new: it partitions, and it states
 * the two rules that make a partition readable rather than merely present.
 *
 * RULE 1 — PHASES ARE NOT SUMS, AND THIS IS NOT AN EXCUSE. The labels nest: a
 * `room-geometry-compile` sits inside a `preview-compile`, which sits inside a
 * release; a `mesh-prebuild` fires per preview frame AND per commit. The
 * occurrence counts make that visible (six `mesh-prebuild`s per accepted action,
 * each with its own p50, inside ONE 300 ms release) and are exactly why no phase
 * total is reported anywhere in this module. Adding them would double-count the
 * same millisecond, which is the arithmetic error the containment record's own
 * "nothing may be summed" note exists to prevent.
 *
 * RULE 2 — ONLY EXCLUSIVE SELF IS COMPARABLE, AND ONLY WHERE IT IS PRICEABLE.
 * A label's `p50` is its INCLUSIVE interval. `exclusiveSelf` is present only when
 * every occurrence in the class could be exclusive-priced (the containment rule),
 * and `encloses` names the rows a label contains — `chain-canonical-gates` wraps
 * document validation plus a full wall-first compile, so its p50 can never be
 * ranked against a leaf's self. Where self is withheld, the label has an
 * inclusive p50 and nothing else, and the phase's `largestExclusiveSelf` simply
 * does not consider it.
 *
 * WHAT IS NOT CLASSIFIED. A label this reading does not place lands in
 * `unclassified` WITH its own rows — never in a phase and never as a zero. That
 * bucket holds two honest kinds of row: a mark this map does not know, and a mark
 * that wraps MORE THAN ONE phase (`authoring-release`, the whole wall-authoring
 * release; `pointermove-rigid`, a whole pointer-move's preview handling), which
 * cannot be a member of a single phase without lying about what it measures. The
 * mapping is deliberately narrow: it names only the labels the attribution pass
 * reads, so an unknown DEV mark is visible as an unknown rather than absorbed.
 */
import type { P23BM1IntervalSeries } from '$lib/bench/p23b-m1-frame-timing';

/**
 * The keyed-row shape this module reads, stated structurally so the partition can
 * be built from a containment row, a boundary row or a test fixture alike.
 */
export type P23BM1AttributionMarkRow = {
	count: number;
	p50: number;
	p95: number;
	exclusiveSelf: { count: number; p50: number; p95: number } | null;
	exclusiveSelfWithheld: string | null;
	maxPerAction: number;
	actionsPresent: number;
};

/** The four phases, plus the visible remainder. */
export type P23BM1Phase =
	| 'geometry-computation'
	| 'state-installation'
	| 'plan-rendering'
	| 'unclassified';

type PhaseEntry = { phase: Exclude<P23BM1Phase, 'unclassified'>; encloses: string | null };

/**
 * LABEL → PHASE. Every entry is an explicit decision, and `encloses` states the
 * inclusive relationship where one exists rather than leaving it to the reader.
 * Labels absent from this map are reported as unclassified.
 */
export const P23B_M1_PHASE_BY_LABEL: Readonly<Record<string, PhaseEntry>> = {
	// ---- geometry computation -------------------------------------------------
	'p2311:room-geometry-compile': {
		phase: 'geometry-computation',
		encloses: null
	},
	'p2311:preview-compile': {
		phase: 'geometry-computation',
		encloses:
			'the preview model compile, and the core compile inside it — a `p2311:room-geometry-compile` occurrence is contained here'
	},
	'p2311:preview-compile-reused': { phase: 'geometry-computation', encloses: null },
	'p2311:chain-canonical-gates': {
		phase: 'geometry-computation',
		encloses:
			'document validation plus a FULL wall-first compile — a `p2311:room-geometry-compile` occurrence is contained here'
	},
	'p2311:acceptance-compile': {
		phase: 'geometry-computation',
		encloses: 'a full wall-first compile — a `p2311:room-geometry-compile` occurrence is contained here'
	},
	'p2311:curve-sampling': { phase: 'geometry-computation', encloses: null },
	'p2311:finite-thickness': { phase: 'geometry-computation', encloses: null },
	'p2311:junction-resolution': { phase: 'geometry-computation', encloses: null },
	'p2311:standalone-wall-build': { phase: 'geometry-computation', encloses: null },
	'p2311:face-extraction': { phase: 'geometry-computation', encloses: null },
	'p2311:correspondence': { phase: 'geometry-computation', encloses: null },
	// The snap and topology family (the D5 owner family). These are the candidate
	// document's derivation and validation stages plus the pointer-time snap
	// resolution — computation, not installation and not Plan rendering.
	'p2311:snap-wall-index': {
		phase: 'geometry-computation',
		encloses: null
	},
	'p2311:snap-resolution': { phase: 'geometry-computation', encloses: null },
	'p2311:architecture-snap-resolution': {
		phase: 'geometry-computation',
		encloses: 'the snap query, and the memoized `p2311:snap-wall-index` derivation it can trigger'
	},
	'p2311:wall-chain-plan': { phase: 'geometry-computation', encloses: null },
	'p2311:proposal-derive': { phase: 'geometry-computation', encloses: null },
	'p2311:preflight': { phase: 'geometry-computation', encloses: null },
	'p2311:preflight-topology': { phase: 'geometry-computation', encloses: null },
	'p2311:topology-pre': { phase: 'geometry-computation', encloses: null },
	'p2311:topology-post': { phase: 'geometry-computation', encloses: null },
	'p2311:chain-topology-gate': { phase: 'geometry-computation', encloses: null },
	'p2311:structural-pre': { phase: 'geometry-computation', encloses: null },
	'p2311:structural-post': { phase: 'geometry-computation', encloses: null },
	'p2311:junction-partition': { phase: 'geometry-computation', encloses: null },
	'p2311:room-reconciliation': { phase: 'geometry-computation', encloses: null },
	'p2311:opening-set': { phase: 'geometry-computation', encloses: null },
	'p2311:portal-relations': { phase: 'geometry-computation', encloses: null },
	// ---- state installation ---------------------------------------------------
	'p2311:mesh-prebuild': {
		phase: 'state-installation',
		encloses:
			'one full-generation wall-mesh preparation (per-Wall value comparisons happen inside it); fired once per prepared generation, so several occurrences can sit inside one release'
	},
	'p2311:preview-install': { phase: 'state-installation', encloses: null },
	'p2311:wall-chain-commit-install': { phase: 'state-installation', encloses: null },
	'p2311:commit-capture': { phase: 'state-installation', encloses: null },
	'p2311:commit-replace': { phase: 'state-installation', encloses: null },
	'p2311:commit-matches': { phase: 'state-installation', encloses: null },
	'p2311:gesture-commit': {
		phase: 'state-installation',
		encloses: 'the commit and history write of one direct-edit gesture'
	},
	'p2311:selection-hit': { phase: 'state-installation', encloses: null },
	'p2311:baseline-restore': { phase: 'state-installation', encloses: null },
	'p2311:restore-mesh-install': { phase: 'state-installation', encloses: null },
	'p2311:restore-project-clone': { phase: 'state-installation', encloses: null },
	'p2311:restore-model-project': { phase: 'state-installation', encloses: null },
	'p2311:restore-reactive-write': { phase: 'state-installation', encloses: null },
	'p2311:restore-issues-clone': { phase: 'state-installation', encloses: null },
	'p2311:restore-bookkeeping': { phase: 'state-installation', encloses: null },
	// ---- Plan rendering -------------------------------------------------------
	'p2311:plan-render-model': { phase: 'plan-rendering', encloses: null },
	'p2311:plan-salience': { phase: 'plan-rendering', encloses: null },
	'p2311:plan-presentation': { phase: 'plan-rendering', encloses: null },
	'p2311:plan-svg-context-ink': { phase: 'plan-rendering', encloses: null },
	'p2311:svg-attributes': { phase: 'plan-rendering', encloses: null }
};

/** The phase a mark label belongs to; anything unknown is unclassified. */
export function p23bM1PhaseOf(label: string): P23BM1Phase {
	return P23B_M1_PHASE_BY_LABEL[label]?.phase ?? 'unclassified';
}

export type P23BM1AttributionLabel = {
	label: string;
	phase: P23BM1Phase;
	/** Stated when this label's interval contains another row's; its p50 is inclusive. */
	encloses: string | null;
	count: number;
	/** The class's own `count / measured actions`: 1 = once per gesture, 6 = once per wall. */
	occurrencesPerAction: number;
	/** INCLUSIVE p50 of one occurrence. Never comparable with a withheld row's self. */
	p50: number;
	p95: number;
	exclusiveSelf: { count: number; p50: number; p95: number } | null;
	exclusiveSelfWithheld: string | null;
};

export type P23BM1Attribution = {
	note: string;
	measuredActions: number;
	/** Every label the class reported, phase-labelled, priceable ones first. */
	labels: P23BM1AttributionLabel[];
	phases: {
		phase: P23BM1Phase;
		labels: string[];
		/** Largest exclusive self in the phase, or null when nothing there is priceable. */
		largestExclusiveSelf: { label: string; p50: number } | null;
	}[];
	/**
	 * The release-side signals reported BESIDE the phases, never folded into them:
	 * they are boundaries (or a correlated compositor row), not marks.
	 */
	presentation: {
		signal: string;
		definition: string;
		distribution: P23BM1IntervalSeries;
		coverage: { releases: number; coveredReleases: number; coveredShare: number } | null;
		boundaries: P23BM1AttributionLabel[];
	};
	unclassified: string[];
};

export const P23B_M1_ATTRIBUTION_NOTE =
	'Per-action attribution read out of this class\'s own keyed rows — not a new measurement and NOT a breakdown. Labels nest (a core compile inside a preview compile inside a release; a mesh preparation per prepared generation), so NO phase total is reported and no phase may be summed: occurrence counts and per-occurrence p50s are reported side by side instead. Only `exclusiveSelf` is comparable across labels, and only where every occurrence in the class could be exclusive-priced; a withheld row has an inclusive p50 and nothing else. `occurrencesPerAction` is the class\'s own count divided by its measured actions, so a once-per-gesture label and a once-per-wall label are never read as the same size.';

function labelRow(
	label: string,
	row: P23BM1AttributionMarkRow,
	measuredActions: number
): P23BM1AttributionLabel {
	const entry = P23B_M1_PHASE_BY_LABEL[label];
	return {
		label,
		phase: entry?.phase ?? 'unclassified',
		encloses: entry?.encloses ?? null,
		count: row.count,
		occurrencesPerAction: measuredActions > 0 ? row.count / measuredActions : 0,
		p50: row.p50,
		p95: row.p95,
		exclusiveSelf: row.exclusiveSelf ? { ...row.exclusiveSelf } : null,
		exclusiveSelfWithheld: row.exclusiveSelfWithheld
	};
}

const byPriceThenSize = (a: P23BM1AttributionLabel, b: P23BM1AttributionLabel): number =>
	(a.exclusiveSelf === null ? 1 : 0) - (b.exclusiveSelf === null ? 1 : 0) ||
	(b.exclusiveSelf?.p50 ?? b.p50) - (a.exclusiveSelf?.p50 ?? a.p50) ||
	a.label.localeCompare(b.label);

/**
 * Partition one class's already-measured rows. Pure: the caller passes the rows
 * the class reported, this decides how they read.
 */
export function summarizeM1Attribution(input: {
	marks: Readonly<Record<string, P23BM1AttributionMarkRow>>;
	boundaries: Readonly<Record<string, P23BM1AttributionMarkRow>>;
	releaseRow: {
		signal: string;
		definition: string;
		distribution: P23BM1IntervalSeries;
		coverage: { releases: number; coveredReleases: number; coveredShare: number };
	};
	measuredActions: number;
}): P23BM1Attribution {
	const labels = Object.entries(input.marks)
		.map(([label, row]) => labelRow(label, row, input.measuredActions))
		.sort(byPriceThenSize);
	// Boundary rows are reported as presentation signals only: a boundary is the
	// interval the ledger itself measured, so it is never a phase member.
	const boundaries = Object.entries(input.boundaries)
		.map(([label, row]) => ({ ...labelRow(label, row, input.measuredActions), phase: 'unclassified' as const }))
		.sort((a, b) => b.p50 - a.p50 || a.label.localeCompare(b.label));
	const phases: P23BM1Attribution['phases'] = (
		['geometry-computation', 'state-installation', 'plan-rendering', 'unclassified'] as const
	).map((phase) => {
		const members = labels.filter((entry) => entry.phase === phase);
		const priced = members
			.filter((entry): entry is P23BM1AttributionLabel & { exclusiveSelf: NonNullable<P23BM1AttributionLabel['exclusiveSelf']> } => entry.exclusiveSelf !== null)
			.sort((a, b) => b.exclusiveSelf.p50 - a.exclusiveSelf.p50 || a.label.localeCompare(b.label));
		return {
			phase,
			labels: members.map((entry) => entry.label),
			largestExclusiveSelf: priced[0]
				? { label: priced[0].label, p50: priced[0].exclusiveSelf.p50 }
				: null
		};
	});
	return {
		note: P23B_M1_ATTRIBUTION_NOTE,
		measuredActions: input.measuredActions,
		labels,
		phases,
		presentation: {
			signal: input.releaseRow.signal,
			definition: input.releaseRow.definition,
			distribution: { ...input.releaseRow.distribution },
			coverage: input.releaseRow.coverage ? { ...input.releaseRow.coverage } : null,
			boundaries
		},
		unclassified: labels.filter((entry) => entry.phase === 'unclassified').map((entry) => entry.label)
	};
}
