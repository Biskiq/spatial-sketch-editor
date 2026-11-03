/**
 * R217.S08 — Scene object marks: the domain half of the S07 mark contract.
 *
 * A selected Scene object — a catalogue model, a primitive or a drawn native
 * form — publishes one mark vocabulary: a floor **move** track, a vertical
 * **turn** ring, the W·D·H **chip** and the **lift** knob it reveals. Sizing is
 * the one capability that differs by kind: a model or primitive scales
 * uniformly from the chip, and a form reveals per-axis rays (`form-size.ts`). This module owns every fact those
 * marks name — the bounds they are drawn at, the planner a release submits and
 * the F4 intent that carries the captured value. The Stage host admits the
 * descriptors, projects them at its calibrated screen size and hit-tests them;
 * no second gizmo system exists here.
 *
 * The Card's Position, Yaw and Size writers call the same `planSceneObjectMark`
 * dispatch, so typing a value and dragging to it produce the same candidate and
 * the same refusal words.
 */
import { angleDeltaLabel, planarDeltaLabel, signed } from '$lib/authoring/stage/gesture-values';
import type {
	AuthoringIntent,
	SceneEntity,
	SceneFormEntity,
	ScenePrimitiveEntity,
	Vec3
} from '@portfolio/project-model';
import {
	planPlaceOnFloor,
	planResizeOnFloor,
	planSetLift,
	planSetYaw,
	type SceneOperationContext,
	type SceneOperationResult
} from '@portfolio/project-model/scene-planning';
import type { StageHandleDescriptor } from '$lib/authoring/stage/stage-handles';
import { sceneEntityReference, type SceneCandidate } from './placement';
import {
	formSizeMeasurement,
	formSizeRayDescriptors,
	formSizeRayIds,
	formWorldPoint,
	isSceneFormRayMarkId,
	type FormMarkScreenHeight,
	type FormSizeMeasurement,
	type SceneFormRayMarkId
} from './shape/form-size';

/** The stable ids a Scene object publishes. The host owns disclosure state. */
export const SCENE_OBJECT_MARK = {
	move: 'scene-object-move',
	turn: 'scene-object-turn',
	scalePoint: 'scene-object-scale-point',
	size: 'scene-object-size',
	lift: 'scene-object-lift'
} as const;

/**
 * Where the turn ring's one arrow sits in the object's own frame. It is carried
 * by the live yaw, so the arrow travels with the turn (review pass 2 §6).
 */
export const SCENE_TURN_ARROW_PHASE = (3 * Math.PI) / 4;

/** The world direction of the turn arrow for one yaw (Scene yaw turns +X toward −Z). */
export function sceneTurnArrowPhase(yaw: number): Vec3 {
	const angle = yaw + SCENE_TURN_ARROW_PHASE;
	return [Math.cos(angle), 0, -Math.sin(angle)];
}

export type SceneObjectMarkId = (typeof SCENE_OBJECT_MARK)[keyof typeof SCENE_OBJECT_MARK];

/**
 * Editing gestures. The scale point is the W·D·H chip: a click discloses, and a
 * drag from it is the uniform Size gesture (it claims under its own id).
 */
export type SceneObjectEditMarkId =
	| typeof SCENE_OBJECT_MARK.move
	| typeof SCENE_OBJECT_MARK.turn
	| typeof SCENE_OBJECT_MARK.size
	| typeof SCENE_OBJECT_MARK.lift
	| SceneFormRayMarkId;

/**
 * Every Card field a Scene object can hold, in reading order. A model or
 * primitive holds `size`; a form holds `width`, `height` and `depth` instead.
 */
export const SCENE_OBJECT_CARD_FIELD_IDS = [
	'position-x',
	'position-z',
	'yaw',
	'size',
	'width',
	'height',
	'depth',
	'elevation'
] as const;

