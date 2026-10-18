/**
 * T1.P01.S04 — the Layout adapter.
 *
 * This is the slice's **only** module the Stage catalogue discovers, and it
 * reaches the shell exclusively through T1.P01.S07's AM-5 contribution points:
 * the Dimensions and placement instruments, the Card facts and the capability
 * Find entries. It edits no host core, route or shell module.
 *
 * It registers five production planners with the one F.4 coordinator
 * (`createLayoutPlanners`) and contributes:
 *
 * - `layout-place-plinth` — the Place → Layout plinth operation, always present;
 * - `layout-dimensions` — the settled-measure instrument for the selected Wall
 *   or Opening, present only while such a subject is selected;
 * - Card facts read from the accepted source, never from planning state.
 *
 * A Layout object's name stays read-only identity: no planner owns renaming one,
 * so the instrument reports it as read-only rather than offering a control.
 */

import type { LayoutDocumentWallFirst } from '@portfolio/layout-core';

import type { StageAdapterFactory } from '$lib/authoring/stage/stage-adapter-host';
import type {
	StageAdapter,
	StageAdapterBinding,
	StageCardSubject,
	StageCardFact
} from '$lib/authoring/stage/stage-facade';
import { currentStagePlanner, currentStageSource } from '$lib/authoring/stage/current-stage-source';

import LayoutDimensionsInstrument from './layout/LayoutDimensionsInstrument.svelte';
import LayoutPlacementInstrument from './layout/LayoutPlacementInstrument.svelte';
import {
	LAYOUT_PLINTH_PLACE_KIND,
	createLayoutPlanners,
	layoutFacts,
	layoutSubjectOf,
	type LayoutSubject
} from './layout/precision';
import { layoutNameTarget } from './layout/adapter-support';

const LAYOUT_DIMENSIONS_TASK = 'layout-dimensions';

function factsFor(
	document: LayoutDocumentWallFirst,
	subject: LayoutSubject
): readonly StageCardFact[] {
	return layoutFacts(document, subject);
}

export const createAdapter: StageAdapterFactory = (services) => {
	for (const planner of createLayoutPlanners()) {
		const registration = services.authoring.registerPlanner(currentStagePlanner(planner));
		if (registration.kind !== 'registered') {
			throw new Error(
				`Layout adapter planner "${planner.kind}" was refused: ${registration.reason} — ${registration.message}`
			);
		}
	}

	const adapter: StageAdapter = {
		id: 'layout',
		requiredCapabilities: ['stage-instrument-v1'],
		bind(context): StageAdapterBinding {
			const document = currentStageSource(context.snapshot).source.layout;

			// Capability Find lists **operations**, not subjects, so both entries are
			// stable for the binding's life. A Dimensions task opened without an
			// inspectable subject renders `null` instead of a wrong-subject instrument;
			// the instrument reads the one canonical selection when it opens.
			return {
				tasks: [
					{
						id: 'layout-place-plinth',
						taskKind: LAYOUT_PLINTH_PLACE_KIND,
						label: 'Place plinth',
						order: 10
					},
					{
						id: 'layout-dimensions',
						taskKind: LAYOUT_DIMENSIONS_TASK,
						label: 'Dimensions',
						targetRef: null,
						order: 0
					}
				],
				findEntries: [
					{
						id: 'layout-dimensions',
						taskKind: LAYOUT_DIMENSIONS_TASK,
						label: 'Dimensions',
						railFamily: 'inspect',
						capability: 'layout',
						order: 0
					},
					{
						id: 'layout-place-plinth',
						taskKind: LAYOUT_PLINTH_PLACE_KIND,
						label: 'Place plinth',
						railFamily: 'place',
						capability: 'layout',
						order: 10
					}
				],
				cardFacts(cardSubject: StageCardSubject) {
					const subject = layoutSubjectOf({
						sourceKind: cardSubject.sourceKind,
						sourceId: cardSubject.sourceId
					});
					return subject === null ? [] : factsFor(document, subject);
				},
				cardName(cardSubject: StageCardSubject) {
					const subject = layoutSubjectOf({
						sourceKind: cardSubject.sourceKind,
						sourceId: cardSubject.sourceId
					});
					// A Layout object's name is its identity, so it owns no writer.
					if (subject === null || subject.kind === 'object') return null;
					return layoutNameTarget(services, subject);
				},
				instrument(task) {
					if (task.kind === LAYOUT_DIMENSIONS_TASK) {
						const current = layoutSubjectOf(context.selection());
						if (current === null || current.kind === 'object') return null;
						return {
							summary: 'Dimensions',
							facts: factsFor(document, current),
							view: { component: LayoutDimensionsInstrument, services }
						};
					}
					if (task.kind === LAYOUT_PLINTH_PLACE_KIND) {
						return {
							summary: 'Place plinth',
							facts: [
								{ label: 'Floor datum', value: `${document.floor.elevation} m` },
								{ label: 'Creates', value: 'One ordinary Layout box' }
							],
							view: { component: LayoutPlacementInstrument, services }
						};
					}
					return null;
				}
			};
		}
	};

	return adapter;
};
