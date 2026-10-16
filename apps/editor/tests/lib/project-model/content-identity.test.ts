/**
 * The one current-source content identity (`@portfolio/project-model`,
 * T1.P01.S03 plan §Content identity).
 *
 * Pins the four properties the plan names — invariance to input key order and
 * whitespace, distinctness for different authored contents, equality for
 * identical contents, and freedom from acceptance bookkeeping — plus the
 * refusal path: a source the current writer rejects is never hashed, because an
 * identity computed over an unvalidated payload could make equal bytes-but-
 * unequal meaning compare equal.
 *
 * These are the tests every sibling consumer (S02's boot, `T3.P01.S02`'s server
 * recomputation) inherits from the export that lands here.
 */
import { describe, expect, it } from 'vitest';

import {
	canonicalSourceJson,
	computeSourceContentId,
	createEmptyWallFirstProject,
	createEmptyWorldLocalSceneDocument,
	tryComputeSourceContentId,
	validateProject,
	type ProjectDocument,
	type SceneEntity
} from '@portfolio/project-model';

function baseProject(): ProjectDocument {
	return createEmptyWallFirstProject({ id: 'project-identity', name: 'Identity' });
}

function entity(id: string, name: string): SceneEntity {
	return {
		kind: 'primitive',
		id,
		name,
		primitive: 'box',
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: false,
		position: [0, 0.5, 0],
		rotation: [0, 0, 0]
	};
}

function withEntity(project: ProjectDocument, ...entities: SceneEntity[]): ProjectDocument {
	return {
		...project,
		scene: { ...createEmptyWorldLocalSceneDocument(), entities }
	};
}

describe('current-source content identity', () => {
	it('is the shared sha256 fingerprint over canonical bytes', async () => {
		const identity = await computeSourceContentId(baseProject());
		expect(identity).toMatch(/^sha256-[0-9a-f]{64}$/);
	});

	it("matches the project writer's own canonical bytes (no second canonical form)", async () => {
		const project = baseProject();
		const canonical = canonicalSourceJson(project);
		expect(canonical.kind).toBe('canonical');
		if (canonical.kind !== 'canonical') return;
		const validated = validateProject(project);
		expect(validated.success).toBe(true);
		if (!validated.success) return;
		expect(canonical.canonicalJson).toBe(validated.canonicalJson);
	});

	it('is invariant to input key order and whitespace', async () => {
		const project = withEntity(baseProject(), entity('entity-1', 'One'));
		const compact = JSON.stringify(project);
		const pretty = JSON.stringify(project, null, 4);
		const reordered = `{ "scene": ${JSON.stringify(project.scene)}, "name": ${JSON.stringify(project.name)}, "layout": ${JSON.stringify(project.layout)}, "id": ${JSON.stringify(project.id)} }`;

		const [fromCompact, fromPretty, fromReordered, fromParsed] = await Promise.all([
			computeSourceContentId(compact),
			computeSourceContentId(pretty),
			computeSourceContentId(reordered),
			computeSourceContentId(project)
		]);
		expect(fromPretty).toBe(fromCompact);
		expect(fromReordered).toBe(fromCompact);
		expect(fromParsed).toBe(fromCompact);

		// The canonical bytes themselves are invariant, not just their digest: the
		// writer rebuilds the document, so the caller's key order cannot survive.
		const a = canonicalSourceJson(reordered);
		const b = canonicalSourceJson(compact);
		expect(a.kind).toBe('canonical');
		expect(b.kind).toBe('canonical');
		if (a.kind !== 'canonical' || b.kind !== 'canonical') return;
		expect(a.canonicalJson).toBe(b.canonicalJson);
	});

	it('gives identical contents one identity and different contents another', async () => {
		const project = withEntity(baseProject(), entity('entity-1', 'One'));
		const sameContents = withEntity(baseProject(), entity('entity-1', 'One'));
		expect(await computeSourceContentId(sameContents)).toBe(await computeSourceContentId(project));

		// Scene-level change.
		const sceneChanged = withEntity(baseProject(), entity('entity-1', 'Renamed'));
		expect(await computeSourceContentId(sceneChanged)).not.toBe(await computeSourceContentId(project));

		// Entity-set change.
		const entityAdded = withEntity(baseProject(), entity('entity-1', 'One'), entity('entity-2', 'Two'));
		expect(await computeSourceContentId(entityAdded)).not.toBe(await computeSourceContentId(project));

		// Layout-level change (a Layout-owned authored value, not a Scene one).
		const layoutChanged: ProjectDocument = {
			...project,
			layout: { ...project.layout, floor: { ...project.layout.floor, name: 'Ground floor' } }
		};
		expect(validateProject(layoutChanged).success).toBe(true);
		expect(await computeSourceContentId(layoutChanged)).not.toBe(await computeSourceContentId(project));

		// Project-level change.
		expect(await computeSourceContentId({ ...project, name: 'Renamed project' })).not.toBe(
			await computeSourceContentId(project)
		);
	});

	it('hashes the authored document only — no acceptance bookkeeping', async () => {
		const project = withEntity(baseProject(), entity('entity-1', 'One'));
		const canonical = canonicalSourceJson(project);
		expect(canonical.kind).toBe('canonical');
		if (canonical.kind !== 'canonical') return;
		// The canonical document is the authored pair and nothing else: a revision,
		// epoch, history position or receipt inserted here would change the digest
		// of unchanged contents.
		expect(Object.keys(canonical.project).sort()).toEqual(['id', 'layout', 'name', 'scene']);
		expect(Object.keys(canonical.project.scene).sort()).toEqual([
			'connections',
			'entities',
			'formatVersion',
			'materials',
			'navigationNodes',
			'textures'
		]);
	});

	it('refuses a source the current writer rejects instead of hashing it', async () => {
		const missingHalves = await tryComputeSourceContentId({ id: 'project-identity', name: 'Identity' });
		expect(missingHalves.kind).toBe('rejected');
		if (missingHalves.kind === 'rejected') expect(missingHalves.issues.length).toBeGreaterThan(0);

		const unknownRootKey = await tryComputeSourceContentId({ ...baseProject(), revision: 'revision-1' });
		expect(unknownRootKey.kind).toBe('rejected');

		const invalidJson = await tryComputeSourceContentId('{ "id": "project-identity"');
		expect(invalidJson.kind).toBe('rejected');
		if (invalidJson.kind === 'rejected') expect(invalidJson.issues[0]!.code).toBe('invalid_json');

		await expect(computeSourceContentId({ id: 'project-identity', name: 'Identity' })).rejects.toThrow();
	});
});