/** The size fields one kind holds: the only Card difference between kinds. */
export function sceneObjectSizeFieldIds(kind: SceneEntity['kind']): readonly SceneObjectCardFieldId[] {
	return kind === 'form' ? ['width', 'height', 'depth'] : ['size'];
}

export type SceneObjectCardFieldId = (typeof SCENE_OBJECT_CARD_FIELD_IDS)[number];

export type SceneObjectBounds = {
	readonly min: Vec3;
	readonly max: Vec3;
};

export type SceneObjectFootprint = {
	readonly width: number;
	readonly depth: number;
};

/** The live values a gesture or refusal shows on its mark. */
export type SceneObjectMarkLive = {
	readonly markId: SceneObjectMarkId | SceneFormRayMarkId;
	readonly position: Vec3;
	readonly yaw: number;
	readonly scale: number;
	readonly refusal: string | null;
};

/** The height of an object's base above the support beneath it (0 = resting). */
export type SceneObjectLift = {
	readonly lift: number;
	/** The support elevation the lift is measured from. */
	readonly supportY: number;
};

const FRAME = { origin: [0, 0, 0] as Vec3, yaw: 0 };
const PROJECT_WORLD = { version: 1, kind: 'project-world' } as const;

export function isSceneObjectEditMarkId(id: string | undefined): id is SceneObjectEditMarkId {
	return (
		id === SCENE_OBJECT_MARK.move ||
		id === SCENE_OBJECT_MARK.turn ||
		id === SCENE_OBJECT_MARK.size ||
		id === SCENE_OBJECT_MARK.lift ||
		isSceneFormRayMarkId(id)
	);
}

export type SceneObjectEntity = Extract<
	SceneEntity,
	{ kind: 'primitive' } | { kind: 'model' } | { kind: 'form' }
>;

/**
 * A Scene object is a primitive, a catalogue model or a drawn native form,
 * wherever it came from: one Card and one mark set. Lights are not objects.
 */
export function isSceneObjectEntity(entity: SceneEntity | null | undefined): entity is SceneObjectEntity {
	return entity?.kind === 'primitive' || entity?.kind === 'model' || entity?.kind === 'form';
}

/** The entity's uniform scale; an absent value is the identity. */
export function sceneObjectScale(entity: SceneEntity): number {
	return typeof entity.scale === 'number' && Number.isFinite(entity.scale) ? entity.scale : 1;
}

export function sceneYawDegrees(yaw: number): number {
	return (yaw * 180) / Math.PI;
}

export function sceneYawRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

/**
 * The axis-aligned bounds of one analytic primitive, at its own yaw and scale.
 *
 * A primitive has authored dimensions, so its bounds are a derivation rather
 * than a guess. A model has no authored extent here; its drawn bounds come from
 * the Scene pick source and are absent until its body is mounted.
 */
export function primitiveBounds(entity: ScenePrimitiveEntity): SceneObjectBounds {
	const scale = sceneObjectScale(entity);
	const yaw = entity.rotation[1];
	const cos = Math.cos(yaw);
	const sin = Math.sin(yaw);
	const [x, y, z] = entity.position;
	const half = (values: readonly [number, number, number]): SceneObjectBounds => {
		const [hx, hy, hz] = values;
		const halfX = Math.abs(hx * cos) + Math.abs(hz * sin);
		const halfZ = Math.abs(hx * sin) + Math.abs(hz * cos);
		return {
			min: [x - halfX, y - hy, z - halfZ],
			max: [x + halfX, y + hy, z + halfZ]
		};
	};
	switch (entity.primitive) {
		case 'box':
			return half([
				(entity.dimensions.width / 2) * scale,
				(entity.dimensions.height / 2) * scale,
				(entity.dimensions.depth / 2) * scale
			]);
		case 'plane':
			// A vertical plane has no floor footprint; the never-picked shape still
			// needs finite bounds so it cannot project a NaN mark.
			return half([
				(entity.dimensions.width / 2) * scale,
				(entity.dimensions.height / 2) * scale,
				0.005
			]);
		case 'cylinder':
			return half([
				entity.dimensions.radius * scale,
				(entity.dimensions.height / 2) * scale,
				entity.dimensions.radius * scale
			]);
		case 'sphere':
			return half([
				entity.dimensions.radius * scale,
				entity.dimensions.radius * scale,
				entity.dimensions.radius * scale
			]);
	}
}

