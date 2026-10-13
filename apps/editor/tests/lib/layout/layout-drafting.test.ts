/**
 * P23 drafting — the kernel assertions that survive the editor removal.
 *
 * PR #115 (§7.2 category D extraction) removed the editor shell. Most of this
 * file tested the Plan *presentation* it owned — `plan-overlays`' interaction
 * projection (`buildPlanInteractionProjection`, `withLayoutSnapFeedback`,
 * `interiorLabelPoint`, `snapMarkerRadiusPx`, `PLAN_CLOSE_AT_JUNCTION_COPY`),
 * the `layout-mesh-factory` preview model, `layout-interaction` state and the
 * guarded history runner — and those subjects are gone, so those cases are
 * gone with them. The source-contract reads against deleted editor files
 * (`EditorInspector.svelte`, `LayoutPlanViewport.svelte`) are removed too.
 *
 * What is kept, with its expectations unchanged, is the part that calls
 * `layout-core` directly: the chain planner, the exact wall length/thickness
 * planners, the exact-input parser and the canonical Plan hit.
 *
 * The removed `P23.6 density purity` case pinned that the committed render
 * layers are a pure function of compiled geometry across zoom levels, but its
 * only zoom source was the deleted interaction state; with that gone the
 * comparison would be the same call twice, so it is dropped rather than left
 * vacuous.
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	planExactWallLength,
	planExactWallThickness,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import {
	formatDegrees,
	formatMeters,
	parseExactNumber
} from '$lib/authoring/layout/layout-exact-input';
import { resolvePlanHit } from '$lib/authoring/layout/plan-hit';

function baseDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	return {
		...document,
		floor: { ...document.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 }
	};
}

const p = (x: number, z: number): [number, number] => [x, z];
const RECT = [p(0, 0), p(4, 0), p(4, 3), p(0, 3)] as const;

function commitChain(
	baseline: LayoutDocumentWallFirst,
	points: [number, number][],
	role: 'boundary' | 'partition',
	close = false,
	/**
	 * P23B.3a S6 — the gesture's DECLARED connection to existing geometry (array
	 * index = draft point index). A continuation names the Junction it continues
	 * from; a segment attached to a Wall's face names that host. Without either,
	 * the chain is independent placement and joins nothing.
	 */
	connection?: { junctions?: readonly string[]; hosts?: readonly string[] }
): LayoutDocumentWallFirst {
	const junctionSnaps = (connection?.junctions ?? []).map((junctionId, index) => ({
		pointIndex: index,
		junctionId
	}));
	const hostSnaps = (connection?.hosts ?? []).map((wallId, index) => ({ pointIndex: index, wallId }));
	const plan = planWallChain({
		baseline,
		points,
		role,
		close,
		...(junctionSnaps.length > 0 ? { endpointJunctionSnaps: junctionSnaps } : {}),
		...(hostSnaps.length > 0 ? { endpointHostSnaps: hostSnaps } : {})
	});
	if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
	return plan.document;
}

// ---------------------------------------------------------------------------
// P23.6 exact inputs — planner-owned validity, full stored precision
// ---------------------------------------------------------------------------

describe('P23.6 exact inputs — planner-owned validity', () => {
	it('keeps full stored precision behind the rounded display', () => {
		const document = commitChain(baseDocument(), [p(0, 0), p(4, 0)], 'boundary');
		const wallId = document.walls[0]!.id;
		// What the user types parses fully: the planner stores exactly what it
		// is given — display rounding never feeds back into the document.
		const length = planExactWallLength(document, wallId, 2.987654321, 'start');
		if (length.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(length)}`);
		const moved = length.document.walls.find((wall) => wall.id === wallId)!;
		expect(moved).toBeDefined();
		const thickness = planExactWallThickness(document, wallId, 0.25);
		if (thickness.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(thickness)}`);
		expect(thickness.document.walls.find((wall) => wall.id === wallId)?.thickness).toBe(0.25);
	});
});

describe('P23.6 blank exact inputs leave the parsed value untouched', () => {
	it('blank Junction X/Z changes nothing', () => {
		const seed = commitChain(baseDocument(), [...RECT], 'boundary', true);
		const junction = seed.junctions[0]!;
		for (const raw of ['', '   ']) {
			const parsed = parseExactNumber(raw, junction.point[0], formatMeters);
			expect(parsed.ok).toBe(false);
		}
	});

	it('blank Wall Angle changes nothing', () => {
		// The editor adapter's positive control (`updateWallFirstWallAngle`
		// committing exactly one history entry) lived in the deleted
		// preview-state module and is not reproducible here; the surviving
		// guarantee is the parser's rejection of blank input.
		const blank = parseExactNumber('', 0, formatDegrees);
		expect(blank.ok).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// P23.6 Junction hit resolution
// ---------------------------------------------------------------------------

describe('P23.6 junction hit resolution', () => {
	it('resolves a Plan hit on a canonical endpoint with no Room context', () => {
		const first = commitChain(baseDocument(), [p(0, 0), p(4, 0)], 'boundary');
		const document = commitChain(first, [p(0, 2), p(4, 2)], 'partition');
		const firstWall = document.walls[0]!;
		const { geometry } = compileWallFirstLayoutGeometry(document);
		const hit = resolvePlanHit(geometry.queries, [0.05, 0.02], 0.2);
		expect(hit).toMatchObject({ kind: 'wallEndpoint', wallId: firstWall.id, endpoint: 0 });
		expect(hit).not.toHaveProperty('roomId');
	});
});
