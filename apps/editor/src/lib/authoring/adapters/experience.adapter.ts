/**
 * T3.P02.S01 — the Experience adapter.
 *
 * It registers the slice's Experience planners with the one F.4 coordinator and
 * contributes the Experience lens's authoring surface through T1.P01.S07's AM-5
 * points. It edits no host core, route or shell module, and it owns no selection,
 * history or order store: the surface edits one accepted source through the public
 * acceptance port, and Guide order stays the only order writer.
 *
 * The adapter is mounted for every project epoch; a binding that outlives a source
 * is retired with the adapter registration, and the surface re-reads the live
 * accepted source rather than a snapshot captured here.
 */

import type { StageAdapterFactory } from '../stage/stage-adapter-host';
import type { StageAdapter } from '../stage/stage-facade';
import { createUnitCandidatePlanners } from '@portfolio/project-model/units';

import ExperienceSurface from '../experience/ExperienceSurface.svelte';

/** The one contributed task; every Find entry opens this surface. */
const EXPERIENCE_TASK = 'experience-edit';

export const createAdapter: StageAdapterFactory = (services) => {
	for (const planner of createUnitCandidatePlanners()) {
		const registration = services.authoring.registerPlanner(planner);
		if (registration.kind !== 'registered') {
			throw new Error(
				`Experience adapter planner "${planner.kind}" was refused: ${registration.reason} — ${registration.message}`
			);
		}
	}

	const adapter: StageAdapter = {
		id: 'experience',
		requiredCapabilities: ['stage-instrument-v1'],
		tasks: [
			{
				id: EXPERIENCE_TASK,
				taskKind: EXPERIENCE_TASK,
				label: 'Experience',
				// The Experience lens owns this task: a World task in the Experience
				// lens refuses Resume, and stacking both would show two controls that
				// cannot act on each other.
				lens: 'experience',
				order: 1
			}
		],
		findEntries: [
			{
				id: EXPERIENCE_TASK,
				taskKind: EXPERIENCE_TASK,
				label: 'Experience authoring',
				railFamily: 'experience',
				capability: 'experience',
				order: 1
			}
		],
		instrument() {
			return {
				summary: 'Experience',
				view: { component: ExperienceSurface, services }
			};
		}
	};
	return adapter;
};
