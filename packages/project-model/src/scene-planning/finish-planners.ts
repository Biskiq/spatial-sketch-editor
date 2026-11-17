/**
 * The Finish and palette planners (T2.S4a).
 *
 * Six operations, each one F.4 intent and therefore one Undo entry:
 *
 * - `scene-finish-assign` paints a curated Finish, a project Finish or a
 *   model's own materials onto whole objects;
 * - `scene-finish-edit` changes a Finish's colour, Sheen or Metal, choosing
 *   *Just this* or *All N* for a shared Finish;
 * - `scene-palette-slot-add/set/rename/remove` own the World palette.
 *
 * Every writer leaves the **assignment normal form** behind (§3 of the plan):
 * a primitive or Form never carries an instance it does not need, a model
 * reaches a curated Finish through one pristine instance, and a pristine
 * instance left with no user is collected in the same write.
 *
 * The planners read a strict payload, validate against S1's own schema and
 * return through `finalizeSceneCandidate`, so the record-scope grant and the
 * active Scene unit format are checked once, on the candidate the adapter will
 * admit.
 */
import type { DomainPlanner, PlannerOutcome, PlannerRequest } from '../f4';
import type {
	MaterialId,
	SceneColor,
	SceneEntity,
	SceneMaterialInstance,
	ScenePaletteSlot,
	SceneTextureAsset
} from '../scene';
import { ShapeReader, type ShapeIssue } from '../strict-shape';
import { replaceUnitData } from '../units/envelope';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '../units/source';
import type { CameraFreeSceneDocument as SceneDocument, ProjectEnvelope, TypedResource } from '../units/types';
import {
	applyFinishEdit,
	finishEditIsNoop,
	finishOf,
	finishRefOfKey,
	isFinishPaintable,
	isPristineInstance,
	literalizePaletteFollowers,
	materialInstanceById,
	nextFinishName,
	nextPaletteName,
	paletteFollowers,
	paletteHasRoom,
	usersOfFinish,
	PALETTE_NAME_MAX_LENGTH,
	type FinishKey,
	type SceneFinishEdit,
	type SceneFinishRef
} from './finish-model';
import { sceneEntityTargetProblem } from './intent-payload';
import { finalizeSceneCandidate, sameSceneValues, type SceneRecordScope } from './record-scope';
import {
	finishTextureResource,
	finishTextureUri,
	sameFinishTexturePin,
	withFinishTextureResource,
	type FinishTexturePin
} from './texture-resource';

export const SCENE_FINISH_ASSIGN = 'scene-finish-assign';
export const SCENE_FINISH_EDIT = 'scene-finish-edit';
export const SCENE_PALETTE_SLOT_ADD = 'scene-palette-slot-add';
export const SCENE_PALETTE_SLOT_SET = 'scene-palette-slot-set';
export const SCENE_PALETTE_SLOT_RENAME = 'scene-palette-slot-rename';
export const SCENE_PALETTE_SLOT_REMOVE = 'scene-palette-slot-remove';
export const SCENE_FINISH_FROM_IMAGE = 'scene-finish-from-image';

const kinds = [
	SCENE_FINISH_ASSIGN,
	SCENE_FINISH_EDIT,
	SCENE_FINISH_FROM_IMAGE,
	SCENE_PALETTE_SLOT_ADD,
	SCENE_PALETTE_SLOT_SET,
	SCENE_PALETTE_SLOT_RENAME,
	SCENE_PALETTE_SLOT_REMOVE
] as const;
type Kind = (typeof kinds)[number];
type Result = PlannerOutcome<ProjectEnvelope>;

const MATERIAL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/;

export type FinishPlannerOptions = {
	/** The catalogue's display label, e.g. `Walnut Wood`; identity is its id. */
	readonly labelForMaterial?: (materialId: MaterialId) => string;
};

function refuse(message: string, code = 'invalid-value'): Result {
	return { kind: 'rejected', code, message, diagnostics: [] };
}

function labelOf(options: FinishPlannerOptions, materialId: MaterialId): string {
	return options.labelForMaterial?.(materialId) ?? materialId;
}

type MaterialGrant = NonNullable<SceneRecordScope['materials']>;

type EditPlan =
	| {
			readonly kind: 'planned';
			readonly scene: SceneDocument;
			readonly changedEntityIds: readonly string[];
			readonly subjectIds: readonly string[];
			readonly addedMaterials: readonly string[];
			readonly changedMaterials: readonly string[];
			readonly removedMaterials: readonly string[];
	  }
	| { readonly kind: 'rejected'; readonly code: string; readonly message: string };

/** Apply an assignment to one entity. Caller has established the Finish exists. */
function assignOne(
	entity: SceneEntity,
	finish: SceneFinishRef,
	materials: SceneMaterialInstance[],
	pristineIdForBase: (base: MaterialId) => string
): SceneEntity {
	if (!isFinishPaintable(entity)) return entity;
	if (finish === 'model-own') {
		if (entity.kind !== 'model') return entity;
		const { materialInstanceId: _previous, ...rest } = entity as SceneEntity & {
			materialInstanceId?: string;
		};
		void _previous;
		return rest as SceneEntity;
	}
	if ('curated' in finish) {
		if (entity.kind === 'model') {
			const instance = materialInstanceById(materials, entity.materialInstanceId);
			// Already carried by the same pristine base: nothing to write.
			if (instance !== undefined && isPristineInstance(instance) && instance.baseMaterialId === finish.curated) {
				return entity;
			}
			return { ...entity, materialInstanceId: pristineIdForBase(finish.curated) };
		}
		const { materialInstanceId: _previous, ...rest } = entity as SceneEntity & {
			materialInstanceId?: string;
		};
		void _previous;
		return { ...rest, materialId: finish.curated } as SceneEntity;
	}
	const project = materialInstanceById(materials, finish.project);
	if (project === undefined) return entity;
	if (entity.kind === 'model') {
		return { ...entity, materialInstanceId: project.id };
	}
	return {
		...entity,
		materialId: project.baseMaterialId,
		materialInstanceId: project.id
	} as SceneEntity;
}

