/**
 * T2.P01.S02 — the strict intent payload, target and allocation reader.
 *
 * An `AuthoringIntent@1` payload is captured, serializable domain data, so it is
 * read strictly: unknown keys, missing fields and non-finite numbers are
 * refusals with a path and a code, never coercions. One reader serves all seven
 * operations (the tests README's one-parser-per-grammar rule), and the target
 * reader is the other half of the operation's scope:
 *
 * - `place-object` addresses no existing subject — its entity id is a captured
 *   allocation, so `targets` must be empty;
 * - every other operation addresses exactly one Scene entity, and the target
 *   must name the same entity as the payload, at the snapshot's exact content
 *   revision, in the canonical Scene location. A target that resolves elsewhere
 *   is a refusal, not a planner guess.
 */
import type { LayoutVec2 } from '@portfolio/layout-core';
import type { ShapeIssue } from '../strict-shape';
import { ShapeReader } from '../strict-shape';
import { validateFrameReference } from '../references/validate';
import type { FrameReference, SemanticReference } from '../references/types';
import type { MaterialId, SceneFormPlane, Vec3 } from '../scene';
import type { CameraFreeSceneDocument as SceneDocument } from '../units/types';
import type { LocalInputFrame } from './types';
import type { SceneSupportChoice } from './support';
import type { CapturedIdAllocation } from '../f4/types';
import type { SceneOperationKind } from './operations';
import type { CreatorModelResourcePayload } from './model-resource';

export type SceneOperationPayload =
	| {
			readonly kind: 'create-form';
			readonly plane: SceneFormPlane;
			readonly outline: readonly {
				readonly u: number;
				readonly v: number;
				readonly smooth: boolean;
			}[];
			readonly extent: number;
			readonly position: Vec3;
			readonly yaw: number;
			readonly materialId: MaterialId;
			readonly name: string;
			readonly choice?: SceneSupportChoice;
	  }
	| {
			readonly kind: 'set-form-size';
			readonly entityId: string;
			readonly scale: readonly [number, number, number];
			readonly choice?: SceneSupportChoice;
	  }
	| {
			readonly kind: 'place-object';
			readonly definitionKey: string;
			readonly metadataContentId: string;
			readonly worldXZ: LayoutVec2;
			readonly yaw: number;
			readonly frame: LocalInputFrame;
			readonly frameReference: FrameReference;
			readonly choice?: SceneSupportChoice;
			/**
			 * First placement of an approved creator model: the exact resource and lock
			 * installed in the same accepted result as the entity. Later instances omit
			 * it and resolve the definition from the accepted envelope.
			 */
			readonly modelResource?: { readonly id: string } & CreatorModelResourcePayload;
	  }
	| {
			readonly kind: 'move-horizontal';
			readonly entityId: string;
			readonly worldXZ: LayoutVec2;
			readonly frame: LocalInputFrame;
			readonly frameReference: FrameReference;
			readonly contactMinY: number;
			readonly choice?: SceneSupportChoice;
	  }
	| {
			readonly kind: 'set-yaw';
			readonly entityId: string;
			readonly yaw: number;
			readonly frame: LocalInputFrame;
			readonly frameReference: FrameReference;
	  }
	| {
			readonly kind: 'place-on-floor';
			readonly entityId: string;
			readonly worldXZ: LayoutVec2;
			readonly frame: LocalInputFrame;
			readonly frameReference: FrameReference;
			readonly contactMinY: number;
			readonly yaw?: number;
			readonly choice?: SceneSupportChoice;
	  }
	| {
			readonly kind: 'resize-on-floor';
			readonly entityId: string;
			readonly scale: number;
			readonly contactMinY: number;
			readonly choice?: SceneSupportChoice;
	  }
	| {
			readonly kind: 'duplicate-one';
			readonly entityId: string;
			readonly contactMinY: number;
			readonly choice?: SceneSupportChoice;
	  }
	| { readonly kind: 'delete-one'; readonly entityId: string };

