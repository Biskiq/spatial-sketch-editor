import { describe, expect, it } from 'vitest';
//
// PR #115 section 7.2 category A-prime - extraction note. This file guarded
// `$lib/content/scene` against the checked-in legacy room-local Scene plus the
// Chopin Room frames. Those frames (and `chopin-project.json`) were isolated into
// the external frozen project (section 3.7), and the eight cases that resolved
// room-qualified records cannot keep their expectations with an identity registry,
// so they were removed rather than regenerated to fit. What remains asserts the
// retained module validation and rejection boundaries. Resolution coverage returns
// with the T2/T3 world-local Scene unit and its own fixtures.
import { createEmptyLayoutRoomRegistry } from '@portfolio/project-model';
import {
	assertNavigationGraphMatchesScene,
	createNavigationGraph,
	modelEntityToPlacement,
	resolveSceneDocument as resolveSceneDocumentWithRooms,
	type SceneDocument,
	type SceneModelEntity
} from '$lib/content/scene';
import {
	serializeSceneDocument,
	validateSceneDocument
} from '@portfolio/project-model';
import {
	cloneFixtureDocument,
	loadFixtureScene
} from './__fixtures__/load-fixture-scene';

// PR #115 (§3.7): the Chopin Room frames this legacy room-local fixture used to
// resolve against were isolated into the external frozen project, so the frames are
// now an explicit input; the identity registry leaves room-less records as authored.
const resolveSceneDocument = (input: unknown) =>
	resolveSceneDocumentWithRooms(input, createEmptyLayoutRoomRegistry());

function fixtureDocument(): SceneDocument {
	return cloneFixtureDocument('tour-minimal');
}

function assertGuidedCycleInvariant(document: SceneDocument) {
	const guided = document.navigationNodes.filter(
		(node) => node.nextNodeId !== undefined || node.previousNodeId !== undefined
	);
	if (guided.length === 0) return;

	const nodeById = new Map(document.navigationNodes.map((node) => [node.id, node]));
	const startId = guided[0]!.id;
	const visited = new Set<string>();
	let cursor = nodeById.get(startId);

	while (cursor && !visited.has(cursor.id)) {
		visited.add(cursor.id);
		cursor = cursor.nextNodeId ? nodeById.get(cursor.nextNodeId) : undefined;
	}

	expect(visited.size).toBe(guided.length);
	expect(cursor?.id).toBe(startId);
}


describe('resolveSceneDocument', () => {
	it('rejects unknown placement asset IDs at the scene boundary', () => {
		const base = fixtureDocument();
		const invalid = {
			...base,
			entities: base.entities.map((object, index) =>
				index === 0 ? { ...object, assetId: 'missing-asset' } : object
			)
		};

		expect(() => resolveSceneDocument(invalid)).toThrow(/Unknown asset/);
	});

	it('rejects invalid scene-authoritative placement fallbacks', () => {
		const invalid = fixtureDocument();
		(invalid.entities[0] as unknown as { fallback: string }).fallback = 'not-a-fallback';
		expect(() => resolveSceneDocument(invalid)).toThrow(/invalid_fallback/);
	});







	it('rejects duplicate ids and unknown endpoints', () => {
		const cloneDocument = () => fixtureDocument();
		const duplicate = cloneDocument();
		duplicate.entities.push({ ...duplicate.entities[0] });
		expect(() => resolveSceneDocument(duplicate)).toThrow(
			`Duplicate scene entity id: ${duplicate.entities[0].id}`
		);

		const unknownEndpoint = cloneDocument();
		unknownEndpoint.connections[0].toNodeId = 'missing-node';
		expect(() => resolveSceneDocument(unknownEndpoint)).toThrow(
			'Unknown navigation node: missing-node'
		);
	});


	it('rejects malformed timing payloads', () => {
		const document = fixtureDocument();
		const bad = {
			...document,
			connections: [
				{
					...document.connections[0]!,
					timing: {
						forward: { durationSeconds: 0 }
					}
				},
				...document.connections.slice(1)
			]
		};
		expect(() => resolveSceneDocument(bad)).toThrow(/invalid_duration_seconds/);
	});



});
