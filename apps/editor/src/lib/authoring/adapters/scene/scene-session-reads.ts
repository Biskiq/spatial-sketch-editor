/**
 * The Scene session's read helpers and pure candidate/placement readings.
 *
 * The session owns mode, lease, subject and the displayed candidate. These
 * functions read the accepted snapshot, the session's snap step and its
 * one-shot completion listener; they never acquire a gesture or write.
 */
import type { SceneOperationContext, SceneOperationResult } from '@portfolio/project-model/scene-planning';
import type { SceneEntity, Vec3 } from '@portfolio/project-model/scene';
import type { NormalizedPlacementDefinition } from '@portfolio/project-model/scene-planning';
import { snapDraftingCoordinate } from '$lib/authoring/stage/stage-adapter-host';
import type { SceneEditingSnapshot, SceneSessionOutcome } from './placement';

export type SceneSessionReads = {
	readonly notify: () => void;
	readonly context: () => SceneOperationContext;
	readonly entityOf: (id: string) => SceneEntity | null;
	readonly contactOf: (entity: SceneEntity) => number | null;
	readonly scaleOf: (entity: SceneEntity) => number;
	readonly snapped: (value: number) => number;
};

export function createSceneSessionReads(input: {
	readonly snapshot: SceneEditingSnapshot;
	readonly snapStep: () => number | null;
	readonly takeCommitted: () => ((placedEntityId: string | null) => void) | null;
	readonly placedEntityId: () => string | null;
}): SceneSessionReads {
	return {
		notify() {
			const listener = input.takeCommitted();
			listener?.(input.placedEntityId());
		},
		context() {
			return {
				layout: input.snapshot.source.layout,
				scene: input.snapshot.source.scene,
				sourceContentId: input.snapshot.contentRevision
			};
		},
		entityOf(id) {
			return input.snapshot.source.scene.entities.find((entity) => entity.id === id) ?? null;
		},
		contactOf(entity) {
			return input.snapshot.contactMinYFor?.(entity) ?? null;
		},
		scaleOf(entity) {
			return typeof entity.scale === 'number' && Number.isFinite(entity.scale) ? entity.scale : 1;
		},
		snapped(value) {
			const step = input.snapStep();
			if (step === null || !(step > 0)) return value;
			return snapDraftingCoordinate(value, step);
		}
	};
}

export function candidateFrom(
	result: SceneOperationResult,
	step: number | null,
	contactOf: (entity: SceneEntity) => number | null,
	clearCandidate: () => void
): SceneSessionOutcome {
	if (result.kind === 'rejected') {
		clearCandidate();
		return { kind: 'refused', code: result.code, message: result.message };
	}
	const next = result.scene.entities.find((entry) => entry.id === result.entityId);
	if (next === undefined) return { kind: 'refused', code: 'missing-target', message: 'The candidate entity vanished.' };
	const modelContactMinY = next.kind === 'model' ? contactOf(next) : null;
	return {
		kind: 'candidate',
		candidate: {
			kind:
				result.operationKind === 'set-yaw'
					? 'yaw'
					: result.operationKind === 'resize-on-floor'
						? 'resize'
						: 'move',
			entityId: next.id,
			primitive: null,
			position: [...next.position] as Vec3,
			rotation: [...next.rotation] as Vec3,
			worldXZ: [next.position[0], next.position[2]],
			yaw: next.rotation[1],
			scale: typeof next.scale === 'number' && Number.isFinite(next.scale) ? next.scale : 1,
			snappedStep: step,
			...(modelContactMinY === null ? {} : { modelContactMinY })
		}
	};
}

export function footprintOf(definition: NormalizedPlacementDefinition): { width: number; depth: number } {
	let minX = Infinity;
	let maxX = -Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;
	for (const [x, z] of definition.footprintMeters) {
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minZ = Math.min(minZ, z);
		maxZ = Math.max(maxZ, z);
	}
	return {
		width: Number.isFinite(maxX - minX) ? maxX - minX : 1,
		depth: Number.isFinite(maxZ - minZ) ? maxZ - minZ : 1
	};
}
