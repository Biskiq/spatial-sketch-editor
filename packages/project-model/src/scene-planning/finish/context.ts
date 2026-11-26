/** The shared Finish plan context, built once per call. */

import { type PlannerOutcome, type PlannerRequest } from '../../f4/types';
import { pruneOverrides } from '../../materials/read';
import { type MaterialId, type SceneMaterialInstance } from '../../scene';
import { type Kind } from './kinds';
import {
	findIdenticalFinish,
	isPristineInstance,
	materialInstanceById,
	nextFinishName,
	type SceneFinishRef,
} from './model';
import { applyFinishPatch, baseRecipeOf } from './patch';
import { readFinishRef } from './payload';
import {
	MATERIAL_ID,
	materialRecipesOf,
	type FinishPlannerOptions,
	refuse,
	labelOf,
	nameContextOf,
	type MaterialGrant,
	allocationOf,
} from './shared';
import { type FinishAssignDerive } from './targets';
import { generatedFinishName, isGeneratedFinishName, uniqueFinishName } from './treatment';
import { finalizeSceneCandidate, type SceneRecordScope } from '../record-scope';
import { withFinishTextureResource } from '../texture-resource';
import { ShapeReader } from '../../strict-shape';
import { replaceUnitData } from '../../units/envelope';
import {
	type CameraFreeSceneDocument as SceneDocument,
	type ProjectEnvelope,
	type TypedResource,
} from '../../units/types';

export type Result = PlannerOutcome<ProjectEnvelope>;

/**
 * Everything one Finish plan needs, resolved once per call: the request, the
 * Scene before the write, the strict reader, and the shared record-scope
 * closures. Plans receive this object and never re-read the envelope.
 */
