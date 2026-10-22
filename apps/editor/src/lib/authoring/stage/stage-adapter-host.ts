/** Public editor-only composition seam. Domain factories never receive host internals. */
import type { DomainPlanner, RegistrationOutcome } from '@portfolio/project-model';
import type { StageAcceptanceHost } from './host-acceptance';
import type { StageAdapter, StageAdapterRegistration, StageFacade } from './stage-facade';

export type StageAdapterServices = {
	readonly stage: StageFacade;
	/** One epoch's F4 boundary. Planner registrations last for this epoch. */
	readonly authoring: Pick<StageAcceptanceHost, 'accept' | 'acceptedRevision'> & { registerPlanner(planner: DomainPlanner<unknown>): RegistrationOutcome };
};

export type StageAdapterFactory = (services: StageAdapterServices) => StageAdapter;

/**
 * One epoch's adapter-facing ports. Constructing a second value over the same
 * facade and host is safe: it is access, not state, so a lens surface and the
 * adapter mount edit through the same Stage and the same F.4 boundary.
 */
export function createStageAdapterServices(stage: StageFacade, host: StageAcceptanceHost): StageAdapterServices {
	return {
		stage,
		authoring: {
			registerPlanner: (planner) => host.registerPlanner(planner),
			accept: (intent) => host.accept(intent),
			acceptedRevision: () => host.acceptedRevision()
		}
	};
}

export function mountStageAdapter(
	stage: StageFacade,
	host: StageAcceptanceHost,
	factory: StageAdapterFactory
): StageAdapterRegistration {
	return stage.registerStageAdapter(factory(createStageAdapterServices(stage, host)));
}
