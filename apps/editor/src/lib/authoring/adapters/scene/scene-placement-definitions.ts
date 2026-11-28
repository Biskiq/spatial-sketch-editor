/**
 * The Scene adapter's one placement-definition set.
 *
 * The registered planners and the group-copy preview read the same provider, so
 * a preview can never admit a model that acceptance would refuse (or the
 * reverse). The catalogue definitions load asynchronously; an approved creator
 * model is reachable after mount, and the armed model before its first install.
 */
import type { NormalizedPlacementDefinition } from '@portfolio/project-model/scene-planning';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { armedModelDefinition, creatorDefinitions } from './import/definitions';
import { liveProjectId } from './object-readings';

export function scenePlacementDefinitions(
	services: StageAdapterServices,
	admitted: readonly NormalizedPlacementDefinition[],
): readonly NormalizedPlacementDefinition[] {
	// The approved model a creator has armed is an admitted definition even before
	// its first placement installs the resource. A rebind (a drawing install
	// replaces the accepted source) clears the captured procedure definitions, so
	// the arm itself must keep the model placeable.
	const armed = armedModelDefinition(liveProjectId(services));
	return [...admitted, ...creatorDefinitions(), ...(armed === null ? [] : [armed])];
}
