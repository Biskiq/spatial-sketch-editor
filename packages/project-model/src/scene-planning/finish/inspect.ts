/**
 * `inspectFinish`: the one read the Finish operation surface answers from
 *
 *
 * The editor UI and agents ask the same question and receive the same answer:
 * which definition revision a Finish names, where every effective value comes
 * from, who uses it (including dormant surfaces and stored references to retired
 * ones), which operations are currently supported and, when the host supplies
 * its target analysis, which targets cannot draw it and why.
 *
 * Treatment is a render-layer rule; the caller may pass `treat` to obtain the
 * treated reading beside the untreated one. This module never imports it.
 */
import { resolveLayoutSurface, surfaceKey } from '@portfolio/layout-core/plan';
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import type { SceneEntity, SceneMaterialInstance, SceneSurfaceRef } from '../../scene';
import { qualifyAcrossTargets } from '../../materials/bind';
import { catalogueRecipe } from '../../materials/catalogue';
import type { MaterialIssue } from '../../materials/issues';
import {
	createImageIndex,
	materialImageIndex,
	mergeImageIndexes,
	resolveFinish,
	shippedImageIndex,
	type ImageIndex
} from '../../materials/resolve';
import type {
	BoundInputs,
	FinishProvenance,
	FinishResolution,
	Hash,
	TargetAnalysis,
	TargetAnalysisRequest,
	TargetFacts
} from '../../materials/types';
import type { ProjectEnvelope } from '../../units/types';
import { materialRuntimeIndexOf } from '../../units/material-index';
import {
	finishKeyOfRef,
	finishKeyOfSurface,
	finishOf,
	isFinishPaintable,
	isPristineInstance,
	materialInstanceById,
	type FinishKey,
	type SceneFinishRef
} from './model';

/** A user's stable key within one revision. Never persisted. */
export type FinishUserKey = string;

export type InspectedFinishUser =
	| {
			readonly kind: 'entity';
			readonly key: FinishUserKey;
			readonly entityId: string;
			readonly entityKind: 'primitive' | 'form' | 'model';
	  }
	| {
			readonly kind: 'surface';
			readonly key: FinishUserKey;
			readonly surface: SceneSurfaceRef;
			/** `dormant` surfaces keep their Finish but draw nothing today. */
			readonly lifecycle: 'present' | 'dormant' | 'retired';
	  };

export type FinishOperation =
	| 'assign'
	| 'rename'
	| 'edit-in-place'
	| 'edit-all'
	| 'edit-just-this'
	| 'materialize'
	| 'remove';

export type FinishInspection = {
	readonly ref: SceneFinishRef;
	readonly key: FinishKey;
	readonly name: string;
	/** What the Finish names: a catalogue base, a definition digest, or a model's own. */
	readonly definition:
		| { readonly kind: 'catalogue'; readonly id: string }
		| { readonly kind: 'material'; readonly hash: Hash }
		| { readonly kind: 'model-own' };
	readonly provenance: FinishProvenance | null;
	readonly untreated: BoundInputs | null;
	readonly treated: unknown;
	/** Users that resolve today, in stable source order (entities, then surfaces). */
	readonly users: readonly InspectedFinishUser[];
	/** Stored references to retired surfaces. They protect the Finish from removal. */
	readonly storedReferences: readonly InspectedFinishUser[];
	readonly operations: readonly FinishOperation[];
	readonly issues: readonly MaterialIssue[];
};

export function entityUserKey(entityId: string): FinishUserKey {
	return `entity:${entityId}`;
}

export function surfaceUserKey(surface: SceneSurfaceRef): FinishUserKey {
	return `surface:${surfaceKey(surface)}`;
}

/** The analysis subject the register/patch planners name for a user. */
export function analysisSubjectOf(user: InspectedFinishUser): string {
	return user.kind === 'entity' ? user.entityId : surfaceKey(user.surface);
}

type FinishScene = ProjectEnvelope['units']['scene']['data'];

/**
 * Every Scene entity and stored surface assignment using one Finish, with the
 * surface lifecycle against the current Layout. Retired surfaces are returned
 * separately: they no longer resolve, but they still reference the Finish.
 */
