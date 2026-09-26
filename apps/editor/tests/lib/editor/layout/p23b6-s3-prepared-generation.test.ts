import { describe, expect, it } from 'vitest';

import {
	compileLayoutGeometry,
	compileWallFirstLayoutGeometry,
	planRigidWallMove,
	planWallFirstRoomMove,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS, P23B_OWNER_LAYOUT } from '$lib/bench/p23b-fixtures';
import { g1LineRectangleDocument } from '../../layout/__fixtures__/layout-g1-fixtures';
import {
	getPreparedWallMeshes,
	prepareWallMeshes,
	s1ObjectKeysDeepEqual,
	type PreparedWallMeshSet
} from '$lib/editor/layout/prepared-wall-meshes';
import { buildStandaloneWallMesh, type IndexedWallMesh } from '$lib/layout/wall-mesh-builder';

const fixtureIds = [
	'p23b-40-wall-straight-v1',
	'p23b-40-wall-target-curved-v1',
	'p23b-40-wall-all-curved-v1'
];

function compile(document: LayoutDocumentWallFirst): CompiledLayoutGeometry {
	const result = compileWallFirstLayoutGeometry(document);
	if (result.issues.length > 0) {
		throw new Error(`fixture compile failed: ${result.issues.map((issue) => issue.code).join(', ')}`);
	}
	return result.geometry;
}

function fixtures(): Array<{ id: string; document: LayoutDocumentWallFirst }> {
	return [
		...fixtureIds.map((id) => {
			const spec = P23B_MATRIX_SPECS.find((entry) => entry.id === id);
			if (!spec) throw new Error(`missing fixture ${id}`);
			return { id, document: buildP23BMatrixFixture(spec) };
		}),
		{ id: 'owner-40-curved-v1', document: P23B_OWNER_LAYOUT }
	];
}

function acceptedActions(document: LayoutDocumentWallFirst, fixtureId: string) {
	const wall = document.walls.find((entry) => entry.id.endsWith(':wall-1')) ?? document.walls[1]!;
	const wallMove = planRigidWallMove(document, wall.id, [0, 0.25]);
	const roomMove = document.rooms[0]
		? planWallFirstRoomMove(document, document.rooms[0].id, [0.25, 0])
		: null;
	return [
		{
			name: 'accepted-single-Wall release',
			expectedHits:
				fixtureId === 'p23b-40-wall-all-curved-v1' || fixtureId === 'owner-40-curved-v1' ? 37 : 36,
			document: wallMove.kind === 'success' ? wallMove.document : null
		},
		{
			name: 'whole-Room bridge',
			expectedHits: 36,
			document: roomMove?.kind === 'success' ? roomMove.document : null
		}
	];
}

function assertHitCount(set: PreparedWallMeshSet, expected: number): void {
	expect(set.stats.reused, 'the prepared generation reused the expected Wall meshes').toBe(expected);
}

function assertMeshParity(actual: IndexedWallMesh, expected: IndexedWallMesh): void {
	expect(actual).toEqual(expected);
}

