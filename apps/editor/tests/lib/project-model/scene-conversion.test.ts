/**
 * The bounded Scene 11/resources 2 converter.
 *
 * It is the only reader that accepts the outgoing pair. These tests prove it
 * preserves stable IDs, assignments and pins, maps the old normal flag, and
 * refuses every other version pair without returning a document.
 */
import { describe, expect, it } from 'vitest';
import { computeUnitContentRevision } from '@portfolio/project-model/units';
import { catalogueRecipe } from '@portfolio/project-model/materials';
import {
	convertScene11To12,
	type SceneConversionResult
} from '@portfolio/project-model/scene-conversion';
import { createUnitProject } from '../authoring/__fixtures__/unit-envelope-fixtures';

async function outgoingEnvelope() {
	const envelope = await createUnitProject({ id: 'project-1', name: 'Outgoing' });
	const outgoing = structuredClone(envelope) as unknown as {
		units: {
			scene: {
				header: { formatVersion: number; contentRevision: string };
				data: Record<string, unknown> & { formatVersion: number };
			};
			resources: {
				header: { formatVersion: number; contentRevision: string };
				data: { formatVersion: number; resources: unknown[] };
			};
		};
	};
	outgoing.units.scene.header.formatVersion = 11;
	outgoing.units.scene.data.formatVersion = 11;
	outgoing.units.scene.data.textures = [
		{ id: 'tex-colour', name: 'Colour', uri: '/textures/colour.png' },
		{ id: 'tex-normal', name: 'Normal', uri: '/textures/normal.png' }
	];
	outgoing.units.scene.data.materials = [
		{
			id: 'brushed',
			name: 'Brushed',
			baseMaterialId: 'plaster-warm',
			color: '#aabbcc',
			roughness: 0.35,
			metalness: 0.9,
			maps: { color: 'tex-colour', normal: 'tex-normal' },
			mapping: { tileMeters: [2, 2], rotation: 0.25 },
			normalScale: 1.5,
			normalFlipY: true
		}
	];
	outgoing.units.scene.data.surfaceFinishes = [
		{
			surface: { kind: 'wall-side', wallId: 'wall-a', side: 'left' },
			finish: { materialInstanceId: 'brushed' }
		}
	];
	outgoing.units.resources.header.formatVersion = 2;
	outgoing.units.resources.data.formatVersion = 2;
	outgoing.units.scene.header.contentRevision = await computeUnitContentRevision(
		outgoing.units.scene.data as never
	);
	outgoing.units.resources.header.contentRevision = await computeUnitContentRevision(
		outgoing.units.resources.data as never
	);
	return outgoing as never;
}

/** Build a valid variant: the header records the bytes the test authored. */
async function sealScene(source: unknown): Promise<void> {
	const scene = (source as { units: { scene: { header: { contentRevision: string }; data: unknown } } }).units.scene;
	scene.header.contentRevision = await computeUnitContentRevision(scene.data as never);
}

