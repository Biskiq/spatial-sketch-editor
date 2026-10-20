import { describe, expect, it } from 'vitest';
//
// PR #115 section 7.2 category A-prime - extraction note. This file guards
// `$lib/content/scene` against the checked-in fixture. The Room frames it used to
// resolve against live in the external frozen project (section 3.7), and WP3 made
// the fixture itself current-format, so resolution is identity and no frame source
// is passed. What remains asserts the retained module validation and rejection
// boundaries. Resolution coverage returns with the T2/T3 Scene unit.
import {
	assertNavigationGraphMatchesScene,
	createNavigationGraph,
	modelEntityToPlacement,
	resolveSceneDocument,
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

function fixtureDocument(): SceneDocument {
	return cloneFixtureDocument('tour-minimal');
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