/** Read the payload for one registered operation kind. */
export function readSceneOperationPayload(
	reader: ShapeReader,
	kind: string,
	raw: unknown
): SceneOperationPayload | null {
	switch (kind) {
		case 'create-form':
			return readCreateFormPayload(reader, raw);
		case 'set-form-size':
			return readSetFormSizePayload(reader, raw);
		case 'place-object':
			return readPlaceObjectPayload(reader, raw);
		case 'move-horizontal':
			return readSupportMovePayload(reader, raw, 'move-horizontal');
		case 'set-yaw':
			return readSetYawPayload(reader, raw);
		case 'place-on-floor':
			return readPlaceOnFloorPayload(reader, raw);
		case 'resize-on-floor':
			return readResizePayload(reader, raw);
		case 'duplicate-one':
			return readDuplicatePayload(reader, raw);
		case 'delete-one': {
			const record = reader.object(raw, '$.payload', ['entityId']);
			if (record === null) return null;
			const entityId = reader.opaqueId(record.entityId, '$.payload.entityId');
			return entityId === null ? null : { kind: 'delete-one', entityId };
		}
		default:
			reader.problem('$.kind', 'unsupported-operation', `No Scene operation kind "${kind}" is registered`);
			return null;
	}
}

function readCreateFormPayload(reader: ShapeReader, raw: unknown): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, [
		'plane',
		'outline',
		'extent',
		'position',
		'yaw',
		'materialId',
		'name',
		'supportChoice'
	]);
	if (record === null) return null;
	const plane = reader.tag(record.plane, `${path}.plane`, ['plan', 'elevation']);
	const extent = reader.number(record.extent, `${path}.extent`);
	const position = reader.vector3(record.position, `${path}.position`);
	const yaw = reader.number(record.yaw, `${path}.yaw`);
	const materialId = reader.string(record.materialId, `${path}.materialId`);
	const name = reader.string(record.name, `${path}.name`);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	let outline: { u: number; v: number; smooth: boolean }[] | null = null;
	if (!Array.isArray(record.outline)) {
		reader.problem(`${path}.outline`, 'not-an-array', `${path}.outline must be an array`);
	} else {
		const parsed: { u: number; v: number; smooth: boolean }[] = [];
		let valid = true;
		for (const [index, entry] of record.outline.entries()) {
			const anchorPath = `${path}.outline[${index}]`;
			const anchor = reader.object(entry, anchorPath, ['u', 'v', 'smooth']);
			if (anchor === null) {
				valid = false;
				break;
			}
			const u = reader.number(anchor.u, `${anchorPath}.u`);
			const v = reader.number(anchor.v, `${anchorPath}.v`);
			const smooth = reader.boolean(anchor.smooth, `${anchorPath}.smooth`);
			if (u === null || v === null || smooth === null) {
				valid = false;
				break;
			}
			parsed.push({ u, v, smooth });
		}
		if (valid) outline = parsed;
	}
	if (
		plane === null ||
		extent === null ||
		position === null ||
		yaw === null ||
		materialId === null ||
		name === null ||
		choice === undefined ||
		outline === null
	) {
		return null;
	}
	return {
		kind: 'create-form',
		plane: plane as SceneFormPlane,
		outline,
		extent,
		position,
		yaw,
		materialId: materialId as MaterialId,
		name,
		...(choice.choice === undefined ? {} : { choice: choice.choice })
	};
}

function readSetFormSizePayload(reader: ShapeReader, raw: unknown): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['entityId', 'scale', 'supportChoice']);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const scale = reader.vector3(record.scale, `${path}.scale`);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	if (scale !== null) {
		for (const [index, value] of scale.entries()) {
			if (value <= 0) {
				reader.problem(`${path}.scale[${index}]`, 'out-of-range', `${path}.scale[${index}] must be greater than zero`);
			}
		}
	}
	if (entityId === null || scale === null || choice === undefined) return null;
	return {
		kind: 'set-form-size',
		entityId,
		scale,
		...(choice.choice === undefined ? {} : { choice: choice.choice })
	};
}