function collectPristine(materials: readonly SceneMaterialInstance[], entities: readonly SceneEntity[]): SceneMaterialInstance[] {
	const used = new Set(
		entities
			.map((entity) => (entity as SceneEntity & { materialInstanceId?: string }).materialInstanceId)
			.filter((id): id is string => id !== undefined)
	);
	return materials.filter((instance) => !isPristineInstance(instance) || used.has(instance.id));
}

/** The one shared edit planner both `finish-edit` and `palette-slot-add` use. */
function planEdit(
	base: SceneDocument,
	input: {
		readonly entityId: string;
		readonly from: FinishKey;
		readonly reach: number;
		readonly mode: 'just-this' | 'all' | 'in-place';
		readonly edit: SceneFinishEdit;
		readonly allocateId: string | null;
		readonly options: FinishPlannerOptions;
	}
): EditPlan {
	const entity = base.entities.find((candidate) => candidate.id === input.entityId);
	if (entity === undefined) return { kind: 'rejected', code: 'unknown-entity', message: 'Choose an object from the current Scene revision.' };
	if (!isFinishPaintable(entity)) {
		return { kind: 'rejected', code: 'not-paintable', message: 'That object has no Finish.' };
	}
	const key = finishOf(entity, base.materials);
	if (key === null || key === 'model-own') {
		return { kind: 'rejected', code: 'not-editable', message: "A model's own materials are not a Finish. Choose a Finish first." };
	}
	const ref = finishRefOfKey(key);
	if (ref === null || ref === 'model-own') {
		return { kind: 'rejected', code: 'unknown-finish', message: 'That Finish no longer exists.' };
	}
	if (input.from !== key) {
		return { kind: 'rejected', code: 'stale-finish', message: 'That object’s Finish changed. Reopen the row and try again.' };
	}
	const users = usersOfFinish(base, key);
	const reach = users.length;
	if (input.reach !== reach) {
		return { kind: 'rejected', code: 'stale-reach', message: `That Finish is now used by ${reach} object${reach === 1 ? '' : 's'}.` };
	}
	const curated = 'curated' in ref;
	if (curated && input.mode === 'in-place') {
		return { kind: 'rejected', code: 'mode-mismatch', message: 'A curated Finish is never edited in place.' };
	}
	if (input.mode === 'all' && reach === 1) {
		return { kind: 'rejected', code: 'mode-mismatch', message: 'A Finish with one user is edited for that object.' };
	}
	if (!curated && input.mode === 'in-place' && reach > 1) {
		return { kind: 'rejected', code: 'mode-mismatch', message: 'A shared Finish is edited for one object or for all of them.' };
	}
	const needsNewInstance = curated || input.mode === 'just-this';
	if (needsNewInstance && input.allocateId === null) {
		return { kind: 'rejected', code: 'missing-allocation', message: 'This edit needs an allocated Finish id.' };
	}
	if (!needsNewInstance && input.allocateId !== null) {
		return { kind: 'rejected', code: 'unexpected-allocation', message: 'Editing a Finish in place creates no id.' };
	}

	const materials = [...base.materials];
	let entities = base.entities;
	const addedMaterials: string[] = [];
	const changedMaterials: string[] = [];

	if (needsNewInstance) {
		const project = 'project' in ref ? materialInstanceById(base.materials, ref.project) : undefined;
		if ('project' in ref && project === undefined) {
			return { kind: 'rejected', code: 'unknown-finish', message: 'That Finish no longer exists.' };
		}
		const baseId = curated ? ref.curated : project!.baseMaterialId;
		// A curated edit starts from the catalogue base; a clone keeps every
		// authored value of its source Finish and changes only its id and name.
		const seed: SceneMaterialInstance = curated
			? {
					id: input.allocateId!,
					name: nextFinishName(labelOf(input.options, baseId), base.materials),
					baseMaterialId: baseId
				}
			: {
					...project!,
					id: input.allocateId!,
					name: nextFinishName(project!.name, base.materials)
				};
		const created = applyFinishEdit(seed, input.edit);
		materials.push(created);
		addedMaterials.push(created.id);
		const targets = input.mode === 'all' ? users : [entity];
		const targetIds = new Set(targets.map((target) => target.id));
		entities = base.entities.map((candidate) => {
			if (!targetIds.has(candidate.id)) return candidate;
			if (candidate.kind === 'model') return { ...candidate, materialInstanceId: created.id };
			return {
				...candidate,
				materialId: created.baseMaterialId,
				materialInstanceId: created.id
			} as SceneEntity;
		});
	} else {
		const project = 'project' in ref ? materialInstanceById(base.materials, ref.project) : undefined;
		if (project === undefined) {
			return { kind: 'rejected', code: 'unknown-finish', message: 'That Finish no longer exists.' };
		}
		if (finishEditIsNoop(project, input.edit)) {
			return { kind: 'rejected', code: 'no-change', message: 'That Finish already has those values.' };
		}
		const updated = applyFinishEdit(project, input.edit);
		const index = materials.findIndex((instance) => instance.id === project.id);
		materials[index] = updated;
		changedMaterials.push(updated.id);
	}

	const collected = collectPristine(materials, entities);
	const removedMaterials = materials
		.filter((instance) => !collected.some((candidate) => candidate.id === instance.id))
		.map((instance) => instance.id);
	const after: SceneDocument = { ...base, materials: collected, entities };
	if (sameSceneValues(base, after)) {
		return { kind: 'rejected', code: 'no-change', message: 'That Finish already has those values.' };
	}
	const affected = input.mode === 'all' ? users.map((user) => user.id) : [entity.id];
	return {
		kind: 'planned',
		scene: after,
		changedEntityIds: affected,
		subjectIds: affected,
		addedMaterials,
		changedMaterials,
		removedMaterials
	};
}

