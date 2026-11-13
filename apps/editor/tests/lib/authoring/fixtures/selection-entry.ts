/**
 * One canonical Layout Opening selection, for suites that drive a real Paper or
 * Stage caller. The id and revision are the only facts those callers read; the
 * address is complete so the value is a real `StageSelectionEntry`, not a cast.
 */
import type { StageSelectionEntry } from '$lib/authoring/stage/semantic-selection';

export function openingSelection(id: string): StageSelectionEntry {
	return {
		reference: {
			version: 1,
			domain: 'layout',
			subject: { kind: 'opening', id },
			revision: { kind: 'exact', contentRevision: 'revision-g3' },
			instancePath: [],
			location: { kind: 'layout-location', levelId: 'level-ground', structureInstancePath: [] },
			componentId: null,
			capabilityId: null
		}
	};
}
