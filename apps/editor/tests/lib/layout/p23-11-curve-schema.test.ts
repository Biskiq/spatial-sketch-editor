/**
 * P23.11 Slice 1 — the split-preserving canonical Wall curve representation.
 *
 * The canonical centerline is an explicit cubic chain: ordered bend points plus
 * **one control pair per cubic span** (`spans.length === knots.length + 1`).
 * Endpoint positions stay owned by the Junctions; the chain stores only
 * per-span controls. Bend points carry identity, spans do not.
 *
 * These tests pin the schema, the identity policy, the deep-clone/translate
 * helpers, and — most importantly — that swapping the representation preserved
 * the evaluated curve exactly. De Casteljau subdivision is only exact because
 * the read path consumes stored spans, so the write-path derivation must still
 * agree with the legacy `auto-bezier` evaluator it replaced.
 */
import { describe, expect, it } from 'vitest';

import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	cloneWallCenterline,
	compileAutoBezierAnchors,
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	nextWallCurveKnotId,
	parseWallFirstLayoutDocumentJson,
	planConvertWallToCurve,
	planWallSplit,
	serializeWallFirstLayoutDocument,
	sampleSegment,
	translateWallCenterline,
	validateWallFirstLayoutDocument,
	wallCenterlineSamples,
	wallCenterlineSegment,
	wallCubicChain,
	wallFirstWallSpan,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCenterline,
	type LayoutWallCurveKnot,
	type NodingIdAllocator
} from '@portfolio/layout-core';

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

function straightWallDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [10, 0] }
	];
	document.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' }
		}
	];
	return document;
}

function chain(centerline: LayoutWallCenterline): Extract<
	LayoutWallCenterline,
	{ kind: 'cubic-chain' }
> {
	if (centerline.kind !== 'cubic-chain') throw new Error('expected a cubic-chain centerline');
	return centerline;
}

/** S-shaped chain: two bend points, three spans, explicitly stored controls. */
function curvedChain(): LayoutWallCenterline {
	const knots: LayoutWallCurveKnot[] = [
		{ id: 'wall-a:knot:1', point: [3, 2] },
		{ id: 'wall-a:knot:2', point: [7, -2] }
	];
	const points: LayoutVec2[] = [[0, 0], [3, 2], [7, -2], [10, 0]];
	return wallCubicChain(knots, deriveChainSpans(points));
}

function curvedWallDocument(): LayoutDocumentWallFirst {
	const document = straightWallDocument();
	document.walls[0]!.centerline = curvedChain();
	return document;
}

function roundTrip(document: LayoutDocumentWallFirst): LayoutDocumentWallFirst {
	const json = serializeWallFirstLayoutDocument(document);
	const result = parseWallFirstLayoutDocumentJson(json);
	if (!result.success) {
		throw new Error(`round trip rejected: ${JSON.stringify(result.issues)}`);
	}
	return result.document;
}

function nodingAllocator(): NodingIdAllocator {
	return {
		nextWallId(base, seed) {
			let candidate = `${seed}-1`;
			let counter = 1;
			while (base.walls.some((wall) => wall.id === candidate)) {
				counter += 1;
				candidate = `${seed}-${counter}`;
			}
			return candidate;
		},
		nextJunctionId(base, seed) {
			let candidate = `j-${seed}-1`;
			let counter = 1;
			while (base.junctions.some((junction) => junction.id === candidate)) {
				counter += 1;
				candidate = `j-${seed}-${counter}`;
			}
			return candidate;
		}
	};
}

function wall(document: LayoutDocumentWallFirst, id = 'wall-a'): LayoutWall {
	const found = document.walls.find((candidate) => candidate.id === id);
	if (!found) throw new Error(`unknown wall ${id}`);
	return found;
}

// ---------------------------------------------------------------------------
// schema + round trip
// ---------------------------------------------------------------------------