function readColor(
	reader: ShapeReader,
	raw: unknown,
	path: string
): { readonly ok: true; readonly value: SceneColor } | { readonly ok: false } {
	if (typeof raw === 'string') {
		if (!HEX_COLOR.test(raw)) {
			reader.problem(path, 'invalid-color', `${path} must be a lowercase #rrggbb colour`);
			return { ok: false };
		}
		return { ok: true, value: raw };
	}
	const record = reader.object(raw, path, ['slot']);
	const slot = record === null ? null : reader.opaqueId(record.slot, `${path}.slot`);
	if (slot === null) return { ok: false };
	return { ok: true, value: { slot } };
}

function readFinishRef(reader: ShapeReader, raw: unknown, path: string): SceneFinishRef | null {
	if (raw === 'model-own') return 'model-own';
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		reader.problem(path, 'invalid-value', `${path} must name a curated Finish, a project Finish or Model's own`);
		return null;
	}
	// Discriminate on the key before reading: reading both shapes would report the
	// other shape's key as unknown.
	if ('project' in raw) {
		const project = reader.object(raw, path, ['project']);
		const id = project === null ? null : reader.opaqueId(project.project, `${path}.project`);
		return id === null ? null : { project: id };
	}
	const curated = reader.object(raw, path, ['curated']);
	if (curated === null) return null;
	const materialId = reader.string(curated.curated, `${path}.curated`);
	if (materialId === null || !MATERIAL_ID.test(materialId)) {
		if (materialId !== null) {
			reader.problem(`${path}.curated`, 'unknown-catalogue', `${path}.curated must name a curated Finish`);
		}
		return null;
	}
	return { curated: materialId as MaterialId };
}

const TILE_MIN_METERS = 0.01;
const TILE_MAX_METERS = 100;
const TWO_PI = Math.PI * 2;
const FINISH_NAME_MAX_LENGTH = 120;

/** Normalise radians into the Scene format's [0, 2π) domain. */
function normalizeRotation(value: number): number {
	const wrapped = value % TWO_PI;
	return wrapped < 0 ? wrapped + TWO_PI : wrapped;
}

function readFinishEdit(reader: ShapeReader, raw: unknown, path: string): SceneFinishEdit | null {
	const record = reader.object(raw, path, [
		'color',
		'roughness',
		'metalness',
		'colorMap',
		'tileMeters',
		'rotation'
	]);
	if (record === null) return null;
	const edit: {
		color?: SceneColor | null;
		roughness?: number | null;
		metalness?: 0 | 1 | null;
		colorMap?: string | null;
		tileMeters?: readonly [number, number] | null;
		rotation?: number | null;
	} = {};
	if ('color' in record) {
		if (record.color === null) edit.color = null;
		else {
			const parsed = readColor(reader, record.color, `${path}.color`);
			if (!parsed.ok) return null;
			edit.color = parsed.value;
		}
	}
	for (const key of ['roughness', 'metalness'] as const) {
		if (!(key in record)) continue;
		if (record[key] === null) {
			edit[key] = null;
			continue;
		}
		const value = reader.number(record[key], `${path}.${key}`);
		if (value === null) return null;
		if (key === 'roughness') {
			if (value < 0 || value > 1) {
				reader.problem(`${path}.roughness`, 'invalid-value', `${path}.roughness must be within [0, 1]`);
				return null;
			}
			edit.roughness = value;
		} else {
			if (value !== 0 && value !== 1) {
				reader.problem(`${path}.metalness`, 'invalid-value', `${path}.metalness must be 0 or 1`);
				return null;
			}
			edit.metalness = value;
		}
	}
	if ('colorMap' in record) {
		if (record.colorMap === null) edit.colorMap = null;
		else {
			const textureId = reader.opaqueId(record.colorMap, `${path}.colorMap`);
			if (textureId === null) return null;
			edit.colorMap = textureId;
		}
	}
	if ('tileMeters' in record) {
		if (record.tileMeters === null) edit.tileMeters = null;
		else {
			if (!Array.isArray(record.tileMeters) || record.tileMeters.length !== 2) {
				reader.problem(`${path}.tileMeters`, 'invalid-value', `${path}.tileMeters must be a [width, height] pair`);
				return null;
			}
			const width = reader.number(record.tileMeters[0], `${path}.tileMeters[0]`);
			const height = reader.number(record.tileMeters[1], `${path}.tileMeters[1]`);
			if (width === null || height === null) return null;
			if (
				width < TILE_MIN_METERS || width > TILE_MAX_METERS ||
				height < TILE_MIN_METERS || height > TILE_MAX_METERS
			) {
				reader.problem(
					`${path}.tileMeters`,
					'invalid-value',
					`${path}.tileMeters must be within [${TILE_MIN_METERS}, ${TILE_MAX_METERS}] m`
				);
				return null;
			}
			edit.tileMeters = [width, height];
		}
	}
	if ('rotation' in record) {
		if (record.rotation === null) edit.rotation = null;
		else {
			const value = reader.number(record.rotation, `${path}.rotation`);
			if (value === null) return null;
			if (!Number.isFinite(value)) {
				reader.problem(`${path}.rotation`, 'invalid-value', `${path}.rotation must be finite`);
				return null;
			}
			edit.rotation = normalizeRotation(value);
		}
	}
	if (
		!('color' in edit) && !('roughness' in edit) && !('metalness' in edit) &&
		!('colorMap' in edit) && !('tileMeters' in edit) && !('rotation' in edit)
	) {
		reader.problem(path, 'invalid-value', `${path} must change at least one Finish value`);
		return null;
	}
	return edit;
}

function readTexturePin(reader: ShapeReader, raw: unknown, path: string): FinishTexturePin | null {
	const record = reader.object(raw, path, ['hash', 'mime', 'size', 'locator']);
	if (record === null) return null;
	const hash = reader.string(record.hash, `${path}.hash`);
	const mime = reader.string(record.mime, `${path}.mime`);
	const size = reader.integerAtLeast(record.size, `${path}.size`, 1);
	const locator = reader.string(record.locator, `${path}.locator`);
	if (hash === null || mime === null || size === null || locator === null) return null;
	return { hash, mime, size, locator };
}

