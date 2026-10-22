/**
 * P23.6 canonical Wall / Room selection — compiler and Plan hit contract.
 *
 * PR #115 (§7.2 category D extraction) removed the editor shell and, with it,
 * the old Plan presentation model (`lib/layout/plan-render-model.ts`, §5.1
 * REMOVE). This file keeps the assertions whose subject survives: compiled
 * geometry shape and `resolvePlanHit` (now `$lib/authoring/layout/plan-hit`).
 * The fixture builders call `layout-core` directly.
 *
 * Gone with their subjects: the highlight/hover style language and the
 * endpoint-LOD *rendering* checks, which asserted `buildPlanRenderModel`
 * primitives; the `layout-interaction` selection authority and
 * `reconcileLayoutSelection` contract; and the source-contract reads against
 * deleted editor files (`LayoutDraftToolbar.svelte`,
 * `LayoutPlanViewport.svelte`, `EditorInspector.svelte`,
 * `UnifiedProjectTree.svelte`).
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	deriveLayoutWallRole,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { resolvePlanHit } from '$lib/authoring/layout/plan-hit';
import { freshCapture } from './__fixtures__/layout-id-capture';

/** Empty wall-first document with a real floor record (P23.9 precedent). */
function baseDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	return {
		...document,
		floor: { ...document.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 }
	};
}

const p = (x: number, z: number): [number, number] => [x, z];

function commitChain(
	baseline: LayoutDocumentWallFirst,
	points: [number, number][]
): LayoutDocumentWallFirst {
	const plan = planWallChain({ baseline, points, close: false, capture: freshCapture() });
	if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
	return plan.document;
}

/** Two open Walls that close no ring, so both are free-standing (no Rooms). */
function twoWallDocument(): LayoutDocumentWallFirst {
	const first = commitChain(baseDocument(), [p(0, 0), p(4, 0)]);
	return commitChain(first, [p(0, 2), p(4, 2)]);
}

describe('P23.6 canonical Wall selection — compiler contract', () => {
	it('emits both Walls with their derived (free-standing) role and no Rooms', () => {
		const document = twoWallDocument();
		expect(document.rooms).toHaveLength(0);
		expect(document.walls.map((wall) => deriveLayoutWallRole(document, wall.id))).toEqual([
			'free-standing',
			'free-standing'
		]);
		const { geometry } = compileWallFirstLayoutGeometry(document);
		expect(geometry.walls).toHaveLength(2);
		expect(new Set(geometry.walls.map((wall) => wall.role))).toEqual(new Set(['free-standing']));
	});
});

describe('P23.6 canonical Wall hit resolution', () => {
	it('resolves a Plan hit on a roomless Wall with no fake roomId', () => {
		const document = twoWallDocument();
		const { geometry } = compileWallFirstLayoutGeometry(document);
		const [first] = document.walls;
		const hit = resolvePlanHit(geometry.queries, [2, 0.05], 0.2);
		expect(hit?.kind).toBe('physicalWall');
		if (hit?.kind === 'physicalWall') expect(hit.wallId).toBe(first!.id);
		// Far from every Wall and with no Rooms, there is no hit at all.
		expect(resolvePlanHit(geometry.queries, [20, 20], 0.2)).toBeNull();
	});
});

describe('P23.6 single-Wall chain role derivation', () => {
	it('derives free-standing for a single Wall that closes no ring', () => {
		const document = commitChain(baseDocument(), [p(0, 0), p(2, 0)]);
		expect(
			document.walls.every((wall) => deriveLayoutWallRole(document, wall.id) === 'free-standing')
		).toBe(true);
		expect(document.rooms).toHaveLength(0);
	});
});

describe('P23.6 wall-first Room selection', () => {
	function roomed(): LayoutDocumentWallFirst {
		const plan = planWallChain({
			baseline: baseDocument(),
			points: [p(0, 0), p(4, 0), p(4, 3), p(0, 3)],
			close: true,
			capture: freshCapture()
		});
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		return plan.document;
	}

	it('resolves a Plan hit inside the Room with no legacy context', () => {
		const document = roomed();
		const { geometry } = compileWallFirstLayoutGeometry(document);
		const hit = resolvePlanHit(geometry.queries, [2, 1.5], 0.2);
		expect(hit).toEqual({ kind: 'room', roomId: document.rooms[0]!.id });
	});
});

describe('P23.10 direct-edit hit priority — an Opening owns its own body', () => {
	it('keeps an Opening hit ahead of the host Wall body, so Wall drag never grabs a door', () => {
		const document = twoWallDocument();
		const [first] = document.walls;
		document.openings.push({
			id: 'door',
			wallId: first!.id,
			kind: 'door',
			offset: 1,
			width: 1,
			height: 2,
			sillHeight: 0,
			profile: 'rectangular'
		});
		const { geometry } = compileWallFirstLayoutGeometry(document);
		// Mid-Opening: the Opening wins (and carries no Room context).
		expect(resolvePlanHit(geometry.queries, [1.5, 0.02], 0.2)).toMatchObject({
			kind: 'wallOpening',
			wallId: first!.id,
			openingId: 'door'
		});
		// Clear of the Opening: the Wall body is the hit again.
		expect(resolvePlanHit(geometry.queries, [3, 0.02], 0.2)).toMatchObject({
			kind: 'physicalWall',
			wallId: first!.id
		});
	});
});

describe('P23.6 endpoint LOD — invisible endpoints lose hit authority', () => {
	it('lets the physical Wall win below the Junction-handle zoom floor', () => {
		const document = twoWallDocument();
		const { geometry } = compileWallFirstLayoutGeometry(document);
		const [first] = document.walls;
		const near = resolvePlanHit(geometry.queries, [0.05, 0.02], 0.2);
		expect(near?.kind).toBe('wallEndpoint');
		const far = resolvePlanHit(geometry.queries, [0.05, 0.02], 0.2, { includeEndpoints: false });
		expect(far).toMatchObject({ kind: 'physicalWall', wallId: first!.id });
	});
});