function readPlaceObjectPayload(reader: ShapeReader, raw: unknown): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, [
		'definitionKey',
		'metadataContentId',
		'worldXZ',
		'yaw',
		'frame',
		'frameReference',
		'supportChoice',
		'modelResource'
	]);
	if (record === null) return null;
	const definitionKey = reader.opaqueId(record.definitionKey, `${path}.definitionKey`);
	const metadataContentId = reader.opaqueId(record.metadataContentId, `${path}.metadataContentId`);
	const worldXZ = readPoint(reader, record.worldXZ, `${path}.worldXZ`);
	const yaw = reader.number(record.yaw, `${path}.yaw`);
	const frame = readFrame(reader, record.frame, `${path}.frame`);
	const frameReference = readFrameReference(reader, record.frameReference, `${path}.frameReference`, frame);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	const modelResource =
		record.modelResource === undefined
			? null
			: readCreatorModelResourcePayload(reader, record.modelResource, `${path}.modelResource`);
	if (
		definitionKey === null ||
		metadataContentId === null ||
		worldXZ === null ||
		yaw === null ||
		frame === null ||
		!frameReference.ok ||
		choice === undefined ||
		(record.modelResource !== undefined && modelResource === null)
	) {
		return null;
	}
	return {
		kind: 'place-object',
		definitionKey,
		metadataContentId,
		worldXZ,
		yaw,
		frame,
		frameReference: frameReference.value,
		...(choice.choice === undefined ? {} : { choice: choice.choice }),
		...(modelResource === null ? {} : { modelResource })
	};
}

/**
 * Read the optional first-placement resource introduction.
 *
 * Every field is required and finite; the planner re-validates the pin against
 * the approved model rules before installing anything, so this reader only
 * proves the captured payload is shaped like a resource at all.
 */
function readCreatorModelResourcePayload(
	reader: ShapeReader,
	raw: unknown,
	path: string
): ({ readonly id: string } & CreatorModelResourcePayload) | null {
	const record = reader.object(raw, path, ['id', 'derivative', 'source', 'recipe', 'reportDigest', 'placement']);
	if (record === null) return null;
	const id = reader.opaqueId(record.id, `${path}.id`);
	const derivative = reader.object(record.derivative, `${path}.derivative`, ['hash', 'mime', 'size', 'locator']);
	const source = reader.object(record.source, `${path}.source`, ['manifestHash', 'size', 'fileCount']);
	const recipe = reader.object(record.recipe, `${path}.recipe`, ['id', 'version']);
	const reportDigest = reader.opaqueId(record.reportDigest, `${path}.reportDigest`);
	const placement = reader.object(record.placement, `${path}.placement`, [
		'metresPerSourceUnit',
		'pivot',
		'footprint',
		'contactMinY'
	]);
	if (
		id === null ||
		derivative === null ||
		source === null ||
		recipe === null ||
		reportDigest === null ||
		placement === null
	) {
		return null;
	}
	const hash = reader.opaqueId(derivative.hash, `${path}.derivative.hash`);
	const mime = reader.string(derivative.mime, `${path}.derivative.mime`);
	const size = reader.integerAtLeast(derivative.size, `${path}.derivative.size`, 1);
	const locator = reader.string(derivative.locator, `${path}.derivative.locator`);
	const manifestHash = reader.opaqueId(source.manifestHash, `${path}.source.manifestHash`);
	const sourceSize = reader.integerAtLeast(source.size, `${path}.source.size`, 0);
	const fileCount = reader.integerAtLeast(source.fileCount, `${path}.source.fileCount`, 1);
	const recipeId = reader.string(recipe.id, `${path}.recipe.id`);
	const recipeVersion = reader.integerAtLeast(recipe.version, `${path}.recipe.version`, 1);
	const metresPerSourceUnit = reader.numberAtLeast(placement.metresPerSourceUnit, `${path}.placement.metresPerSourceUnit`, 0, true);
	const pivot = reader.vector3(placement.pivot, `${path}.placement.pivot`);
	const footprint = reader.object(placement.footprint, `${path}.placement.footprint`, ['width', 'depth']);
	const contactMinY = reader.number(placement.contactMinY, `${path}.placement.contactMinY`);
	if (
		hash === null ||
		mime === null ||
		size === null ||
		locator === null ||
		manifestHash === null ||
		sourceSize === null ||
		fileCount === null ||
		recipeId === null ||
		recipeVersion === null ||
		metresPerSourceUnit === null ||
		pivot === null ||
		footprint === null ||
		contactMinY === null
	) {
		return null;
	}
	const width = reader.numberAtLeast(footprint.width, `${path}.placement.footprint.width`, 0, true);
	const depth = reader.numberAtLeast(footprint.depth, `${path}.placement.footprint.depth`, 0, true);
	if (width === null || depth === null) return null;
	return {
		id,
		derivative: { hash, mime, size, locator },
		source: { manifestHash, size: sourceSize, fileCount },
		recipe: { id: recipeId, version: recipeVersion },
		reportDigest,
		placement: {
			metresPerSourceUnit,
			pivot: [pivot[0], pivot[1], pivot[2]],
			footprint: { width, depth },
			contactMinY
		}
	};
}

