/**
 * T2.P01.S01 — the captured-metadata identity of one normalized definition.
 *
 * The normalized definition input carries `metadataContentId`: an immutable
 * identity of the operation metadata captured before preparation, so a replayed
 * placement compares contents instead of re-reading a mutable catalogue. It is
 * **not** the current-source content identity that `T1.P01.S03` owns and that
 * `T1.P01.S02` reuses for boot — that identity hashes authored source bytes.
 * This one hashes the captured definition metadata, and it reuses the package's
 * one hash primitive (`sha256Bytes`) rather than introducing a second one.
 *
 * The canonical form is written field by field in a fixed order, so:
 *
 * - input key order and whitespace never change the identity;
 * - the exclusion list and the admitted-surface set are sorted, because they
 *   are sets of reasons rather than ordered data;
 * - the footprint point order is **kept** — polygon winding and vertex order
 *   are meaningful geometry, not incidental key order;
 * - the renderer's normalization identity participates, so two definitions that
 *   differ only in the source correction are distinct.
 */
import { sha256Bytes } from '../package-sha';
import type {
	NativeObjectCreationDefaults,
	NormalizedPlacementDefinition,
	ObjectCreationDefaults
} from './types';

/** The definition without its own identity: exactly what the identity covers. */
export type DefinitionMetadataFacts = Omit<NormalizedPlacementDefinition, 'metadataContentId'>;

export function canonicalDefinitionMetadata(facts: DefinitionMetadataFacts): string {
	return JSON.stringify({
		definitionKey: facts.definitionKey,
		admission: {
			operations: [...facts.admission.operations],
			supportedSurfaces: sorted([...facts.admission.supportedSurfaces]),
			uprightOnly: facts.admission.uprightOnly,
			provenance: canonicalProvenance(facts.admission.provenance),
			exclusions: [...facts.admission.exclusions]
				.sort((left, right) => compareText(left.code, right.code))
				.map((exclusion) => ({ code: exclusion.code, reason: exclusion.reason }))
		},
		footprintMeters: facts.footprintMeters.map(([x, z]) => [x, z]),
		contactMinY: facts.contactMinY,
		creationDefaults: canonicalCreationDefaults(facts.creationDefaults),
		renderNormalization: {
			defaultScale: facts.renderNormalization.defaultScale,
			...(facts.renderNormalization.defaultRotation === undefined
				? {}
				: { defaultRotation: [...facts.renderNormalization.defaultRotation] })
		}
	});
}

export async function definitionMetadataContentId(facts: DefinitionMetadataFacts): Promise<string> {
	return sha256Bytes(new TextEncoder().encode(canonicalDefinitionMetadata(facts)));
}

function canonicalProvenance(provenance: DefinitionMetadataFacts['admission']['provenance']): unknown {
	return provenance.kind === 'analytical'
		? { kind: 'analytical', detail: provenance.detail }
		: { kind: 'verified-model', verificationId: provenance.verificationId };
}

function canonicalCreationDefaults(defaults: ObjectCreationDefaults): unknown {
	if (defaults.kind === 'primitive') {
		return {
			kind: 'primitive',
			primitive: defaults.primitive,
			name: defaults.name,
			dimensions: canonicalDimensions(defaults),
			materialId: defaults.materialId,
			materialInstanceId: defaults.materialInstanceId ?? null,
			castShadow: defaults.castShadow,
			receiveShadow: defaults.receiveShadow
		};
	}
	return {
		kind: 'model',
		name: defaults.name,
		assetId: defaults.assetId,
		fallback: defaults.fallback,
		materialInstanceId: defaults.materialInstanceId ?? null
	};
}

function canonicalDimensions(defaults: NativeObjectCreationDefaults): unknown {
	switch (defaults.primitive) {
		case 'box':
			return {
				width: defaults.dimensions.width,
				height: defaults.dimensions.height,
				depth: defaults.dimensions.depth
			};
		case 'cylinder':
			return { radius: defaults.dimensions.radius, height: defaults.dimensions.height };
		case 'sphere':
			return { radius: defaults.dimensions.radius };
	}
}

function sorted(values: readonly string[]): string[] {
	return [...values].sort(compareText);
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}
