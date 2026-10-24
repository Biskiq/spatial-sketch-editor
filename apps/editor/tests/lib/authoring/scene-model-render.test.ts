/**
 * T2.P02.S02 — approved-model rendering and derived geometry.
 *
 * The renderer, the Plan projection and the transform session must all read the
 * **confirmed** placement of an approved model, and none of them may measure a
 * mesh or invent a box. These tests cover the editor-side seams that consume it:
 * the resource pin → immutable URL resolution, the Plan footprint, and the
 * contact/support answer the placement and transform planners depend on.
 */
import { describe, expect, it } from 'vitest';

import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { creatorModelResourceEntry } from '@portfolio/project-model/scene-planning';

import {
	approvedModelPins,
	resolveApprovedModels
} from '$lib/authoring/scene/model-bytes';
import { buildPlanSceneFootprintProjection } from '$lib/authoring/scene/plan-scene-footprint';
import { localContactMinY, sceneComposeSupport } from '$lib/authoring/adapters/scene/placement';

const HASH = `sha256-${'a'.repeat(64)}`;
const HASH_B = `sha256-${'b'.repeat(64)}`;
const REPORT = `sha256-${'c'.repeat(64)}`;

function entry(id: string, hash = HASH) {
	const resource = creatorModelResourceEntry(id, {
		derivative: { hash, mime: 'model/gltf-binary', size: 4096, locator: `/models/${hash}.glb` },
		source: { manifestHash: `sha256-${'d'.repeat(64)}`, size: 8192, fileCount: 2 },
		recipe: { id: 'creator-import@1', version: 1 },
		reportDigest: REPORT,
		placement: {
			metresPerSourceUnit: 1,
			pivot: [0, 0, 0],
			footprint: { width: 0.8, depth: 0.6 },
			contactMinY: -0.25
		}
	});
	if (resource === null) throw new Error('fixture approval refused');
	return resource;
}

function envelopeWith(resources: readonly ReturnType<typeof entry>['resource'][]): ProjectEnvelope {
	return {
		units: {
			resources: {
				header: { formatVersion: 2, contentRevision: 'sha256-0' },
				data: { formatVersion: 2, resources }
			}
		}
	} as unknown as ProjectEnvelope;
}

function modelEntity(id: string, assetId: string) {
	return {
		kind: 'model' as const,
		id,
		name: id,
		assetId,
		fallback: 'generic' as const,
		position: [1, 2, 3] as [number, number, number],
		rotation: [0, 0.5, 0] as [number, number, number],
		scale: 1
	};
}

describe('approved model bytes', () => {
	it('resolves pins from the accepted envelope only', () => {
		const envelope = envelopeWith([entry('model-a').resource, entry('model-b', HASH_B).resource]);
		expect(approvedModelPins(envelope)).toEqual([
			{ assetId: 'model-a', hash: HASH },
			{ assetId: 'model-b', hash: HASH_B }
		]);
	});

	it('shares one immutable URL per content hash and revokes exactly what it acquired', async () => {
		const envelope = envelopeWith([entry('model-a').resource, entry('model-b').resource]);
		const loaded: { hash: string; signal?: AbortSignal }[] = [];
		const sources = await resolveApprovedModels({
			envelope,
			projectId: 'project-1',
			apiOrigin: 'http://api.test',
			client: {
				loadContent: async (_projectId, hash) => {
					loaded.push({ hash });
					return new Uint8Array([1, 2, 3]);
				}
			}
		});
		// Two instances of one immutable revision: one fetch, one URL.
		expect(loaded.map((call) => call.hash)).toEqual([HASH]);
		expect(sources.urls.get('model-a')).toBe(sources.urls.get('model-b'));
		sources.dispose();
		// A second resolution acquires again, so the first disposal did not poison
		// the cache for a later session.
		const again = await resolveApprovedModels({
			envelope,
			projectId: 'project-1',
			apiOrigin: 'http://api.test',
			client: { loadContent: async () => new Uint8Array([1, 2, 3]) }
		});
		expect(again.urls.size).toBe(2);
		again.dispose();
	});

	it('reports a failed pin instead of claiming the model loaded', async () => {
		const envelope = envelopeWith([entry('model-a').resource]);
		const sources = await resolveApprovedModels({
			envelope,
			projectId: 'project-1',
			apiOrigin: 'http://api.test',
			client: {
				loadContent: async () => {
					throw new Error('the approved model could not be loaded');
				}
			}
		});
		expect(sources.urls.size).toBe(0);
		expect(sources.failures.get('model-a')).toContain('could not be loaded');
		sources.dispose();
	});

	it('treats an unconfigured API as an honest failure, not an empty success', async () => {
		const envelope = envelopeWith([entry('model-a').resource]);
		const sources = await resolveApprovedModels({ envelope, projectId: 'project-1', apiOrigin: '', client: null });
		expect(sources.urls.size).toBe(0);
		expect(sources.failures.get('model-a')).toContain('not configured');
	});
});

describe('Plan projection of an approved model', () => {
	it('draws the confirmed footprint and rotates it with the entity', () => {
		const projection = buildPlanSceneFootprintProjection(
			{ entities: [modelEntity('entity-1', 'model-a')] as never },
			{ modelFootprintById: () => ({ width: 0.8, depth: 0.6 }) }
		);
		expect(projection.footprints).toHaveLength(1);
		const points = projection.footprints[0]!.points;
		// 0.5 rad yaw: the rectangle is rotated, so its world extent is wider than
		// either local dimension alone, and the centre is the entity's position.
		const xs = points.map(([x]) => x);
		const zs = points.map(([, z]) => z);
		expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.8);
		expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(0.6);
		expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(1, 6);
		expect((Math.max(...zs) + Math.min(...zs)) / 2).toBeCloseTo(3, 6);
	});

	it('draws nothing when the model footprint is unavailable or degenerate', () => {
		const entities = { entities: [modelEntity('entity-1', 'model-a')] as never };
		expect(buildPlanSceneFootprintProjection(entities, { modelFootprintById: () => undefined }).footprints).toHaveLength(0);
		expect(
			buildPlanSceneFootprintProjection(entities, { modelFootprintById: () => ({ width: 0, depth: 0.6 }) })
				.footprints
		).toHaveLength(0);
	});
});

describe('the transform session reads approved contact', () => {
	it('uses the approved contact for a creator model and refuses without it', () => {
		const entity = modelEntity('entity-1', 'model-a');
		expect(localContactMinY(entity, -0.25)).toBe(-0.25);
		expect(localContactMinY(entity, null)).toBeNull();
		expect(localContactMinY(entity)).toBeNull();
	});

	it('offers Resize and Duplicate only when the approved contact exists', () => {
		const entity = modelEntity('entity-1', 'model-a');
		expect(sceneComposeSupport(entity, -0.25)).toMatchObject({ resize: true, duplicate: true });
		const unsupported = sceneComposeSupport(entity, null);
		expect(unsupported.resize).toBe(false);
		expect(unsupported.duplicate).toBe(false);
	});
});
