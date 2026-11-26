/**
 * The read-only material index derived beside the model footprints.
 *
 * A Scene 12 Finish may name a resource digest, and a resource definition maps
 * every recipe digest to one local image identity. Nothing in the Scene record
 * carries bytes or a second locator, so the runtime value needs this index:
 *
 * - `definitions` reaches an immutable recipe by digest;
 * - `images` supplies the verified local identity for each digest and for each
 *   `{textureId}` override (through its `texture` resource pin).
 *
 * It is derived, never authored. `prepareValidatedUnitRuntime` keys reuse on the
 * Scene and resources unit revisions, so a retained runtime carries the exact
 * index its values were resolved with.
 */
import type { MaterialRuntimeIndex, ResolvedImage } from '../materials/types';
import type { ResourceUnitPayload } from './types';

/** Whether the index has anything a renderer could resolve. */
export function materialRuntimeIndexOf(
	resources: ResourceUnitPayload,
): MaterialRuntimeIndex | undefined {
	const definitions = new Map<string, import('../materials/types').Recipe>();
	const definitionImages = new Map<string, ResolvedImage[]>();
	const images: ResolvedImage[] = [];
	for (const resource of resources.resources) {
		if (resource.kind === 'material' && resource.material !== undefined) {
			definitions.set(resource.id, resource.material.recipe);
			definitionImages.set(
				resource.id,
				resource.material.images.map((image) => ({
					hash: image.hash,
					source: image.source,
				})),
			);
			continue;
		}
		if (resource.kind === 'texture' && resource.pin !== null && resource.unresolved === null) {
			images.push({ hash: resource.pin.hash, source: { textureId: resource.id } });
		}
	}
	if (definitions.size === 0 && images.length === 0) return undefined;
	return { definitions, definitionImages, images };
}