/** The footprint a move track and turn ring are drawn around. */
export function boundsFootprint(bounds: SceneObjectBounds): SceneObjectFootprint {
	return {
		width: Math.max(0, bounds.max[0] - bounds.min[0]),
		depth: Math.max(0, bounds.max[2] - bounds.min[2])
	};
}

function normalized(value: Vec3): Vec3 | null {
	const length = Math.hypot(value[0], value[1], value[2]);
	if (!Number.isFinite(length) || length === 0) return null;
	return [value[0] / length, value[1] / length, value[2] / length];
}

/** The base corner the size ray starts from and the diagonal it follows. */
export function sizeRayGeometry(bounds: SceneObjectBounds): {
	readonly anchor: Vec3;
	readonly axis: Vec3;
	readonly extent: number;
} | null {
	const diagonal: Vec3 = [
		bounds.min[0] - bounds.max[0],
		bounds.max[1] - bounds.min[1],
		bounds.min[2] - bounds.max[2]
	];
	const axis = normalized(diagonal);
	if (axis === null) return null;
	return {
		anchor: [bounds.max[0], bounds.min[1], bounds.max[2]],
		axis,
		extent: Math.hypot(diagonal[0], diagonal[1], diagonal[2])
	};
}

/**
 * Publish the four descriptors for one selected object.
 *
 * Descriptor order is the domain's hit order. Scale handles come before Move
 * and Turn because the disclosure and inward ray overlap those marks on small
 * subjects. The ray follows its disclosure; `admitStageHandles` refuses a
 * disclosure that reveals nothing, so the size ray is withheld when the object
 * has no drawn bounds.
 */
/**
 * The accepted bounds carried to the gesture's live pose.
 *
 * Move, Turn and Size all draw their marks around the object, so a preview that
 * left the disclosure and ray at the accepted corner would detach them from the
 * body the creator is manipulating. A primitive is re-derived from its analytic
 * dimensions at the live pose; a model's drawn bounds are transformed by the
 * same translation, yaw delta and uniform scale about its base.
 */
export function liveSceneObjectBounds(
	entity: SceneObjectEntity,
	bounds: SceneObjectBounds | null,
	live: SceneObjectMarkLive | null
): SceneObjectBounds | null {
	if (bounds === null || live === null || entity.kind === 'form') return bounds;
	if (entity.kind === 'primitive') {
		return primitiveBounds({
			...entity,
			position: [...live.position] as Vec3,
			rotation: [entity.rotation[0], live.yaw, entity.rotation[2]],
			scale: live.scale
		});
	}
	const acceptedScale = sceneObjectScale(entity);
	const factor = acceptedScale > 0 ? live.scale / acceptedScale : 1;
	const yaw = live.yaw - entity.rotation[1];
	const cos = Math.cos(yaw);
	const sin = Math.sin(yaw);
	const pivot: Vec3 = [entity.position[0], bounds.min[1], entity.position[2]];
	const dx = live.position[0] - entity.position[0];
	const dy = live.position[1] - entity.position[1];
	const dz = live.position[2] - entity.position[2];
	let min: Vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
	let max: Vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
	for (const x of [bounds.min[0], bounds.max[0]]) {
		for (const y of [bounds.min[1], bounds.max[1]]) {
			for (const z of [bounds.min[2], bounds.max[2]]) {
				const ox = (x - pivot[0]) * factor;
				const oy = (y - pivot[1]) * factor;
				const oz = (z - pivot[2]) * factor;
				const wx = pivot[0] + ox * cos + oz * sin + dx;
				const wy = pivot[1] + oy + dy;
				const wz = pivot[2] - ox * sin + oz * cos + dz;
				min = [Math.min(min[0], wx), Math.min(min[1], wy), Math.min(min[2], wz)];
				max = [Math.max(max[0], wx), Math.max(max[1], wy), Math.max(max[2], wz)];
			}
		}
	}
	return { min, max };
}

