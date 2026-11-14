/**
 * Directional light retirement (T2 gallery UX recovery §7.3, owner decision D4).
 *
 * The Sky owns the only Sun, so the authored `directional` Light kind is gone
 * and the Scene unit format moved 6 → 7. The contract is strict refusal with no
 * migration: a version-6 unit and a Directional entity are both refused with a
 * typed error, never read, converted or dropped. Point and Spot are unchanged.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
import type { SceneLightEntity } from '@portfolio/project-model';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	createProjectEnvelope,
	serializeProjectEnvelope,
	validateCameraFreeScenePayload,
	validateProjectEnvelope
} from '@portfolio/project-model/units';

const POINT: SceneLightEntity = {
	kind: 'light',
	id: 'light-point',
	name: 'Point light',
	light: 'point',
	color: '#ffd6a5',
	intensity: Math.PI,
	range: 4,
	castShadow: false,
	position: [1, 2, 3],
	rotation: [0, 0, 0]
};

const SPOT: SceneLightEntity = {
	kind: 'light',
	id: 'light-spot',
	name: 'Spot light',
	light: 'spot',
	color: '#ffffff',
	intensity: 2 * Math.PI,
	angle: Math.PI / 6,
	penumbra: 0.25,
	castShadow: true,
	position: [0, 2.5, 0],
	rotation: [-Math.PI / 2, 0, 0]
};

const DIRECTIONAL = {
	kind: 'light',
	id: 'light-sun',
	name: 'Sun',
	light: 'directional',
	color: '#ffffff',
	intensity: Math.PI,
	castShadow: false,
	position: [0, 0, 0],
	rotation: [-0.8, 0.4, 0]
};

function payload(entities: readonly unknown[], formatVersion: number = SCENE_UNIT_FORMAT_VERSION) {
	return { formatVersion, textures: [], materials: [], entities };
}

describe('Scene unit format 7', () => {
	it('is the one admitted Scene format', () => {
		expect(SCENE_UNIT_FORMAT_VERSION).toBe(7);
	});

	it('refuses a version-6 Scene payload strictly, even when its content is otherwise valid', () => {
		const result = validateCameraFreeScenePayload(payload([POINT, SPOT], 6));
		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.issues.map((issue) => issue.code)).toEqual(['unsupported_format_version']);
		expect(result.issues[0]!.path).toBe('$.formatVersion');
	});

	it('refuses a version-6 payload carrying a Directional light as a format error, with no conversion', () => {
		const result = validateCameraFreeScenePayload(payload([DIRECTIONAL], 6));
		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.issues.map((issue) => issue.code)).toEqual(['unsupported_format_version']);
	});
});

describe('Directional light refusal', () => {
	it('refuses kind: directional with a typed error naming the entity', () => {
		const result = validateCameraFreeScenePayload(payload([POINT, DIRECTIONAL]));
		expect(result.success).toBe(false);
		if (result.success) return;
		const refusal = result.issues.find((issue) => issue.code === 'unsupported_light_kind');
		expect(refusal?.path).toBe('$.entities[1].light');
		expect(refusal?.message).toContain('This project uses a light kind that is no longer supported');
		expect(refusal?.message).toContain('light-sun');
		expect(refusal?.message).toContain('Sun');
	});

	it('refuses every Directional entity and never converts or drops one', () => {
		const second = { ...DIRECTIONAL, id: 'light-sun-2', name: 'Sun 2' };
		const result = validateCameraFreeScenePayload(payload([DIRECTIONAL, POINT, second]));
		expect(result.success).toBe(false);
		if (result.success) return;
		const paths = result.issues
			.filter((issue) => issue.code === 'unsupported_light_kind')
			.map((issue) => issue.path);
		expect(paths).toEqual(['$.entities[0].light', '$.entities[2].light']);
	});

	it('treats an unknown light kind as a different refusal from the retired one', () => {
		const result = validateCameraFreeScenePayload(payload([{ ...DIRECTIONAL, light: 'area' }]));
		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.issues.map((issue) => issue.code)).toContain('invalid_light');
		expect(result.issues.map((issue) => issue.code)).not.toContain('unsupported_light_kind');
	});
});

describe('the authored Light kinds stay exactly Point and Spot', () => {
	const source = (file: string): string =>
		readFileSync(resolve(process.cwd(), '../../packages/project-model/src', file), 'utf8');

	it('admits only point and spot in the codec reader', () => {
		const match = source('scene-codec/readers.ts').match(/SCENE_LIGHT_KINDS\s*=\s*\[([^\]]*)\]/);
		expect(match?.[1]?.replace(/['"\s]/g, '').split(',').filter(Boolean)).toEqual(['point', 'spot']);
	});

	it('types the Scene light kind as point or spot only', () => {
		expect(source('scene.ts')).toMatch(/type SceneLightKind\s*=\s*'point'\s*\|\s*'spot'\s*;/);
	});

	it('names the retired kind only in the codec refusal', () => {
		for (const file of ['scene.ts', 'scene-codec/readers.ts', 'scene-codec/canonical.ts', 'scene-planning/light-operations.ts', 'scene-planning/intent-payload.ts']) {
			expect(source(file), file).not.toMatch(/['"]directional['"]/);
		}
		expect(source('scene-codec/parse-entities.ts')).toContain("RETIRED_DIRECTIONAL_LIGHT = 'directional'");
	});
});

describe('Point and Spot are unchanged', () => {
	it('round-trips both kinds through the Scene payload with every field intact', () => {
		const result = validateCameraFreeScenePayload(payload([POINT, SPOT]));
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.value.formatVersion).toBe(7);
		expect(result.value.entities).toEqual([POINT, SPOT]);
	});

	it('round-trips through a serialized project envelope', async () => {
		const built = await createProjectEnvelope({
			id: 'project-1',
			name: 'Project one',
			acceptedRevision: { projectId: 'project-1', revisionId: 'revision-1' },
			dependencyLock: { formatVersion: 1, entries: [] },
			layout: { unitId: 'unit-layout', data: createEmptyWallFirstLayoutDocument() },
			scene: { unitId: 'unit-scene', data: payload([POINT, SPOT]) as never },
			camera: {
				unitId: 'unit-camera',
				data: {
					formatVersion: CAMERA_UNIT_FORMAT_VERSION,
					views: [{ id: 'view-1', label: 'Entry', eye: [0, 0, 0], target: [0, 0, 1], fov: 54, connectedViewIds: [] }],
					connections: []
				}
			},
			experience: {
				unitId: 'unit-experience',
				data: { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences: [] }
			},
			resources: {
				unitId: 'unit-resources',
				data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [] }
			}
		});
		const text = serializeProjectEnvelope(built);
		const read = validateProjectEnvelope(JSON.parse(text));
		expect(read.success).toBe(true);
		if (!read.success) return;
		expect(read.envelope.units.scene.header.formatVersion).toBe(7);
		expect(read.envelope.units.scene.data.entities).toEqual([POINT, SPOT]);

		// The same envelope with its Scene unit stamped version 6 is refused whole.
		const stale = JSON.parse(text) as {
			units: { scene: { header: { formatVersion: number }; data: { formatVersion: number } } };
		};
		stale.units.scene.header.formatVersion = 6;
		stale.units.scene.data.formatVersion = 6;
		const refused = validateProjectEnvelope(stale);
		expect(refused.success).toBe(false);
		if (refused.success) return;
		expect(refused.issues.map((issue) => issue.code)).toContain('unsupported_format_version');
	});
});