function readSupportMovePayload(
	reader: ShapeReader,
	raw: unknown,
	kind: 'move-horizontal'
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, [
		'entityId',
		'worldXZ',
		'frame',
		'frameReference',
		'contactMinY',
		'supportChoice'
	]);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const worldXZ = readPoint(reader, record.worldXZ, `${path}.worldXZ`);
	const frame = readFrame(reader, record.frame, `${path}.frame`);
	const frameReference = readFrameReference(reader, record.frameReference, `${path}.frameReference`, frame);
	const contactMinY = reader.number(record.contactMinY, `${path}.contactMinY`);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	if (
		entityId === null ||
		worldXZ === null ||
		frame === null ||
		!frameReference.ok ||
		contactMinY === null ||
		choice === undefined
	) {
		return null;
	}
	return {
		kind,
		entityId,
		worldXZ,
		frame,
		frameReference: frameReference.value,
		contactMinY,
		...(choice.choice === undefined ? {} : { choice: choice.choice })
	};
}

function readSetYawPayload(reader: ShapeReader, raw: unknown): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['entityId', 'yaw', 'frame', 'frameReference']);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const yaw = reader.number(record.yaw, `${path}.yaw`);
	const frame = readFrame(reader, record.frame, `${path}.frame`);
	const frameReference = readFrameReference(reader, record.frameReference, `${path}.frameReference`, frame);
	if (entityId === null || yaw === null || frame === null || !frameReference.ok) return null;
	return { kind: 'set-yaw', entityId, yaw, frame, frameReference: frameReference.value };
}

function readPlaceOnFloorPayload(reader: ShapeReader, raw: unknown): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, [
		'entityId',
		'worldXZ',
		'frame',
		'frameReference',
		'contactMinY',
		'yaw',
		'supportChoice'
	]);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const worldXZ = readPoint(reader, record.worldXZ, `${path}.worldXZ`);
	const frame = readFrame(reader, record.frame, `${path}.frame`);
	const frameReference = readFrameReference(reader, record.frameReference, `${path}.frameReference`, frame);
	const contactMinY = reader.number(record.contactMinY, `${path}.contactMinY`);
	const yaw = record.yaw === undefined ? undefined : reader.number(record.yaw, `${path}.yaw`);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	if (
		entityId === null ||
		worldXZ === null ||
		frame === null ||
		!frameReference.ok ||
		contactMinY === null ||
		yaw === null ||
		choice === undefined
	) {
		return null;
	}
	return {
		kind: 'place-on-floor',
		entityId,
		worldXZ,
		frame,
		frameReference: frameReference.value,
		contactMinY,
		...(yaw === undefined ? {} : { yaw }),
		...(choice.choice === undefined ? {} : { choice: choice.choice })
	};
}

function readResizePayload(reader: ShapeReader, raw: unknown): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['entityId', 'scale', 'contactMinY', 'supportChoice']);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const scale = reader.numberAtLeast(record.scale, `${path}.scale`, 0, true);
	const contactMinY = reader.number(record.contactMinY, `${path}.contactMinY`);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	if (entityId === null || scale === null || contactMinY === null || choice === undefined) return null;
	return {
		kind: 'resize-on-floor',
		entityId,
		scale,
		contactMinY,
		...(choice.choice === undefined ? {} : { choice: choice.choice })
	};
}

function readDuplicatePayload(reader: ShapeReader, raw: unknown): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['entityId', 'contactMinY', 'supportChoice']);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const contactMinY = reader.number(record.contactMinY, `${path}.contactMinY`);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	if (entityId === null || contactMinY === null || choice === undefined) return null;
	return {
		kind: 'duplicate-one',
		entityId,
		contactMinY,
		...(choice.choice === undefined ? {} : { choice: choice.choice })
	};
}

/** The operation's existing subject, or an explicit absence for creation. */
export type SceneOperationSubject =
	| { readonly kind: 'none' }
	| { readonly kind: 'entity'; readonly entityId: string };

