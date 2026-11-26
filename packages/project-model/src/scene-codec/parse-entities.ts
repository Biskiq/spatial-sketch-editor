/**
 * `scene-codec/parse-entities.ts` — entity/resource parsers + cluster shape
 * mapping.
 *
 * Hosts the entity-related `parse*` functions (`parseTextureAsset`,
 * `parseMaterialInstance`, `parseEntityTransform`, `parseModelEntity`,
 * `parsePrimitiveEntity`, `parseLightEntity`, `parseEntity`, `parseCluster`)
 * plus the shared `readPositiveDimension` / `parsePrimitiveDimensions`
 * helpers. Reads all icon/reader helpers from `./readers`.
 *
 * Tagged `@internal` — never imported outside `scene-codec/`; consumers walk
 * documents through `validateSceneDocument` or `parseSceneDocumentJson`.
 */

export {
	parseTextureAsset,
	parseSceneColor,
	parseMaterialInstance,
	readPositiveDimension,
	parsePrimitiveDimensions,
} from './parse-entities/materials';
export { parseFormSource, parseFormEntity } from './parse-entities/forms';
export {
	parseEntityTransform,
	parseModelEntity,
	parsePrimitiveEntity,
	parseLightEntity,
	parseArtworkLibraryEntry,
	parseEntity,
	parseCluster,
} from './parse-entities/entities';
