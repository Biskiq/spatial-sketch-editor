/**
 * The attribution pass reads M1's per-class rows through this partition, so these
 * tests pin the three properties that make it trustworthy: the mapping of the
 * labels the pass actually reads, the rule that a phase carries NO total (only
 * occurrence counts and per-occurrence distributions, because the labels nest),
 * and the rule that only priceable exclusive self can be compared — a withheld
 * row is listed but never ranked.
 */
import { describe, expect, it } from 'vitest';

import {
	p23bM1PhaseOf,
	summarizeM1Attribution,
	P23B_M1_ATTRIBUTION_NOTE,
	P23B_M1_PHASE_BY_LABEL,
	type P23BM1AttributionMarkRow
} from '$lib/bench/p23b-m1-attribution';

function row(
	options: {
		count: number;
		p50: number;
		p95?: number;
		self?: number | null;
		withheld?: string | null;
	} = { count: 1, p50: 1 }
): P23BM1AttributionMarkRow {
	const self = options.self === undefined ? options.p50 : options.self;
	return {
		count: options.count,
		p50: options.p50,
		p95: options.p95 ?? options.p50,
		exclusiveSelf: self === null ? null : { count: options.count, p50: self, p95: options.p95 ?? self },
		exclusiveSelfWithheld: options.withheld ?? (self === null ? '4 of 4 occurrences could not be exclusive-priced' : null),
		maxPerAction: 1,
		actionsPresent: options.count
	};
}

const releaseRow = {
	signal: 'presented-frame',
	definition: 'presentation-grade',
	distribution: { count: 20, p50: 278.4, p95: 378.5, max: 400, mean: 280 },
	coverage: { releases: 20, coveredReleases: 20, coveredShare: 1 }
};

describe('M1 attribution — the phase map', () => {
	it('names the phase of the labels the attribution pass reads', () => {
		expect(p23bM1PhaseOf('p2311:room-geometry-compile')).toBe('geometry-computation');
		expect(p23bM1PhaseOf('p2311:preview-compile')).toBe('geometry-computation');
		expect(p23bM1PhaseOf('p2311:mesh-prebuild')).toBe('state-installation');
		expect(p23bM1PhaseOf('p2311:preview-install')).toBe('state-installation');
		expect(p23bM1PhaseOf('p2311:plan-render-model')).toBe('plan-rendering');
		expect(p23bM1PhaseOf('p2311:svg-attributes')).toBe('plan-rendering');
		// The D5 owner family is computation, not installation and not rendering.
		expect(p23bM1PhaseOf('p2311:snap-wall-index')).toBe('geometry-computation');
		expect(p23bM1PhaseOf('p2311:architecture-snap-resolution')).toBe('geometry-computation');
		expect(p23bM1PhaseOf('p2311:preflight-topology')).toBe('geometry-computation');
		expect(p23bM1PhaseOf('p2311:gesture-commit')).toBe('state-installation');
	});

	it('leaves a mark that wraps several phases out of every phase, rather than picking one', () => {
		for (const label of ['p2311:authoring-release', 'p2311:pointermove-rigid']) {
			expect(p23bM1PhaseOf(label)).toBe('unclassified');
		}
	});

	it('leaves an unknown DEV mark unclassified rather than absorbing it into a phase', () => {
		expect(p23bM1PhaseOf('p2311:some-new-mark')).toBe('unclassified');
		const summary = summarizeM1Attribution({
			marks: { 'p2311:some-new-mark': row({ count: 2, p50: 7 }) },
			boundaries: {},
			releaseRow,
			measuredActions: 2
		});
		expect(summary.unclassified).toEqual(['p2311:some-new-mark']);
		// It is still reported, with its own numbers: unknown is visible, not zero.
		expect(summary.labels).toHaveLength(1);
		expect(summary.labels[0]).toMatchObject({ label: 'p2311:some-new-mark', phase: 'unclassified', p50: 7 });
	});

	it('states where a label encloses another row, so its p50 is never read as a leaf', () => {
		// `chain-canonical-gates` is validation plus a FULL compile, so it contains a
		// `room-geometry-compile`; `mesh-prebuild` fires per prepared generation, so
		// several occurrences can sit inside one release.
		expect(P23B_M1_PHASE_BY_LABEL['p2311:chain-canonical-gates']?.encloses).toContain('FULL wall-first compile');
		expect(P23B_M1_PHASE_BY_LABEL['p2311:preview-compile']?.encloses).toContain('room-geometry-compile');
		expect(P23B_M1_PHASE_BY_LABEL['p2311:mesh-prebuild']?.encloses).toContain('full-generation');
	});
});

