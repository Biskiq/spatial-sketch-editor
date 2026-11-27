/**
 * T1 V2a — the Wall top source contract and its compiled reading.
 *
 * P1–P7 from `v-plan-verticality.md` §3.3 live here at the layout-core
 * boundary: the codec refuses an unrepresentable or second-spelling shape, the
 * compiler reports the one rule that needs the derived length, Junction legs
 * carry each Wall's own end top, and the Opening-set fit reads the lowest top
 * over the Opening's interval.
 *
 * P8 (a level Wall is byte-identical to the pre-bump output) is a golden test in
 * `apps/editor/tests/lib/layout/wall-top-level-golden.test.ts`, because it pins
 * the emitted mesh buffers as well as the compiled records.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	MAX_LAYOUT_DIMENSION_METERS,
	type LayoutVec2
} from '@portfolio/layout-core/geometry';
import {
	CLOSED_WALL_LEVEL_ONLY_CODE,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	WALL_TOP_APEX_INVALID_CODE,
	WALL_TOP_APEX_OUTSIDE_CODE,
	WALL_TOP_RISE_INVALID_CODE,
	compiledWallTopAt,
	compiledWallTopKnots,
	compiledWallTopPeak,
	createEmptyWallFirstLayoutDocument,
	parseWallFirstLayoutDocumentJson,
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument,
	validateWallFirstOpeningSet,
	wallTopAt,
	wallTopBreakpoints,
	wallTopRange,
	wallTopShapeIssues,
	type LayoutDocumentWallFirst,
	type LayoutWall,
	type LayoutWallOpening,
	type LayoutWallTop
} from '@portfolio/layout-core/wall';

const LEVEL: LayoutWallTop = { kind: 'level' };

function wall(id: string, start: string, end: string, overrides: Partial<LayoutWall> = {}): LayoutWall {
	return {
		id,
		startJunctionId: start,
		endJunctionId: end,
		thickness: 0.2,
		height: 3,
		top: LEVEL,
		centerline: { kind: 'line' },
		...overrides
	};
}

function documentOf(
	points: Record<string, LayoutVec2>,
	walls: readonly LayoutWall[],
	openings: readonly LayoutWallOpening[] = []
): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	for (const [id, point] of Object.entries(points)) document.junctions.push({ id, point });
	document.walls.push(...walls);
	document.openings.push(...openings);
	return document;
}

function issueCodes(document: LayoutDocumentWallFirst): string[] {
	const result = validateWallFirstLayoutDocument(document);
	return result.success ? [] : result.issues.map((issue) => issue.code);
}

function issuePaths(document: LayoutDocumentWallFirst): string[] {
	const result = validateWallFirstLayoutDocument(document);
	return result.success ? [] : result.issues.map((issue) => issue.path);
}

function opening(overrides: Partial<LayoutWallOpening> & Pick<LayoutWallOpening, 'id' | 'wallId'>): LayoutWallOpening {
	return {
		kind: 'door',
		offset: 0,
		width: 1,
		height: 2,
		sillHeight: 0,
		profile: 'rectangular',
		...overrides
	} as LayoutWallOpening;
}

const line = (length = 10): Record<string, LayoutVec2> => ({ a: [0, 0], b: [length, 0] });

describe('V2a · the Wall top source contract (P1–P6)', () => {
	it('round-trips a level Wall canonically at the new format', () => {
		const document = documentOf(line(), [wall('w1', 'a', 'b')]);
		expect(document.formatVersion).toBe(LAYOUT_WALL_FIRST_FORMAT_VERSION);
		expect(LAYOUT_WALL_FIRST_FORMAT_VERSION).toBe(11);
		const json = serializeWallFirstLayoutDocument(document);
		expect(json).toMatch(/"top": \{\s*"kind": "level"\s*\}/);
		const parsed = parseWallFirstLayoutDocumentJson(json);
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.document.walls[0]!.top).toEqual(LEVEL);
		expect(parsed.canonicalJson).toBe(json);
	});

	it('accepts a slope with exactly one zero end, in either direction', () => {
		const rising = documentOf(line(), [wall('w1', 'a', 'b', { top: { kind: 'slope', startRise: 0, endRise: 2 } })]);
		const falling = documentOf(line(), [wall('w1', 'a', 'b', { top: { kind: 'slope', startRise: 2, endRise: 0 } })]);
		expect(issueCodes(rising)).toEqual([]);
		expect(issueCodes(falling)).toEqual([]);
		expect(wallTopAt(rising.walls[0]!, 10, 10)).toBe(5);
		expect(wallTopAt(falling.walls[0]!, 0, 10)).toBe(5);
	});

	it('refuses a slope whose lowest end rise is not exactly zero', () => {
		for (const top of [
			{ kind: 'slope', startRise: 1, endRise: 2 },
			{ kind: 'slope', startRise: 0, endRise: 0 }
		] as const) {
			const document = documentOf(line(), [wall('w1', 'a', 'b', { top })]);
			expect(issueCodes(document), JSON.stringify(top)).toContain(WALL_TOP_RISE_INVALID_CODE);
			expect(issuePaths(document)).toContain('$.walls[0].top');
		}
	});

	it('refuses a negative rise at the value layer', () => {
		const issues = wallTopShapeIssues({ kind: 'slope', startRise: -1, endRise: 2 });
		expect(issues.map((issue) => issue.code)).toContain(WALL_TOP_RISE_INVALID_CODE);
	});

	it('accepts a gable whose apex is above both ends and inside the Wall', () => {
		const document = documentOf(line(10), [
			wall('w1', 'a', 'b', { top: { kind: 'gable', startRise: 0, endRise: 1, apexRise: 4, apexOffset: 4 } })
		]);
		expect(issueCodes(document)).toEqual([]);
	});

	it('refuses a gable apex that does not rise above both ends, or has no offset', () => {
		for (const top of [
			{ kind: 'gable', startRise: 0, endRise: 2, apexRise: 2, apexOffset: 4 },
			{ kind: 'gable', startRise: 0, endRise: 0, apexRise: 3, apexOffset: 0 }
		] as const) {
			const document = documentOf(line(10), [wall('w1', 'a', 'b', { top })]);
			expect(issueCodes(document), JSON.stringify(top)).toContain(WALL_TOP_APEX_INVALID_CODE);
		}
	});

	it('refuses a second spelling of one shape', () => {
		const levelWithRise = documentOf(line(), [
			wall('w1', 'a', 'b', { top: { kind: 'level', startRise: 0 } as LayoutWallTop })
		]);
		const slopeWithApex = documentOf(line(), [
			wall('w1', 'a', 'b', { top: { kind: 'slope', startRise: 0, endRise: 2, apexRise: 3 } as LayoutWallTop })
		]);
		expect(issueCodes(levelWithRise)).toContain('unknown_key');
		expect(issueCodes(slopeWithApex)).toContain('unknown_key');
	});

	it('refuses a non-level top on a closed Wall', () => {
		const closed = createEmptyWallFirstLayoutDocument();
		closed.junctions.push({ id: 'seam', point: [0, 0] });
		closed.walls.push(wall('circle', 'seam', 'seam', { top: { kind: 'slope', startRise: 0, endRise: 2 } }));
		expect(issueCodes(closed)).toContain(CLOSED_WALL_LEVEL_ONLY_CODE);
	});

	it('keeps the authored height plus peak rise inside the 1,000 m envelope', () => {
		const document = documentOf(line(10), [
			wall('w1', 'a', 'b', {
				height: MAX_LAYOUT_DIMENSION_METERS - 1,
				top: { kind: 'slope', startRise: 0, endRise: 2 }
			})
		]);
		expect(issueCodes(document)).toContain('dimension_out_of_range');
	});

	it('refuses the frozen previous-format payload outright', () => {
		const v10 = readFileSync(
			fileURLToPath(new URL('./fixtures/layout-v10-level-wall.json', import.meta.url)),
			'utf8'
		);
		const parsed = parseWallFirstLayoutDocumentJson(v10);
		expect(parsed.success).toBe(false);
		if (parsed.success) return;
		expect(parsed.issues[0]!.code).toBe('unsupported_format_version');
		expect(parsed.issues[0]!.path).toBe('$.formatVersion');
		expect(parsed.issues[0]!.message).toContain('Recognized versions: 11');
	});
});

describe('V2a · the top evaluator (P1, P4)', () => {
	it('linearises rise in station between breakpoints', () => {
		const slope = wall('w1', 'a', 'b', { height: 2, top: { kind: 'slope', startRise: 0, endRise: 4 } });
		expect(wallTopBreakpoints(slope.top, 8)).toEqual([
			{ distance: 0, rise: 0 },
			{ distance: 8, rise: 4 }
		]);
		expect(wallTopAt(slope, 0, 8)).toBe(2);
		expect(wallTopAt(slope, 2, 8)).toBe(3);
		expect(wallTopAt(slope, 8, 8)).toBe(6);
		// Mitre vertices live outside the Wall extent; the station is clamped so a
		// corner evaluates exactly its own end top.
		expect(wallTopAt(slope, -1.5, 8)).toBe(2);
		expect(wallTopAt(slope, 12, 8)).toBe(6);
	});

	it('reads a gable apex as the maximum and both eaves as the ends', () => {
		const gable = wall('w1', 'a', 'b', {
			height: 2,
			top: { kind: 'gable', startRise: 0, endRise: 1, apexRise: 4, apexOffset: 3 }
		});
		expect(wallTopBreakpoints(gable.top, 10)).toEqual([
			{ distance: 0, rise: 0 },
			{ distance: 3, rise: 4 },
			{ distance: 10, rise: 1 }
		]);
		expect(wallTopAt(gable, 3, 10)).toBe(6);
		expect(wallTopAt(gable, 1.5, 10)).toBe(4);
		const overApex = wallTopRange(gable, 1, 6, 10);
		expect(overApex.max).toBe(6);
		expect(overApex.min).toBeCloseTo(2 + 4 / 3, 12);
		const descending = wallTopRange(gable, 4, 9, 10);
		expect(descending.max).toBeCloseTo(2 + 25 / 7, 12);
		expect(descending.min).toBeCloseTo(2 + 10 / 7, 12);
		// A range that does not contain the apex never reports the peak.
		expect(wallTopRange(gable, 7, 9, 10).max).toBeLessThan(6);
	});

	it('compiles the profile in the Floor-datum frame and keeps the apex knot', () => {
		const document = documentOf(line(10), [
			wall('w1', 'a', 'b', {
				height: 2,
				top: { kind: 'gable', startRise: 0, endRise: 1, apexRise: 4, apexOffset: 3 }
			})
		]);
		const compiled = compileWallFirstLayoutGeometry(document);
		expect(compiled.issues).toEqual([]);
		const compiledWall = compiled.geometry.walls[0]!;
		expect(compiledWall.topProfile).toEqual([
			{ distance: 0, topY: 2 },
			{ distance: 3, topY: 6 },
			{ distance: 10, topY: 3 }
		]);
		expect(compiledWall.bounds3.max[1]).toBe(6);
		expect(compiledWallTopPeak(compiledWall.topProfile!, 2)).toBe(6);
		expect(compiledWallTopAt(compiledWall.topProfile!, 6.5)).toBe(4.5);
		expect(compiledWallTopKnots(compiledWall.topProfile)).toEqual([3]);
	});

	it('reads a curved Wall top by station, not by chord', () => {
		const curved = documentOf({ a: [0, 0], b: [10, 0] }, [
			wall('w1', 'a', 'b', {
				height: 2,
				top: { kind: 'slope', startRise: 0, endRise: 3 },
				centerline: {
					kind: 'cubic-chain',
					knots: [{ id: 'k1', point: [5, 3] }],
					spans: [
						{ handleOut: [2, 0], handleIn: [3, 3] },
						{ handleOut: [7, 3], handleIn: [8, 0] }
					]
				}
			})
		]);
		const compiled = compileWallFirstLayoutGeometry(curved);
		expect(compiled.issues).toEqual([]);
		const compiledWall = compiled.geometry.walls[0]!;
		const length = compiledWall.length;
		expect(length).toBeGreaterThan(10);
		const profile = compiledWall.topProfile!;
		expect(profile[0]).toEqual({ distance: 0, topY: 2 });
		expect(profile.at(-1)!.distance).toBe(length);
		expect(profile.at(-1)!.topY).toBe(5);
		// The midpoint of the profile is the midpoint of the end tops, whatever the
		// curve's arc length is; a chord reading would not land here.
		expect(compiledWallTopAt(profile, length / 2)).toBeCloseTo(3.5, 12);
	});
});

describe('V2a · the compiled Wall (P3, P8 inputs)', () => {
	it('gives a level Wall no profile and no new cache-key input', () => {
		const document = documentOf(line(10), [wall('w1', 'a', 'b')]);
		const compiled = compileWallFirstLayoutGeometry(document);
		expect(compiled.issues).toEqual([]);
		const compiledWall = compiled.geometry.walls[0]!;
		expect(compiledWall.topProfile).toBeUndefined();
		expect(compiledWall.cacheKey).not.toContain('level');
		expect(compiledWall.cacheKey).toBe(
			(compileWallFirstLayoutGeometry(documentOf(line(10), [wall('w1', 'a', 'b')])).geometry.walls[0]!).cacheKey
		);
		expect(compiledWall.sections.every((section) => section.topY === 3)).toBe(true);
		expect(compiledWall.bounds3.max[1]).toBe(3);
	});

	it('splits the cache key when the top changes, and peak-bounds a sloped Wall', () => {
		const level = compileWallFirstLayoutGeometry(documentOf(line(10), [wall('w1', 'a', 'b')]));
		const slope = compileWallFirstLayoutGeometry(
			documentOf(line(10), [wall('w1', 'a', 'b', { top: { kind: 'slope', startRise: 0, endRise: 2 } })])
		);
		const gable = compileWallFirstLayoutGeometry(
			documentOf(line(10), [
				wall('w1', 'a', 'b', { top: { kind: 'gable', startRise: 0, endRise: 1, apexRise: 3, apexOffset: 4 } })
			])
		);
		const levelKey = level.geometry.walls[0]!.cacheKey;
		const slopeKey = slope.geometry.walls[0]!.cacheKey;
		const gableKey = gable.geometry.walls[0]!.cacheKey;
		expect(new Set([levelKey, slopeKey, gableKey]).size).toBe(3);
		expect(slope.geometry.walls[0]!.bounds3.max[1]).toBe(5);
		expect(gable.geometry.walls[0]!.bounds3.max[1]).toBe(6);
	});

	it('keeps each section top conservative over its own span', () => {
		const document = documentOf(line(10), [
			wall('w1', 'a', 'b', { top: { kind: 'gable', startRise: 0, endRise: 1, apexRise: 4, apexOffset: 3 } })
		]);
		const compiledWall = compileWallFirstLayoutGeometry(document).geometry.walls[0]!;
		for (const section of compiledWall.sections) {
			const range = wallTopRange(
				document.walls[0]!,
				section.startDistance,
				section.endDistance,
				compiledWall.length
			);
			expect(section.topY, `${section.startDistance}..${section.endDistance}`).toBeCloseTo(range.max, 12);
		}
		// The section that contains the apex is bounded by the peak, not by its
		// endpoints; the mesh clips the true edge per vertex.
		const span = compiledWall.sections.find((section) => section.topY === 7);
		expect(span).toBeDefined();
	});

	it('reports an apex outside the derived length as a blocking compiler issue', () => {
		const document = documentOf(line(10), [
			wall('w1', 'a', 'b', { top: { kind: 'gable', startRise: 0, endRise: 1, apexRise: 4, apexOffset: 12 } })
		]);
		// The codec cannot know the length, so it admits the values...
		expect(issueCodes(document)).toEqual([]);
		// ...and the compiler refuses the Wall whole.
		const compiled = compileWallFirstLayoutGeometry(document);
		const issue = compiled.issues.find((candidate) => candidate.code === WALL_TOP_APEX_OUTSIDE_CODE);
		expect(issue).toBeDefined();
		expect(issue!.path).toBe('walls.w1.top');
		expect(compiled.issues.some((candidate) => candidate.code === WALL_TOP_APEX_OUTSIDE_CODE)).toBe(true);
	});
});

describe('V2a · Junction legs read each Wall’s own end top (P3)', () => {
	const sloped = { kind: 'slope', startRise: 0, endRise: 3 } as const;

	it('degree 2: a sloped Wall meets a level Wall at its own end top', () => {
		const document = documentOf(
			{ a: [0, 0], b: [6, 0], c: [6, 4] },
			[wall('w1', 'a', 'b', { top: sloped }), wall('w2', 'b', 'c')]
		);
		const compiled = compileWallFirstLayoutGeometry(document);
		expect(compiled.issues).toEqual([]);
		const legs = compiled.geometry.junctions!.flatMap((junction) => junction.legs);
		expect(legs.find((leg) => leg.wallId === 'w1' && leg.end === 'end')!.topY).toBe(6);
		expect(legs.find((leg) => leg.wallId === 'w2' && leg.end === 'start')!.topY).toBe(3);
	});

	it('degree 3: every leg reads its own end, and an Opening caps only its own end', () => {
		const document = documentOf(
			{ a: [-3, 0], b: [0, 0], c: [3, 0], d: [0, 3] },
			[
				wall('w1', 'a', 'b', { top: sloped }),
				wall('w2', 'b', 'c', { height: 5 }),
				wall('w3', 'b', 'd', { top: { kind: 'slope', startRise: 0, endRise: 2 } })
			],
			[opening({ id: 'door', wallId: 'w1', offset: 2, width: 1, height: 2, sillHeight: 0 })]
		);
		const compiled = compileWallFirstLayoutGeometry(document);
		expect(compiled.issues).toEqual([]);
		const legs = compiled.geometry.junctions!.flatMap((junction) => junction.legs);
		const w1End = legs.find((leg) => leg.wallId === 'w1' && leg.end === 'end')!;
		expect(w1End.topY).toBe(6);
		// The door's far edge is the Junction itself, so the end is open; what
		// matters here is that the leg still reads this Wall's own end top.
		expect(w1End.endpointOpen).toBe(true);
		expect(w1End.endpointSolidBands.at(-1)!.topY).toBe(6);
		expect(legs.find((leg) => leg.wallId === 'w2' && leg.end === 'start')!.topY).toBe(5);
		expect(legs.find((leg) => leg.wallId === 'w3' && leg.end === 'start')!.topY).toBe(3);
	});

	it('degree 3: an end Opening leaves the solid band from its top to the Wall end top', () => {
		const document = documentOf(
			{ a: [-3, 0], b: [0, 0], c: [3, 0], d: [0, 3] },
			[wall('w1', 'a', 'b'), wall('w2', 'b', 'c'), wall('w3', 'b', 'd', { top: sloped })],
			[opening({ id: 'door', wallId: 'w3', offset: 0, width: 1, height: 2, sillHeight: 0 })]
		);
		const compiled = compileWallFirstLayoutGeometry(document);
		expect(compiled.issues).toEqual([]);
		const leg = compiled.geometry.junctions!
			.flatMap((junction) => junction.legs)
			.find((candidate) => candidate.wallId === 'w3' && candidate.end === 'start')!;
		expect(leg.endpointOpen).toBe(true);
		expect(leg.topY).toBe(3);
		expect(
			leg.endpointSolidBands.filter((band) => band.solid).map((band) => [band.bottomY, band.topY])
		).toEqual([[2, 3]]);
	});

	it('degree 4: a cross of mixed tops closes on four legs with four end tops', () => {
		const document = documentOf(
			{ n: [0, 3], s: [0, -3], e: [3, 0], w: [-3, 0], center: [0, 0] },
			[
				wall('north', 'center', 'n', { top: sloped }),
				wall('south', 'center', 's', { top: { kind: 'slope', startRise: 2, endRise: 0 } }),
				wall('east', 'center', 'e'),
				wall('west', 'center', 'w', { height: 4 })
			]
		);
		const compiled = compileWallFirstLayoutGeometry(document);
		expect(compiled.issues).toEqual([]);
		const junction = compiled.geometry.junctions!.find((candidate) => candidate.legs.length === 4);
		expect(junction).toBeDefined();
		const tops = Object.fromEntries(junction!.legs.map((leg) => [leg.wallId, leg.topY]));
		expect(tops).toEqual({ north: 3, south: 5, east: 3, west: 4 });
	});
});

describe('V2a · an Opening fits under the lowest top over its interval (P7)', () => {
	const slopedDocument = (height: number, wallOpening: LayoutWallOpening) =>
		documentOf(
			line(10),
			[wall('w1', 'a', 'b', { height, top: { kind: 'slope', startRise: 0, endRise: 3 } })],
			[wallOpening]
		);

	it('refuses under the low end and accepts the same Opening under the high end', () => {
		const low = slopedDocument(2, opening({ id: 'low', wallId: 'w1', offset: 0, width: 1, height: 1, sillHeight: 2.2 }));
		const high = slopedDocument(2, opening({ id: 'high', wallId: 'w1', offset: 8, width: 1, height: 1, sillHeight: 2.2 }));
		const lowIssues = validateWallFirstOpeningSet(low);
		expect(lowIssues.map((issue) => issue.code)).toEqual(['opening_exceeds_wall_height']);
		expect(lowIssues[0]!.path).toBe('$.openings[0]');
		expect(validateWallFirstOpeningSet(high)).toEqual([]);
	});

	it('refuses when the eave is lowered below an accepted Opening, naming it', () => {
		const accepted = slopedDocument(
			2,
			opening({ id: 'window', wallId: 'w1', offset: 8, width: 1, height: 1, sillHeight: 2.2 })
		);
		expect(validateWallFirstOpeningSet(accepted)).toEqual([]);
		const lowered = slopedDocument(
			0.5,
			opening({ id: 'window', wallId: 'w1', offset: 8, width: 1, height: 1, sillHeight: 2.2 })
		);
		const issues = validateWallFirstOpeningSet(lowered);
		expect(issues).toHaveLength(1);
		expect(issues[0]!.openingId).toBe('window');
		expect(issues[0]!.wallId).toBe('w1');
		expect(issues[0]!.message).toContain("Opening 'window'");
		expect(issues[0]!.message).toContain("under Wall 'w1' top");
	});
});

describe('V2a · Save and Load keep the canonical top bytes', () => {
	it('round-trips slope and gable Walls byte-identically', () => {
		const document = documentOf(
			{ a: [0, 0], b: [10, 0], c: [10, 6] },
			[
				wall('slope', 'a', 'b', { top: { kind: 'slope', startRise: 0, endRise: 2.5 } }),
				wall('gable', 'b', 'c', {
					height: 2.4,
					top: { kind: 'gable', startRise: 0.6, endRise: 0, apexRise: 3.2, apexOffset: 2.25 }
				})
			]
		);
		const saved = serializeWallFirstLayoutDocument(document);
		const loaded = parseWallFirstLayoutDocumentJson(saved);
		expect(loaded.success).toBe(true);
		if (!loaded.success) return;
		expect(loaded.canonicalJson).toBe(saved);
		expect(loaded.document.walls.map((candidate) => candidate.top)).toEqual(document.walls.map((candidate) => candidate.top));
		expect(serializeWallFirstLayoutDocument(loaded.document)).toBe(saved);
	});
});
