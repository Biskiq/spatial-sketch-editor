/**
 * T2.P01.S01 exit criteria — the host policy adapter and its admitted inventory.
 *
 * The inventory is a reviewable artifact, so the suite checks the claims a
 * reviewer would: every floor-surface catalogue asset appears exactly once,
 * every exclusion carries a reason, and no model is admitted whose corrected
 * contact has not been verified on the landed r186 loader base. The native
 * primitives are admitted on analytical contacts alone, and their declared
 * footprint must agree with the retained Plan footprint projection at instance
 * scale 1 — which is how "the renderer's normalization is applied exactly once,
 * inside the renderer" is proven rather than asserted.
 */
import { describe, expect, it } from 'vitest';
import { preparePlaceObjectCandidate } from '@portfolio/project-model/scene-planning';
import type { FloorSupportCandidate } from '@portfolio/project-model';
import { SCENE_UNIT_FORMAT_VERSION } from '@portfolio/project-model/units';
import { assets, getAssetById } from '$lib/content/assets';
import { buildPlanSceneFootprintProjection } from '$lib/authoring/scene/plan-scene-footprint';
import {
	CATALOGUE_MODEL_CONTACT_RECORDS,
	admittedCatalogueModelAssets,
	NATIVE_PLACEMENT_PRIMITIVES,
	admittedDefinitionKeys,
	catalogueModelContactMinY,
	catalogueModelDefinition,
	catalogueModelExclusions,
	isAdmittedPlacementAssetId,
	modelDefinitionKey,
	nativeDefinitionKey,
	nativePlacementDefinition,
	objectDefinitionInventory,
	pendingVerificationDefinitionKeys
} from '$lib/authoring/scene/object-definition-policy';
import type { Asset } from '$lib/types/assets';

const FLOOR_ASSETS = assets.filter((asset) => asset.placementSurface === 'floor');

const SUPPORT: FloorSupportCandidate = {
	queryPoint: [0, 0],
	elevation: 0,
	upNormal: [0, 1, 0],
	generationId: 'generation-1',
	witnesses: [
		{
			floorId: 'floor-1',
			roomId: 'room-1',
			recordId: 'record-1',
			cacheKey: 'record-1:cache',
			sourceId: 'record-1:source',
			orderKey: 'record-1:order'
		}
	],
	orderKey: 'record-1:order',
	label: 'Floor floor-1 / Room room-1'
};

describe('admitted object-definition inventory', () => {
	it('lists every floor-surface catalogue asset exactly once, with reasons for every exclusion', () => {
		const inventory = objectDefinitionInventory();
		const catalogueEntries = inventory.filter((entry) => entry.source.kind === 'catalogue-model');
		expect(catalogueEntries.length).toBe(FLOOR_ASSETS.length);
		const assetIds = catalogueEntries.map((entry) => {
			const source = entry.source;
			return source.kind === 'catalogue-model' ? source.assetId : '';
		});
		expect(new Set(assetIds).size).toBe(FLOOR_ASSETS.length);
		expect([...assetIds].sort()).toEqual([...FLOOR_ASSETS.map((asset) => asset.id)].sort());

		for (const entry of inventory) {
			if (entry.admission === 'admitted') {
				expect(entry.exclusions).toEqual([]);
				continue;
			}
			expect(entry.exclusions.length).toBeGreaterThan(0);
			for (const exclusion of entry.exclusions) {
				expect(exclusion.code.length).toBeGreaterThan(0);
				expect(exclusion.reason.length).toBeGreaterThan(0);
			}
		}
	});

	it('never admits a catalogue model whose contact verification is missing', () => {
		for (const entry of objectDefinitionInventory()) {
			if (entry.admission !== 'admitted' || entry.source.kind !== 'catalogue-model') continue;
			const assetId = entry.source.assetId;
			const record = CATALOGUE_MODEL_CONTACT_RECORDS.find((candidate) => candidate.assetId === assetId);
			expect(record?.verified).toBe(true);
			expect(record?.verificationId).toBeDefined();
		}
	});

	it('records the unverified floor models as pending verification rather than admitting them', () => {
		const pending = pendingVerificationDefinitionKeys();
		expect(pending).not.toContain(modelDefinitionKey('paris-grand-piano'));
		expect(catalogueModelExclusions(getAssetById('paris-grand-piano')!).map(reason => reason.code)).toContain('model-geometry-mismatch');
		expect(pending.length).toBeGreaterThan(0);
		for (const entry of objectDefinitionInventory()) {
			if (entry.admission !== 'excluded') continue;
			// Every excluded model carries at least one reason a reviewer can act on.
			expect(entry.exclusions[0]!.code.length).toBeGreaterThan(0);
		}
	});

	it('admits the three analytical native primitives and no plane', () => {
		const admitted = admittedDefinitionKeys();
		for (const primitive of NATIVE_PLACEMENT_PRIMITIVES) {
			expect(admitted).toContain(nativeDefinitionKey(primitive));
		}
		expect(admitted).not.toContain('native:plane');
		for (const entry of objectDefinitionInventory()) {
			expect(entry.definitionKey).not.toBe('native:plane');
		}
	});
});

