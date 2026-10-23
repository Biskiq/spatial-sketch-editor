/**
 * T3.P02.S01 — the Experience adapter.
 *
 * It registers the slice's Experience planners with the one F.4 coordinator and
 * contributes the Experience task and Find entry through T1.P01.S07's AM-5 points.
 * The authoring surface itself is mounted once by the route's Experience lens, not
 * here: a second contribution would put two draft editors over one accepted
 * source. It edits no host core, route or shell module, and it owns no selection,
 * history or order store: the lens edits one accepted source through the public
 * acceptance port, and Guide order stays the only order writer.
 *
 * The adapter is mounted for every project epoch; a binding that outlives a source
 * is retired with the adapter registration, and the surface re-reads the live
 * accepted source rather than a snapshot captured here.
 */

import type { StageAdapterFactory } from '../stage/stage-adapter-host';
import type { StageAdapter } from '../stage/stage-facade';
import { createUnitCandidatePlanners } from '@portfolio/project-model/units';

/** The one contributed task; the Experience lens is its authoring surface. */
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
			// Exactly one writable Experience surface exists: the lens. Contributing a
			// second copy here would put two draft editors over one accepted source.
			return {
				summary: 'Experience authoring is edited in the Experience lens.'
			};
		}
	};
	return adapter;
};