/**
 * Read the operation's target: `none` for creation, exactly one Scene entity
 * reference otherwise. The reference must be exact for this snapshot's content,
 * at the canonical Scene location, and name the payload's entity.
 */
export function readSceneOperationSubject(input: {
	readonly reader: ShapeReader;
	readonly kind: SceneOperationKind;
	readonly targets: readonly SemanticReference[];
	readonly payload: SceneOperationPayload;
	readonly sourceContentId: string;
}): SceneOperationSubject | null {
	const { reader, kind, targets, payload, sourceContentId } = input;
	if (kind === 'place-object' || kind === 'create-form') {
		if (targets.length !== 0) {
			reader.problem(
				'$.targets',
				'invalid-target',
				`${kind} addresses no existing subject; its entity id is a captured allocation`
			);
			return null;
		}
		return { kind: 'none' };
	}
	if (targets.length !== 1) {
		reader.problem(
			'$.targets',
			'invalid-target',
			`${kind} addresses exactly one Scene entity; received ${targets.length} targets`
		);
		return null;
	}
	if (payload.kind === 'place-object' || payload.kind === 'create-form') return null;
	const target = targets[0]!;
	const entityId = payload.entityId;
	const problem = sceneEntityTargetProblem(target, entityId, sourceContentId);
	if (problem !== null) {
		reader.problem('$.targets[0]', problem.code, problem.message);
		return null;
	}
	return { kind: 'entity', entityId };
}

/** The one creation id a place/duplicate intent must carry, or `none`. */
export function readSceneOperationAllocation(input: {
	readonly reader: ShapeReader;
	readonly kind: SceneOperationKind;
	readonly allocations: readonly CapturedIdAllocation[];
	readonly scene: SceneDocument;
}): { readonly kind: 'none' } | { readonly kind: 'created'; readonly entityId: string } | null {
	const { reader, kind, allocations, scene } = input;
	if (kind !== 'place-object' && kind !== 'create-form' && kind !== 'duplicate-one') {
		if (allocations.length !== 0) {
			reader.problem(
				'$.allocatedIds',
				'unexpected-allocation',
				`${kind} creates no id, so its intent must not carry an allocation`
			);
			return null;
		}
		return { kind: 'none' };
	}
	if (allocations.length !== 1) {
		reader.problem(
			'$.allocatedIds',
			'missing-allocation',
			`${kind} needs exactly one captured scene-entity id; received ${allocations.length}`
		);
		return null;
	}
	const allocation = allocations[0]!;
	if (allocation.kind !== 'scene-entity') {
		reader.problem(
			'$.allocatedIds[0].kind',
			'unsupported-allocation',
			`${kind} allocates a scene-entity id, not "${allocation.kind}"`
		);
		return null;
	}
	if (scene.entities.some((entity) => entity.id === allocation.id)) {
		reader.problem(
			'$.allocatedIds[0].id',
			'duplicate-entity-id',
			`Captured id "${allocation.id}" is already used by the accepted source; it is never renamed`
		);
		return null;
	}
	return { kind: 'created', entityId: allocation.id };
}

function sceneEntityTargetProblem(
	target: SemanticReference,
	entityId: string,
	sourceContentId: string
): ShapeIssue | null {
	if (target.domain !== 'scene') {
		return {
			path: '$.targets[0].domain',
			code: 'invalid-target',
			message: `Scene operations address Scene subjects, not "${target.domain}"`
		};
	}
	if (target.subject.kind !== 'entity') {
		return {
			path: '$.targets[0].subject.kind',
			code: 'invalid-target',
			message: `Scene operations address entity subjects, not "${target.subject.kind}"`
		};
	}
	if (target.subject.id !== entityId) {
		return {
			path: '$.targets[0].subject.id',
			code: 'invalid-target',
			message: `The target names "${target.subject.id}" and the payload names "${entityId}"`
		};
	}
	if (target.revision.kind !== 'exact' || target.revision.contentRevision !== sourceContentId) {
		return {
			path: '$.targets[0].revision',
			code: 'stale-revision',
			message: 'The target must be exact for this snapshot\'s content revision'
		};
	}
	if (target.instancePath.length !== 0) {
		return {
			path: '$.targets[0].instancePath',
			code: 'invalid-target',
			message: 'A root Scene entity is addressed with an empty instance path'
		};
	}
	if (target.location.kind !== 'project-root') {
		return {
			path: '$.targets[0].location',
			code: 'invalid-target',
			message: 'A current-format Scene entity lives at the project root'
		};
	}
	if (target.componentId !== null || target.capabilityId !== null) {
		return {
			path: '$.targets[0]',
			code: 'invalid-target',
			message: 'A Scene entity target names no component or capability'
		};
	}
	return null;
}

