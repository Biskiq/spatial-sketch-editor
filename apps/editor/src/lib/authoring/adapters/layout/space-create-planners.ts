import { isSpaceCreationCycle, planCreateOpenSpace, type SpaceCreationCycle } from '@portfolio/layout-core/room';
import { layoutIdCaptureInput, layoutWorkingLevelInput, type LayoutIdCapture } from '@portfolio/layout-core/plan';
import type { AuthoringIntent, DomainPlanner } from '@portfolio/project-model/f4';
import type { SemanticReference } from '@portfolio/project-model/references';
import { canonicalUnitJson, type ProjectEnvelope } from '@portfolio/project-model/units';

import { layoutSubjectReference, readCapturedOperation } from './drawing-planners';
import { layoutPlanner, preparedLayoutCandidate, registerLayoutSurfaceLineage } from './precision';

export const LAYOUT_OPEN_SPACE_CREATE_KIND = 'layout-open-space-create';

function cycleTargets(cycle: SpaceCreationCycle, contentRevision: string, levelId: string): SemanticReference[] {
	const targets = new Map<string, SemanticReference>();
	const add = (kind: string, id: string) => {
		targets.set(JSON.stringify([kind, id]), layoutSubjectReference({ kind, id, contentRevision, levelId }));
	};
	for (const span of cycle) {
		if (span.kind === 'wall') add('wall', span.wallId);
		for (const anchor of [span.from, span.to]) {
			if (anchor.kind === 'junction') add('junction', anchor.id);
			if (anchor.kind === 'wall-station') add('wall', anchor.wallId);
		}
	}
	return [...targets.values()];
}

export function spaceCreateIntent(input: {
	cycle: SpaceCreationCycle;
	capture: LayoutIdCapture;
	operationId: string;
	projectId: string;
	revisionId: string;
	contentRevision: string;
	levelId: string;
}): AuthoringIntent {
	const cycle = structuredClone(input.cycle);
	return {
		version: 1,
		kind: LAYOUT_OPEN_SPACE_CREATE_KIND,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: cycleTargets(cycle, input.contentRevision, input.levelId),
		payload: { cycle },
		capturedInputs: [layoutIdCaptureInput(input.capture), layoutWorkingLevelInput(input.levelId)],
		allocatedIds: []
	};
}

export function createSpaceCreatePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_OPEN_SPACE_CREATE_KIND, (request) => {
		const payload = request.intent.payload;
		if (!payload || typeof payload !== 'object' || Object.keys(payload).length !== 1 ||
			!('cycle' in payload) || !isSpaceCreationCycle(payload.cycle)) {
			return { kind: 'rejected', code: 'invalid-value', message: 'Room needs one exact boundary cycle.', diagnostics: [] };
		}
		const captured = readCapturedOperation(request);
		if ('kind' in captured) return captured;
		const { capture, levelId } = captured;
		const layout = request.snapshot.domain.source.units.layout;
		const contentRevision = layout.header.contentRevision;
		const expected = cycleTargets(payload.cycle, contentRevision, levelId).map(canonicalUnitJson).sort();
		const actual = request.intent.targets.map(canonicalUnitJson).sort();
		if (actual.length !== expected.length || actual.some((target, index) => target !== expected[index])) {
			return { kind: 'rejected', code: 'invalid-target', message: 'The captured Walls or Junctions no longer match this outline.', diagnostics: [] };
		}
		const plan = planCreateOpenSpace({ baseline: layout.data, capture, levelId, cycle: payload.cycle });
		if (plan.kind === 'refused') {
			return { kind: 'rejected', code: plan.code, message: plan.message, diagnostics: [] };
		}
		const splitWalls = new Set(plan.splitWallIds);
		const rooms = layout.data.rooms.filter((room) => room.boundary.some(({ wallId }) => splitWalls.has(wallId)));
		const openings = layout.data.openings.filter(({ wallId }) => splitWalls.has(wallId));
		const base = preparedLayoutCandidate(request, LAYOUT_OPEN_SPACE_CREATE_KIND, { kind: 'room', id: plan.roomId }, plan.document, [
			'rooms',
			...(plan.createdJunctionIds.length ? ['junctions'] : []),
			...(splitWalls.size ? ['walls'] : []),
			...(openings.length ? ['openings'] : [])
		], { created: true, surfaceLineage: plan.surfaceLineage });
		if (base.kind !== 'prepared') return base;
		const reference = (kind: string, id: string) => layoutSubjectReference({ kind, id, contentRevision, levelId });
		const created = [
			...plan.createdJunctionIds.map((id) => reference('junction', id)),
			...plan.createdWallIds.map((id) => reference('wall', id))
		];
		const preserved = [
			...plan.splitWallIds.map((id) => reference('wall', id)),
			...rooms.map(({ id }) => reference('room', id)),
			...openings.map(({ id }) => reference('opening', id))
		];
		const candidate = {
			...base.candidate,
			changes: base.candidate.changes.map((change) => ({
				...change, subjectIds: [...change.subjectIds, ...[...created, ...preserved].map((ref) => ref.subject.id)]
			})),
			correspondence: [
				...base.candidate.correspondence,
				...created.map((after) => ({ relation: 'created' as const, before: null, after })),
				...preserved.map((before) => ({ relation: 'preserved' as const, before, after: before }))
			]
		};
		registerLayoutSurfaceLineage(candidate, plan.surfaceLineage);
		return { kind: 'prepared', candidate };
	});
}
