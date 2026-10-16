/**
 * T2.P01.S01 exit criteria — the captured-metadata identity of a definition.
 *
 * One contract: what the identity covers and what it must ignore. The
 * canonical form is written field by field, so input key order and the order of
 * set-like lists (exclusions, admitted surfaces) cannot change it, while
 * everything that changes the placement meaning — contact, footprint geometry,
 * the renderer's normalization correction, the definition key — must.
 *
 * Footprint vertex order is deliberately *not* normalized: polygon winding and
 * point order are geometry, not incidental key order.
 */
import { describe, expect, it } from 'vitest';
import {
	canonicalDefinitionMetadata,
	definitionMetadataContentId,
	type NormalizedPlacementDefinition
} from '@portfolio/project-model';

type Facts = Omit<NormalizedPlacementDefinition, 'metadataContentId'>;

const FOOTPRINT: readonly [number, number][] = [
	[-0.5, -0.5],
	[0.5, -0.5],
	[0.5, 0.5],
	[-0.5, 0.5]
];

function facts(overrides: Partial<Facts> = {}): Facts {
	return {
		definitionKey: 'native:box',
		admission: {
			operations: ['place-object'],
			supportedSurfaces: ['floor'],
			uprightOnly: true,
			provenance: { kind: 'analytical', detail: 'Centered primitive: contactMinY = -height/2.' },
			exclusions: [{ code: 'plane-primitive', reason: 'no horizontal footprint' }]
		},
		footprintMeters: FOOTPRINT,
		contactMinY: -0.5,
		creationDefaults: {
			kind: 'primitive',
			primitive: 'box',
			name: 'Block',
			dimensions: { width: 1, height: 1, depth: 1 },
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true
		},
		renderNormalization: { defaultScale: 1 },
		...overrides
	};
}

describe('captured definition metadata identity', () => {
	it('is a stable package hash of the canonical metadata', async () => {
		const first = await definitionMetadataContentId(facts());
		const second = await definitionMetadataContentId(facts());
		expect(first).toBe(second);
		expect(first).toMatch(/^sha256-[0-9a-f]{64}$/);
	});

	it('is written in a fixed field order, so input key order cannot change it', async () => {
		const reordered: Facts = {
			renderNormalization: { defaultScale: 1 },
			creationDefaults: {
				kind: 'primitive',
				primitive: 'box',
				name: 'Block',
				dimensions: { width: 1, height: 1, depth: 1 },
				materialId: 'plaster-warm',
				castShadow: true,
				receiveShadow: true
			},
			contactMinY: -0.5,
			footprintMeters: FOOTPRINT,
			admission: {
				operations: ['place-object'],
				supportedSurfaces: ['floor'],
				uprightOnly: true,
				provenance: { kind: 'analytical', detail: 'Centered primitive: contactMinY = -height/2.' },
				exclusions: [{ code: 'plane-primitive', reason: 'no horizontal footprint' }]
			},
			definitionKey: 'native:box'
		};
		expect(await definitionMetadataContentId(reordered)).toBe(
			await definitionMetadataContentId(facts())
		);
	});

	it('emits one compact canonical JSON document', () => {
		const canonical = canonicalDefinitionMetadata(facts());
		expect(() => JSON.parse(canonical)).not.toThrow();
		expect(canonical).not.toContain('\n');
		expect(canonical).not.toMatch(/ {2,}/);
	});

	it('ignores the order of set-like lists', async () => {
		const reorderedSets = facts({
			admission: {
				...facts().admission,
				supportedSurfaces: ['wall', 'floor'],
				exclusions: [
					{ code: 'z-last', reason: 'second' },
					{ code: 'a-first', reason: 'first' }
				]
			}
		});
		const sameSets = facts({
			admission: {
				...facts().admission,
				supportedSurfaces: ['floor', 'wall'],
				exclusions: [
					{ code: 'a-first', reason: 'first' },
					{ code: 'z-last', reason: 'second' }
				]
			}
		});
		expect(await definitionMetadataContentId(reorderedSets)).toBe(
			await definitionMetadataContentId(sameSets)
		);
	});

	it('changes whenever the placement meaning changes', async () => {
		const baseline = await definitionMetadataContentId(facts());
		expect(await definitionMetadataContentId(facts({ contactMinY: -0.25 }))).not.toBe(baseline);
		expect(
			await definitionMetadataContentId(facts({ renderNormalization: { defaultScale: 0.032 } }))
		).not.toBe(baseline);
		expect(await definitionMetadataContentId(facts({ definitionKey: 'native:cylinder' }))).not.toBe(
			baseline
		);
		expect(
			await definitionMetadataContentId(facts({ footprintMeters: [...FOOTPRINT].reverse() }))
		).not.toBe(baseline);
	});
});
