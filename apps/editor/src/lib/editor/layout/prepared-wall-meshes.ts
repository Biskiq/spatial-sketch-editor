import type {
	CompiledLayoutGeometry,
	CompiledPhysicalWall,
	LayoutGeometryIssue
} from '@portfolio/layout-core';
import { legJoinsByWall } from '$lib/layout/layout-geometry-types';
import {
	buildRoomWallMesh,
	buildStandaloneWallMesh,
	STANDALONE_WALL_MESH_BUILDER_SIGNATURE,
	type IndexedWallMesh,
	type ResolvedWallEnds,
	type WallMeshBuildResult
} from '$lib/layout/wall-mesh-builder';
import { buildLayout3dTriangleIndex, type Layout3dPickIndex } from './layout-3d-picking';

/** The complete value record consumed by `buildStandaloneWallMesh`. */
export type PreparedWallMeshInput = {
	wall: CompiledPhysicalWall;
	floorElevation: number;
	ends: ResolvedWallEnds | null;
	builderSignature: string;
};

export type PreparedWallMeshReference = {
	input: PreparedWallMeshInput;
	/** The reference generation's one-time structural verdict. */
	structureValid: boolean;
	/** Failed or issue-producing builds cannot be reused. */
	mesh?: IndexedWallMesh;
	issues?: readonly LayoutGeometryIssue[];
};

export type WallMeshReuseRefusalReason =
	| 'no-reference'
	| 'builder-signature-changed'
	| 'floor-elevation-changed'
	| 'compiled-wall-changed'
	| 'resolved-ends-changed'
	| 'reference-build-failed'
	| 'non-plain-data-input';

export type PreparedWallMeshResult = {
	mesh?: IndexedWallMesh;
	issues: readonly LayoutGeometryIssue[];
	reused: boolean;
	refusalReason: WallMeshReuseRefusalReason | null;
};

export type WallMeshPreparationStats = {
	built: number;
	reused: number;
	refusedByReason: Partial<Record<WallMeshReuseRefusalReason, number>>;
};

/** One renderer-free, state-free derived set, weakly owned by its generation. */
export type PreparedWallMeshSet = {
	wallMeshesByRoom: ReadonlyMap<string, IndexedWallMesh>;
	wallMeshesByWall: ReadonlyMap<string, IndexedWallMesh>;
	layout3dPickIndexByRoom: ReadonlyMap<string, Layout3dPickIndex>;
	issues: readonly LayoutGeometryIssue[];
	wallMeshInputsByWall: ReadonlyMap<string, PreparedWallMeshInput>;
	wallMeshIssuesByWall: ReadonlyMap<string, readonly LayoutGeometryIssue[]>;
	/** Computed once when this generation first enters the existing weak cache. */
	reuseInputsStructureValid: boolean;
	canonicalWallCount: number;
	stats: WallMeshPreparationStats;
};

/** Build the canonical per-Wall key from the exact arguments used by the builder. */
export function preparedWallMeshInput(
	wall: CompiledPhysicalWall,
	floorElevation: number,
	ends: PreparedWallMeshInput['ends']
): PreparedWallMeshInput {
	return {
		wall,
		floorElevation,
		ends,
		builderSignature: STANDALONE_WALL_MESH_BUILDER_SIGNATURE
	};
}

/**
 * Admit only finite JSON-like values with ordinary prototypes, enumerable
 * string keys, data properties, dense arrays and no cycles. This is a
 * generation-boundary check, never part of the per-Wall comparator.
 */
export function isPlainJsonLike(value: unknown, ancestors = new Set<object>()): boolean {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
	if (typeof value === 'number') return Number.isFinite(value);
	if (typeof value !== 'object' || ancestors.has(value)) return false;
	try {
		const isArray = Array.isArray(value);
		if (Object.getPrototypeOf(value) !== (isArray ? Array.prototype : Object.prototype)) return false;
		ancestors.add(value);
		const keys = Reflect.ownKeys(value);
		if (isArray) {
			const array = value as unknown[];
			if (keys.length !== array.length + 1) return false;
			for (let index = 0; index < array.length; index += 1) {
				if (!Object.prototype.hasOwnProperty.call(array, index)) return false;
			}
		}
		for (const key of keys) {
			if (typeof key !== 'string') return false;
			if (isArray && key === 'length') continue;
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (
				!descriptor ||
				!descriptor.enumerable ||
				!Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
				!isPlainJsonLike(descriptor.value, ancestors)
			) {
				return false;
			}
		}
		ancestors.delete(value);
		return true;
	} catch {
		ancestors.delete(value);
		return false;
	}
}

