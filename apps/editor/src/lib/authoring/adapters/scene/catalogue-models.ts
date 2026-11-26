import { UNIT_SOURCE_KIND } from '@portfolio/project-model/units';
import { stageEnvelope } from '$lib/authoring/stage/stage-adapter-host';
import { admittedCatalogueModelAssets } from '../../scene/object-definition-policy';

/**
 * Verified catalogue models this project can actually hold. A catalogue entity
 * needs its asset resource in the envelope, which only a project that already
 * carries it has; listing the others would offer a placement that always refuses.
 */
export function visibleCatalogueModels(
	snapshot: Parameters<typeof stageEnvelope>[0],
	inStudio: boolean
): readonly { readonly id: string; readonly name: string }[] {
	if (inStudio) return [];
	if (snapshot.sourceKind !== UNIT_SOURCE_KIND) return admittedCatalogueModelAssets();
	const held = stageEnvelope(snapshot).units.resources.data.resources;
	return admittedCatalogueModelAssets().filter((asset) =>
		held.some((resource) => resource.kind === 'asset' && resource.id === asset.id && resource.unresolved === null)
	);
}
