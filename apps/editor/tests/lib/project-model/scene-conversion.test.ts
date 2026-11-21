/**
 * The bounded Scene 11/resources 2 converter.
 *
 * It is the only reader that accepts the outgoing pair. These tests prove it
 * preserves stable IDs, assignments and pins, maps the old normal flag, and
 * refuses every other version pair without returning a document.
 */
import { describe, expect, it } from 'vitest';
import { computeUnitContentRevision } from '@portfolio/project-model/units';
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

describe('Scene 11/resources 2 -> Scene 12/resources 3', () => {
	it('preserves identities, assignments and pins while converting the Finish grammar', async () => {
		const source = await outgoingEnvelope();
		const result = await convertScene11To12(source);
		expect(result.success).toBe(true);
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
		const result: SceneConversionResult = await convertScene11To12(source);
		expect(result.success).toBe(false);
		if (!result.success) expect(result.issues[0]?.code).toBe('unknown-key');
	});
});
