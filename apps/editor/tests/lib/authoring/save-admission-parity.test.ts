/**
 * Editor/API Save admission parity (T3.P01.S02).
 *
 * Save must not persist a source the visitor or editor refuses. The API's Save
 * suite builds the **same** unknown-asset source and asserts `invalid_project`;
 * this file proves the editor's own admission path (its catalogue Scene options)
 * refuses it too. The fixture is intentionally tiny so both sides can build it
 * literally without a shared test package.
 */
import { describe, expect, it } from 'vitest';

import {
	admitCurrentSource,
	createEmptyWallFirstProject,
	type AcceptedRevision
} from '@portfolio/project-model';
import { MUSEUM_SCENE_VALIDATION_OPTIONS } from '$lib/content/scene-validation';

const PARITY_ASSET_ID = 'asset-not-in-the-host-catalogue';
const PARITY_REVISION: AcceptedRevision = { projectId: 'project:parity', revisionId: 'revision-1' };

function unknownAssetProject() {
	const project = createEmptyWallFirstProject({ id: 'project:parity', name: 'Parity' });
	project.scene.entities = [
		{
			kind: 'model',
			id: 'imported',
			name: 'Imported',
			assetId: PARITY_ASSET_ID,
			fallback: 'piano',
			position: [0, 0, 0],
			rotation: [0, 0, 0]
		}
	];
	return project;
}

describe('Save admission parity', () => {
	it('editor admission refuses the same unknown-asset source the API refuses', async () => {
		const result = await admitCurrentSource(unknownAssetProject(), {
			acceptedRevision: PARITY_REVISION,
			scene: MUSEUM_SCENE_VALIDATION_OPTIONS
		});
		expect(result.kind).toBe('rejected');
		if (result.kind !== 'rejected') throw new Error('expected a refusal');
		expect(result.code).toBe('invalid-project');
		expect(result.issues.some((issue) => issue.message.includes(PARITY_ASSET_ID))).toBe(true);
	});
});