function readPoint(reader: ShapeReader, input: unknown, path: string): LayoutVec2 | null {
	if (!Array.isArray(input) || input.length !== 2) {
		reader.problem(path, 'invalid-point', `${path} must be a two-number world X/Z point`);
		return null;
	}
	const x = reader.number(input[0], `${path}[0]`);
	const z = reader.number(input[1], `${path}[1]`);
	return x === null || z === null ? null : [x, z];
}

function readFrame(reader: ShapeReader, input: unknown, path: string): LocalInputFrame | null {
	const record = reader.object(input, path, ['origin', 'yaw']);
	if (record === null) return null;
	const origin = reader.vector3(record.origin, `${path}.origin`);
	const yaw = reader.number(record.yaw, `${path}.yaw`);
	if (origin === null || yaw === null) return null;
	return { origin: origin as Vec3, yaw };
}

/**
 * Validate one captured `FrameReference@1` against the conversion that came with
 * it.
 *
 * `project-world` is the identity conversion and needs no owner data, so a
 * non-identity transform behind it refuses (`frame-mismatch`). An `owner-frame`
 * names a frame only its owner can place: resolving it needs that owner's
 * `FrameResolver`, and a pure planner is given none. A structurally valid
 * owner-qualified reference therefore refuses (`unsupported-frame`) instead of
 * accepting a caller-supplied origin and yaw as if the owner had produced them.
 * No frame is invented from a Room, its centroid or its containment.
 */
function readFrameReference(
	reader: ShapeReader,
	input: unknown,
	path: string,
	frame: LocalInputFrame | null
): { readonly ok: true; readonly value: FrameReference } | { readonly ok: false } {
	const validated = validateFrameReference(input);
	if (!validated.success) {
		for (const issue of validated.issues) {
			reader.problem(`${path}${issue.path.slice(1)}`, issue.code, issue.message);
		}
		return { ok: false };
	}
	if (frame === null) return { ok: false };
	if (validated.value.kind === 'owner-frame') {
		reader.problem(
			path,
			'unsupported-frame',
			`Frame "${validated.value.frameId}" is owner-qualified by "${validated.value.owner}"; its placement is only usable through that owner's frame resolver, and this reader admits none, so the supplied conversion is not verified`
		);
		return { ok: false };
	}
	if (frame.yaw !== 0 || frame.origin.some((value) => value !== 0)) {
		reader.problem(
			path,
			'frame-mismatch',
			'a project-world frame reference must carry the identity conversion (zero origin and yaw)'
		);
		return { ok: false };
	}
	return { ok: true, value: validated.value };
}

function readSupportChoice(
	reader: ShapeReader,
	input: unknown,
	path: string
): { readonly choice?: SceneSupportChoice } | undefined {
	if (input === undefined) return {};
	const record = reader.object(input, path, ['kind', 'orderKey', 'elevation', 'generationId']);
	if (record === null) return undefined;
	const kind = reader.tag(record.kind, `${path}.kind`, ['order-key', 'elevation']);
	const generationId = reader.opaqueId(record.generationId, `${path}.generationId`);
	if (kind === null || generationId === null) return undefined;
	if (kind === 'order-key') {
		const orderKey = reader.opaqueId(record.orderKey, `${path}.orderKey`);
		if (record.elevation !== undefined) {
			reader.problem(`${path}.elevation`, 'unknown-key', `${path}.elevation belongs to an elevation choice`);
		}
		return orderKey === null ? undefined : { choice: { kind: 'order-key', orderKey, generationId } };
	}
	const elevation = reader.number(record.elevation, `${path}.elevation`);
	if (record.orderKey !== undefined) {
		reader.problem(`${path}.orderKey`, 'unknown-key', `${path}.orderKey belongs to an order-key choice`);
	}
	return elevation === null ? undefined : { choice: { kind: 'elevation', elevation, generationId } };
}
