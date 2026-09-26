import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	planRigidWallMove,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from '$lib/bench/p23b-fixtures';
import {
	prepareWallMeshes,
	type PreparedWallMeshSet
} from '$lib/editor/layout/prepared-wall-meshes';

type H6Witness = {
	referenceGeneration: WeakRef<object>;
	newerGeneration: WeakRef<object>;
	sharedMesh: WeakRef<object>;
	/** Strong only so the first stage can prove the reference dies independently. */
	keepNewer: CompiledLayoutGeometry | null;
};

function compile(document: LayoutDocumentWallFirst): CompiledLayoutGeometry {
	const result = compileWallFirstLayoutGeometry(document);
	if (result.issues.length > 0) throw new Error('H-6 fixture compile failed');
	return result.geometry;
}

function preparedSharedGeneration(strongOwner = false): {
	witness: H6Witness;
	strongOwner?: Map<object, PreparedWallMeshSet>;
} {
	const spec = P23B_MATRIX_SPECS.find((entry) => entry.id === 'p23b-40-wall-straight-v1');
	if (!spec) throw new Error('missing H-6 straight fixture');
	const document = buildP23BMatrixFixture(spec);
	const referenceGeometry = compile(document);
	const reference = prepareWallMeshes(referenceGeometry);
	const move = planRigidWallMove(document, document.walls[1]!.id, [0, 0.25]);
	if (move.kind !== 'success') throw new Error(`H-6 accepted move rejected: ${move.rejection.code}`);
	const newerGeneration = compile(move.document);
	const newer = prepareWallMeshes(newerGeneration, referenceGeometry);
	const sharedId = [...newer.wallMeshesByWall.keys()].find(
		(wallId) => newer.wallMeshesByWall.get(wallId) === reference.wallMeshesByWall.get(wallId)
	);
	if (!sharedId) throw new Error('H-6 candidate did not share an unchanged Wall mesh');
	const sharedMesh = newer.wallMeshesByWall.get(sharedId)!;
	const witness: H6Witness = {
		referenceGeneration: new WeakRef(referenceGeometry),
		newerGeneration: new WeakRef(newerGeneration),
		sharedMesh: new WeakRef(sharedMesh),
		keepNewer: newerGeneration
	};
	const strong = strongOwner ? new Map<object, PreparedWallMeshSet>([[newerGeneration, newer]]) : null;
	return strong ? { witness, strongOwner: strong } : { witness };
}

async function forceCollection(): Promise<void> {
	const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
	if (!gc) throw new Error('H-6 forced-GC oracle needs Node --expose-gc');
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	for (let pass = 0; pass < 24; pass += 1) {
		gc();
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
	}
}

function assertReleased(reference: WeakRef<object>): void {
	expect(reference.deref(), 'the weakly owned mesh is released with its last generation').toBeUndefined();
}

describe('P23B.6 S3 H-6 — shared immutable meshes follow generation ownership', () => {
	it.skipIf(typeof (globalThis as typeof globalThis & { gc?: () => void }).gc !== 'function')(
		'releases the reference generation first, then the shared mesh with its last generation',
		async () => {
			const { witness } = preparedSharedGeneration();
			await forceCollection();
			expect(witness.referenceGeneration.deref(), 'the older generation has no cross-generation owner').toBeUndefined();
			expect(witness.sharedMesh.deref(), 'the newer prepared set still owns the shared immutable mesh').toBeDefined();

			witness.keepNewer = null;
			await forceCollection();
			expect(witness.newerGeneration.deref(), 'the newer generation is no longer live').toBeUndefined();
			assertReleased(witness.sharedMesh);
		}
	);

	it.skipIf(typeof (globalThis as typeof globalThis & { gc?: () => void }).gc !== 'function')(
		'H-6 negative control: a strong generation Map fails the release oracle',
		async () => {
			const { witness, strongOwner } = preparedSharedGeneration(true);
			await forceCollection();
			witness.keepNewer = null;
			await forceCollection();
			const stronglyHeldMesh = witness.sharedMesh;
			expect(strongOwner?.size).toBe(1);
			expect(() => assertReleased(stronglyHeldMesh)).toThrow();
			strongOwner?.clear();
			await forceCollection();
			assertReleased(stronglyHeldMesh);
		}
	);
});
