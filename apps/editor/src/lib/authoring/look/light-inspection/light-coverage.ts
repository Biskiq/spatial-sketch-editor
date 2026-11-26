import type { ViewportEvaluation } from '@portfolio/camera-core/viewport';
import { lightById, type Light } from '../../adapters/light/light-subjects';
import type { StageFacade } from '../../stage/stage-facade';
import type {
	LightLookThroughCone,
	LightLookThroughSession,
} from '../../stage/route/light-look-through.svelte';
import type { LightCoverage } from './light-inspection-view';

export function createLightCoverage(input: {
	readonly stage: () => StageFacade | null;
	readonly evaluation: () => ViewportEvaluation | null;
	readonly session: () => LightLookThroughSession | null;
	readonly cone: (light: Light) => LightLookThroughCone;
}) {
	/** The inspected Spot's authored cone, projected with the current evaluation. */
	function read(): LightCoverage {
		const inspection = input.session();
		const stage = input.stage();
		const current = input.evaluation();
		if (inspection === null || stage === null || current === null) return null;
		const light = lightById(stage.snapshot(), inspection.lightId);
		if (light === null || light.light !== 'spot') return null;
		const evaluationId = stage.evaluationId();
		if (evaluationId === null) return null;
		const projectRing = (points: readonly (readonly [number, number, number])[]) => {
			const projected: [number, number][] = [];
			for (const point of points) {
				const result = stage.projectWorld(point, evaluationId);
				if (result.kind !== 'projected') return null;
				projected.push([result.css[0] - current.rect.left, result.css[1] - current.rect.top]);
			}
			return projected;
		};
		const cone = input.cone(light);
		const capRing = projectRing(cone.capRing);
		if (capRing === null || capRing.length === 0) return null;
		const innerRing = cone.innerRing === null ? null : projectRing(cone.innerRing);
		return { capRing, innerRing };
	}

	return { read };
}