/** A form's per-axis sizing inputs; absent for a model or primitive. */
export type SceneObjectFormMarks = {
	/** The live measurement (the candidate's during a size drag). */
	readonly measurement: FormSizeMeasurement;
	/** The accepted measurement a size delta is read against. */
	readonly baseline: FormSizeMeasurement;
	/** The live per-axis form, so rays follow a size preview. */
	readonly form: SceneFormEntity['form'];
	readonly screenHeight?: FormMarkScreenHeight | null;
};

export function sceneObjectMarkDescriptors(input: {
	readonly entity: SceneEntity;
	readonly reading?: 'plan' | '3d';
	readonly contactMinY: number;
	readonly bounds: SceneObjectBounds | null;
	readonly footprint: SceneObjectFootprint | null;
	readonly live?: SceneObjectMarkLive | null;
	/** The accepted lift, when the support beneath resolves; `null` withholds the lift knob. */
	readonly lift?: SceneObjectLift | null;
	/** Required for a form; ignored for every other kind. */
	readonly form?: SceneObjectFormMarks | null;
}): readonly StageHandleDescriptor[] {
	const { entity } = input;
	if (!isSceneObjectEntity(entity)) return [];
	const formMarks = entity.kind === 'form' ? (input.form ?? null) : null;
	if (entity.kind === 'form' && formMarks === null) return [];
	const acceptedScale = sceneObjectScale(entity);
	const live = input.live ?? null;
	const scale = live?.scale ?? acceptedScale;
	const yaw = live?.yaw ?? entity.rotation[1];
	const position = live?.position ?? entity.position;
	const baseY = position[1] + scale * input.contactMinY;
	// A model with no admitted footprint has no honest mark extent; publishing a
	// stand-in metre would make the turn ring and move track lie about its body.
	if (input.footprint === null) return [];
	const footprint = input.footprint;
	const refusal = (id: string): string | null => (live?.markId === id ? live.refusal : null);
	const move: StageHandleDescriptor = {
		id: SCENE_OBJECT_MARK.move,
		kind: 'point',
		draw: { cross: true },
		role: 'edit',
		anchor: [position[0], baseY, position[2]],
		axis: [Math.cos(yaw), 0, -Math.sin(yaw)],
		extent: Math.max(0.2, footprint.width / 2),
		label: 'Move',
		fact: 'position',
		verb: 'Position',
		planner: 'place-on-floor',
		value: planarDeltaLabel(position[0] - entity.position[0], position[2] - entity.position[2]),
		refusal: refusal(SCENE_OBJECT_MARK.move)
	};
	// The ring is last: it is drawn at the shared 30 px calibration, so a ring
	// hit winning first would make the knobs inside it unreachable.
	const turn: StageHandleDescriptor = {
		id: SCENE_OBJECT_MARK.turn,
		kind: 'ring',
		role: 'edit',
		anchor: [position[0], baseY, position[2]],
		axis: [0, 1, 0],
		extent: Math.max(0.2, Math.max(footprint.width, footprint.depth) / 2),
		label: 'Turn',
		fact: 'yaw',
		verb: 'Yaw',
		planner: 'set-yaw',
		phase: sceneTurnArrowPhase(yaw),
		value: angleDeltaLabel(yaw, entity.rotation[1]),
		refusal: refusal(SCENE_OBJECT_MARK.turn)
	};
	// The lift knob is withheld in Plan (edge-on) and wherever no support lies
	// beneath. It is the bottom of the chip's stem; for a form the same stem
	// carries the Height knob at its top.
	const lifting = input.reading !== 'plan' && input.lift != null;
	const liftMark = (foot: Vec3, top: Vec3, height: number): StageHandleDescriptor => {
		const accepted = input.lift!;
		const liveLift = live === null ? accepted.lift : Math.max(0, baseY - accepted.supportY);
		return {
			// The stem's bottom knob: lift off the support, height kept.
			id: SCENE_OBJECT_MARK.lift,
			kind: 'ray',
			role: 'edit',
			draw: { ray: 8, glyph: 'lift-knob' },
			anchor: foot,
			axis: [0, 1, 0],
			extent: Math.max(0.2, height),
			stem: top,
			screen: { offset: [26, 0] },
			label: 'Lift',
			fact: 'lift',
			verb: 'Lift',
			planner: 'set-lift',
			disclosedBy: SCENE_OBJECT_MARK.scalePoint,
			value: `Δ ${signed(liveLift - accepted.lift)} m · base ${liveLift.toFixed(2)} m`,
			refusal: refusal(SCENE_OBJECT_MARK.lift)
		};
	};

	if (formMarks !== null && entity.kind === 'form') {
		// Per-axis sizing: the chip only discloses (a form refuses a uniform
		// scale), and reveals the rays of this reading plus the lift knob.
		const pose: SceneFormEntity = {
			...entity,
			position: [...position] as Vec3,
			rotation: [entity.rotation[0], yaw, entity.rotation[2]],
			form: formMarks.form
		};
		const bounds = formMarks.measurement.bounds;
		const rays = formSizeRayDescriptors({
			pose,
			reading: input.reading,
			measurement: formMarks.measurement,
			baseline: formMarks.baseline,
			disclosedBy: SCENE_OBJECT_MARK.scalePoint,
			refusal,
			screenHeight: formMarks.screenHeight
		});
		if (bounds === null || rays === null) return [];
		const chip: StageHandleDescriptor = {
			id: SCENE_OBJECT_MARK.scalePoint,
			kind: 'point',
			role: 'disclose',
			intent: 'resize',
			anchor: formWorldPoint(pose, bounds.max),
			label: 'Scale',
			reveals: [...formSizeRayIds(input.reading), ...(lifting ? [SCENE_OBJECT_MARK.lift] : [])]
		};
		return [
			chip,
			...rays,
			...(lifting
				? [
						liftMark(
							formWorldPoint(pose, [bounds.max[0], bounds.min[1], bounds.max[2]]),
							formWorldPoint(pose, bounds.max),
							bounds.max[1] - bounds.min[1]
						)
					]
				: []),
			move,
			turn
		];
	}

	const bounds = liveSceneObjectBounds(entity, input.bounds, live);
	// A model or primitive's chip both discloses the lift knob and, dragged,
	// scales uniformly; with nothing to reveal admission would withhold it.
	if (bounds === null || !lifting) return [move, turn];
	return [
		{
			// The W·D·H chip: click shows the lift knob, a drag scales uniformly.
			id: SCENE_OBJECT_MARK.scalePoint,
			kind: 'point',
			role: 'disclose',
			intent: 'resize',
			drags: true,
			anchor: [bounds.max[0], bounds.max[1], bounds.max[2]],
			label: 'Scale',
			value: `× ${(scale / acceptedScale).toFixed(2)}`,
			refusal: refusal(SCENE_OBJECT_MARK.size),
			reveals: [SCENE_OBJECT_MARK.lift]
		},
		liftMark(
			[bounds.max[0], bounds.min[1], bounds.max[2]],
			[bounds.max[0], bounds.max[1], bounds.max[2]],
			bounds.max[1] - bounds.min[1]
		),
		move,
		turn
	];
}

