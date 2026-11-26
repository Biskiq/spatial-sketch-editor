/**
 * The derived resting-object count for one floor Region.
 *
 * One reader for the Region Card and the Eraser disclosure. It reads the
 * accepted Scene through the V1d support seam and supplies approved model
 * contact from the accepted resource or verified catalogue record. It is a
 * read: no Scene entity, geometry or history value is written.
 */
import {
	countSceneRootsOnFloorRegion,
	sceneSupportGenerationId,
} from '@portfolio/project-model/scene-planning';
import { sceneModelContactMinY } from '$lib/authoring/model-contact';
import {
	stageEnvelope,
	stageLayout,
	type StageAdapterContext,
} from '$lib/authoring/stage/stage-adapter-host';

export function restingObjectsOnFloorRegion(
	snapshot: StageAdapterContext['snapshot'],
	regionId: string,
): number {
	const region = stageLayout(snapshot).regions.find((candidate) => candidate.id === regionId);
	if (region === undefined || region.role !== 'floor') return 0;
	const envelope = stageEnvelope(snapshot);
	return countSceneRootsOnFloorRegion({
		geometry: snapshot.domain.geometry,
		generationId: sceneSupportGenerationId(snapshot.sourceContentId),
		scene: envelope.units.scene.data,
		regionId,
		modelContactMinY: (entity) => sceneModelContactMinY(envelope, entity),
	});
}
