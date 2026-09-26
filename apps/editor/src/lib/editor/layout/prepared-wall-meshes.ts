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

/**
 * The complete input record for one canonical Wall mesh. The builder closure
 * was audited in both byte-identical mirrors: mesh data comes from the whole
 * compiled Wall, its Floor elevation, resolved Junction ends, and the default
 * builder constants/options identified by the signature. The only ambient
 * access in the builder is the opt-in P23.11 timer, which adds marks but does
 * not affect the returned mesh. This module itself reads no ambient state.
 *
 * Keep this record conservative: comparing the whole Wall means a new compiled
 * field automatically participates, and changed values refuse reuse.
 */
export type PreparedWallMeshInput = {
	wall: CompiledPhysicalWall;
	floorElevation: number;
	ends: ResolvedWallEnds | null;
	builderSignature: string;
};

export type PreparedWallMeshReference = {
	input: PreparedWallMeshInput;
	/** Failed builds have no mesh and therefore cannot be reused. */
	mesh?: IndexedWallMesh;
};

export type WallMeshReuseRefusalReason =
	| 'no-reference'
	| 'builder-signature-changed'
	| 'floor-elevation-changed'
	| 'compiled-wall-changed'
	| 'resolved-ends-changed'
	| 'reference-build-failed';

export type PreparedWallMeshResult = {
	mesh?: IndexedWallMesh;
	issues: readonly LayoutGeometryIssue[];
	reused: boolean;
	refusalReason: WallMeshReuseRefusalReason | null;
};

/** Build the canonical per-Wall key from the exact arguments used by the caller. */
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
 * Decide whether a reference mesh is safe to share. This is a pure, state-free
 * per-Wall decision; it neither retains a reference nor owns a generation cache.
 */
export function wallMeshReuseRefusalReason(
	candidate: PreparedWallMeshInput,
	reference: PreparedWallMeshReference | null
): WallMeshReuseRefusalReason | null {
	if (!reference) return 'no-reference';
	if (candidate.builderSignature !== reference.input.builderSignature) {
		return 'builder-signature-changed';
	}
	if (!Object.is(candidate.floorElevation, reference.input.floorElevation)) {
		return 'floor-elevation-changed';
	}
	if (!deepEqualOwnData(candidate.wall, reference.input.wall)) {
		return 'compiled-wall-changed';
	}
	if (!deepEqualOwnData(candidate.ends, reference.input.ends)) {
		return 'resolved-ends-changed';
	}
	return null;
}

/**
 * Reuse a successful reference mesh when every input matches. A mismatch or a
 * failed reference reruns the supplied builder so its current issues are fresh.
 */
export function prepareWallMesh(
	candidate: PreparedWallMeshInput,
	reference: PreparedWallMeshReference | null,
	build: () => WallMeshBuildResult
): PreparedWallMeshResult {
	const mismatch = wallMeshReuseRefusalReason(candidate, reference);
	if (mismatch === null && reference?.mesh) {
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

function deepEqualOwnData(
	left: unknown,
	right: unknown,
	seen = new WeakMap<object, WeakSet<object>>()
): boolean {
	if (Object.is(left, right)) return true;
	if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
		return false;
	}
	if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false;
	if (ArrayBuffer.isView(left) || ArrayBuffer.isView(right)) {
		if (
			!ArrayBuffer.isView(left) ||
			!ArrayBuffer.isView(right) ||
			left.constructor !== right.constructor
		) {
			return false;
		}
		if (left.byteLength !== right.byteLength) return false;
		const leftBytes = new Uint8Array(left.buffer, left.byteOffset, left.byteLength);
		const rightBytes = new Uint8Array(right.buffer, right.byteOffset, right.byteLength);
		return leftBytes.every((value, index) => value === rightBytes[index]);
	}
	if (left instanceof ArrayBuffer || right instanceof ArrayBuffer) {
		if (
			!(left instanceof ArrayBuffer) ||
			!(right instanceof ArrayBuffer) ||
			left.byteLength !== right.byteLength
		) {
			return false;
		}
		const leftBytes = new Uint8Array(left);
		const rightBytes = new Uint8Array(right);
		return leftBytes.every((value, index) => value === rightBytes[index]);
	}
	if (Array.isArray(left) !== Array.isArray(right)) return false;

	let paired = seen.get(left);
	if (paired?.has(right)) return true;
	if (!paired) {
		paired = new WeakSet<object>();
		seen.set(left, paired);
	}
	paired.add(right);

	const leftKeys = Reflect.ownKeys(left);
	const rightKeys = Reflect.ownKeys(right);
	if (leftKeys.length !== rightKeys.length) return false;
	for (const key of leftKeys) {
		if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
		const leftDescriptor = Object.getOwnPropertyDescriptor(left, key);
		const rightDescriptor = Object.getOwnPropertyDescriptor(right, key);
		if (!leftDescriptor || !rightDescriptor) return false;
		const leftIsData = Object.prototype.hasOwnProperty.call(leftDescriptor, 'value');
		const rightIsData = Object.prototype.hasOwnProperty.call(rightDescriptor, 'value');
		if (leftIsData !== rightIsData) return false;
		if (leftIsData && rightIsData) {
			if (!deepEqualOwnData(leftDescriptor.value, rightDescriptor.value, seen)) return false;
		} else if (
			leftDescriptor.get !== rightDescriptor.get ||
			leftDescriptor.set !== rightDescriptor.set
		) {
			return false;
		}
	}
	return true;
}