export function createFinishPlanContext(
	request: PlannerRequest<ProjectEnvelope>,
	kind: Kind,
	options: FinishPlannerOptions,
) {
	const envelope = request.snapshot.domain.source;
	const { data: before, header } = envelope.units.scene;
	const reader = new ShapeReader();
	const reference = (id: string) => ({
		version: 1 as const,
		domain: 'scene' as const,
		revision: { kind: 'exact' as const, contentRevision: header.contentRevision },
		subject: { kind: 'entity' as const, id },
		instancePath: [],
		location: { kind: 'project-root' as const },
		componentId: null,
		capabilityId: null,
	});
	const scope: SceneRecordScope = {
		operationKind: kind,
		changedEntityIds: [],
		changedEntityFields: [],
		createdEntityIds: [],
		removedEntityIds: [],
		allowClusterCleanup: false,
	};
	const complete = (
		after: SceneDocument,
		grant: Partial<SceneRecordScope>,
		subjectIds: readonly string[],
		fields: string[],
		textureResource?: TypedResource,
	): Result => {
		const finalized = finalizeSceneCandidate({ before, after, scope: { ...scope, ...grant } });
		if (finalized.kind === 'rejected') return finalized;
		let candidateSource = replaceUnitData(envelope, 'scene', finalized.scene);
		if (textureResource !== undefined) {
			const withResource = withFinishTextureResource(candidateSource, textureResource);
			if (withResource === null) {
				return refuse(
					'The Finish image resource could not be added to the candidate.',
					'texture-mismatch',
				);
			}
			candidateSource = withResource;
		}
		// A palette-only write changes no entity, but it is still an accepted content
		// change. Publish every surviving entity as preserved so the host can keep a
		// live selection (and its Card) across the write; edits keep their narrower set.
		const correspondenceIds =
			(grant.changedEntityIds?.length ?? 0) > 0
				? grant.changedEntityIds!
				: after.entities.map((entity) => entity.id);
		return {
			kind: 'prepared',
			candidate: {
				operationId: request.intent.operationId,
				sourceKind: request.snapshot.sourceKind,
				sourceVersion: request.snapshot.sourceVersion,
				source: candidateSource,
				changes: [{ kind, subjectIds, fields }],
				correspondence: correspondenceIds.map((id) => ({
					relation: 'preserved' as const,
					before: reference(id),
					after: reference(id),
				})),
				diagnostics: [],
			},
		};
	};
	const materialGrant = (grant: {
		added?: readonly string[];
		changed?: readonly string[];
		removed?: readonly string[];
	}): MaterialGrant => ({
		added: grant.added ?? [],
		changed: grant.changed ?? [],
		removed: grant.removed ?? [],
	});

	const resolveDerivedAssign = (
		sourceFinish: SceneFinishRef,
		derive: FinishAssignDerive,
		allowPristineProject: boolean,
	):
		| {
				readonly kind: 'resolved';
				readonly finish: SceneFinishRef;
				readonly created: SceneMaterialInstance | null;
		  }
		| { readonly kind: 'outcome'; readonly outcome: PlannerOutcome<ProjectEnvelope> } => {
		if (sourceFinish === 'model-own') {
			return {
				kind: 'outcome',
				outcome: refuse("Model's own cannot be derived.", 'not-paintable'),
			};
		}
		const curated = 'curated' in sourceFinish ? sourceFinish.curated : null;
		const project =
			'project' in sourceFinish
				? materialInstanceById(before.materials, sourceFinish.project)
				: undefined;
		if (curated !== null && !MATERIAL_ID.test(curated)) {
			return {
				kind: 'outcome',
				outcome: refuse('That curated Finish does not exist.', 'unknown-catalogue'),
			};
		}
		if (
			'project' in sourceFinish &&
			(project === undefined || (!allowPristineProject && isPristineInstance(project)))
		) {
			return {
				kind: 'outcome',
				outcome: refuse('That project Finish no longer exists.', 'unknown-finish'),
			};
		}
		const recipes = materialRecipesOf(envelope);
		const seed: SceneMaterialInstance =
			curated !== null
				? { id: '__derive__', name: labelOf(options, curated), base: { catalogue: curated } }
				: { ...project!, id: '__derive__' };
		let derived: SceneMaterialInstance = seed;
		if (derive.edits.length > 0) {
			const patched = applyFinishPatch(seed, derive.edits, baseRecipeOf(seed, recipes));
			if (!patched.ok) {
				if (patched.problem.code !== 'no-change') {
					return {
						kind: 'outcome',
						outcome: {
							kind: 'rejected',
							code: patched.problem.code,
							message: patched.problem.message,
							diagnostics: [
								{
									path: patched.problem.path,
									code: patched.problem.code,
									message: patched.problem.message,
								},
							],
						},
					};
				}
			} else {
				derived = patched.instance;
			}
		}
		const pruned = pruneOverrides(derived.overrides);
		if (derive.identity === 'reuse') {
			if ('catalogue' in derived.base && pruned === undefined) {
				return {
					kind: 'resolved',
					finish: { curated: derived.base.catalogue as MaterialId },
					created: null,
				};
			}
			const identical = findIdenticalFinish(before.materials, derived.base, pruned);
			if (identical !== null) {
				return { kind: 'resolved', finish: { project: identical.id }, created: null };
			}
		}
		const allocation = allocationOf(request, ['scene-finish', 'scene-material'], true);
		if ('missing' in allocation) {
			return { kind: 'outcome', outcome: refuse(allocation.missing, 'missing-allocation') };
		}
		const allocatedId = allocation.id!;
		if (before.materials.some((instance) => instance.id === allocatedId)) {
			return {
				kind: 'outcome',
				outcome: refuse('That Finish id is already in use.', 'unexpected-allocation'),
			};
		}
		let created: SceneMaterialInstance = {
			id: allocatedId,
			name:
				curated !== null
					? nextFinishName(labelOf(options, curated), before.materials)
					: nextFinishName(project!.name, before.materials),
			base: derived.base,
			...(pruned === undefined ? {} : { overrides: pruned }),
		};
		if (options.treatmentFacts !== undefined) {
			const context = nameContextOf(options, recipes, before.palette);
			const wasGenerated =
				curated !== null || isGeneratedFinishName(project!.name, project!, context);
			if (wasGenerated) {
				const label = generatedFinishName(
					curated !== null ? created : { ...created, name: project!.name },
					context,
				);
				created = { ...created, name: uniqueFinishName(label, before.materials, null) };
			}
		}
		return { kind: 'resolved', finish: { project: created.id }, created };
	};

	const withResources = (
		after: SceneDocument,
		grant: Partial<SceneRecordScope>,
		resources: readonly TypedResource[] | null,
		lockEntries: readonly import('../../units/types').DependencyLockEntry[] | null,
		subjectIds: readonly string[],
		fields: string[],
	): Result => {
		const finalized = finalizeSceneCandidate({ before, after, scope: { ...scope, ...grant } });
		if (finalized.kind === 'rejected') return finalized;
		let candidateSource = replaceUnitData(envelope, 'scene', finalized.scene);
		if (resources !== null) {
			candidateSource = {
				...candidateSource,
				units: {
					...candidateSource.units,
					resources: {
						header: { ...candidateSource.units.resources.header },
						data: {
							formatVersion: candidateSource.units.resources.data.formatVersion,
							resources: [...resources],
						},
					},
				},
			};
		}
		if (lockEntries !== null) {
			candidateSource = {
				...candidateSource,
				dependencyLock: { ...candidateSource.dependencyLock, entries: [...lockEntries] },
			};
		}
		return {
			kind: 'prepared',
			candidate: {
				operationId: request.intent.operationId,
				sourceKind: request.snapshot.sourceKind,
				sourceVersion: request.snapshot.sourceVersion,
				source: candidateSource,
				changes: [{ kind, subjectIds, fields }],
				correspondence: after.entities.map((entity) => ({
					relation: 'preserved' as const,
					before: reference(entity.id),
					after: reference(entity.id),
				})),
				diagnostics: [],
			},
		};
	};
	const readProjectFinish = (raw: unknown): SceneMaterialInstance | Result => {
		const finish = readFinishRef(reader, raw, '$.payload.finish');
		if (finish === null || reader.issues.length > 0)
			return refuse(reader.issues[0]?.message ?? 'Name one project Finish.');
		if (finish === 'model-own' || !('project' in finish)) {
			return refuse('Only a project Finish can be renamed or removed.', 'not-editable');
		}
		const instance = materialInstanceById(before.materials, finish.project);
		if (instance === undefined || isPristineInstance(instance)) {
			return refuse('That project Finish no longer exists.', 'unknown-finish');
		}
		return instance;
	};
	const isResult = (value: SceneMaterialInstance | Result): value is Result =>
		(value as Result).kind === 'rejected' || (value as Result).kind === 'prepared';

	return {
		request,
		kind,
		options,
		envelope,
		before,
		header,
		reader,
		reference,
		scope,
		complete,
		materialGrant,
		resolveDerivedAssign,
		withResources,
		readProjectFinish,
		isResult,
	};
}

export type FinishPlanContext = ReturnType<typeof createFinishPlanContext>;
