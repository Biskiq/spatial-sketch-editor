import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	legJoinsByWall,
	type CompiledPhysicalWall,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import {
	buildStandaloneWallMesh,
	STANDALONE_WALL_MESH_BUILDER_SIGNATURE,
	type IndexedWallMesh
} from '$lib/layout/wall-mesh-builder';
import {
	prepareWallMesh,
	preparedWallMeshInput,
	type PreparedWallMeshInput,
	type PreparedWallMeshReference
} from '$lib/editor/layout/prepared-wall-meshes';
import {
	buildStandaloneWallMesh as buildMuseumStandaloneWallMesh
} from '../../../../../museum/src/lib/layout/wall-mesh-builder';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from '$lib/bench/p23b-fixtures';

const WALL_ID = 'room-0:wall-0';

function fixtureDocument(
	openings: Array<{ id: string; offset: number; width: number }> = []
): LayoutDocumentWallFirst {
	const spec = P23B_MATRIX_SPECS.find((entry) => entry.id === 'p23b-12-wall-straight-v1');
	if (!spec) throw new Error('missing straight 12-Wall contract fixture');
	const document = buildP23BMatrixFixture(spec);
	document.openings = openings.map(({ id, offset, width }) => ({
		id,
		wallId: WALL_ID,
		kind: 'door',
		offset,
		width,
		height: 2.1,
		sillHeight: 0,
		profile: 'rectangular'
	}));
	return document;
}

function inputFor(document: LayoutDocumentWallFirst): PreparedWallMeshInput {
	const compiled = compileWallFirstLayoutGeometry(document);
	const wall = compiled.geometry.walls.find((entry) => entry.wallId === WALL_ID);
	if (!wall) throw new Error(`fixture did not compile ${WALL_ID}`);
	const floorElevation = compiled.geometry.floors.find((floor) => floor.floorId === wall.floorId)?.elevation;
	if (floorElevation === undefined) throw new Error(`fixture has no floor for ${WALL_ID}`);
	const ends = legJoinsByWall(compiled.geometry.junctions).get(WALL_ID) ?? null;
	return preparedWallMeshInput(wall, floorElevation, ends);
}

function clone<T>(value: T): T {
	return structuredClone(value);
}

function meshFor(input: PreparedWallMeshInput): IndexedWallMesh {
	const result = buildStandaloneWallMesh(input.wall, input.floorElevation, input.ends);
	if (!result.mesh) {
		throw new Error(`fixture mesh failed: ${result.issues.map((issue) => issue.code).join(', ')}`);
	}
	return result.mesh;
}

function changedWall(
	input: PreparedWallMeshInput,
	change: (wall: CompiledPhysicalWall) => void
): PreparedWallMeshInput {
	const wall = clone(input.wall);
	change(wall);
	return { ...input, wall };
}

