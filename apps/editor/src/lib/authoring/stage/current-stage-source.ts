/** Explicit current-encoding adapter. The common Stage contract never requires this port. */
import { CURRENT_SOURCE_KIND, CURRENT_SOURCE_VERSION, freezeF4Data, type DomainPlanner, type ProjectDocument, type PlannerRequest, type CurrentDomainSource } from '@portfolio/project-model';
import type { StageReadSnapshot } from './accepted-read';
export const CURRENT_STAGE_SOURCE_VERSION = CURRENT_SOURCE_VERSION;
const currentSource = Symbol('current-stage-source');
type CurrentStageRead = StageReadSnapshot & { readonly [currentSource]: CurrentDomainSource };

/** Admission owns this immutable source; this is access, never another source slot. */
export function attachCurrentStageSource(snapshot: StageReadSnapshot, source: CurrentDomainSource): StageReadSnapshot {
	return Object.freeze({ ...snapshot, [currentSource]: freezeF4Data(source) });
}

export function currentStageSource(snapshot: StageReadSnapshot): CurrentDomainSource {
	if (snapshot.sourceKind !== 'project-current' || snapshot.sourceVersion !== CURRENT_STAGE_SOURCE_VERSION || !(currentSource in snapshot)) {
		throw new Error(`Current-source adapter cannot read ${snapshot.sourceKind}@${snapshot.sourceVersion}`);
	}
	return (snapshot as CurrentStageRead)[currentSource];
}


/** Current-format planner access is an explicit encoding adapter, never part of the common read port. */
export function currentStagePlanner(planner: DomainPlanner<ProjectDocument>): DomainPlanner<unknown> {
	return { ...planner, prepare(request) {
		if (request.snapshot.sourceKind !== CURRENT_SOURCE_KIND || request.snapshot.sourceVersion !== CURRENT_SOURCE_VERSION) {
			return { kind: 'rejected', code: 'incompatible-source', message: 'This planner requires an admitted current source.', diagnostics: [] };
		}
		// F4's source adapter admitted this encoding before dispatch. No decoder or format fallback here.
		return planner.prepare(request as PlannerRequest<ProjectDocument>);
	} };
}
