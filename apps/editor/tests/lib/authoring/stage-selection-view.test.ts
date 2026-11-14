import { describe, expect, it } from 'vitest';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '@portfolio/project-model/units';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';
import type { StageSubject } from '$lib/authoring/stage/stage-facade';
import { attachUnitStageSource } from '$lib/authoring/stage/unit-stage-source';
import {
	createUnitProject,
	type UnitProjectInput
} from './__fixtures__/unit-envelope-fixtures';
import { sceneEntityReference } from './__fixtures__/f4-current-source-fixtures';
import {
	createStageSelectionView,
	type StageSelectionViewInput
} from '$lib/authoring/stage/route/stage-selection-view';

async function snapshotOf(input: UnitProjectInput, name: string, contentId: string): Promise<StageReadSnapshot> {
	const envelope = await createUnitProject(input);
	return attachUnitStageSource(
		{
			acceptedRevision: { projectId: input.id, revisionId: 'revision-1' },
			sourceContentId: contentId,
			canonicalJson: '{}',
			sessionEpoch: 'session-selection-view',
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			compileGeneration: `generation-${contentId}`,
			domain: { name } as StageReadSnapshot['domain']
		} as StageReadSnapshot,
		envelope
	);
}

describe('stage selection view — the Index projection stays document-stable', () => {
	it('reuses Index rows, labels and relations across selection and scope changes, and rebuilds on a source revision', async () => {
		const initialSnapshot = await snapshotOf(
			{ id: 'project-1', name: 'Selection project' },
			'Selection project',
			'content-1'
		);
		const reference = sceneEntityReference('content-1', 'entity-1');
		const subject: StageSubject = {
			id: 'scene:entity:entity-1',
			label: 'Chair',
			reference,
			worldPoint: [1, 2, 3]
		};
		const view = createStageSelectionView();
		const base: StageSelectionViewInput = {
			snapshot: initialSnapshot,
			envelope: null,
			sceneRooms: new Map(),
			selection: null,
			planView: null,
			subjects: [subject],
			scope: 'project'
		};

		const initial = view.read(base);
		expect(initial.entries).toHaveLength(1);
		expect(initial.sourceWorldPoint(subject.id)).toEqual([1, 2, 3]);

		// Selection is a Card read, not an Index input.
		const selected = view.read({ ...base, selection: { reference } });
		expect(selected.entries).toBe(initial.entries);
		expect(selected.labels).toBe(initial.labels);
		expect(selected.entryMap).toBe(initial.entryMap);
		expect(selected.worldIndex).toBe(initial.worldIndex);
		expect(selected.cardIdentity?.sourceId).toBe('entity-1');

		// Scope only resolves the visible context; it does not rebuild the Index.
		const scoped = view.read({ ...base, scope: 'room:missing' });
		expect(scoped.entries).toBe(initial.entries);
		expect(scoped.labels).toBe(initial.labels);
		expect(scoped.worldIndex).toBe(initial.worldIndex);
		expect(scoped.resolvedScope).toBe('project');
		expect(scoped.sceneEntityOf('missing')).toBeNull();

		// A new accepted source is a new document projection.
		const revisedSnapshot = await snapshotOf(
			{ id: 'project-1', name: 'Renamed project' },
			'Renamed project',
			'content-2'
		);
		const revised = view.read({ ...base, snapshot: revisedSnapshot });
		expect(revised.entries).not.toBe(initial.entries);
		expect(revised.labels).not.toBe(initial.labels);
		expect(revised.worldIndex).not.toBe(initial.worldIndex);
		expect(revised.worldIndex.contexts[0]?.label).toBe('Renamed project');
	});
});