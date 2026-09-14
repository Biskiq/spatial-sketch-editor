/**
 * P23.11 Slice 1 — canonical Wall curve schema.
 *
 * The `centerline` union is required on every persisted Wall (fresh-authority
 * policy: no migration, no missing-field tolerance). Straight Walls carry
 * `{ kind: 'line' }`; curved Walls carry an ordered anchor list. Cloning and
 * every constructor site must produce/preserve canonical centerline data.
 */
import { describe, expect, it } from 'vitest';

import type { LayoutDocumentWallFirst, LayoutWall } from '$lib/layout/layout-wall-first-types';
import {
	createEmptyWallFirstLayoutDocument,
	parseWallFirstLayoutDocumentJson,
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument
} from '$lib/layout/layout-wall-first-codec';
import { cloneWallCenterline } from '@portfolio/layout-core';
import { planDuplicateIsolatedRoom } from '$lib/layout/layout-duplicate';
import { planWallSplit } from '$lib/layout/layout-wall-noding';
import { planWallChain } from '$lib/layout/layout-wall-chain';

import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-compat';

const nodingAllocator = {
	nextWallId(base: LayoutDocumentWallFirst, seed: string): string {
		const taken = new Set(base.walls.map((wall) => wall.id));
		return allocate(taken, seed);
	},
	nextJunctionId(base: LayoutDocumentWallFirst, seed: string): string {
		const taken = new Set(base.junctions.map((junction) => junction.id));
		return allocate(taken, seed);
	}
};

function allocate(taken: ReadonlySet<string>, seed: string): string {
	if (!taken.has(seed)) return seed;
	let index = 2;
	while (taken.has(`${seed}.${index}`)) index += 1;
	return `${seed}.${index}`;
}

function straightDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	document.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [6, 0] }
	];
	document.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			role: 'partition',
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' }
		}
	];
	return document;
}

function curvedDocument(): LayoutDocumentWallFirst {
	const document = straightDocument();
	document.walls = [
		{
			...document.walls[0]!,
			centerline: {
				kind: 'auto-bezier',
				interiorAnchors: [
					{ id: 'wall-a:anchor:1', point: [3, 2] },
					{ id: 'wall-a:anchor:2', point: [4, 2.5] }
				]
			}
		}
	];
	return document;
}

describe('P23.11 slice 1 — wall centerline codec', () => {
	it('round-trips a straight Wall with its line centerline', () => {
		const result = parseWallFirstLayoutDocumentJson(
			serializeWallFirstLayoutDocument(straightDocument())
		);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.document.walls[0]!.centerline).toEqual({ kind: 'line' });
	});

	it('round-trips a curved Wall preserving anchor order and IDs', () => {
		const document = curvedDocument();
		const json = serializeWallFirstLayoutDocument(document);
		const result = parseWallFirstLayoutDocumentJson(json);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.document.walls[0]!.centerline).toEqual(document.walls[0]!.centerline);
		expect(result.canonicalJson).toBe(json);
	});

	it('rejects a Wall with a missing centerline (fresh-authority: required field)', () => {
		const payload = JSON.parse(serializeWallFirstLayoutDocument(straightDocument()));
		delete payload.walls[0].centerline;
		const result = parseWallFirstLayoutDocumentJson(JSON.stringify(payload));
		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.issues.map((issue) => issue.code)).toContain('invalid_type');
	});

	it('rejects a curved centerline with zero anchors', () => {
		const document = curvedDocument();
		(document.walls[0]!.centerline as { interiorAnchors: unknown[] }).interiorAnchors = [];
		const result = validateWallFirstLayoutDocument(document);
		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.issues.map((issue) => issue.code)).toContain('empty_array');
	});

	it('rejects non-finite anchor points', () => {
		const document = curvedDocument();
		(
			(document.walls[0]!.centerline as { interiorAnchors: Array<{ point: number[] }> })
				.interiorAnchors[0] as { point: number[] }
		).point = [Number.NaN, 2];
		const result = validateWallFirstLayoutDocument(document);
		expect(result.success).toBe(false);
	});

	it('rejects duplicate anchor IDs', () => {
		const document = curvedDocument();
		const anchors = (document.walls[0]!.centerline as { interiorAnchors: Array<{ id: string }> })
			.interiorAnchors;
		anchors[1]!.id = anchors[0]!.id;
		const result = validateWallFirstLayoutDocument(document);
		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.issues.map((issue) => issue.code)).toContain('duplicate_id');
	});

	it('rejects an unknown centerline kind', () => {
		const document = straightDocument();
		(document.walls[0] as { centerline: unknown }).centerline = { kind: 'nurbs' };
		const result = validateWallFirstLayoutDocument(document);
		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.issues.map((issue) => issue.code)).toContain('unsupported_value');
	});
});

