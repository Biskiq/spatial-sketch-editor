import { type PlannerOutcome, type PlannerRequest } from '../../f4/types';
import { type SemanticReference } from '../../references/types';
import { type ShapeIssue } from '../../strict-shape';
import { type ProjectEnvelope } from '../types';

/** The captured staging input name; the value is the staging set the host uploaded. */
export const STAGED_RESOURCES_INPUT = 'staged-resources-v1';

export type PrepareFailure = Extract<PlannerOutcome<ProjectEnvelope>, { kind: 'rejected' }>;

export function refuse(
	code: string,
	message: string,
	diagnostics: readonly ShapeIssue[] = [],
): PrepareFailure {
	return { kind: 'rejected', code, message, diagnostics };
}

export function envelopeOf(request: PlannerRequest<ProjectEnvelope>): ProjectEnvelope {
	return request.snapshot.domain.source;
}

export function revisionOf(
	envelope: ProjectEnvelope,
	domain: 'camera' | 'experience' | 'resources',
): string {
	return envelope.units[domain].header.contentRevision;
}

/** One deterministic lock order: domain, subject kind, subject id, instance path. */
export function compareLockEntries(
	left: ProjectEnvelope['dependencyLock']['entries'][number],
	right: ProjectEnvelope['dependencyLock']['entries'][number],
): number {
	const key = (entry: ProjectEnvelope['dependencyLock']['entries'][number]) =>
		[entry.domain, entry.subjectKind, entry.subjectId, entry.instancePath.join('\u0000')].join(
			'\u0001',
		);
	return key(left).localeCompare(key(right));
}

export function reference(
	domain: SemanticReference['domain'],
	subjectKind: string,
	subjectId: string,
	instancePath: readonly string[],
	contentRevision: string,
): SemanticReference {
	return {
		version: 1,
		domain,
		revision: { kind: 'exact', contentRevision },
		subject: { kind: subjectKind, id: subjectId },
		instancePath,
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
	};
}

export function targetOf(
	intent: PlannerRequest<ProjectEnvelope>['intent'],
	domain: string,
	subjectKind: string,
): SemanticReference | null {
	const matches = intent.targets.filter(
		(target) => target.domain === domain && target.subject.kind === subjectKind,
	);
	return matches.length === 1 ? matches[0]! : null;
}

/** Captured ids are the only source of new identity; a missing or extra one refuses. */
export function capturedId(
	intent: PlannerRequest<ProjectEnvelope>['intent'],
	kind: string,
): string | null {
	const matches = intent.allocatedIds.filter((entry) => entry.kind === kind);
	return matches.length === 1 ? matches[0]!.id : null;
}

/** Every captured id of one kind, in capture order. */
export function capturedIds(
	intent: PlannerRequest<ProjectEnvelope>['intent'],
	kind: string,
): string[] {
	return intent.allocatedIds.filter((entry) => entry.kind === kind).map((entry) => entry.id);
}

export function allIds(envelope: ProjectEnvelope): Set<string> {
	const ids = new Set<string>();
	for (const unit of Object.values(envelope.units)) ids.add(unit.header.unitId);
	for (const view of envelope.units.camera.data.views) ids.add(view.id);
	for (const connection of envelope.units.camera.data.connections) ids.add(connection.id);
	for (const experience of envelope.units.experience.data.experiences) {
		ids.add(experience.id);
		for (const item of [
			...experience.presentations,
			...experience.stops,
			...experience.guides,
			...experience.detours,
		]) {
			ids.add(item.id);
		}
	}
	for (const resource of envelope.units.resources.data.resources)
		ids.add(`${resource.kind}:${resource.id}`);
	return ids;
}