export function finishUsersWithLifecycle(
	scene: FinishScene,
	key: FinishKey,
	layout: LayoutDocumentWallFirst
): { readonly users: InspectedFinishUser[]; readonly storedReferences: InspectedFinishUser[] } {
	const users: InspectedFinishUser[] = [];
	const storedReferences: InspectedFinishUser[] = [];
	for (const entity of scene.entities) {
		if (finishOf(entity, scene.materials) !== key) continue;
		users.push({
			kind: 'entity',
			key: entityUserKey(entity.id),
			entityId: entity.id,
			entityKind: entity.kind as 'primitive' | 'form' | 'model'
		});
	}
	for (const assignment of scene.surfaceFinishes ?? []) {
		if (finishKeyOfSurface(scene, assignment) !== key) continue;
		const lifecycle = resolveLayoutSurface(layout, assignment.surface);
		const user: InspectedFinishUser = {
			kind: 'surface',
			key: surfaceUserKey(assignment.surface),
			surface: assignment.surface,
			lifecycle
		};
		if (lifecycle === 'retired') storedReferences.push(user);
		else users.push(user);
	}
	return { users, storedReferences };
}

/** Whether any record in the Scene still names this project Finish id. */
export function finishIdIsReferenced(scene: FinishScene, id: string): boolean {
	return (
		scene.entities.some(
			(entity: SceneEntity) => (entity as SceneEntity & { materialInstanceId?: string }).materialInstanceId === id
		) ||
		(scene.surfaceFinishes ?? []).some(
			(assignment) => 'materialInstanceId' in assignment.finish && assignment.finish.materialInstanceId === id
		)
	);
}

/** The verified image index of one admitted envelope. */
export function envelopeImageIndex(envelope: ProjectEnvelope, definitionHash?: Hash): ImageIndex {
	const index = materialRuntimeIndexOf(envelope.units.resources.data);
	const definition = definitionHash === undefined ? [] : (index?.definitionImages.get(definitionHash) ?? []);
	return mergeImageIndexes(
		shippedImageIndex(),
		materialImageIndex(definition),
		createImageIndex(index?.images ?? [])
	);
}

/** Resolve one Finish instance (or a curated base) against an admitted envelope. */
export function resolveEnvelopeFinish(
	envelope: ProjectEnvelope,
	instance: SceneMaterialInstance
): FinishResolution {
	const scene = envelope.units.scene.data;
	if ('catalogue' in instance.base) {
		return resolveFinish({ catalogue: instance.base.catalogue }, instance.overrides, scene.palette, envelopeImageIndex(envelope));
	}
	const hash = instance.base.material;
	const recipe = materialRuntimeIndexOf(envelope.units.resources.data)?.definitions.get(hash);
	if (recipe === undefined) {
		return {
			inputs: null,
			issues: [{ code: 'missing-definition', path: '$.base.material', action: 'Restore the material definition or choose another Finish.' }]
		};
	}
	return resolveFinish({ material: recipe }, instance.overrides, scene.palette, envelopeImageIndex(envelope, hash));
}

/** The analysis request one user needs at the current revisions. */
export function analysisRequestOf(
	envelope: ProjectEnvelope,
	user: InspectedFinishUser
): TargetAnalysisRequest {
	if (user.kind === 'entity') {
		return {
			subject: user.entityId,
			domain: 'scene',
			entityId: user.entityId,
			expectedGeometryRevision: envelope.units.scene.header.contentRevision
		};
	}
	return {
		subject: surfaceKey(user.surface),
		domain: 'layout',
		surface: user.surface,
		expectedGeometryRevision: envelope.units.layout.header.contentRevision
	};
}

/**
 * Qualify one resolution across users that draw today (present surfaces and
 * every entity). Dormant users are reported in the inspection but impose no
 * draw requirement until their surface returns.
 */