describe('P23B.6 S3b — canonical builder closure and D-5 refusal matrix', () => {
	const base = inputFor(fixtureDocument([{ id: 'door-1', offset: 1.5, width: 0.9 }]));
	const baseMesh = meshFor(base);
	const reference: PreparedWallMeshReference = { input: base, mesh: baseMesh };

	it('uses the builder-signature contract from the byte-identical editor and museum mirrors', () => {
		expect(STANDALONE_WALL_MESH_BUILDER_SIGNATURE).toBe(
			'buildStandaloneWallMesh(v1:whole-wall,floor-elevation,resolved-ends)'
		);
		const editorResult = buildStandaloneWallMesh(base.wall, base.floorElevation, base.ends);
		const museumResult = buildMuseumStandaloneWallMesh(base.wall, base.floorElevation, base.ends);
		expect(editorResult.mesh).toEqual(museumResult.mesh);
	});

	it('keeps the opt-in diagnostic timer outside the mesh data dependency closure', () => {
		const global = globalThis as typeof globalThis & { __P2311_PERF__?: boolean };
		const previous = global.__P2311_PERF__;
		try {
			global.__P2311_PERF__ = false;
			const withoutMarks = buildStandaloneWallMesh(base.wall, base.floorElevation, base.ends).mesh;
			global.__P2311_PERF__ = true;
			const withMarks = buildMuseumStandaloneWallMesh(base.wall, base.floorElevation, base.ends).mesh;
			expect(withMarks).toEqual(withoutMarks);
		} finally {
			if (previous === undefined) delete global.__P2311_PERF__;
			else global.__P2311_PERF__ = previous;
		}
	});

	it.each([
		[
			'sample moved',
			changedWall(base, (wall) => { wall.samples[0]!.point[0] += 0.1; }),
			'compiled-wall-changed'
		],
		[
			'thickness',
			changedWall(base, (wall) => { wall.thickness += 0.025; }),
			'compiled-wall-changed'
		],
		[
			'height',
			changedWall(base, (wall) => { wall.height += 0.1; }),
			'compiled-wall-changed'
		],
		[
			'hosted Opening added',
			inputFor(fixtureDocument([
				{ id: 'door-1', offset: 1.5, width: 0.9 },
				{ id: 'door-2', offset: 5, width: 0.9 }
			])),
			'compiled-wall-changed'
		],
		[
			'hosted Opening moved',
			inputFor(fixtureDocument([{ id: 'door-1', offset: 1.75, width: 0.9 }])),
			'compiled-wall-changed'
		],
		[
			'hosted Opening resized',
			inputFor(fixtureDocument([{ id: 'door-1', offset: 1.5, width: 1.1 }])),
			'compiled-wall-changed'
		],
		[
			'section changed',
			changedWall(base, (wall) => {
				if (!wall.sections[0]) throw new Error('fixture has no compiled Wall section');
				wall.sections[0].topY += 0.1;
			}),
			'compiled-wall-changed'
		],
		[
			'solid span changed',
			changedWall(base, (wall) => {
				if (!wall.solidSpans[0]) throw new Error('fixture has no compiled solid span');
				wall.solidSpans[0].topY += 0.1;
			}),
			'compiled-wall-changed'
		],
		[
			'connected Junction moved (resolved corner changed)',
			(() => {
				const ends = clone(base.ends);
				if (!ends?.end?.corner || ends.end.corner.front.kind !== 'miter') {
					throw new Error('fixture has no resolved connected miter corner');
				}
				ends.end.corner.front.apex[0] += 0.1;
				return { ...base, ends };
			})(),
			'resolved-ends-changed'
		],
		[
			'adjacent Wall moved (resolved neighbor fact changed)',
			(() => {
				const ends = clone(base.ends);
				if (!ends?.end?.neighbor) throw new Error('fixture has no resolved adjacent Wall');
				ends.end.neighbor.tangentOut[0] += 0.1;
				return { ...base, ends };
			})(),
			'resolved-ends-changed'
		],
		[
			'Floor elevation',
			{ ...base, floorElevation: base.floorElevation + 1 },
			'floor-elevation-changed'
		],
		[
			'Wall role',
			changedWall(base, (wall) => {
				wall.role = wall.role === 'boundary' ? 'partition' : 'boundary';
			}),
			'compiled-wall-changed'
		],
		[
			'builder-signature tag',
			{ ...base, builderSignature: `${base.builderSignature}:changed` },
			'builder-signature-changed'
		]
	] as const)('%s makes the preparation refuse reuse and run the builder', (_row, candidate, reason) => {
		let buildCalls = 0;
		const result = prepareWallMesh(candidate, reference, () => {
			buildCalls += 1;
			return buildStandaloneWallMesh(candidate.wall, candidate.floorElevation, candidate.ends);
		});
		expect(result.reused, `${_row} must refuse`).toBe(false);
		expect(result.refusalReason).toBe(reason);
		expect(buildCalls, `${_row} must call the builder`).toBe(1);
	});

	it('refuses reuse when a future compiled field exists in both generations with a changed value', () => {
		const referenceInput = {
			...base,
			wall: { ...base.wall, p26FutureField: { profile: [0, 1, 2] } } as CompiledPhysicalWall
		};
		const candidate = {
			...base,
			wall: { ...base.wall, p26FutureField: { profile: [0, 1, 3] } } as CompiledPhysicalWall
		};
		let buildCalls = 0;
		const result = prepareWallMesh(candidate, { input: referenceInput, mesh: baseMesh }, () => {
			buildCalls += 1;
			return buildStandaloneWallMesh(candidate.wall, candidate.floorElevation, candidate.ends);
		});
		expect(result.reused).toBe(false);
		expect(result.refusalReason).toBe('compiled-wall-changed');
		expect(buildCalls).toBe(1);
	});

	it('reuses the unchanged Wall mesh when a new independent overlapping group appears', () => {
		// A new independent group changes the generation around this Wall, but it
		// changes none of this Wall's compiled inputs or its resolved ends.
		const independentOverlappingGroup = { wallId: 'independent-overlap', bounds: clone(base.wall.bounds2) };
		expect(independentOverlappingGroup.bounds).toEqual(base.wall.bounds2);
		const nextGenerationInput = { ...base, wall: clone(base.wall), ends: clone(base.ends) };
		expect(nextGenerationInput.wall).not.toBe(base.wall);
		expect(nextGenerationInput.ends).not.toBe(base.ends);
		let buildCalls = 0;
		const result = prepareWallMesh(nextGenerationInput, reference, () => {
			buildCalls += 1;
			return buildStandaloneWallMesh(
				nextGenerationInput.wall,
				nextGenerationInput.floorElevation,
				nextGenerationInput.ends
			);
		});
		expect(result.reused).toBe(true);
		expect(result.mesh).toBe(baseMesh);
		expect(result.refusalReason).toBeNull();
		expect(buildCalls).toBe(0);
	});
});