describe('P23B.6 S3 — one prepared generation reuses only value-equal canonical Wall meshes', () => {
	for (const { id, document } of fixtures()) {
		for (const action of acceptedActions(document, id)) {
			it(`OR-HIT ${id} ${action.name}`, () => {
				if (!action.document) throw new Error(`${id} ${action.name} fixture action was rejected`);
				const referenceGeometry = compile(document);
				const reference = prepareWallMeshes(referenceGeometry);
				const candidateGeometry = compile(action.document);
				const prepared = prepareWallMeshes(candidateGeometry, referenceGeometry);

				assertHitCount(prepared, action.expectedHits);
				expect(prepared.stats.built + prepared.stats.reused).toBe(document.walls.length);
				expect(Object.values(prepared.stats.refusedByReason).reduce((sum, count) => sum + (count ?? 0), 0))
					.toBe(prepared.stats.built);
				const reusedId = [...prepared.wallMeshesByWall.keys()].find(
					(wallId) => prepared.wallMeshesByWall.get(wallId) === reference.wallMeshesByWall.get(wallId)
				);
				expect(reusedId, 'reuse comes from value equality across distinct compiled objects').toBeDefined();
				expect(prepared.wallMeshInputsByWall.get(reusedId!)!.wall).not.toBe(
					reference.wallMeshInputsByWall.get(reusedId!)!.wall
				);
				expect(prepared.wallMeshIssuesByWall.get(reusedId!)).toEqual([]);
				expect(prepared.wallMeshIssuesByWall.get(reusedId!)).not.toBe(
					reference.wallMeshIssuesByWall.get(reusedId!)
				);
				expect(getPreparedWallMeshes(candidateGeometry)).toBe(prepared);
				expect(reference.stats.reused).toBe(0);
			});
		}
	}

	it('OR-HIT negative control: no reference fails the positive-hit oracle', () => {
		const document = buildP23BMatrixFixture(
			P23B_MATRIX_SPECS.find((entry) => entry.id === 'p23b-40-wall-straight-v1')!
		);
		const move = planRigidWallMove(document, document.walls[1]!.id, [0, 0.25]);
		if (move.kind !== 'success') throw new Error(`negative-control move rejected: ${move.rejection.code}`);
		const noReference = prepareWallMeshes(compile(move.document));
		expect(noReference.stats.reused).toBe(0);
		expect(() => assertHitCount(noReference, 36)).toThrow();
	});

	it('legacy Room meshes are rebuilt and never cross-generation reused', () => {
		const document = g1LineRectangleDocument();
		const referenceGeometry = compileLayoutGeometry(document).geometry;
		const reference = prepareWallMeshes(referenceGeometry);
		const candidateGeometry = compileLayoutGeometry(document).geometry;
		const candidate = prepareWallMeshes(candidateGeometry, referenceGeometry);
		expect(referenceGeometry.walls).toEqual([]);
		expect(candidate.stats.reused).toBe(0);
		expect(candidate.wallMeshesByRoom.size).toBeGreaterThan(0);
		for (const [roomId, mesh] of candidate.wallMeshesByRoom) {
			expect(mesh).not.toBe(reference.wallMeshesByRoom.get(roomId));
		}
	});

	it('OR-5: every prepared mesh equals a scratch build on the watertight matrix actions', () => {
		for (const { id, document } of fixtures()) {
			const referenceGeometry = compile(document);
			prepareWallMeshes(referenceGeometry);
			for (const action of acceptedActions(document, id)) {
				if (!action.document) throw new Error(`${id} ${action.name} fixture action was rejected`);
				const candidateGeometry = compile(action.document);
				const prepared = prepareWallMeshes(candidateGeometry, referenceGeometry);
				// The prepared module's canonical input map is the oracle source for the exact builder arguments.
				for (const [wallId, input] of prepared.wallMeshInputsByWall) {
					const scratch = buildStandaloneWallMesh(input.wall, input.floorElevation, input.ends);
					expect(scratch.issues, `${id} ${action.name} ${wallId} issues`).toEqual(
						prepared.wallMeshIssuesByWall.get(wallId)
					);
					if (scratch.mesh) {
						const actual = prepared.wallMeshesByWall.get(wallId);
						expect(actual, `${wallId} prepared mesh exists`).toBeDefined();
						assertMeshParity(actual!, scratch.mesh);
					}
				}
				expect(prepared.wallMeshInputsByWall.size).toBe(40);
			}
		}
	}, 15_000);

	it('OR-5 negative control: a corrupted reused mesh fails the parity assertion', () => {
		const document = buildP23BMatrixFixture(
			P23B_MATRIX_SPECS.find((entry) => entry.id === 'p23b-40-wall-straight-v1')!
		);
		const referenceGeometry = compile(document);
		const reference = prepareWallMeshes(referenceGeometry);
		const move = planRigidWallMove(document, document.walls[1]!.id, [0, 0.25]);
		if (move.kind !== 'success') throw new Error(`negative-control move rejected: ${move.rejection.code}`);
		const candidateGeometry = compile(move.document);
		const prepared = prepareWallMeshes(candidateGeometry, referenceGeometry);
		const reusedId = [...reference.wallMeshesByWall.keys()].find(
			(wallId) => prepared.wallMeshesByWall.get(wallId) === reference.wallMeshesByWall.get(wallId)
		);
		if (!reusedId) throw new Error('fixture did not reuse a Wall mesh');
		const input = prepared.wallMeshInputsByWall.get(reusedId)!;
		const scratch = buildStandaloneWallMesh(input.wall, input.floorElevation, input.ends).mesh!;
		const corrupted = structuredClone(prepared.wallMeshesByWall.get(reusedId)!);
		corrupted.positions[0] = corrupted.positions[0]! + 1;
		expect(() => assertMeshParity(corrupted, scratch)).toThrow();
	});

	it('OR-8 lifecycle: edits, replacement, and restore resolve to the right generation set', () => {
		const document = buildP23BMatrixFixture(
			P23B_MATRIX_SPECS.find((entry) => entry.id === 'p23b-40-wall-straight-v1')!
		);
		const initialGeometry = compile(document);
		const initial = prepareWallMeshes(initialGeometry);
		const target = document.walls[1]!;
		const move = planRigidWallMove(document, target.id, [0, 0.25]);
		if (move.kind !== 'success') throw new Error(`OR-8 edit rejected: ${move.rejection.code}`);
		const editedGeometry = compile(move.document);
		const edited = prepareWallMeshes(editedGeometry, initialGeometry);
		expect(edited.wallMeshesByWall.get(target.id)).not.toBe(initial.wallMeshesByWall.get(target.id));
		const unchangedId = [...initial.wallMeshesByWall.keys()].find(
			(wallId) => edited.wallMeshesByWall.get(wallId) === initial.wallMeshesByWall.get(wallId)
		);
		expect(unchangedId, 'at least one value-equal Wall retained its mesh').toBeDefined();

		const replacementGeometry = compile(P23B_OWNER_LAYOUT);
		const replacement = prepareWallMeshes(replacementGeometry);
		expect(replacement.stats.reused).toBe(0);
		expect(getPreparedWallMeshes(initialGeometry)).toBe(initial);
		expect(getPreparedWallMeshes(editedGeometry)).toBe(edited);
		// Restore uses the already prepared canonical generation; the active set is not stale.
		expect(prepareWallMeshes(initialGeometry, editedGeometry)).toBe(initial);
	});

	it('OR-8 negative control: passing the stale baseline mesh for a changed Wall fails parity', () => {
		const document = buildP23BMatrixFixture(
			P23B_MATRIX_SPECS.find((entry) => entry.id === 'p23b-40-wall-straight-v1')!
		);
		const initialGeometry = compile(document);
		const initial = prepareWallMeshes(initialGeometry);
		const target = document.walls[1]!;
		const move = planRigidWallMove(document, target.id, [0, 0.25]);
		if (move.kind !== 'success') throw new Error(`negative-control move rejected: ${move.rejection.code}`);
		const edited = prepareWallMeshes(compile(move.document), initialGeometry);
		const changedInput = edited.wallMeshInputsByWall.get(target.id)!;
		const scratch = buildStandaloneWallMesh(changedInput.wall, changedInput.floorElevation, changedInput.ends).mesh!;
		const stale = initial.wallMeshesByWall.get(target.id)!;
		expect(() => assertMeshParity(stale, scratch)).toThrow();
	});

	it('OR-9 integrated structural guard: a non-enumerable future Wall field refuses all generation reuse', () => {
		const document = buildP23BMatrixFixture(
			P23B_MATRIX_SPECS.find((entry) => entry.id === 'p23b-40-wall-straight-v1')!
		);
		const referenceGeometry = compile(document);
		prepareWallMeshes(referenceGeometry);
		const candidateGeometry = structuredClone(referenceGeometry);
		const candidateWall = candidateGeometry.walls[1]! as typeof candidateGeometry.walls[number] & {
			p26FutureField?: { profile: number[] };
		};
		Object.defineProperty(candidateWall, 'p26FutureField', {
			value: { profile: [0, 1, 3] },
			enumerable: false
		});
		const prepared = prepareWallMeshes(candidateGeometry, referenceGeometry);
		const referenceWall = referenceGeometry.walls[1]!;
		expect(s1ObjectKeysDeepEqual(candidateWall, referenceWall)).toBe(true);
		expect(prepared.reuseInputsStructureValid).toBe(false);
		expect(prepared.stats.reused).toBe(0);
		expect(prepared.stats.refusedByReason['non-plain-data-input']).toBe(40);
		expect(() => assertHitCount(prepared, 1)).toThrow();
		// The existing weak-keyed entry stores the verdict; an exact-generation hit does no new preparation.
		expect(prepareWallMeshes(candidateGeometry, referenceGeometry)).toBe(prepared);
	});
});
