/**
 * Resolve a subject for a sample tile: the framing it draws with and the key
 * of the picture that results. One function, used by the inspection host to
 * draw and by the catalogue manifest to validate, so a stored master can only
 * be current when the host would draw the same picture.
 */
import { INSPECTION_LIGHTING_VERSION } from './inspection-lighting';
import {
	SAMPLE_TILE_MASTER_SIZE,
	defaultSampleTileFraming,
	mappingTileMeters,
	normalizeSampleTileFraming,
	sampleTileKey,
	sampleTileMetricFacts,
	type SampleTileFraming,
} from './sample-tile';
import {
	resolveInspectionSubject,
	type InspectionSubject,
	type ResolvedInspectionSubject,
} from './inspection-subject';

export type ResolvedSampleTile = {
	/** The subject resolved against the window as its metric basis. */
	readonly resolved: ResolvedInspectionSubject;
	readonly framing: Required<SampleTileFraming>;
	/** Null when the Finish cannot resolve. */
	readonly recipeKey: string | null;
	readonly key: string | null;
};

export function resolveSampleTile(
	subject: InspectionSubject,
	hint: SampleTileFraming | 'default',
	size: number = SAMPLE_TILE_MASTER_SIZE,
): ResolvedSampleTile {
	const first = resolveInspectionSubject(subject, 'plane');
	const framing = normalizeSampleTileFraming(
		hint === 'default'
			? defaultSampleTileFraming(
					first.inputs === null ? null : mappingTileMeters(first.inputs.mapping),
				)
			: hint,
	);
	if (first.inputs === null) return { resolved: first, framing, recipeKey: null, key: null };
	// The window is the metric basis the Finish binds against.
	const resolved = resolveInspectionSubject(
		subject,
		'plane',
		undefined,
		sampleTileMetricFacts(framing),
	);
	const recipeKey = resolved.recipeKey;
	return {
		resolved,
		framing,
		recipeKey,
		key:
			recipeKey === null
				? null
				: sampleTileKey({
						recipeKey,
						framing,
						width: size,
						height: size,
						lightingVersion: INSPECTION_LIGHTING_VERSION,
					}),
	};
}