function readEntityIdList(
	reader: ShapeReader,
	raw: unknown,
	path: string,
	allowEmpty: boolean
): string[] | null {
	if (!Array.isArray(raw) || (!allowEmpty && raw.length === 0)) {
		reader.problem(path, 'invalid-value', `${path} must be ${allowEmpty ? 'an' : 'a non-empty'} array of Scene entity ids`);
		return null;
	}
	const ids: string[] = [];
	for (const [index, entry] of raw.entries()) {
		const id = reader.opaqueId(entry, `${path}[${index}]`);
		if (id === null) return null;
		if (ids.includes(id)) {
			reader.problem(`${path}[${index}]`, 'duplicate-id', `${path} must not repeat an entity id`);
			return null;
		}
		ids.push(id);
	}
	return ids;
}

function readMaterialIdList(reader: ShapeReader, raw: unknown, path: string): string[] | null {
	if (!Array.isArray(raw) || raw.length === 0) {
		reader.problem(path, 'invalid-value', `${path} must be a non-empty array of Scene entity ids`);
		return null;
	}
	const ids: string[] = [];
	for (const [index, entry] of raw.entries()) {
		const id = reader.opaqueId(entry, `${path}[${index}]`);
		if (id === null) return null;
		if (ids.includes(id)) {
			reader.problem(`${path}[${index}]`, 'duplicate-id', `${path} must not repeat an entity id`);
			return null;
		}
		ids.push(id);
	}
	return ids;
}

