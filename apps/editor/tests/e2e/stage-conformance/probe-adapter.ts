/** TEST-ONLY sentinel: STAGE_BROWSER_CONFORMANCE_WRITER. No production import. */
import { planExactWallHeight } from '@portfolio/layout-core';
import { CURRENT_SOURCE_KIND, CURRENT_SOURCE_VERSION, type DomainPlanner, type ProjectDocument,
	type AuthoringIntent } from '@portfolio/project-model';
import type { StageAdapterFactory, StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import ProbeInstrument from './ProbeInstrument.svelte';

const KIND = 'conformance-wall-height';
const planner: DomainPlanner<ProjectDocument> = {
	id: KIND, kind: KIND,
	admission: { domain: 'layout', compound: false, units: false, resources: false },
	sourceKinds: [CURRENT_SOURCE_KIND], sourceVersions: [CURRENT_SOURCE_VERSION],
	prepare({ snapshot, intent }) {
		const wall = snapshot.domain.source.layout.walls[0];
		if (!wall) return { kind: 'rejected', code: 'missing-wall', message: 'Starter wall required', diagnostics: [] };
		const plan = planExactWallHeight(snapshot.domain.source.layout, wall.id, wall.height + 1);
		if (plan.kind === 'rejected') return { kind: 'rejected', code: plan.rejection.code, message: plan.rejection.message, diagnostics: [] };
		const reference = { version: 1 as const, domain: 'layout' as const, subject: { kind: 'wall', id: wall.id },
			revision: { kind: 'exact' as const, contentRevision: snapshot.sourceContentId },
			instancePath: [], location: { kind: 'layout-location' as const, levelId: snapshot.domain.source.layout.floor.id, structureInstancePath: [] }, componentId: null, capabilityId: null };
		return { kind: 'prepared', candidate: { operationId: intent.operationId,
			sourceKind: CURRENT_SOURCE_KIND, sourceVersion: CURRENT_SOURCE_VERSION,
			source: { ...snapshot.domain.source, layout: plan.document },
			changes: [{ kind: KIND, subjectIds: [wall.id], fields: ['height'] }],
			correspondence: [{ relation: 'preserved', before: reference, after: reference }], diagnostics: [] } };
	}
};

export function heightIntent({ stage, authoring }: StageAdapterServices): AuthoringIntent {
	const snapshot = stage.snapshot();
	const wall = snapshot.domain.project.layout.walls[0]!;
	return { version: 1, kind: KIND, operationId: crypto.randomUUID(), expectedRevision: authoring.acceptedRevision(),
		targets: [{ version: 1, domain: 'layout', subject: { kind: 'wall', id: wall.id },
			revision: { kind: 'exact', contentRevision: snapshot.sourceContentId },
			instancePath: [], location: { kind: 'layout-location', levelId: snapshot.domain.project.layout.floor.id, structureInstancePath: [] }, componentId: null, capabilityId: null }],
		payload: {}, capturedInputs: [], allocatedIds: [] };
}

export const createAdapter: StageAdapterFactory = (services) => {
	const registered = services.authoring.registerPlanner(planner);
	if (registered.kind !== 'registered') throw new Error('conformance planner refused');
	return {
		id: 'stage-browser-conformance', requiredCapabilities: ['stage-instrument-v1'],
		bind({ snapshot }) {
			const wall = snapshot.domain.project.layout.walls[0];
			if (!wall) return {};
			return {
				tasks: [{ id: 'conformance-height', taskKind: 'conformance-height', label: 'Conformance height' }],
				findEntries: [{ id: 'conformance-height', taskKind: 'conformance-height', label: 'Conformance height', railFamily: 'measure', capability: 'conformance' }],
				cardFacts: () => [{ label: 'Conformance height', value: `${wall.height} m` }],
				instrument: () => ({ summary: `STAGE_BROWSER_CONFORMANCE_WRITER: wall height ${wall.height} m`,
					facts: [{ label: 'Content', value: snapshot.sourceContentId }], view: { component: ProbeInstrument, services } })
			};
		}
	};
};
