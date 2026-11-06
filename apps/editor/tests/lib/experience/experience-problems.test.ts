import { describe, expect, it } from 'vitest';
import { CAMERA_UNIT_FORMAT_VERSION, validateProjectEnvelope } from '@portfolio/project-model/units';

import {
	experienceProblems,
	loweringProblem,
	travelGapMessages
} from '$lib/authoring/experience/experience-problems';

import { VIEWS, experienceEnvelope } from './fixtures';

describe('travelGapMessages', () => {
	it('reports nothing where Camera connects the two Views', async () => {
		const envelope = await experienceEnvelope();
		expect(travelGapMessages(envelope, 'experience-1', 'stop-1')).toEqual([]);
	});

	it('reports the gap on the Stop whose Travel has no connection, and only that Stop', async () => {
		const envelope = await experienceEnvelope({
			camera: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: VIEWS.map((view) => ({ ...view, connectedViewIds: [] })),
				connections: []
			}
		});
		const messages = travelGapMessages(envelope, 'experience-1', 'stop-1');
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain('stop-1');
		expect(travelGapMessages(envelope, 'experience-1', 'stop-2')).toEqual([]);
		expect(travelGapMessages(envelope, 'experience-1', 'missing')).toEqual([]);
	});
});

describe('experienceProblems', () => {
	it('R14 — words a missing Travel path with Stop numbers and keeps ids in the detail', async () => {
		const envelope = await experienceEnvelope({
			camera: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: VIEWS.map((view) => ({ ...view, connectedViewIds: [] })),
				connections: []
			}
		});
		const validation = validateProjectEnvelope(envelope);
		expect(validation.success).toBe(true);
		const problem = experienceProblems(envelope).find((entry) => entry.code === 'travel-gap');
		expect(problem).toBeDefined();
		expect(problem!.sentence).toBe("Stop 1's Travel to Stop 2 needs a Camera path.");
		expect(problem!.sentence).not.toContain('stop-1');
		expect(problem!.subject).toEqual({ kind: 'transition', stopId: 'stop-1' });
		expect(problem!.fix).toBe('Add a Camera path for this move.');
		expect(problem!.detail).toContain('travel-gap');
		expect(problem!.detail).toContain('stop-1');
	});

	it('leaves a non-Experience finding visible with a generic sentence', async () => {
		const envelope = await experienceEnvelope();
		const problems = experienceProblems(envelope, [
			{ path: '$.units.resources.data.resources[0].unresolved', code: 'missing-resource', message: 'missing' }
		]);
		expect(problems).toHaveLength(1);
		expect(problems[0]!.sentence).toBe('This file points at something it does not carry.');
		expect(problems[0]!.subject).toBeNull();
		expect(problems[0]!.detail).toContain('missing-resource');
	});
});

describe('loweringProblem', () => {
	it('R13 — words a duplicate imported path with View labels and opens the Transition Card', async () => {
		const envelope = await experienceEnvelope();
		// A file may still name two paths on one pair even though the canonical Camera
		// unit refuses duplicates; lowering refuses rather than choosing one.
		const problem = loweringProblem(envelope, {
			kind: 'refused',
			code: 'travel-ambiguous',
			message:
				'Stop "stop-1" binds a Travel, and more than one Camera connection joins "view-1" to "view-2"; Experience never chooses between them',
			stopId: 'stop-1'
		});
		expect(problem.code).toBe('travel-ambiguous');
		expect(problem.sentence).toBe(
			"Stop 1's Travel to Stop 2 joins “Piano” and “Gallery” with more than one Camera path, so the editor will not choose."
		);
		expect(problem.sentence).not.toContain('view-1');
		expect(problem.subject).toEqual({ kind: 'transition', stopId: 'stop-1' });
		expect(problem.fix).toBe('Keep one Camera path between those Views.');
		expect(problem.detail).toContain('travel-ambiguous');
		expect(problem.detail).toContain('view-1');
	});
});