export type SceneObjectMarkPlanInput =
	| {
			readonly markId: typeof SCENE_OBJECT_MARK.move;
			readonly context: SceneOperationContext;
			readonly entityId: string;
			readonly contactMinY: number;
			readonly worldXZ: readonly [number, number];
	  }
	| {
			readonly markId: typeof SCENE_OBJECT_MARK.turn;
			readonly context: SceneOperationContext;
			readonly entityId: string;
			readonly yaw: number;
	  }
	| {
			readonly markId: typeof SCENE_OBJECT_MARK.size;
			readonly context: SceneOperationContext;
			readonly entityId: string;
			readonly contactMinY: number;
			readonly scale: number;
	  }
	| {
			readonly markId: typeof SCENE_OBJECT_MARK.lift;
			readonly context: SceneOperationContext;
			readonly entityId: string;
			readonly contactMinY: number;
			readonly lift: number;
	  };

/** One planner dispatch: a mark and the matching Card field both call this. */
export function planSceneObjectMark(input: SceneObjectMarkPlanInput): SceneOperationResult {
	switch (input.markId) {
		case SCENE_OBJECT_MARK.move:
			return planPlaceOnFloor({
				context: input.context,
				entityId: input.entityId,
				worldXZ: input.worldXZ,
				frame: FRAME,
				contactMinY: input.contactMinY
			});
		case SCENE_OBJECT_MARK.turn:
			return planSetYaw({
				context: input.context,
				entityId: input.entityId,
				yaw: input.yaw,
				frame: FRAME
			});
		case SCENE_OBJECT_MARK.size:
			return planResizeOnFloor({
				context: input.context,
				entityId: input.entityId,
				scale: input.scale,
				contactMinY: input.contactMinY
			});
		case SCENE_OBJECT_MARK.lift:
			return planSetLift({
				context: input.context,
				entityId: input.entityId,
				lift: input.lift,
				contactMinY: input.contactMinY
			});
	}
}

