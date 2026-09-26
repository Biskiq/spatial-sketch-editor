import type {
	CompiledPhysicalWall,
	LayoutGeometryIssue
} from '@portfolio/layout-core';
import {
	STANDALONE_WALL_MESH_BUILDER_SIGNATURE,
	type IndexedWallMesh,
	type ResolvedWallEnds,
	type WallMeshBuildResult
} from '$lib/layout/wall-mesh-builder';

/** The complete value record consumed by `buildStandaloneWallMesh`. */
export type PreparedWallMeshInput = {
	wall: CompiledPhysicalWall;
	floorElevation: number;
	ends: ResolvedWallEnds | null;
	builderSignature: string;
};

export type PreparedWallMeshReference = {
	input: PreparedWallMeshInput;
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

/** Build the canonical per-Wall key from the exact arguments used by the builder. */
export function preparedWallMeshInput(
	wall: CompiledPhysicalWall,
	floorElevation: number,
	ends: ResolvedWallEnds | null
): PreparedWallMeshInput {
	return {
		wall,
		floorElevation,
		ends,
		builderSignature: STANDALONE_WALL_MESH_BUILDER_SIGNATURE
	};
}

/**
 * D-5's structural guard admits only finite JSON-like records with ordinary
 * prototypes, enumerable string keys, data properties, dense arrays and no
 * cycles. It makes S1's cheaper Object.keys comparator safe for this input set.
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

/** S1's recursive Object.keys comparator; inputs are structurally guarded first. */
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
 * Decide whether a reference mesh is safe to share. This is a pure, state-free
 * per-Wall decision; it neither retains a reference nor owns a generation cache.
 */
export function wallMeshReuseRefusalReason(
	candidate: PreparedWallMeshInput,
	reference: PreparedWallMeshReference | null
): WallMeshReuseRefusalReason | null {
	if (!reference) return 'no-reference';
	if (
		typeof candidate.floorElevation !== 'number' ||
		!Number.isFinite(candidate.floorElevation) ||
		typeof reference.input.floorElevation !== 'number' ||
		!Number.isFinite(reference.input.floorElevation) ||
		!isPlainJsonLike(candidate.wall) ||
		!isPlainJsonLike(reference.input.wall) ||
		!isPlainJsonLike(candidate.ends) ||
		!isPlainJsonLike(reference.input.ends) ||
		!isPlainJsonLike(candidate.builderSignature) ||
		!isPlainJsonLike(reference.input.builderSignature)
	) {
		return 'non-plain-data-input';
	}
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

/** Reuse a successful reference mesh; rerun failed builds so issues are fresh. */
export function prepareWallMesh(
	candidate: PreparedWallMeshInput,
	reference: PreparedWallMeshReference | null,
	build: () => WallMeshBuildResult
): PreparedWallMeshResult {
	const mismatch = wallMeshReuseRefusalReason(candidate, reference);
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