function sameSequence(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function allocationOf(
	request: PlannerRequest<ProjectEnvelope>,
	allowedKinds: readonly string[],
	required: boolean
): { readonly id: string | null } | { readonly missing: string } {
	const allocations = request.allocatedIds;
	if (allocations.length === 0) {
		return required ? { missing: 'This operation needs one allocated id.' } : { id: null };
	}
	if (allocations.length !== 1 || !allowedKinds.includes(allocations[0]!.kind)) {
		return { missing: `This operation takes one allocated ${allowedKinds.join(' or ')} id.` };
	}
	return { id: allocations[0]!.id };
}

function prepare(request: PlannerRequest<ProjectEnvelope>, kind: Kind, options: FinishPlannerOptions): Result {
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
		capabilityId: null
	});
	const scope: SceneRecordScope = {
		operationKind: kind,
		changedEntityIds: [],
		changedEntityFields: [],
		createdEntityIds: [],
		removedEntityIds: [],
		allowClusterCleanup: false
	};
	const complete = (
		after: SceneDocument,
		grant: Partial<SceneRecordScope>,
		subjectIds: readonly string[],
		fields: string[],
		textureResource?: TypedResource
	): Result => {
		const finalized = finalizeSceneCandidate({ before, after, scope: { ...scope, ...grant } });
		if (finalized.kind === 'rejected') return finalized;
		let candidateSource = replaceUnitData(envelope, 'scene', finalized.scene);
		if (textureResource !== undefined) {
			const withResource = withFinishTextureResource(candidateSource, textureResource);
			if (withResource === null) {
				return refuse('The Finish image resource could not be added to the candidate.', 'texture-mismatch');
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
					after: reference(id)
				})),
				diagnostics: []
			}
		};
	};
	const materialGrant = (grant: {
		added?: readonly string[];
		changed?: readonly string[];
		removed?: readonly string[];
	}): MaterialGrant => ({
		added: grant.added ?? [],
		changed: grant.changed ?? [],
		removed: grant.removed ?? []
	});

	if (kind === SCENE_FINISH_ASSIGN) {
		const payload = reader.object(request.intent.payload, '$.payload', ['finish', 'entityIds']);
		const finish = payload === null ? null : readFinishRef(reader, payload.finish, '$.payload.finish');
		const entityIds = payload === null ? null : readMaterialIdList(reader, payload.entityIds, '$.payload.entityIds');
		if (finish === null || entityIds === null || reader.issues.length > 0) {
			return refuse(reader.issues[0]?.message ?? 'Paint needs one Finish and at least one object.');
		}
		if (request.intent.targets.length !== entityIds.length) {
			return refuse('Paint must address exactly the objects it names.');
		}
		for (const [index, target] of request.intent.targets.entries()) {
			const problem = sceneEntityTargetProblem(target, entityIds[index]!, header.contentRevision);
			if (problem !== null) return refuse(problem.message);
		}
		const targets: SceneEntity[] = [];
		for (const id of entityIds) {
			const entity = before.entities.find((candidate) => candidate.id === id);
			if (entity === undefined) return refuse(`No Scene object "${id}" is in the current revision.`, 'unknown-entity');
			if (!isFinishPaintable(entity)) {
				return refuse(
					entity.kind === 'light' ? 'Lights have no Finish.' : 'That subject cannot be painted.',
					'not-paintable'
				);
			}
			if (finish === 'model-own' && entity.kind !== 'model') {
				return refuse("Model's own can only be painted onto a model.", 'not-paintable');
			}
			targets.push(entity);
		}
		const curatedFinish = typeof finish === 'object' && 'curated' in finish ? finish : null;
		const projectFinish = typeof finish === 'object' && 'project' in finish ? finish : null;
		if (curatedFinish !== null && !MATERIAL_ID.test(curatedFinish.curated)) {
			return refuse('That curated Finish does not exist.', 'unknown-catalogue');
		}
		if (projectFinish !== null && materialInstanceById(before.materials, projectFinish.project) === undefined) {
			return refuse('That project Finish no longer exists.', 'unknown-finish');
		}
		// A model can only carry a curated Finish through a pristine instance. Reuse
		// the first one in document order, or install exactly one new instance.
		let pristineId: string | null = null;
		if (curatedFinish !== null && targets.some((entity) => entity.kind === 'model')) {
			const reusable = before.materials.find(
				(instance) => isPristineInstance(instance) && instance.baseMaterialId === curatedFinish.curated
			);
			if (reusable !== undefined) pristineId = reusable.id;
			else {
				const allocation = allocationOf(request, ['scene-finish', 'scene-material'], true);
				if ('missing' in allocation) return refuse(allocation.missing, 'missing-allocation');
				pristineId = allocation.id;
			}
		}
		const allocation = allocationOf(request, ['scene-finish', 'scene-material'], false);
		if ('missing' in allocation) return refuse(allocation.missing, 'unexpected-allocation');
		if (pristineId === null && allocation.id !== null) {
			return refuse('Painting these objects needs no allocated Finish id.', 'unexpected-allocation');
		}

		const materials = [...before.materials];
		if (pristineId !== null && !materials.some((instance) => instance.id === pristineId)) {
			if (curatedFinish !== null) {
				materials.push({
					id: pristineId,
					name: labelOf(options, curatedFinish.curated),
					baseMaterialId: curatedFinish.curated
				});
			}
		}
		const resolvePristine = (base: MaterialId): string => {
			const reusable = materials.find(
				(instance) => isPristineInstance(instance) && instance.baseMaterialId === base
			);
			if (reusable !== undefined) return reusable.id;
			// Several curated bases in one multi-target paint: each needs its own
			// pristine record. The intent carries one id, so a second base refuses.
			if (pristineId !== null) {
				materials.push({ id: pristineId, name: labelOf(options, base), baseMaterialId: base });
				return pristineId;
			}
			throw new Error('missing pristine instance');
		};
		let entities: SceneEntity[];
		try {
			entities = before.entities.map((entity) =>
				entityIds.includes(entity.id) ? assignOne(entity, finish, materials, resolvePristine) : entity
			);
		} catch {
			return refuse('This paint needs one allocated Finish id per curated base.', 'missing-allocation');
		}
		const collected = collectPristine(materials, entities);
		const after: SceneDocument = { ...before, materials: collected, entities };
		if (sameSceneValues(before, after)) {
			return refuse('Every chosen object already has that Finish.', 'no-change');
		}
		const added = collected
			.filter((instance) => !before.materials.some((candidate) => candidate.id === instance.id))
			.map((instance) => instance.id);
		const removed = before.materials
			.filter((instance) => !collected.some((candidate) => candidate.id === instance.id))
			.map((instance) => instance.id);
		return complete(
			after,
			{
				changedEntityIds: entityIds,
				changedEntityFields: ['materialId', 'materialInstanceId'],
				materials: materialGrant({ added, removed })
			},
			entityIds,
			['finish', 'materialId', 'materialInstanceId', 'materials']
		);
	}

	if (kind === SCENE_FINISH_EDIT) {
		const payload = reader.object(request.intent.payload, '$.payload', ['entityId', 'from', 'reach', 'mode', 'edit']);
		const entityId = payload === null ? null : reader.opaqueId(payload.entityId, '$.payload.entityId');
		const from = payload === null ? null : reader.string(payload.from, '$.payload.from');
		const reach = payload === null ? null : reader.integerAtLeast(payload.reach, '$.payload.reach', 1);
		const mode = payload === null ? null : reader.tag(payload.mode, '$.payload.mode', ['just-this', 'all', 'in-place']);
		const edit = payload === null ? null : readFinishEdit(reader, payload.edit, '$.payload.edit');
		if (entityId === null || from === null || reach === null || mode === null || edit === null || reader.issues.length > 0) {
			return refuse(reader.issues[0]?.message ?? 'The Finish edit is incomplete.');
		}
		if (request.intent.targets.length !== 1) return refuse('A Finish edit addresses exactly one object.');
		const targetProblem = sceneEntityTargetProblem(request.intent.targets[0]!, entityId, header.contentRevision);
		if (targetProblem !== null) return refuse(targetProblem.message);
		// The id is offered, not required here: `planEdit` refuses a missing or an
		// unexpected allocation *after* it has judged the reach and the mode, so a
		// mismatched mode reports itself rather than hiding behind an id.
		const allocations = request.allocatedIds;
		if (
			allocations.length > 1 ||
			(allocations.length === 1 && !['scene-finish', 'scene-material'].includes(allocations[0]!.kind))
		) {
			return refuse('A Finish edit takes one allocated Finish id at most.', 'unexpected-allocation');
		}
		const allocationId = allocations[0]?.id ?? null;
		const planned = planEdit(before, {
			entityId,
			from,
			reach,
			mode: mode as 'just-this' | 'all' | 'in-place',
			edit,
			allocateId: allocationId,
			options
		});
		if (planned.kind === 'rejected') return refuse(planned.message, planned.code);
		return complete(
			planned.scene,
			{
				changedEntityIds: planned.changedEntityIds,
				changedEntityFields: ['materialId', 'materialInstanceId'],
				materials: materialGrant({
					added: planned.addedMaterials,
					changed: planned.changedMaterials,
					removed: planned.removedMaterials
				})
			},
			planned.subjectIds,
			['finish', 'color', 'roughness', 'metalness', 'maps', 'mapping', 'materials']
		);
	}

	if (kind === SCENE_FINISH_FROM_IMAGE) {
		// The one Finish write that stages creator bytes. The P20 upload happened
		// before this intent and is never part of Undo; this write adds only the
		// Scene records that name those bytes, together or not at all.
		const payload = reader.object(request.intent.payload, '$.payload', [
			'name',
			'texture',
			'entityIds',
			'replaceFinishOf'
		]);
		const rawName = payload === null ? null : reader.string(payload.name, '$.payload.name');
		const texturePayload =
			payload === null ? null : reader.object(payload.texture, '$.payload.texture', ['assetId', 'pin']);
		const assetId =
			texturePayload === null
				? null
				: reader.opaqueId(texturePayload.assetId, '$.payload.texture.assetId');
		const pin =
			texturePayload === null
				? null
				: readTexturePin(reader, texturePayload.pin, '$.payload.texture.pin');
		const entityIds =
			payload === null
				? null
				: readEntityIdList(reader, payload.entityIds, '$.payload.entityIds', true);
		if (rawName === null || assetId === null || pin === null || entityIds === null || reader.issues.length > 0) {
			return refuse(reader.issues[0]?.message ?? 'A Finish image needs a name, a verified pin and its objects.', 'invalid-pin');
		}
		const name = rawName.trim();
		if (name.length === 0 || name.length > FINISH_NAME_MAX_LENGTH) {
			return refuse(`A Finish name must be 1 to ${FINISH_NAME_MAX_LENGTH} characters.`, 'invalid-value');
		}
		const textureResource = finishTextureResource({ assetId, pin });
		if (textureResource === null) {
			return refuse('A Finish image needs a sha256 pin for a PNG, JPEG or WebP within the Artwork byte cap.', 'invalid-pin');
		}
		const uri = finishTextureUri(assetId);

		let replace: {
			readonly entityId: string;
			readonly reach: number;
			readonly mode: 'just-this' | 'all' | 'in-place';
		} | null = null;
		if (payload !== null && payload.replaceFinishOf !== undefined) {
			const record = reader.object(payload.replaceFinishOf, '$.payload.replaceFinishOf', [
				'entityId',
				'reach',
				'mode'
			]);
			const replaceEntityId = record === null ? null : reader.opaqueId(record.entityId, '$.payload.replaceFinishOf.entityId');
			const replaceReach =
				record === null ? null : reader.integerAtLeast(record.reach, '$.payload.replaceFinishOf.reach', 1);
			const replaceMode =
				record === null
					? null
					: reader.tag(record.mode, '$.payload.replaceFinishOf.mode', ['just-this', 'all', 'in-place']);
			if (replaceEntityId === null || replaceReach === null || replaceMode === null || reader.issues.length > 0) {
				return refuse(reader.issues[0]?.message ?? 'The image replacement is incomplete.');
			}
			replace = {
				entityId: replaceEntityId,
				reach: replaceReach,
				mode: replaceMode as 'just-this' | 'all' | 'in-place'
			};
		}

		if (replace === null) {
			// An empty selection is the Library's *arm Paint* case: the Finish and
			// its image are created with no user yet, exactly as a project Finish
			// that loses its last user is kept rather than silently deleted.
			if (request.intent.targets.length !== entityIds.length) {
				return refuse('A Finish image must address exactly the objects it names.');
			}
		} else {
			if (entityIds.length > 0) return refuse('An image replacement addresses one object, not a selection.');
			if (request.intent.targets.length !== 1) return refuse('An image replacement addresses exactly one object.');
			const problem = sceneEntityTargetProblem(
				request.intent.targets[0]!,
				replace.entityId,
				header.contentRevision
			);
			if (problem !== null) return refuse(problem.message);
		}
		for (const [index, id] of entityIds.entries()) {
			const problem = sceneEntityTargetProblem(request.intent.targets[index]!, id, header.contentRevision);
			if (problem !== null) return refuse(problem.message);
			const entity = before.entities.find((candidate) => candidate.id === id);
			if (entity === undefined) return refuse(`No Scene object "${id}" is in the current revision.`, 'unknown-entity');
			if (!isFinishPaintable(entity)) return refuse('That subject cannot carry a Finish.', 'not-paintable');
		}

		// The texture record is idempotent: the same bytes always name the same
		// record, and an existing record with another URI is a tampered answer.
		const existingTexture = before.textures.find((texture) => texture.id === assetId);
		if (existingTexture !== undefined && existingTexture.uri !== uri) {
			return refuse('That image is already registered under a different URI.', 'texture-mismatch');
		}
		const textures: SceneTextureAsset[] =
			existingTexture === undefined
				? [...before.textures, { id: assetId, name, uri }]
				: before.textures;
		const texturesAdded = existingTexture === undefined;

		// The typed resource is idempotent too; a record with another pin means the
		// Scene and the registry disagree, which no write may paper over.
		const resources = envelope.units.resources.data.resources;
		const existingResource = resources.find(
			(resource) => resource.kind === 'texture' && resource.id === assetId
		);
		if (
			existingResource !== undefined &&
			(existingResource.pin === null ||
				existingResource.unresolved !== null ||
				!sameFinishTexturePin(existingResource.pin, textureResource.pin))
		) {
			return refuse('That image\u2019s pinned bytes disagree with the project registry.', 'texture-mismatch');
		}
		const resourceToAdd = existingResource === undefined ? textureResource : undefined;

		let scene: SceneDocument;
		let changedEntityIds: readonly string[];
		let subjectIds: readonly string[];
		let addedMaterials: readonly string[] = [];
		let changedMaterials: readonly string[] = [];
		let removedMaterials: readonly string[] = [];

		if (replace === null) {
			const allocations = request.allocatedIds;
			if (allocations.length !== 1 || !['scene-finish', 'scene-material'].includes(allocations[0]!.kind)) {
				return refuse('A Finish image needs one allocated Finish id.', 'missing-allocation');
			}
			const finishId = allocations[0]!.id;
			if (before.materials.some((material) => material.id === finishId)) {
				return refuse('That Finish id is already in use.', 'unexpected-allocation');
			}
			const created: SceneMaterialInstance = {
				id: finishId,
				name,
				baseMaterialId: 'paper-aged',
				// The base is `#e2d2b0`; white keeps the image untinted (S1's writer rule).
				color: '#ffffff',
				maps: { color: assetId }
			};
			const materials = [...before.materials, created];
			const entities = before.entities.map((entity) =>
				entityIds.includes(entity.id)
					? assignOne(entity, { project: finishId }, materials, () => {
							throw new Error('a project Finish needs no pristine instance');
						})
					: entity
			);
			const collected = collectPristine(materials, entities);
			scene = { ...before, textures, materials: collected, entities };
			changedEntityIds = entityIds;
			subjectIds = [...entityIds, finishId];
			addedMaterials = [finishId];
			removedMaterials = materials
				.filter((instance) => !collected.some((candidate) => candidate.id === instance.id))
				.map((instance) => instance.id);
		} else {
			const target = before.entities.find((entity) => entity.id === replace!.entityId);
			if (target === undefined) return refuse('That object is not in the current revision.', 'unknown-entity');
			if (!isFinishPaintable(target)) return refuse('That object has no Finish.', 'not-paintable');
			const key = finishOf(target, before.materials);
			if (key === null || key === 'model-own') {
				return refuse("A model's own materials are not a Finish. Choose a Finish first.", 'not-editable');
			}
			const ref = finishRefOfKey(key);
			if (ref === null || ref === 'model-own') return refuse('That Finish no longer exists.', 'unknown-finish');
			const needsNew = 'curated' in ref || replace.mode === 'just-this';
			const allocations = request.allocatedIds;
			if (needsNew) {
				if (allocations.length !== 1 || !['scene-finish', 'scene-material'].includes(allocations[0]!.kind)) {
					return refuse('This image replacement needs one allocated Finish id.', 'missing-allocation');
				}
			} else if (allocations.length !== 0) {
				return refuse('This image replacement creates no Finish id.', 'unexpected-allocation');
			}
			const workingScene: SceneDocument = { ...before, textures };
			const planned = planEdit(workingScene, {
				entityId: replace.entityId,
				from: key,
				reach: replace.reach,
				mode: replace.mode,
				edit: { colorMap: assetId },
				allocateId: needsNew ? allocations[0]!.id : null,
				options
			});
			if (planned.kind === 'rejected') return refuse(planned.message, planned.code);
			scene = planned.scene;
			changedEntityIds = planned.changedEntityIds;
			subjectIds = [assetId, ...planned.subjectIds];
			addedMaterials = planned.addedMaterials;
			changedMaterials = planned.changedMaterials;
			removedMaterials = planned.removedMaterials;
		}

		const grant: Partial<SceneRecordScope> = {
			changedEntityIds,
			changedEntityFields: ['materialId', 'materialInstanceId'],
			materials: materialGrant({
				added: addedMaterials,
				changed: changedMaterials,
				removed: removedMaterials
			}),
			...(texturesAdded ? { textures: { added: [assetId] } } : {})
		};
		return complete(
			scene,
			grant,
			subjectIds,
			['finish', 'texture', 'resource', 'maps', 'materials'],
			resourceToAdd
		);
	}

	if (kind === SCENE_PALETTE_SLOT_ADD) {
		const payload = reader.object(request.intent.payload, '$.payload', ['color', 'adoptEntityId', 'reach', 'mode']);
		const parsedColor = payload === null ? null : readColor(reader, payload.color, '$.payload.color');
		const adoptEntityId =
			payload === null || payload.adoptEntityId === undefined
				? null
				: reader.opaqueId(payload.adoptEntityId, '$.payload.adoptEntityId');
		const reach = payload === null || payload.reach === undefined ? null : reader.integerAtLeast(payload.reach, '$.payload.reach', 1);
		const mode = payload === null || payload.mode === undefined ? null : reader.tag(payload.mode, '$.payload.mode', ['just-this', 'all', 'in-place']);
		if (payload === null || parsedColor === null || !parsedColor.ok || reader.issues.length > 0) {
			return refuse(reader.issues[0]?.message ?? 'A palette colour is required.');
		}
		if (!paletteHasRoom(before.palette)) return refuse('The palette already holds eight colours.', 'palette-full');
		const adopt = adoptEntityId !== null;
		if (adopt !== (reach !== null && mode !== null)) {
			return refuse('Adopting a colour needs the object and its reach; a plain add needs neither.');
		}
		let adoptEntity: SceneEntity | null = null;
		if (adopt) {
			if (request.intent.targets.length !== 1) return refuse('A palette adoption addresses exactly one object.');
			const problem = sceneEntityTargetProblem(request.intent.targets[0]!, adoptEntityId!, header.contentRevision);
			if (problem !== null) return refuse(problem.message);
			adoptEntity = before.entities.find((candidate) => candidate.id === adoptEntityId) ?? null;
			if (adoptEntity === null) return refuse('That object is not in the current revision.', 'unknown-entity');
			const instance = materialInstanceById(
				before.materials,
				(adoptEntity as SceneEntity & { materialInstanceId?: string }).materialInstanceId
			);
			if (instance?.color === undefined || typeof instance.color !== 'string' || instance.color !== parsedColor.value) {
				return refuse('The current colour is inherited, so there is no literal to save.', 'invalid-adopt');
			}
		} else if (request.intent.targets.length !== 0) {
			return refuse('A palette add with no adopted object addresses no subject.');
		}

		// The slot id is the first allocation; an adopted shared/curated Finish may
		// additionally create a project Finish, which is the second.
		const allocations = request.allocatedIds;
		if (allocations.length === 0 || allocations[0]!.kind !== 'scene-palette-slot') {
			return refuse('A palette add needs one allocated palette slot id.', 'missing-allocation');
		}
		let finishAllocation: string | null = null;
		if (adoptEntity !== null) {
			const adoptFinish = finishOf(adoptEntity, before.materials);
			if (adoptFinish === null || adoptFinish === 'model-own') {
				return refuse('That object has no editable Finish.', 'not-editable');
			}
		}
		if (allocations.length > 2) {
			return refuse('A palette add takes one slot id and at most one Finish id.', 'unexpected-allocation');
		}
		if (allocations.length === 2) {
			if (!['scene-finish', 'scene-material'].includes(allocations[1]!.kind)) {
				return refuse('The second allocation must be a Finish id.', 'unexpected-allocation');
			}
			finishAllocation = allocations[1]!.id;
		}

		const slots: ScenePaletteSlot[] = [
			...(before.palette ?? []),
			{ id: allocations[0]!.id, name: nextPaletteName(before.palette), color: parsedColor.value as string }
		];
		let scene: SceneDocument = { ...before, palette: slots };
		let changedEntityIds: readonly string[] = [];
		let subjectIds: readonly string[] = [];
		let addedMaterials: readonly string[] = [];
		let changedMaterials: readonly string[] = [];
		let removedMaterials: readonly string[] = [];
		if (adoptEntity !== null) {
			const edit = planEdit(scene, {
				entityId: adoptEntity.id,
				from: finishOf(adoptEntity, before.materials)!,
				reach: reach!,
				mode: mode as 'just-this' | 'all' | 'in-place',
				edit: { color: { slot: allocations[0]!.id } },
				allocateId: finishAllocation,
				options
			});
			if (edit.kind === 'rejected') return refuse(edit.message, edit.code);
			scene = edit.scene;
			changedEntityIds = edit.changedEntityIds;
			subjectIds = edit.subjectIds;
			addedMaterials = edit.addedMaterials;
			changedMaterials = edit.changedMaterials;
			removedMaterials = edit.removedMaterials;
		}
		const grant: Partial<SceneRecordScope> = {
			palette: { change: 'slots' },
			changedEntityIds,
			changedEntityFields: changedEntityIds.length === 0 ? [] : ['materialId', 'materialInstanceId'],
			materials: materialGrant({
				added: addedMaterials,
				changed: changedMaterials,
				removed: removedMaterials
			})
		};
		return complete(scene, grant, subjectIds, ['palette', 'materials']);
	}

	if (kind === SCENE_PALETTE_SLOT_SET) {
		const payload = reader.object(request.intent.payload, '$.payload', ['slotId', 'color']);
		const slotId = payload === null ? null : reader.opaqueId(payload.slotId, '$.payload.slotId');
		const parsedColor = payload === null ? null : readColor(reader, payload.color, '$.payload.color');
		if (slotId === null || parsedColor === null || !parsedColor.ok || reader.issues.length > 0) {
			return refuse(reader.issues[0]?.message ?? 'A palette slot and colour are required.');
		}
		if (request.intent.targets.length !== 0) return refuse('A palette colour addresses no Scene subject.');
		const slot = before.palette?.find((entry) => entry.id === slotId);
		if (slot === undefined) return refuse('That palette colour no longer exists.', 'unknown-slot');
		if (slot.color === parsedColor.value) return refuse('That palette colour is unchanged.', 'no-change');
		const palette = before.palette!.map((entry) =>
			entry.id === slotId ? { ...entry, color: parsedColor.value as string } : entry
		);
		return complete({ ...before, palette }, { palette: { change: 'slots' } }, [], ['palette']);
	}

	if (kind === SCENE_PALETTE_SLOT_RENAME) {
		const payload = reader.object(request.intent.payload, '$.payload', ['slotId', 'name']);
		const slotId = payload === null ? null : reader.opaqueId(payload.slotId, '$.payload.slotId');
		const rawName = payload === null ? null : reader.string(payload.name, '$.payload.name');
		if (slotId === null || rawName === null || reader.issues.length > 0) {
			return refuse(reader.issues[0]?.message ?? 'A palette slot and name are required.');
		}
		if (request.intent.targets.length !== 0) return refuse('A palette name addresses no Scene subject.');
		const name = rawName.trim();
		if (name.length === 0 || name.length > PALETTE_NAME_MAX_LENGTH) {
			return refuse(`A palette name must be 1 to ${PALETTE_NAME_MAX_LENGTH} characters.`, 'invalid-name');
		}
		const slot = before.palette?.find((entry) => entry.id === slotId);
		if (slot === undefined) return refuse('That palette colour no longer exists.', 'unknown-slot');
		if (slot.name === name) return refuse('That palette name is unchanged.', 'no-change');
		const palette = before.palette!.map((entry) =>
			entry.id === slotId ? { ...entry, name } : entry
		);
		return complete({ ...before, palette }, { palette: { change: 'slots' } }, [], ['palette']);
	}

	// scene-palette-slot-remove
	const payload = reader.object(request.intent.payload, '$.payload', ['slotId']);
	const slotId = payload === null ? null : reader.opaqueId(payload.slotId, '$.payload.slotId');
	if (slotId === null || reader.issues.length > 0) {
		return refuse(reader.issues[0]?.message ?? 'A palette slot is required.');
	}
	if (request.intent.targets.length !== 0) return refuse('Removing a palette colour addresses no Scene subject.');
	const slot = before.palette?.find((entry) => entry.id === slotId);
	if (slot === undefined) return refuse('That palette colour no longer exists.', 'unknown-slot');
	const followers = paletteFollowers(before.materials, slotId);
	const materials = literalizePaletteFollowers(before.materials, slotId, slot.color);
	const remaining = before.palette!.filter((entry) => entry.id !== slotId);
	const after: SceneDocument = {
		...before,
		materials,
		...(remaining.length === 0 ? { palette: undefined } : { palette: remaining })
	};
	if (remaining.length === 0) delete (after as { palette?: unknown }).palette;
	return complete(
		after,
		{
			palette: { change: 'slots' },
			materials: materialGrant({ changed: followers.map((instance) => instance.id) })
		},
		[],
		['palette', 'materials']
	);

}

export function createFinishPlanners(
	options: FinishPlannerOptions = {}
): readonly DomainPlanner<ProjectEnvelope>[] {
	return kinds.map((kind) => ({
		id: `scene.${kind}`,
		kind,
		// `scene-finish-from-image` is the one Finish planner that stages a typed
		// resource: the texture record and its pin are added with the Finish. Every
		// other Finish write stays Scene-only.
		admission: {
			domain: 'scene' as const,
			compound: false,
			units: false,
			resources: kind === SCENE_FINISH_FROM_IMAGE
		},
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare: (request) => prepare(request, kind, options)
	}));
}

/** One diagnostic list for callers that inspect a plan without admitting it. */
export type FinishPlanDiagnostic = ShapeIssue;
