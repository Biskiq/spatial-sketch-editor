/** Public editor-only composition seam. Domain factories never receive host internals. */
import type { StageAcceptanceHost } from './host-acceptance';
import type { StageAdapter, StageAdapterRegistration, StageFacade } from './stage-facade';

export type StageAdapterServices = {
	readonly stage: StageFacade;
	/** One epoch's F4 boundary. Planner registrations last for this epoch. */
	readonly authoring: Pick<StageAcceptanceHost, 'registerPlanner' | 'accept' | 'acceptedRevision'>;
};

export type StageAdapterFactory = (services: StageAdapterServices) => StageAdapter;

export function mountStageAdapter(
	stage: StageFacade,
	host: StageAcceptanceHost,
	factory: StageAdapterFactory
): StageAdapterRegistration {
	return stage.registerStageAdapter(factory({
		stage,
		authoring: {
			registerPlanner: (planner) => host.registerPlanner(planner),
			accept: (intent) => host.accept(intent),
			acceptedRevision: () => host.acceptedRevision()
		}
	}));
}