describe('P23.11 slice 1 — cubic-chain centerline schema', () => {
	it('round-trips a straight Wall unchanged', () => {
		const document = straightWallDocument();
		expect(validateWallFirstLayoutDocument(document).success).toBe(true);
		expect(roundTrip(document)).toEqual(document);
	});

	it('round-trips a curved chain with knot positions and span controls exact', () => {
		const document = curvedWallDocument();
		expect(validateWallFirstLayoutDocument(document).success).toBe(true);

		const before = chain(wall(document).centerline);
		const after = chain(wall(roundTrip(document)).centerline);
		expect(after.knots).toEqual(before.knots);
		expect(after.spans).toEqual(before.spans);
		expect(after.spans).toHaveLength(before.knots.length + 1);
	});

	it('accepts and round-trips a knot-less single-cubic chain', () => {
		// One knot-less cubic is a legal curved Wall: a split or a knot deletion
		// can leave one behind, and it must never be flattened into `line`.
		const document = straightWallDocument();
		document.walls[0]!.centerline = {
			kind: 'cubic-chain',
			knots: [],
			spans: [{ handleOut: [3, 4], handleIn: [7, 4] }]
		};
		expect(validateWallFirstLayoutDocument(document).success).toBe(true);
		const restored = chain(wall(roundTrip(document)).centerline);
		expect(restored.knots).toEqual([]);
		expect(restored.spans).toHaveLength(1);
		expect(restored.spans[0]).toEqual({ handleOut: [3, 4], handleIn: [7, 4] });
	});

	it('rejects the superseded auto-bezier centerline', () => {
		const document = curvedWallDocument();
		const payload = JSON.parse(serializeWallFirstLayoutDocument(document)) as {
			walls: { centerline: unknown }[];
		};
		payload.walls[0]!.centerline = {
			kind: 'auto-bezier',
			interiorAnchors: [{ id: 'wall-a:knot:1', point: [5, 3] }]
		};
		const result = validateWallFirstLayoutDocument(payload);
		expect(result.success).toBe(false);
	});

	it('rejects a chain with too few or too many spans', () => {
		const document = curvedWallDocument();
		const base = JSON.parse(serializeWallFirstLayoutDocument(document)) as {
			walls: { centerline: { kind: string; knots: unknown[]; spans: unknown[] } }[];
		};

		const tooFew = structuredClone(base);
		tooFew.walls[0]!.centerline.spans = tooFew.walls[0]!.centerline.spans.slice(0, 2);
		expect(validateWallFirstLayoutDocument(tooFew).success).toBe(false);

		const tooMany = structuredClone(base);
		tooMany.walls[0]!.centerline.spans = [
			...tooMany.walls[0]!.centerline.spans,
			{ handleOut: [1, 1], handleIn: [2, 2] }
		];
		expect(validateWallFirstLayoutDocument(tooMany).success).toBe(false);
	});

	it('gives spans no identity: an ID or ordering key on a span is rejected', () => {
		const document = curvedWallDocument();
		const base = JSON.parse(serializeWallFirstLayoutDocument(document)) as {
			walls: { centerline: { spans: Record<string, unknown>[] } }[];
		};
		for (const key of ['id', 'index', 'order'] as const) {
			const payload = structuredClone(base);
			payload.walls[0]!.centerline.spans[0]![key] = key === 'id' ? 'span-1' : 0;
			expect(validateWallFirstLayoutDocument(payload).success, key).toBe(false);
		}
	});

	it('rejects duplicate bend-point IDs', () => {
		const document = curvedWallDocument();
		const payload = JSON.parse(serializeWallFirstLayoutDocument(document)) as {
			walls: { centerline: { knots: { id: string; point: number[] }[] } }[];
		};
		payload.walls[0]!.centerline.knots[1]!.id = payload.walls[0]!.centerline.knots[0]!.id;
		expect(validateWallFirstLayoutDocument(payload).success).toBe(false);
	});

	it('rejects non-finite bend points and span controls', () => {
		const document = curvedWallDocument();
		const base = JSON.parse(serializeWallFirstLayoutDocument(document)) as {
			walls: {
				centerline: {
					knots: { point: unknown }[];
					spans: { handleOut?: unknown; handleIn?: unknown }[];
				};
			}[];
		};

		const badKnot = structuredClone(base);
		badKnot.walls[0]!.centerline.knots[0]!.point = [1, null];
		expect(validateWallFirstLayoutDocument(badKnot).success).toBe(false);

		const badOut = structuredClone(base);
		delete badOut.walls[0]!.centerline.spans[0]!.handleOut;
		expect(validateWallFirstLayoutDocument(badOut).success).toBe(false);

		const badIn = structuredClone(base);
		badIn.walls[0]!.centerline.spans[1]!.handleIn = ['x', 0];
		expect(validateWallFirstLayoutDocument(badIn).success).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// identity + helpers
// ---------------------------------------------------------------------------

describe('P23.11 slice 1 — identity policy and clone/translate helpers', () => {
	it('allocates deterministic bend-point IDs', () => {
		expect(nextWallCurveKnotId('wall-a', [])).toBe('wall-a:knot:1');
		expect(nextWallCurveKnotId('wall-a', [{ id: 'wall-a:knot:1', point: [0, 0] }])).toBe(
			'wall-a:knot:2'
		);
		// A colliding next index advances instead of reusing an existing ID.
		expect(
			nextWallCurveKnotId('wall-a', [
				{ id: 'wall-a:knot:1', point: [0, 0] },
				{ id: 'wall-a:knot:3', point: [1, 1] }
			])
		).toBe('wall-a:knot:4');
	});

	it('deep-clones knots and spans so a candidate cannot alias the baseline', () => {
		const baseline = curvedChain();
		const clone = cloneWallCenterline(baseline);
		expect(clone).toEqual(baseline);

		const cloned = chain(clone);
		cloned.knots[0]!.point[0] = 999;
		cloned.spans[0]!.handleOut[1] = 999;

		const original = chain(baseline);
		expect(original.knots[0]!.point).toEqual([3, 2]);
		expect(original.spans[0]!.handleOut[1]).not.toBe(999);
	});

	it('translates every bend point and every span control by one rigid delta', () => {
		const baseline = curvedChain();
		const moved = chain(translateWallCenterline(baseline, [5, -1]));

		chain(baseline).knots.forEach((knot, index) => {
			expect(moved.knots[index]!.point).toEqual([knot.point[0] + 5, knot.point[1] - 1]);
			// Identity is rigid too: the same knot, moved.
			expect(moved.knots[index]!.id).toBe(knot.id);
		});
		chain(baseline).spans.forEach((span, index) => {
			expect(moved.spans[index]!.handleOut).toEqual([
				span.handleOut[0] + 5,
				span.handleOut[1] - 1
			]);
			expect(moved.spans[index]!.handleIn).toEqual([
				span.handleIn[0] + 5,
				span.handleIn[1] - 1
			]);
		});
	});

	it('keeps a flat line centerline flat under translation', () => {
		expect(translateWallCenterline({ kind: 'line' }, [5, 5])).toEqual({ kind: 'line' });
		expect(cloneWallCenterline({ kind: 'line' })).toEqual({ kind: 'line' });
	});
});

// ---------------------------------------------------------------------------
// the representation swap must not move the curve
// ---------------------------------------------------------------------------

describe('P23.11 slice 1 — representation is behaviour-preserving', () => {
	it('derives exactly the spans the legacy evaluator compiled to cubics', () => {
		const fixtures: LayoutVec2[][] = [
			[[0, 0], [10, 0]],
			[[0, 0], [5, 3], [10, 0]],
			[[0, 0], [3, 2], [7, -2], [10, 0]],
			[[0, 0], [2.5, 1.5], [5, -1], [7.5, 1.5], [10, 0]]
		];
		for (const points of fixtures) {
			const spans = deriveChainSpans(points);
			expect(spans).toHaveLength(points.length - 1);
			const fromSpans = spans.map((span, index) => ({
				start: points[index]!,
				handleOut: span.handleOut,
				handleIn: span.handleIn,
				end: points[index + 1]!
			}));
			expect(fromSpans).toEqual(compileAutoBezierAnchors(points));
		}
	});

	it('samples a stored chain identically to the legacy anchor evaluator', () => {
		const points: LayoutVec2[] = [[0, 0], [3, 2], [7, -2], [10, 0]];
		const spans = deriveChainSpans(points);
		const stored = sampleSegment({
			id: 'wall-a',
			kind: 'cubic-chain',
			cubics: spans.map((span, index) => ({
				start: points[index]!,
				handleOut: span.handleOut,
				handleIn: span.handleIn,
				end: points[index + 1]!
			}))
		});
		const derived = sampleSegment({
			id: 'wall-a',
			kind: 'auto-bezier',
			start: [0, 0],
			end: [10, 0],
			interiorAnchors: [
				{ id: 'wall-a:knot:1', point: [3, 2] },
				{ id: 'wall-a:knot:2', point: [7, -2] }
			]
		});
		expect(stored.samples).toEqual(derived.samples);
		expect(stored.length).toBeCloseTo(derived.length, 12);
	});

	it('samples a forward and a reverse chain traversal of the same curve equally long', () => {
		const document = curvedWallDocument();
		const curved = wall(document);
		const forward = wallCenterlineSamples(curved, [0, 0], [10, 0], 'forward');
		const reverse = wallCenterlineSamples(curved, [0, 0], [10, 0], 'reverse');
		expect(forward).toBeDefined();
		expect(reverse).toBeDefined();
		expect(reverse!.length).toBeCloseTo(forward!.length, 9);

		// A reverse walk mirrors each cubic, so its samples are the forward ones
		// back to front rather than a differently-shaped curve.
		const forwardPoints = forward!.samples.map((sample) => sample.point);
		const reversePoints = reverse!.samples.map((sample) => sample.point);
		expect(reversePoints[0]!).toEqual(forwardPoints.at(-1)!);
		expect(reversePoints.at(-1)!).toEqual(forwardPoints[0]!);
	});

	it('makes convert-to-curve a geometric no-op on a straight Wall', () => {
		const document = straightWallDocument();
		const plan = planConvertWallToCurve(document, 'wall-a');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const converted = plan.document;

		const before = wallFirstWallSpan(document, wall(document));
		const after = wallFirstWallSpan(converted, wall(converted));
		expect(before).toBeDefined();
		expect(after).toBeDefined();
		expect(after!.length).toBeCloseTo(before!.length, 9);

		const sampled = wallCenterlineSamples(wall(converted), [0, 0], [10, 0], 'forward');
		expect(sampled).toBeDefined();
		// Every sample lies on the original straight span.
		for (const sample of sampled!.samples) {
			expect(Math.abs(sample.point[1])).toBeLessThan(1e-9);
			expect(sample.point[0]).toBeGreaterThanOrEqual(-1e-9);
			expect(sample.point[0]).toBeLessThanOrEqual(10 + 1e-9);
		}

		const convertedChain = chain(wall(converted).centerline);
		expect(convertedChain.knots).toHaveLength(1);
		expect(convertedChain.knots[0]!.point).toEqual([5, 0]);
		expect(convertedChain.spans).toHaveLength(2);
	});

	it('emits the canonical piecewise-linear segment shape for both centreline kinds', () => {
		const lineSegment = wallCenterlineSegment(
			{ id: 'wall-a', centerline: { kind: 'line' } },
			[0, 0],
			[10, 0],
			'forward'
		);
		expect(lineSegment.kind).toBe('line');

		const document = curvedWallDocument();
		const chainSegment = wallCenterlineSegment(wall(document), [0, 0], [10, 0], 'forward');
		expect(chainSegment.kind).toBe('cubic-chain');
		if (chainSegment.kind !== 'cubic-chain') return;
		expect(chainSegment.cubics).toHaveLength(3);
	});
});

// ---------------------------------------------------------------------------
// construction sites stay canonical
// ---------------------------------------------------------------------------

describe('P23.11 slice 1 — construction sites keep the canonical shape', () => {
	it('straight Wall split fragments still declare a canonical line centerline', () => {
		const document = straightWallDocument();
		const plan = planWallSplit(document, 'wall-a', 4, nodingAllocator());
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		for (const fragment of plan.document.walls) {
			expect(fragment.centerline.kind).toBe('line');
		}
	});

	it('save/load preserves the chain byte-for-byte', () => {
		const document = curvedWallDocument();
		const once = serializeWallFirstLayoutDocument(document);
		const restored = roundTrip(document);
		expect(serializeWallFirstLayoutDocument(restored)).toBe(once);
		expect(wall(restored).centerline.kind).toBe('cubic-chain');
	});

	it('declares the unchanged canonical format version', () => {
		expect(curvedWallDocument().formatVersion).toBe(LAYOUT_WALL_FIRST_FORMAT_VERSION);
	});
});