export type SceneObjectMarkIntentInput =
	| {
			readonly markId: typeof SCENE_OBJECT_MARK.move;
			readonly entityId: string;
			readonly contactMinY: number;
			readonly worldXZ: readonly [number, number];
	  }
	| {
			readonly markId: typeof SCENE_OBJECT_MARK.turn;
			readonly entityId: string;
			readonly yaw: number;
	  }
	| {
			readonly markId: typeof SCENE_OBJECT_MARK.size;
			readonly entityId: string;
			readonly contactMinY: number;
			readonly scale: number;
	  }
	| {
			readonly markId: typeof SCENE_OBJECT_MARK.lift;
			readonly entityId: string;
			readonly contactMinY: number;
			readonly lift: number;
	  };

/** The F4 intent one released mark captures at the live accepted revision. */
export function sceneObjectMarkIntent(
	input: SceneObjectMarkIntentInput & {
		readonly projectId: string;
		readonly revisionId: string;
		readonly sceneContentRevision: string;
		readonly operationId: string;
	}
): AuthoringIntent {
	const payload: AuthoringIntent['payload'] =
		input.markId === SCENE_OBJECT_MARK.move
			? {
					entityId: input.entityId,
					worldXZ: [input.worldXZ[0], input.worldXZ[1]],
					frame: FRAME,
					frameReference: PROJECT_WORLD,
					contactMinY: input.contactMinY
				}
			: input.markId === SCENE_OBJECT_MARK.turn
				? {
						entityId: input.entityId,
						yaw: input.yaw,
						frame: FRAME,
						frameReference: PROJECT_WORLD
					}
				: input.markId === SCENE_OBJECT_MARK.lift
					? {
							entityId: input.entityId,
							lift: input.lift,
							contactMinY: input.contactMinY
						}
					: {
							entityId: input.entityId,
							scale: input.scale,
							contactMinY: input.contactMinY
						};
	return {
		version: 1,
		kind:
			input.markId === SCENE_OBJECT_MARK.move
				? 'place-on-floor'
				: input.markId === SCENE_OBJECT_MARK.turn
					? 'set-yaw'
					: input.markId === SCENE_OBJECT_MARK.lift
						? 'set-lift'
						: 'resize-on-floor',
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [sceneEntityReference(input.entityId, input.sceneContentRevision)],
		payload,
		capturedInputs: [],
		allocatedIds: []
	};
}

