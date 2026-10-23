import { describe, expect, it } from 'vitest';
import { CAMERA_UNIT_FORMAT_VERSION } from '@portfolio/project-model/units';

import { travelGapMessages } from '$lib/authoring/experience/travel-gap';

import { VIEWS, experienceEnvelope } from './fixtures';

describe('travelGapMessages', () => {
	it('reports nothing where Camera connects the two Views', async () => {
		const envelope = await experienceEnvelope();
		expect(travelGapMessages(envelope, 'experience-1', 'stop-1')).toEqual([]);
	});

	it('reports the gap on the Stop whose Travel has no connection, and only that Stop', async () => {
		const envelope = await experienceEnvelope({
			camera: { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views: VIEWS.map((view) => ({ ...view, connectedViewIds: [] })), connections: [] }
		});
		const messages = travelGapMessages(envelope, 'experience-1', 'stop-1');
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain('stop-1');
		expect(travelGapMessages(envelope, 'experience-1', 'stop-2')).toEqual([]);
		expect(travelGapMessages(envelope, 'experience-1', 'missing')).toEqual([]);
	});
});