describe('native normalized definitions', () => {
	it('declares an analytical footprint and contact for every admitted primitive', async () => {
		const box = await nativePlacementDefinition('box');
		expect(box.footprintMeters).toHaveLength(4);
		expect(box.contactMinY).toBe(-0.5);
		expect(box.renderNormalization.defaultScale).toBe(1);
		expect(box.metadataContentId).toMatch(/^sha256-[0-9a-f]{64}$/);

		const cylinder = await nativePlacementDefinition('cylinder');
		expect(cylinder.footprintMeters.length).toBeGreaterThanOrEqual(3);
		expect(cylinder.contactMinY).toBe(-0.5);

		const sphere = await nativePlacementDefinition('sphere');
		expect(sphere.footprintMeters.length).toBeGreaterThanOrEqual(3);
		expect(sphere.contactMinY).toBe(-0.5);

		for (const definition of [box, cylinder, sphere]) {
			expect(definition.admission.supportedSurfaces).toEqual(['floor']);
			expect(definition.admission.uprightOnly).toBe(true);
			expect(definition.admission.operations).toEqual(['place-object']);
			expect(definition.admission.provenance.kind).toBe('analytical');
			expect(definition.admission.exclusions.map((exclusion) => exclusion.code)).toContain(
				'plane-primitive'
			);
		}
	});

	it('captures a stable definition across repeat captures', async () => {
		const first = await nativePlacementDefinition('box');
		const second = await nativePlacementDefinition('box');
		expect(second.metadataContentId).toBe(first.metadataContentId);
		expect(second).toEqual(first);
	});
});

describe('catalogue model admission', () => {
	it('admits only the salon chair after its r186 contact and footprint verification', async () => {
		const definition = await catalogueModelDefinition('paris-salon-chair');
		expect(definition).not.toBeNull();
		expect(definition?.admission.provenance).toEqual({
			kind: 'verified-model',
			verificationId: 'r186-salon-chair-contact-footprint-v1'
		});
		expect(definition?.contactMinY).toBe(CATALOGUE_MODEL_CONTACT_RECORDS.find((record) => record.assetId === 'paris-salon-chair')?.contactMinY);
		expect(catalogueModelContactMinY('paris-salon-chair')).toBe(definition?.contactMinY);
		expect(admittedCatalogueModelAssets().map((asset) => asset.id)).toEqual(['paris-salon-chair']);
	});

	it('refuses the non-unit-normalization piano while its contact is unverified', async () => {
		const asset = getAssetById('paris-grand-piano');
		expect(asset?.defaultScale).toBe(0.032);
		expect(asset?.footprint?.width).toBe(1.48);

		expect(await catalogueModelDefinition('paris-grand-piano')).toBeNull();
		expect(isAdmittedPlacementAssetId('paris-grand-piano')).toBe(false);
		expect(isAdmittedPlacementAssetId('asset-that-does-not-exist')).toBe(false);
		expect(isAdmittedPlacementAssetId('paris-chandelier')).toBe(false);

		const record = CATALOGUE_MODEL_CONTACT_RECORDS.find((entry) => entry.assetId === 'paris-grand-piano');
		expect(record?.nonUnitSourceNormalization).toBe(true);
		expect(record?.verified).toBe(false);
		expect(record?.contactSource).toBe('catalogue-floor-pivot-note');

		const reasons = catalogueModelExclusions(asset!).map((exclusion) => exclusion.code);
		expect(reasons).toContain('unverified-model-contact');
	});

	it('names each refusal reason for a surface, a status or a missing contact record', () => {
		const wallAsset = getAssetById('paris-portrait-frame')!;
		expect(wallAsset.placementSurface).toBe('wall');
		expect(catalogueModelExclusions(wallAsset).map((exclusion) => exclusion.code)).toContain(
			'unsupported-placement-surface'
		);

		const placeholder: Asset = {
			...wallAsset,
			id: 'synthetic-floor-placeholder',
			placementSurface: 'floor',
			status: 'placeholder',
			footprint: { width: 1, depth: 1 }
		};
		const reasons = catalogueModelExclusions(placeholder).map((exclusion) => exclusion.code);
		expect(reasons).toContain('unapproved-asset-status');
		expect(reasons).toContain('missing-contact-record');
	});
});

describe('normalization is applied exactly once', () => {
	it('places a native block whose declared footprint matches the retained Plan projection at scale 1', async () => {
		const definition = await nativePlacementDefinition('box');
		const result = preparePlaceObjectCandidate({
			document: { formatVersion: SCENE_UNIT_FORMAT_VERSION, textures: [], materials: [], entities: [] },
			entityId: 'entity-1',
			snapshot: { acceptedRevision: { projectId: 'project-1', revisionId: 'revision-1' }, sourceContentId: 'content-1' },
			supportSnapshot: { acceptedRevision: { projectId: 'project-1', revisionId: 'revision-1' }, sourceContentId: 'content-1' },
			frameSnapshot: { acceptedRevision: { projectId: 'project-1', revisionId: 'revision-1' }, sourceContentId: 'content-1' },
			frameReference: { version: 1, kind: 'project-world' },
			definition,
			worldXZ: [0, 0],
			yaw: 0,
			frame: { origin: [0, 0, 0], yaw: 0 },
			generationId: 'generation-1',
			support: { kind: 'resolved', support: SUPPORT }
		});
		expect(result.kind).toBe('candidate');
		if (result.kind !== 'candidate') return;
		expect(result.candidate.entity.scale).toBe(1);

		const projection = buildPlanSceneFootprintProjection(result.candidate.scene);
		expect(projection.footprints).toHaveLength(1);
		const points = projection.footprints[0]!.points;
		expect(points).toHaveLength(4);
		for (const [x, z] of points) {
			expect(Math.abs(x)).toBeCloseTo(0.5, 12);
			expect(Math.abs(z)).toBeCloseTo(0.5, 12);
		}
		// The renderer's own correction is 1 for primitives, and the authored
		// instance carries scale 1 — the footprint is the declared one.
		expect(definition.renderNormalization.defaultScale).toBe(1);
		expect(JSON.stringify(result.candidate.entity)).not.toContain('0.032');
	});
});