describe('Scene 11/resources 2 -> Scene 12/resources 3', () => {
	it('preserves identities, assignments and pins while converting the Finish grammar', async () => {
		const source = await outgoingEnvelope();
		const result = await convertScene11To12(source);
		expect(result.success, result.success ? '' : JSON.stringify(result.issues)).toBe(true);
		if (!result.success || result.document === undefined) return;
		const document = result.document;
		expect(document.units.scene.header.formatVersion).toBe(12);
		expect(document.units.scene.data.formatVersion).toBe(12);
		expect(document.units.resources.header.formatVersion).toBe(3);
		expect(document.units.resources.data.formatVersion).toBe(3);
		expect(document.units.layout.header.formatVersion).toBe(9);
		expect(document.units.scene.data.textures.map((texture) => texture.id)).toEqual([
			'tex-colour',
			'tex-normal'
		]);
		expect(document.units.scene.data.surfaceFinishes).toEqual([
			{
				surface: { kind: 'wall-side', wallId: 'wall-a', side: 'left' },
				finish: { materialInstanceId: 'brushed' }
			}
		]);
		const finish = document.units.scene.data.materials[0]!;
		expect(finish.id).toBe('brushed');
		expect(finish.name).toBe('Brushed');
		expect(finish.base).toEqual({ catalogue: 'plaster-warm' });
		expect(finish.overrides?.color).toBe('#aabbcc');
		expect(finish.overrides?.roughness).toBe(0.35);
		expect(finish.overrides?.metalness).toBe(0.9);
		expect(finish.overrides?.normalScale).toBe(1.5);
		expect(finish.overrides?.maps?.color).toEqual({ image: { textureId: 'tex-colour' } });
		expect(finish.overrides?.maps?.normal).toMatchObject({
			image: { textureId: 'tex-normal' },
			convention: '-Y'
		});
		expect(finish.overrides?.mapping).toMatchObject({
			kind: 'target',
			metric: { tileMeters: [2, 2], rotation: 0.25 }
		});
		expect(result.report).toMatchObject({
			source: { scene: 11, resources: 2 },
			target: { scene: 12, resources: 3 },
			preserved: { textures: 2, assignments: 1 }
		});
	});

	it('does not mutate the outgoing source and supports a dry run', async () => {
		const source = (await outgoingEnvelope()) as unknown as {
			units: { scene: { header: { formatVersion: number } } };
		};
		const before = structuredClone(source);
		const dry = await convertScene11To12(source, { dryRun: true });
		expect(dry.success).toBe(true);
		if (dry.success) expect(dry.document).toBeUndefined();
		expect(source).toEqual(before);
	});

	it('refuses a payload edited underneath an unchanged content revision', async () => {
		const sceneTampered = (await outgoingEnvelope()) as unknown as {
			units: { scene: { header: { contentRevision: string }; data: { materials: { color: string }[] } } };
		};
		const sceneBefore = structuredClone(sceneTampered);
		sceneTampered.units.scene.data.materials[0]!.color = '#010101';
		const sceneResult = await convertScene11To12(sceneTampered);
		expect(sceneResult.success).toBe(false);
		if (!sceneResult.success) {
			expect(sceneResult.issues).toContainEqual(
				expect.objectContaining({
					path: '$.units.scene.header.contentRevision',
					code: 'content-revision-mismatch'
				})
			);
		}
		// Verification never repairs the header over bytes it did not prove.
		expect(sceneTampered).toEqual({
			...sceneBefore,
			units: {
				...sceneBefore.units,
				scene: {
					...sceneBefore.units.scene,
					data: sceneTampered.units.scene.data
				}
			}
		});

		const resourcesTampered = (await outgoingEnvelope()) as unknown as {
			units: { resources: { header: { contentRevision: string }; data: { resources: unknown[] } } };
		};
		resourcesTampered.units.resources.data.resources.push({ kind: 'texture', id: 'smuggled' });
		const resourcesResult = await convertScene11To12(resourcesTampered);
		expect(resourcesResult.success).toBe(false);
		if (!resourcesResult.success) {
			expect(resourcesResult.issues).toContainEqual(
				expect.objectContaining({
					path: '$.units.resources.header.contentRevision',
					code: 'content-revision-mismatch'
				})
			);
		}
	});

	it('refuses a mixed or historical version pair without a partial document', async () => {
		const source = (await outgoingEnvelope()) as unknown as {
			units: {
				scene: { header: { formatVersion: number } };
				resources: { data: { formatVersion: number } };
			};
		};
		source.units.resources.data.formatVersion = 1;
		const mixed = await convertScene11To12(source);
		expect(mixed.success).toBe(false);
		if (!mixed.success) expect(mixed.issues[0]?.code).toBe('unsupported-format');
		const future = (await outgoingEnvelope()) as unknown as {
			units: { scene: { header: { formatVersion: number } } };
		};
		future.units.scene.header.formatVersion = 13;
		const refused = await convertScene11To12(future);
		expect(refused.success).toBe(false);
	});

	it('refuses an unknown outgoing material field rather than silently dropping it', async () => {
		const source = (await outgoingEnvelope()) as unknown as {
			units: { scene: { data: { materials: Record<string, unknown>[] } } };
		};
		source.units.scene.data.materials[0]!.invented = true;
		await sealScene(source);
		const result: SceneConversionResult = await convertScene11To12(source);
		expect(result.success).toBe(false);
		if (!result.success) expect(result.issues[0]?.code).toBe('unknown-key');
	});

	it('fills a sparse scene mapping from the catalogue base, not the neutral recipe', async () => {
		const source = (await outgoingEnvelope()) as unknown as {
			units: { scene: { data: { materials: Record<string, unknown>[] } } };
		};
		source.units.scene.data.materials[0]!.mapping = { tileMeters: [1.5, 2.5] };
		await sealScene(source);
		const result = await convertScene11To12(source);
		expect(result.success).toBe(true);
		if (!result.success || result.document === undefined) return;
		const base = catalogueRecipe('plaster-warm')!.mapping;
		expect(base.kind).toBe('target');
		if (base.kind !== 'target') return;
		const mapping = result.document.units.scene.data.materials[0]!.overrides?.mapping;
		expect(mapping).toMatchObject({
			kind: 'target',
			metric: {
				tileMeters: [1.5, 2.5],
				rotation: base.metric.rotation,
				offset: base.metric.offset
			}
		});
	});

	it('staticizes a shipped texture and preserves a palette follower', async () => {
		const source = (await outgoingEnvelope()) as unknown as {
			units: {
				scene: {
					data: {
						textures: { id: string; name: string; uri: string }[];
						materials: Record<string, unknown>[];
						palette: unknown[];
					};
				};
			};
		};
		source.units.scene.data.textures[0] = {
			id: 'tex-colour', name: 'Colour', uri: '/textures/plaster-warm/map.png'
		};
		source.units.scene.data.palette = [{ id: 'accent', name: 'Accent', color: '#aabbcc' }];
		source.units.scene.data.materials[0]!.color = { slot: 'accent' };
		await sealScene(source);
		const result = await convertScene11To12(source);
		expect(result.success).toBe(true);
		if (!result.success || result.document === undefined) return;
		const finish = result.document.units.scene.data.materials[0]!;
		expect(finish.overrides?.color).toEqual({ slot: 'accent' });
		expect(finish.overrides?.maps?.color).toEqual({
			image: { shipped: '/textures/plaster-warm/map.png' }
		});
	});

	it('preserves packed scalar components for roughness, occlusion and metalness', async () => {
		const source = (await outgoingEnvelope()) as unknown as {
			units: { scene: { data: { textures: { id: string; name: string; uri: string }[]; materials: Record<string, unknown>[] } } };
		};
		source.units.scene.data.textures.push({ id: 'tex-orm', name: 'ORM', uri: '/textures/orm.png' });
		source.units.scene.data.materials[0]!.maps = {
			color: 'tex-colour', roughness: 'tex-orm', occlusion: 'tex-orm', metalness: 'tex-orm'
		};
		await sealScene(source);
		const result = await convertScene11To12(source);
		expect(result.success, result.success ? '' : JSON.stringify(result.issues)).toBe(true);
		if (!result.success || result.document === undefined) return;
		const maps = result.document.units.scene.data.materials[0]!.overrides?.maps;
		expect(maps?.roughness).toMatchObject({ component: 'g', invert: false });
		expect(maps?.occlusion).toMatchObject({ component: 'r', invert: false });
		expect(maps?.metalness).toMatchObject({ component: 'b', invert: false });
	});

	it('refuses an unknown catalogue base before producing a document', async () => {
		const source = (await outgoingEnvelope()) as unknown as {
			units: { scene: { data: { materials: Record<string, unknown>[] } } };
		};
		source.units.scene.data.materials[0]!.baseMaterialId = 'not-a-catalogue-base';
		await sealScene(source);
		const result = await convertScene11To12(source);
		expect(result.success).toBe(false);
		if (!result.success) expect(result.issues[0]?.code).toBe('unknown-material');
	});
});
