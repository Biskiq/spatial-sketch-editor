import type { StageReadSnapshot } from '../accepted-read';
import type { StageFacade } from '../stage-facade';
import type { createScenePickSource } from '../../scene/scene-pick-source';
import type { GridRect } from '../stage-grid';

export function readStageContentBounds(stage: StageFacade): {
	readonly min: [number, number, number];
	readonly max: [number, number, number];
} | null {
	const layoutBounds = stage.snapshot().domain.geometry.bounds;
	let min: [number, number, number] | null =
		layoutBounds === null ? null : [layoutBounds.min[0], layoutBounds.min[1], layoutBounds.min[2]];
	let max: [number, number, number] | null =
		layoutBounds === null ? null : [layoutBounds.max[0], layoutBounds.max[1], layoutBounds.max[2]];
	for (const entity of stage.snapshot().domain.scene.entities) {
		const bounds = stage.sceneBounds(entity.id);
		if (bounds === null) continue;
		min = min === null
			? [bounds.min[0], bounds.min[1], bounds.min[2]]
			: [Math.min(min[0], bounds.min[0]), Math.min(min[1], bounds.min[1]), Math.min(min[2], bounds.min[2])];
		max = max === null
			? [bounds.max[0], bounds.max[1], bounds.max[2]]
			: [Math.max(max[0], bounds.max[0]), Math.max(max[1], bounds.max[1]), Math.max(max[2], bounds.max[2])];
	}
	return min === null || max === null ? null : { min, max };
}

export function createStageContentBounds(input: {
	readonly scenePick: Pick<ReturnType<typeof createScenePickSource>, 'onRenderRootsChanged'>;
	readonly snapshot: () => StageReadSnapshot | null;
	readonly facade: () => StageFacade | null;
}) {
	let renderRootsRevision = $state(0);
	$effect(() => input.scenePick.onRenderRootsChanged(() => (renderRootsRevision += 1)));
	const stageContentBounds = $derived.by(() => {
		void renderRootsRevision;
		if (input.snapshot() === null) return null;
		const facade = input.facade();
		return facade === null ? null : readStageContentBounds(facade);
	});
	const paperContentBounds = $derived.by((): GridRect | null => {
		const bounds = stageContentBounds;
		return bounds === null
			? null
			: { minX: bounds.min[0], maxX: bounds.max[0], minZ: bounds.min[2], maxZ: bounds.max[2] };
	});
	$effect(() => input.facade()?.camera.setContentBounds(stageContentBounds));

	return {
		renderRootsRevision: () => renderRootsRevision,
		get stage() { return stageContentBounds; },
		get paper() { return paperContentBounds; }
	};
}