describe('M1 attribution — what a phase may and may not claim', () => {
	const summary = summarizeM1Attribution({
		marks: {
			// Six mesh preparations per accepted action, each ~116 ms: the whole-Room
			// move's per-frame cost. Its own p50 is NOT a per-action total.
			'p2311:mesh-prebuild': row({ count: 120, p50: 116.7, p95: 185.4, self: 115.9 }),
			'p2311:room-geometry-compile': row({ count: 200, p50: 20.1, self: 13.4 }),
			'p2311:preview-compile': row({ count: 100, p50: 47.3, self: null }),
			'p2311:plan-render-model': row({ count: 160, p50: 12.8 })
		},
		boundaries: {
			release: row({ count: 20, p50: 300, self: null, withheld: '20 of 20 occurrences could not be exclusive-priced' }),
			'svelte-flush': row({ count: 120, p50: 57.2, self: 17.3 })
		},
		releaseRow,
		measuredActions: 20
	});

	it('reports occurrences per action beside the per-occurrence distribution and no phase total', () => {
		const mesh = summary.labels.find((entry) => entry.label === 'p2311:mesh-prebuild')!;
		expect(mesh.occurrencesPerAction).toBe(6);
		// The number a reader must not form: 6 × 116.7 inside a 300 ms release.
		expect(mesh.p50).toBe(116.7);
		for (const phase of summary.phases) {
			expect(Object.keys(phase).sort()).toEqual(['labels', 'largestExclusiveSelf', 'phase']);
		}
		expect(summary.note).toBe(P23B_M1_ATTRIBUTION_NOTE);
		expect(summary.note).toContain('NO phase total');
	});

	it('ranks a phase by its largest EXCLUSIVE self and ignores withheld rows', () => {
		const geometry = summary.phases.find((phase) => phase.phase === 'geometry-computation')!;
		// `room-geometry-compile` (13.4) wins over `plan-render-model`'s phase and
		// over the withheld `preview-compile`, which has a larger total and no self.
		expect(geometry.largestExclusiveSelf).toEqual({ label: 'p2311:room-geometry-compile', p50: 13.4 });
		expect(geometry.labels).toContain('p2311:preview-compile');
		const install = summary.phases.find((phase) => phase.phase === 'state-installation')!;
		expect(install.largestExclusiveSelf).toEqual({ label: 'p2311:mesh-prebuild', p50: 115.9 });
		// Priceable rows sort before withheld ones, so a withheld total can never be
		// mistaken for the biggest term.
		expect(summary.labels[0]?.label).toBe('p2311:mesh-prebuild');
		expect(summary.labels.at(-1)?.exclusiveSelf).toBeNull();
	});

	it('keeps the release-side signal beside the phases and never inside them', () => {
		expect(summary.presentation.signal).toBe('presented-frame');
		expect(summary.presentation.distribution.p50).toBe(278.4);
		expect(summary.presentation.coverage).toEqual({ releases: 20, coveredReleases: 20, coveredShare: 1 });
		expect(summary.presentation.boundaries.map((entry) => entry.label)).toEqual(['release', 'svelte-flush']);
		expect(summary.presentation.boundaries[0]).toMatchObject({ phase: 'unclassified', p50: 300 });
		for (const phase of summary.phases) expect(phase.labels).not.toContain('release');
	});
});
