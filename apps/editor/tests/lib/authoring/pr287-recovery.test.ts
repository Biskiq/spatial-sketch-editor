/**
 * PR #287 recovery — the two-Wall D Room must survive every canonical gate.
 *
 * The planner, the wall-first codec and F.2 admission are three separate gates.
 * This suite proves the same curved + straight enclosure passes all three, so a
 * creator sees a derived Room instead of an internal admission error.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	planWallChain,
	wallCubicChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { refusedChainPreview } from '$lib/authoring/adapters/layout/chain';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const PROJECT_ID = 'project-pr287-d-room';

function baseDocument(): LayoutDocumentWallFirst {
	const base = createEmptyWallFirstLayoutDocument();
	return { ...base, floor: { ...base.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 } };
}

function curvedBaseline(): LayoutDocumentWallFirst {
	const baseline = baseDocument();
	baseline.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [6, 0] }
	];
	baseline.walls = [
		{
			id: 'wall-top',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			thickness: 0.2,
			height: 3,
			centerline: wallCubicChain(
				[{ id: 'wall-top:knot:1', point: [3, 2] }],
				deriveChainSpans([[0, 0], [3, 2], [6, 0]])
			)
		}
	];
	return baseline;
}

describe('PR287 — two-Wall D Room closure', () => {
	it('plans, derives and admits a curved + straight D Room through F.2', async () => {
		const baseline = curvedBaseline();
		const plan = planWallChain({
			baseline,
			points: [
				[6, 0],
				[0, 0]
			],
			close: false,
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: 'j-b' },
				{ pointIndex: 1, junctionId: 'j-a' }
			],
			capture: freshCapture(),
			levelId: baseline.floor.id
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.walls).toHaveLength(2);
		expect(plan.document.rooms).toHaveLength(1);
		expect(plan.document.rooms[0]!.boundary).toHaveLength(2);

		const project = await createUnitProject({
			id: PROJECT_ID,
			name: 'PR287 D Room',
			layout: plan.document,
			scene: {
				formatVersion: 1,
				textures: [],
				materials: [],
				entities: [],
				navigationNodes: [],
				connections: []
			}
		});
		const admitted = await admitSource(project, {
			sessionEpoch: 'session-pr287-d-room',
			acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
		});
		expect(admitted.kind, JSON.stringify(admitted)).toBe('admitted');
		if (admitted.kind !== 'admitted') return;
		expect(admitted.snapshot.domain.geometry.rooms).toHaveLength(1);
	});

	it('refuses a third Wall between the same Junctions with retained diagnostics', () => {
		const baseline = curvedBaseline();
		const closed = planWallChain({
			baseline,
			points: [
				[6, 0],
				[0, 0]
			],
			close: false,
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: 'j-b' },
				{ pointIndex: 1, junctionId: 'j-a' }
			],
			capture: freshCapture(),
			levelId: baseline.floor.id
		});
		expect(closed.kind).toBe('success');
		if (closed.kind !== 'success') return;
		const third = planWallChain({
			baseline: closed.document,
			points: [
				[6, 0],
				[0, 0]
			],
			close: false,
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: 'j-b' },
				{ pointIndex: 1, junctionId: 'j-a' }
			],
			capture: freshCapture(),
			levelId: baseline.floor.id
		});
		expect(third.kind).toBe('rejected');
		if (third.kind !== 'rejected') return;
		// A third Wall on the same Junction pair is refused before the canonical
		// gate as a collinear overlap, with the attempted geometry named.
		expect(third.rejection.code).toBe('collinear_overlap');
		expect(third.rejection.message).toContain('overlap');
	});

	it('retains F.2 candidate issues and topology diagnostics on the refusal', () => {
		const refused = refusedChainPreview({
			code: 'candidate_does_not_compile',
			issues: [{ code: 'too_few_segments', message: 'A room boundary needs at least three segments' }],
			topology: [{ code: 'boundary_cut_edge', message: 'Boundary wall has no bounded-face incidence' }]
		});
		expect(refused.kind).toBe('refused');
		if (refused.kind !== 'refused') return;
		expect(refused.diagnostics?.map((diagnostic) => diagnostic.code)).toEqual([
			'too_few_segments',
			'boundary_cut_edge'
		]);
	});
});