/**
 * Validate a prepared input map once per compiled generation in DEV. Production
 * compiled geometry is compiler-owned plain data; OR-9 keeps this invariant
 * executable in tests and DEV without putting a reflective walk on the release
 * preparation path. The verdict is stored with that generation's existing
 * weakly keyed derived-mesh entry.
 */
export function validatePreparedWallMeshInputs(
	inputs: ReadonlyMap<string, PreparedWallMeshInput>
): boolean {
	const ancestors = new Set<object>();
	for (const input of inputs.values()) {
		if (
			!Number.isFinite(input.floorElevation) ||
			!isPlainJsonLike(input.wall, ancestors) ||
			!isPlainJsonLike(input.ends, ancestors) ||
			!isPlainJsonLike(input.builderSignature, ancestors)
		) {
			return false;
		}
	}
	return true;
}

/** S1's recursive Object.keys comparator; callers supply generation verdicts. */
export function s1ObjectKeysDeepEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
		return false;
	}
	if (Array.isArray(left) !== Array.isArray(right)) return false;
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) return false;
	for (const key of leftKeys) {
		if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
		if (
			!s1ObjectKeysDeepEqual(
				(left as Record<string, unknown>)[key],
				(right as Record<string, unknown>)[key]
			)
		) {
			return false;
		}
	}
	return true;
}

/**
 * Decide whether a reference mesh is safe to share. Structure is not walked
 * here: the candidate and reference verdicts were cached at their generation
 * boundaries, so this function performs only the admitted value comparison.
 */
export function wallMeshReuseRefusalReason(
	candidate: PreparedWallMeshInput,
	reference: PreparedWallMeshReference | null,
	candidateStructureValid: boolean
): WallMeshReuseRefusalReason | null {
	if (!reference) return 'no-reference';
	if (!candidateStructureValid || !reference.structureValid) return 'non-plain-data-input';
	if (candidate.builderSignature !== reference.input.builderSignature) {
		return 'builder-signature-changed';
	}
	if (!Object.is(candidate.floorElevation, reference.input.floorElevation)) {
		return 'floor-elevation-changed';
	}
	if (!s1ObjectKeysDeepEqual(candidate.wall, reference.input.wall)) {
		return 'compiled-wall-changed';
	}
	if (!s1ObjectKeysDeepEqual(candidate.ends, reference.input.ends)) {
		return 'resolved-ends-changed';
	}
	return null;
}

/** Reuse a successful reference mesh; every miss builds issues for this generation. */
export function prepareWallMesh(
	candidate: PreparedWallMeshInput,
	reference: PreparedWallMeshReference | null,
	candidateStructureValid: boolean,
	build: () => WallMeshBuildResult
): PreparedWallMeshResult {
	const mismatch = wallMeshReuseRefusalReason(candidate, reference, candidateStructureValid);
	if (mismatch === null && reference?.mesh && (reference.issues?.length ?? 0) === 0) {
		return { mesh: reference.mesh, issues: [], reused: true, refusalReason: null };
	}
	const refusalReason = mismatch ?? 'reference-build-failed';
	const result = build();
	return {
		mesh: result.mesh,
		issues: result.issues,
		reused: false,
		refusalReason
	};
}

export function collectPreparedWallMeshInputs(
	geometry: CompiledLayoutGeometry
): Map<string, PreparedWallMeshInput> {
	const floorElevationById = new Map(geometry.floors.map((floor) => [floor.floorId, floor.elevation] as const));
	const endsByWall = legJoinsByWall(geometry.junctions ?? []);
	const inputs = new Map<string, PreparedWallMeshInput>();
	for (const wall of geometry.walls) {
		inputs.set(
			wall.wallId,
			preparedWallMeshInput(
				wall,
				floorElevationById.get(wall.floorId) ?? 0,
				endsByWall.get(wall.wallId) ?? null
			)
		);
	}
	return inputs;
}