describe('P23.11 slice 1 — centerline cloning', () => {
	it('deep-clones a curved centerline (no shared anchors or points)', () => {
		const centerline = {
			kind: 'auto-bezier' as const,
			interiorAnchors: [{ id: 'a1', point: [1, 2] as [number, number] }]
		};
		const clone = cloneWallCenterline(centerline);
		expect(clone).toEqual(centerline);
		expect(clone).not.toBe(centerline);
		if (clone.kind === 'auto-bezier') {
			expect(clone.interiorAnchors).not.toBe(centerline.interiorAnchors);
			expect(clone.interiorAnchors[0]).not.toBe(centerline.interiorAnchors[0]);
			expect(clone.interiorAnchors[0]!.point).not.toBe(centerline.interiorAnchors[0]!.point);
			clone.interiorAnchors[0]!.point[0] = 99;
			expect(centerline.interiorAnchors[0]!.point[0]).toBe(1);
		}
	});

	it('deep-clones a line centerline', () => {
		expect(cloneWallCenterline({ kind: 'line' })).toEqual({ kind: 'line' });
	});
});

describe('P23.11 slice 1 — canonical Wall constructors', () => {
	it('wall-chain birth emits a straight centerline', () => {
		const plan = planWallChain({
			baseline: createEmptyWallFirstLayoutDocument(),
			points: [[0, 0], [4, 0]],
			close: false,
			role: 'partition',
			height: 3
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		for (const wall of plan.document.walls) {
			expect(wall.centerline).toEqual({ kind: 'line' });
		}
	});

	it('wall-split fragments emit straight centerlines', () => {
		const plan = planWallSplit(straightDocument(), 'wall-a', 2, nodingAllocator);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.walls.map((wall) => wall.centerline)).toEqual([
			{ kind: 'line' },
			{ kind: 'line' }
		]);
	});

	it('room-duplicate clones preserve curved centerline data', () => {
		const document = curvedDocument();
		document.junctions = [
			{ id: 'j-a', point: [0, 0] },
			{ id: 'j-b', point: [6, 0] },
			{ id: 'j-c', point: [6, 4] }
		];
		document.walls = [
			{
				id: 'wall-a',
				startJunctionId: 'j-a',
				endJunctionId: 'j-b',
				role: 'boundary',
				thickness: 0.2,
				height: 3,
				centerline: {
					kind: 'auto-bezier',
					interiorAnchors: [{ id: 'wall-a:anchor:1', point: [3, 1] }]
				}
			},
			{
				id: 'wall-b',
				startJunctionId: 'j-b',
				endJunctionId: 'j-c',
				role: 'boundary',
				thickness: 0.2,
				height: 3,
				centerline: { kind: 'line' }
			},
			{
				id: 'wall-c',
				startJunctionId: 'j-c',
				endJunctionId: 'j-a',
				role: 'boundary',
				thickness: 0.2,
				height: 3,
				centerline: { kind: 'line' }
			}
		];
		document.rooms = [
			{
				id: 'room-a',
				name: 'Room A',
				boundary: [
					{ wallId: 'wall-a', direction: 'forward' },
					{ wallId: 'wall-b', direction: 'forward' },
					{ wallId: 'wall-c', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		];
		const plan = planDuplicateIsolatedRoom(document, { roomId: 'room-a', delta: [10, 0] });
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const sourceCenterline = document.walls[0]!.centerline;
		// Every cloned wall must carry a centerline.
		for (const wall of plan.document.walls) {
			expect(wall.centerline).toBeDefined();
		}
		const curvedClones = plan.document.walls.filter(
			(wall) => wall.id !== 'wall-a' && wall.centerline.kind === 'auto-bezier'
		);
		expect(curvedClones).toHaveLength(1);
		const cloneCenterline = curvedClones[0]!.centerline;
		expect(cloneCenterline.kind).toBe('auto-bezier');
		expect(sourceCenterline.kind).toBe('auto-bezier');
		if (cloneCenterline.kind !== 'auto-bezier' || sourceCenterline.kind !== 'auto-bezier') return;
		// P23.11 slice 2 — anchors are absolute document X/Z, so the copy's
		// anchors translate with its Junctions. Leaving them behind would not
		// preserve the shape: the curve would swing across the source-position
		// anchors and cross a sibling Wall of the copy (rejected compile).
		expect(cloneCenterline.interiorAnchors).toEqual([
			{ id: 'wall-a:anchor:1', point: [13, 1] }
		]);
		// Deep copy: the copy never shares anchor arrays or points with the
		// source, and the baseline's own anchor is untouched.
		expect(cloneCenterline.interiorAnchors).not.toBe(sourceCenterline.interiorAnchors);
		expect(cloneCenterline.interiorAnchors[0]).not.toBe(sourceCenterline.interiorAnchors[0]);
		expect(sourceCenterline.interiorAnchors).toEqual([
			{ id: 'wall-a:anchor:1', point: [3, 1] }
		]);
	});

	it('every wall in an accepted wall-chain document validates with centerline required', () => {
		const plan = planWallChain({
			baseline: createEmptyWallFirstLayoutDocument(),
			points: [[0, 0], [3, 0], [3, 3]],
			close: false,
			role: 'boundary',
			height: 3
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const result = validateWallFirstLayoutDocument(plan.document);
		expect(result.success).toBe(true);
		for (const wall of plan.document.walls as LayoutWall[]) {
			expect(wall.centerline.kind).toBe('line');
		}
	});
});
