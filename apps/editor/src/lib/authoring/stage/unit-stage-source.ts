/**
 * The one live Stage source slot: an admitted F.2 `ProjectEnvelope`.
 *
 * No current-source encoding is attached beside it. The envelope is the source;
 * the unit accessors below read its payloads for adapters that edit one domain.
 * `attachUnitStageSource` is called by admission only, and `stageEnvelope` is the
 * only reader, so a second source slot cannot be introduced by accident.
 */
import { freezeF4Data } from '@portfolio/project-model';
import {
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type CameraFreeSceneDocument,
	type CameraUnitPayload,
	type ExperienceUnitPayload,
	type LayoutUnitPayload,
	type ProjectEnvelope,
	type UnitDomain
} from '@portfolio/project-model/units';

import type { StageReadSnapshot } from './accepted-read';

const unitSource = Symbol('unit-stage-source');
type UnitStageRead = StageReadSnapshot & { readonly [unitSource]: ProjectEnvelope };

/** Admission owns this immutable source; this is access, never another source slot. */
export function attachUnitStageSource(snapshot: StageReadSnapshot, envelope: ProjectEnvelope): StageReadSnapshot {
	return Object.freeze({ ...snapshot, [unitSource]: freezeF4Data(envelope) });
}

export function stageEnvelope(snapshot: StageReadSnapshot): ProjectEnvelope {
	if (snapshot.sourceKind !== UNIT_SOURCE_KIND || snapshot.sourceVersion !== UNIT_SOURCE_VERSION || !(unitSource in snapshot)) {
		throw new Error(`The Stage source adapter cannot read ${snapshot.sourceKind}@${snapshot.sourceVersion}`);
	}
	return (snapshot as UnitStageRead)[unitSource];
}

export function stageLayout(snapshot: StageReadSnapshot): LayoutUnitPayload {
	return stageEnvelope(snapshot).units.layout.data;
}

export function stageScene(snapshot: StageReadSnapshot): CameraFreeSceneDocument {
	return stageEnvelope(snapshot).units.scene.data;
}

export function stageCamera(snapshot: StageReadSnapshot): CameraUnitPayload {
	return stageEnvelope(snapshot).units.camera.data;
}

export function stageExperience(snapshot: StageReadSnapshot): ExperienceUnitPayload {
	return stageEnvelope(snapshot).units.experience.data;
}

/** The exact content revision of one authored unit in this snapshot. */
export function stageUnitRevision(snapshot: StageReadSnapshot, domain: UnitDomain): string {
	return stageEnvelope(snapshot).units[domain].header.contentRevision;
}
