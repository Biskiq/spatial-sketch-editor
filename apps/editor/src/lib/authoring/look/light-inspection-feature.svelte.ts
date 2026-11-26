import type { ViewportEvaluation } from '@portfolio/camera-core/viewport';
import {
	createLightLookThrough,
	lookThroughCone,
	type LightLookThroughHost,
} from '../stage/route/light-look-through.svelte';
import { createLightCoverage } from './light-inspection/light-coverage';
import { createLightInspectionGuards } from './light-inspection/light-inspection-guards.svelte';

export type LightInspectionDependencies = LightLookThroughHost & {
	readonly evaluation: () => ViewportEvaluation | null;
	readonly previewing: () => boolean;
};

export function createLightInspectionFeature(deps: LightInspectionDependencies) {
	const inspection = createLightLookThrough(deps);
	const coverage = createLightCoverage({
		stage: deps.stage,
		evaluation: deps.evaluation,
		session: inspection.session,
		cone: lookThroughCone,
	});
	const guards = createLightInspectionGuards({
		inspection,
		lens: deps.lens,
		previewing: deps.previewing,
		readCoverage: coverage.read,
	});
	return {
		id: 'light-inspection' as const,
		get frame() {
			return guards.frame;
		},
		get posture() {
			return inspection.posture;
		},
		ports: {
			card: guards.card,
			session: inspection.session,
			active: inspection.active,
			cancel: guards.cancel,
			lightArmed: guards.lightArmed,
		},
		regions: { viewport: guards.viewport },
		lifecycle: {
			interruptForReplacement: { cancel: guards.cancel },
			resetPresentation: { cancel: guards.cancel },
			accepted: { reconcile: inspection.reconcile },
			historyInstalled: { reconcile: inspection.reconcile },
			leaveLens: { cancel: guards.cancel },
			dispose: { dispose: inspection.dispose },
		},
	};
}