export type SceneObjectCardField = {
	readonly id: SceneObjectCardFieldId;
	readonly label: string;
	readonly unit: 'm' | 'deg' | '';
	/** The accepted value the field shows, formatted for its unit. */
	readonly text: string;
	/** The planner's refusal for the current draft, or `null`. */
	readonly error: string | null;
};

/**
 * The Card's object field set, derived from the accepted entity.
 *
 * This is the one declaration of what the Card writes, so the field-set
 * equality against the mark vocabulary is a test of a value rather than two
 * independently maintained lists.
 */
export function sceneObjectCardFields(
	entity: SceneEntity,
	/** The accepted lift above the support beneath; `null` withholds Elevation. */
	lift: number | null = null
): readonly SceneObjectCardField[] {
	if (!isSceneObjectEntity(entity)) return [];
	const size: SceneObjectCardField[] =
		entity.kind === 'form'
			? formSizeMeasurement(entity).handles.map((handle) => ({
					id: (['width', 'height', 'depth'] as const)[handle.axis],
					label: handle.label,
					unit: 'm' as const,
					text: String(handle.dimension),
					error: null
				}))
			: [{ id: 'size', label: 'Size (uniform)', unit: '', text: String(sceneObjectScale(entity)), error: null }];
	return [
		{ id: 'position-x', label: 'X position', unit: 'm', text: String(entity.position[0]), error: null },
		{ id: 'position-z', label: 'Z position', unit: 'm', text: String(entity.position[2]), error: null },
		{ id: 'yaw', label: 'Yaw', unit: 'deg', text: String(sceneYawDegrees(entity.rotation[1])), error: null },
		...size,
		...(lift === null
			? []
			: [{ id: 'elevation' as const, label: 'Elevation', unit: 'm' as const, text: String(quantizeLift(lift)), error: null }])
	];
}

function quantizeLift(lift: number): number {
	return Math.round(lift * 1e6) / 1e6;
}

/** The mark fact a Card field writes, for field-set equality. */
export function cardFieldFact(id: SceneObjectCardFieldId): string {
	return id === 'position-x' || id === 'position-z'
		? 'position'
		: id === 'yaw'
			? 'yaw'
			: id === 'elevation'
				? 'lift'
				: id === 'width'
					? 'scale[0]'
					: id === 'height'
						? 'scale[1]'
						: id === 'depth'
							? 'scale[2]'
							: 'scale';
}

/**
 * The mark facts the object Card writes, each once: the Card's writer declares these
 * `fieldId`s, so the ordinary fact rows for them are not repeated beside the fields.
 */
export function sceneObjectCardFieldFacts(entity?: SceneEntity): readonly string[] {
	const ids =
		entity === undefined
			? SCENE_OBJECT_CARD_FIELD_IDS
			: SCENE_OBJECT_CARD_FIELD_IDS.filter(
					(id) => !['size', 'width', 'height', 'depth'].includes(id) || sceneObjectSizeFieldIds(entity.kind).includes(id)
				);
	return [...new Set(ids.map(cardFieldFact))];
}

/** A Scene candidate for one accepted planner result, or `null` if it refused. */
export function markCandidate(result: SceneOperationResult): SceneCandidate | null {
	if (result.kind === 'rejected') return null;
	const next = result.scene.entities.find((entity) => entity.id === result.entityId);
	if (next === undefined) return null;
	return {
		kind:
			result.operationKind === 'set-yaw'
				? 'yaw'
				: result.operationKind === 'resize-on-floor'
					? 'resize'
					: 'move',
		entityId: next.id,
		primitive: null,
		position: [...next.position] as Vec3,
		rotation: [...next.rotation] as Vec3,
		worldXZ: [next.position[0], next.position[2]],
		yaw: next.rotation[1],
		scale: sceneObjectScale(next),
		snappedStep: null,
		...(next.kind === 'form' ? { form: next.form } : {})
	};
}