export function qualifyFinishUsers(
	envelope: ProjectEnvelope,
	resolution: FinishResolution,
	users: readonly InspectedFinishUser[],
	analysis: TargetAnalysis | undefined
): { readonly issues: readonly MaterialIssue[]; readonly viable: readonly FinishUserKey[]; readonly failing: readonly FinishUserKey[] } {
	const drawing = users.filter((user) => user.kind === 'entity' || user.lifecycle === 'present');
	if (drawing.length === 0 || resolution.inputs === null) {
		return { issues: resolution.issues, viable: drawing.map((user) => user.key), failing: [] };
	}
	const requests = drawing.map((user) => analysisRequestOf(envelope, user));
	const facts = analysis?.(requests) ?? null;
	const bySubject = new Map<string, TargetFacts>((facts ?? []).map((entry) => [entry.subject, entry]));
	const qualification = qualifyAcrossTargets(
		resolution,
		drawing.map((user, index) => ({
			subject: analysisSubjectOf(user),
			facts: bySubject.get(analysisSubjectOf(user)) ?? null,
			expectedGeometryRevision: requests[index]!.expectedGeometryRevision
		}))
	);
	const failingSubjects = new Set(
		qualification.perTarget.filter((entry) => entry.issues.length > resolution.issues.length).map((entry) => entry.subject)
	);
	return {
		issues: qualification.issues,
		viable: drawing.filter((user) => !failingSubjects.has(analysisSubjectOf(user))).map((user) => user.key),
		failing: drawing.filter((user) => failingSubjects.has(analysisSubjectOf(user))).map((user) => user.key)
	};
}

/**
 * Inspect one Finish at the envelope's accepted revision.
 *
 * Returns `null` for a reference that does not exist in this revision.
 */
export function inspectFinish(
	envelope: ProjectEnvelope,
	ref: SceneFinishRef,
	options: {
		readonly analysis?: TargetAnalysis;
		readonly treat?: (inputs: BoundInputs) => unknown;
		readonly labelForMaterial?: (id: string) => string;
	} = {}
): FinishInspection | null {
	const scene = envelope.units.scene.data;
	const layout = envelope.units.layout.data;
	const key = finishKeyOfRef(ref);
	const { users, storedReferences } = finishUsersWithLifecycle(scene, key, layout);
	if (ref === 'model-own') {
		return {
			ref,
			key,
			name: "Model's own",
			definition: { kind: 'model-own' },
			provenance: null,
			untreated: null,
			treated: null,
			users,
			storedReferences,
			operations: ['assign'],
			issues: []
		};
	}
	let instance: SceneMaterialInstance;
	if ('curated' in ref) {
		if (catalogueRecipe(ref.curated) === undefined) return null;
		instance = { id: `curated:${ref.curated}`, name: options.labelForMaterial?.(ref.curated) ?? ref.curated, base: { catalogue: ref.curated } };
	} else {
		const found = materialInstanceById(scene.materials, ref.project);
		if (found === undefined || isPristineInstance(found)) return null;
		instance = found;
	}
	const resolution = resolveEnvelopeFinish(envelope, instance);
	const qualification = qualifyFinishUsers(envelope, resolution, users, options.analysis);
	const curated = 'curated' in ref;
	const drawing = users.length;
	const operations: FinishOperation[] = ['assign'];
	if (curated) {
		// An unassigned named Finish is allowed, so materialize is always listed.
		operations.push('materialize');
	} else {
		operations.push('rename');
		if (drawing <= 1) operations.push('edit-in-place');
		else operations.push('edit-all', 'edit-just-this');
		if (drawing === 0 && storedReferences.length === 0) operations.push('remove');
	}
	return {
		ref,
		key,
		name: instance.name,
		definition: 'catalogue' in instance.base
			? { kind: 'catalogue', id: instance.base.catalogue }
			: { kind: 'material', hash: instance.base.material },
		provenance: resolution.inputs?.provenance ?? null,
		untreated: resolution.inputs,
		treated: resolution.inputs === null || options.treat === undefined ? null : options.treat(resolution.inputs),
		users,
		storedReferences,
		operations,
		issues: qualification.issues
	};
}

/** Whether an entity is a target a Finish may be assigned to. */
export function isFinishTarget(entity: SceneEntity): boolean {
	return isFinishPaintable(entity);
}
