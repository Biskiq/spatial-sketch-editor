/**
 * Editor/API Save admission parity.
 *
 * Save must not persist a source the editor refuses. Both sides now read the
 * same F.2 envelope: the Stage admission and the unit Save reader share
 * `validateProjectEnvelope` and the canonical envelope bytes, so parity is the
 * content identity they compute, not a second project codec.
 *
 * The unknown-asset case stays an **editor admission** refusal: the host
 * catalogue is a Stage runtime option, and the Save handler deliberately does
 * not invent one. This file pins that difference instead of pretending the two
 * boundaries are identical.
 */
import { describe, expect, it } from 'vitest';

import type { AcceptedRevision } from '@portfolio/project-model';
import {
	SCENE_UNIT_FORMAT_VERSION,
	computeEnvelopeSourceContentId,
	readUnitEnvelopeForSave,
	serializeProjectEnvelope,
	type CameraFreeSceneDocument
} from '@portfolio/project-model/units';

import { admitUnitProject, createUnitProject } from './__fixtures__/unit-envelope-fixtures';

const PARITY_ASSET_ID = 'asset-not-in-the-host-catalogue';
const PARITY_REVISION: AcceptedRevision = { projectId: 'project:parity', revisionId: 'revision-1' };

function unknownAssetScene(): CameraFreeSceneDocument {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials: [],
		entities: [
			{
				kind: 'model',
				id: 'imported',
				name: 'Imported',
				assetId: PARITY_ASSET_ID,
				fallback: 'piano',
				position: [0, 0, 0],
				rotation: [0, 0, 0]
			}
		]
	};
}

async function unknownAssetProject() {
	return createUnitProject({
		id: 'project:parity',
		name: 'Parity',
		acceptedRevision: PARITY_REVISION,
		scene: unknownAssetScene()
	});
}

describe('Save admission parity', () => {
	it('editor admission refuses an unknown-asset source the host catalogue cannot render', async () => {
		const result = await admitUnitProject(await unknownAssetProject(), PARITY_REVISION);
		expect(result.kind).toBe('rejected');
		if (result.kind !== 'rejected') throw new Error('expected a refusal');
		expect(result.issues.some((issue) => issue.message.includes(PARITY_ASSET_ID))).toBe(true);
	});

	it('the unit Save reader and Stage admission agree on the canonical envelope identity', async () => {
		const project = await createUnitProject({
			id: 'project:parity',
			name: 'Parity',
			acceptedRevision: PARITY_REVISION
		});
		const canonicalJson = serializeProjectEnvelope(project);
		const read = await readUnitEnvelopeForSave(canonicalJson);
		expect(read.kind).toBe('read');
		if (read.kind !== 'read') return;
		expect(await computeEnvelopeSourceContentId(read.envelope)).toBe(
			await computeEnvelopeSourceContentId(project)
		);

		const admitted = await admitUnitProject(project, PARITY_REVISION);
		expect(admitted.kind).toBe('admitted');
		if (admitted.kind !== 'admitted') return;
		expect(admitted.canonicalJson).toBe(canonicalJson);
		expect(admitted.sourceContentId).toBe(await computeEnvelopeSourceContentId(project));
	});
});
