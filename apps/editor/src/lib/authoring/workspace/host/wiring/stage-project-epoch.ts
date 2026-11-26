/**
 * The project-epoch wiring module.
 *
 * The host supplies its session sources and the late owners the epoch's ports
 * read (Finish, Light inspection, Object Studio and the created-space notice).
 * The module builds the `ports` literal, so the host body stays a sequence of
 * construction calls.
 */
import { createStageProjectEpoch } from '../../../stage/route/stage-project-epoch.svelte';

type EpochInput = Parameters<typeof createStageProjectEpoch>[0];
type EpochPorts = NonNullable<EpochInput['ports']>;

export type StageProjectEpochWiring = Omit<EpochInput, 'ports'> & {
	readonly finishCard: EpochPorts['finishCard'];
	readonly lightInspection: EpochPorts['lightInspection'];
	readonly objectStudio: EpochPorts['objectStudio'];
	readonly openSpaceCreated: EpochPorts['openSpaceCreated'];
};

export function wireStageProjectEpoch(input: StageProjectEpochWiring) {
	return createStageProjectEpoch({
		session: input.session,
		assets: input.assets,
		materialProofs: input.materialProofs,
		ports: {
			finishCard: input.finishCard,
			lightInspection: input.lightInspection,
			objectStudio: input.objectStudio,
			openSpaceCreated: input.openSpaceCreated,
		},
		projectSession: input.projectSession,
		preview: input.preview,
		createFacade: input.createFacade,
		adapterFactories: input.adapterFactories,
		targetSources: input.targetSources,
		lifecycle: input.lifecycle,
		onNotice: input.onNotice,
		refresh: input.refresh,
		isActiveProject: input.isActiveProject,
	});
}