function buildWallMeshesByRoom(
	geometry: CompiledLayoutGeometry,
	wallMeshInputsByWall: ReadonlyMap<string, PreparedWallMeshInput>,
	reuseInputsStructureValid: boolean,
	reference: PreparedWallMeshSet | undefined
): PreparedWallMeshSet {
	const wallMeshesByRoom = new Map<string, IndexedWallMesh>();
	const wallMeshesByWall = new Map<string, IndexedWallMesh>();
	const layout3dPickIndexByRoom = new Map<string, Layout3dPickIndex>();
	const wallMeshIssuesByWall = new Map<string, readonly LayoutGeometryIssue[]>();
	const issues: LayoutGeometryIssue[] = [];
	const stats: WallMeshPreparationStats = { built: 0, reused: 0, refusedByReason: {} };
	const canonicalMode = geometry.walls.length > 0;

	for (const room of geometry.rooms) {
		if (room.walls.length === 0) {
			if (!canonicalMode) {
				const result = buildRoomWallMesh(room);
				issues.push(...result.issues);
			}
			continue;
		}
		const result = buildRoomWallMesh(room);
		if (result.mesh) {
			wallMeshesByRoom.set(room.roomId, result.mesh);
			layout3dPickIndexByRoom.set(room.roomId, buildLayout3dTriangleIndex(result.mesh));
		}
		issues.push(...result.issues);
	}

	// The reference is used only for canonical Walls; legacy Room meshes never
	// cross generations. Its structure verdict and inputs came from its one prior
	// preparation and live in the same WeakMap entry as its meshes.
	const eligibleReference = canonicalMode && reference?.canonicalWallCount
		? reference
		: undefined;
	for (const [wallId, input] of wallMeshInputsByWall) {
		const referenceInput = eligibleReference?.wallMeshInputsByWall.get(wallId);
		const referenceMesh = eligibleReference?.wallMeshesByWall.get(wallId);
		const referenceIssues = eligibleReference?.wallMeshIssuesByWall.get(wallId);
		const wallReference = referenceInput
			? {
					input: referenceInput,
					structureValid: eligibleReference!.reuseInputsStructureValid,
					mesh: referenceMesh,
					issues: referenceIssues
				}
			: null;
		const result = prepareWallMesh(input, wallReference, reuseInputsStructureValid, () =>
			buildStandaloneWallMesh(input.wall, input.floorElevation, input.ends)
		);
		if (result.reused) {
			stats.reused += 1;
		} else {
			stats.built += 1;
			const refusal = result.refusalReason ?? 'reference-build-failed';
			stats.refusedByReason[refusal] = (stats.refusedByReason[refusal] ?? 0) + 1;
		}
		if (result.mesh) wallMeshesByWall.set(wallId, result.mesh);
		wallMeshIssuesByWall.set(wallId, result.issues);
		issues.push(...result.issues);
	}

	return {
		wallMeshesByRoom,
		wallMeshesByWall,
		layout3dPickIndexByRoom,
		issues,
		wallMeshInputsByWall,
		wallMeshIssuesByWall,
		reuseInputsStructureValid,
		canonicalWallCount: geometry.walls.length,
		stats
	};
}

/** The existing per-generation derived cache; keys are weak and caller-resolved. */
const derivedWallMeshes = new WeakMap<CompiledLayoutGeometry, PreparedWallMeshSet>();

/** Read the single prepared set for a cache key, without creating a second cache. */
export function getPreparedWallMeshes(
	generation: CompiledLayoutGeometry
): PreparedWallMeshSet | undefined {
	return derivedWallMeshes.get(generation);
}

/**
 * Prepare one generation, optionally reusing equal canonical Wall meshes from
 * its currently installed reference generation. The only retention owner is
 * `derivedWallMeshes`, a WeakMap keyed by the generation object.
 */
export function prepareWallMeshes(
	generation: CompiledLayoutGeometry,
	referenceGeneration?: CompiledLayoutGeometry
): PreparedWallMeshSet {
	const cached = derivedWallMeshes.get(generation);
	if (cached) return cached;

	const wallMeshInputsByWall = collectPreparedWallMeshInputs(generation);
	const reuseInputsStructureValid = import.meta.env.DEV
		? validatePreparedWallMeshInputs(wallMeshInputsByWall)
		: true;
	const reference = referenceGeneration ? derivedWallMeshes.get(referenceGeneration) : undefined;
	const prepared = buildWallMeshesByRoom(
		generation,
		wallMeshInputsByWall,
		reuseInputsStructureValid,
		reference
	);
	derivedWallMeshes.set(generation, prepared);
	return prepared;
}
