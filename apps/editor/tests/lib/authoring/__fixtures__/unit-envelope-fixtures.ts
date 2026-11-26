/** Admit an envelope through the editor and wire the real acceptance coordinator. */
import type { AcceptedRevision } from '@portfolio/project-model/references';
import type { DomainPlanner } from '@portfolio/project-model/f4';
import {
	computeEnvelopeSourceContentId,
	createUnitAcceptanceAdapter,
	createUnitAcceptancePreparation,
	createUnitPlannerRegistry,
	prepareUnitRuntime,
	serializeProjectEnvelope,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { createUnitProject, type UnitProjectInput } from '../../../../../../packages/project-model/tests/__fixtures__/unit-envelope';
import {
	createAcceptanceCoordinator,
	type AcceptanceCoordinator
} from '$lib/authoring/f4';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';
import { admitSource } from '$lib/authoring/stage/source-admission';

export { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION };

export const DEFAULT_SESSION_EPOCH = 'session-1';

export {
	cameraFreeScene,
	cameraOfScene,
	createUnitProject,
	unitRevision,
	type UnitProjectInput
} from '../../../../../../packages/project-model/tests/__fixtures__/unit-envelope';

/** The old admission result shape, over the live F.2 admission. */
export type AdmittedUnitProject = {
	readonly kind: 'admitted';
	readonly envelope: ProjectEnvelope;
	/** Compatibility name for migrated assertions: the admitted source is the envelope. */
	readonly project: ProjectEnvelope;
	readonly snapshot: StageReadSnapshot;
	readonly canonicalJson: string;
	readonly sourceContentId: string;
	readonly blockingIssues: readonly never[];
	readonly issues: readonly never[];
};

export type RefusedUnitProject = {
	readonly kind: 'rejected';
	readonly code: string;
	readonly message: string;
	readonly issues: readonly { path: string; code: string; message: string }[];
};

/** Admit through the one live Stage admission, published under `revision`. */
export async function admitUnitProject(
	input: unknown,
	revision: AcceptedRevision,
	sessionEpoch: string = DEFAULT_SESSION_EPOCH
): Promise<AdmittedUnitProject | RefusedUnitProject> {
	const outcome = await admitSource(input, { acceptedRevision: revision, sessionEpoch });
	if (outcome.kind === 'admitted') {
		return {
			kind: 'admitted',
			envelope: input as ProjectEnvelope,
			project: input as ProjectEnvelope,
			snapshot: outcome.snapshot,
			canonicalJson: outcome.snapshot.canonicalJson,
			sourceContentId: outcome.snapshot.sourceContentId,
			blockingIssues: [],
			issues: []
		};
	}
	if (outcome.kind === 'diagnostics') {
		return {
			kind: 'rejected',
			code: 'blocking-geometry',
			message: outcome.issues[0]?.message ?? 'The source has blocking geometry',
			issues: outcome.issues
		};
	}
	return {
		kind: 'rejected',
		code: outcome.reason,
		message: outcome.issues[0]?.message ?? 'The source was refused',
		issues: outcome.issues
	};
}

/** The source-content half of admission, without a session snapshot. */
export async function admitUnitContent(input: unknown): Promise<
	| {
			readonly kind: 'admitted';
			readonly envelope: ProjectEnvelope;
			readonly project: ProjectEnvelope;
			readonly canonicalJson: string;
			readonly sourceContentId: string;
			readonly blockingIssues: readonly never[];
			readonly issues: readonly never[];
	  }
	| RefusedUnitProject
> {
	const prepared = prepareUnitRuntime(input);
	if (prepared.kind === 'rejected') {
		return {
			kind: 'rejected',
			code: prepared.reason,
			message: prepared.issues[0]?.message ?? 'The source was refused',
			issues: prepared.issues
		};
	}
	return {
		kind: 'admitted',
		envelope: prepared.envelope,
		project: prepared.envelope,
		canonicalJson: serializeProjectEnvelope(prepared.envelope),
		sourceContentId: await computeEnvelopeSourceContentId(prepared.envelope),
		blockingIssues: [],
		issues: []
	};
}

/**
 * A coordinator wired exactly as the Stage host wires it (compound unit
 * admission, typed-resource staging granted to the planner that declares it).
 */
export async function createUnitCoordinator(input: {
	readonly baseline:
		| ProjectEnvelope
		| {
				readonly revision: AcceptedRevision;
				readonly source: ProjectEnvelope;
				readonly canonicalJson?: string;
				readonly sourceContentId?: string;
				readonly blockingIssues?: readonly never[];
		  };
	readonly planners?: readonly DomainPlanner<ProjectEnvelope>[];
	readonly sessionEpoch?: string;
	readonly mintRevisionId?: (ordinal: number) => string;
	/**
	 * Resource staging is the host's grant, not a planner's: the current Stage host
	 * grants it so a creator model's first placement can install its resource,
	 * exact lock and entity together. A caller that withholds it proves the
	 * admission refuses a planner that declares the need.
	 */
	readonly resourceStaging?: boolean;
}): Promise<AcceptanceCoordinator<ProjectEnvelope>> {
	const sessionEpoch = input.sessionEpoch ?? DEFAULT_SESSION_EPOCH;
	const source = 'source' in input.baseline ? input.baseline.source : input.baseline;
	const revision = 'source' in input.baseline ? input.baseline.revision : input.baseline.acceptedRevision;
	const canonicalJson =
		'source' in input.baseline && input.baseline.canonicalJson !== undefined
			? input.baseline.canonicalJson
			: serializeProjectEnvelope(source);
	const sourceContentId =
		'source' in input.baseline && input.baseline.sourceContentId !== undefined
			? input.baseline.sourceContentId
			: await computeEnvelopeSourceContentId(source);
	const resourceStaging = input.resourceStaging !== false;
	const registry = createUnitPlannerRegistry<ProjectEnvelope>({ resourceStaging });
	return createAcceptanceCoordinator<ProjectEnvelope>({
		adapter: createUnitAcceptanceAdapter({ compound: true, resourceStaging }),
		preparation: createUnitAcceptancePreparation({ registry, sessionEpoch, resourceStaging }),
		sessionEpoch,
		baseline: {
			revision,
			source,
			canonicalJson,
			sourceContentId,
			blockingIssues: []
		},
		planners: input.planners ?? [],
		...(input.mintRevisionId === undefined ? {} : { mintRevisionId: input.mintRevisionId })
	});
}
