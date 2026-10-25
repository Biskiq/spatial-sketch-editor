/**
 * T1.P01.S04 — the existing-Layout precision operation set.
 *
 * One `DomainPlanner` per writable fact, each delegating to a **retained**
 * Layout planner (`layout-core`). Nothing here hand-mutates geometry: the
 * planner's own candidate gates validate the document, reconcile Rooms and
 * maintain the identity ledger, so an accepted candidate is a real
 * current-format Layout rather than a shape that merely resembles one.
 *
 * Writable facts (and nothing else):
 *
 * | Operation | Kind | Retained planner |
 * | --- | --- | --- |
 * | Wall height | `layout-wall-height` | `planExactWallHeight` |
 * | Wall thickness | `layout-wall-thickness` | `planExactWallThickness` |
 * | Wall length (fixed endpoint) | `layout-wall-length` | `planExactWallLength` |
 * | Wall angle (fixed endpoint) | `layout-wall-angle` | `planExactWallAngle` |
 * | Rigid Wall translation | `layout-wall-move` | `planRigidWallMove` |
 * | Opening offset/width/height/sill | `layout-opening-measure` | `planUpdateWallFirstOpening` |
 * | Wall/Opening name | `layout-entity-name` | `planWallMetadataUpdate` / `planOpeningMetadataUpdate` |
 * | Place → Layout plinth | `layout-plinth-place` | `planCommitLayoutObjectPresetWithId` |
 *
 * Explicitly absent: independent arch rise, an authored Wall role (format 6
 * derives it from Room boundary membership), profile conversion, Floor storey
 * height and Layout-object rename. Those are read-only facts and the Instrument
 * explains them as unavailable rather than exposing a disabled control that
 * looks writable.
 */

import {
	createLayoutCompileSession,
	deriveLayoutWallRole,
	layoutIdCaptureInput,
	layoutWorkingLevelInput,
	nextLayoutPresetObjectId,
	planCommitLayoutObjectPresetWithId,
	readLayoutIdCapture,
	readLayoutWorkingLevel,
	planExactWallAngle,
	planExactWallHeight,
	planExactWallLength,
	planExactWallThickness,
	planOpeningMetadataUpdate,
	planRigidWallMove,
	planUpdateWallFirstOpening,
	planWallMetadataUpdate,
	withLayoutCompileSession,
	type FixedWallEndpoint,
	type LayoutDocumentWallFirst,
	type LayoutIdCapture,
	type LayoutVec2,
	type PrecisionPlan
} from '@portfolio/layout-core';
import type {
	AuthoringIntent,
	DomainPlanner,
	PlannerOutcome,
	PlannerRequest,
	PreparedCandidate,
	SemanticReference
} from '@portfolio/project-model';
import {
	replaceUnitData,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

export const LAYOUT_WALL_HEIGHT_KIND = 'layout-wall-height';
export const LAYOUT_WALL_THICKNESS_KIND = 'layout-wall-thickness';
export const LAYOUT_OPENING_MEASURE_KIND = 'layout-opening-measure';
export const LAYOUT_ENTITY_NAME_KIND = 'layout-entity-name';
export const LAYOUT_PLINTH_PLACE_KIND = 'layout-plinth-place';
/** T1.P01.S05 — exact straight-Wall length, keeping one explicit endpoint fixed. */
export const LAYOUT_WALL_LENGTH_KIND = 'layout-wall-length';
/**
 * T1.P01.S05 — exact straight-Wall angle. The payload carries **radians**, the
 * canonical `atan2(z, x)` unit `planExactWallAngle` solves in; the instrument
 * converts the degrees it displays, so no intent ever carries a display unit.
 */
export const LAYOUT_WALL_ANGLE_KIND = 'layout-wall-angle';
/** T1.P01.S05 — rigid straight-Wall translation: both endpoints move by one delta. */
export const LAYOUT_WALL_MOVE_KIND = 'layout-wall-move';

/** The one opening field each edit owns; the UI never sends a combined patch. */
export type LayoutOpeningField = 'offset' | 'width' | 'height' | 'sillHeight';

export type LayoutSubjectKind = 'wall' | 'opening' | 'object';

export type LayoutSubject = {
	readonly kind: LayoutSubjectKind;
	readonly id: string;
};

export type LayoutFact = { readonly label: string; readonly value: string };

const PAYLOAD_KEYS: Readonly<Record<string, readonly string[]>> = {
	[LAYOUT_WALL_HEIGHT_KIND]: ['wallId', 'height'],
	[LAYOUT_WALL_THICKNESS_KIND]: ['wallId', 'thickness'],
	[LAYOUT_WALL_LENGTH_KIND]: ['wallId', 'length', 'fixed'],
	[LAYOUT_WALL_ANGLE_KIND]: ['wallId', 'angleRadians', 'fixed'],
	[LAYOUT_WALL_MOVE_KIND]: ['wallId', 'deltaX', 'deltaZ'],
	[LAYOUT_OPENING_MEASURE_KIND]: ['openingId', 'field', 'value'],
	[LAYOUT_ENTITY_NAME_KIND]: ['subjectKind', 'subjectId', 'name'],
	[LAYOUT_PLINTH_PLACE_KIND]: ['point', 'floorElevation', 'objectId']
};

/**
 * A payload with exactly the keys its operation owns. An unknown key is refused
 * rather than ignored: a UI that starts sending `keepBottom` must be told the
 * operation does not support it, not silently have it dropped.
 */
function readPayload(
	kind: string,
	payload: unknown
): { readonly value: Record<string, unknown> } | { readonly message: string } {
	if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
		return { message: 'The operation payload must be an object.' };
	}
	const record = payload as Record<string, unknown>;
	const expected = PAYLOAD_KEYS[kind]!;
	const unknown = Object.keys(record).filter((key) => !expected.includes(key));
	if (unknown.length > 0) {
		return { message: `The ${kind} payload cannot carry ${unknown.join(', ')}.` };
	}
	for (const key of expected) {
		if (!(key in record)) return { message: `The ${kind} payload is missing "${key}".` };
	}
	return { value: record };
}

function finitePositive(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function finiteNonNegative(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function opaqueId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

function isFixedEndpoint(value: unknown): value is FixedWallEndpoint {
	return value === 'start' || value === 'end';
}

function finiteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

export function isLayoutOpeningField(value: unknown): value is LayoutOpeningField {
	return value === 'offset' || value === 'width' || value === 'height' || value === 'sillHeight';
}

/** An exact F.1 reference to one Layout subject in the current level. */
export function layoutReference(
	snapshot: PlannerRequest<ProjectEnvelope>['snapshot'],
	subject: LayoutSubject,
	contentRevision: string,
	/** The working level, supplied by the caller as an explicit input. */
	levelId: string
): SemanticReference {
	return {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision },
		subject: { kind: subject.kind, id: subject.id },
		instancePath: [],
		location: {
			kind: 'layout-location',
			levelId,
			structureInstancePath: []
		},
		componentId: null,
		capabilityId: null
	};
}

function rejected(code: string, message: string): PlannerOutcome<ProjectEnvelope> {
	return { kind: 'rejected', code, message, diagnostics: [] };
}

/**
 * One process-local compile store for this adapter's planners.
 *
 * Every layout planner compiles the candidate it is about to accept. A precision
 * drag runs one plan per pointer sample, and each sample moves one Junction, one
 * Wall thickness or one Opening — so the session lets a sample reuse every entity
 * the previous sample did not move (T1.P02.S06 D.3 / H1).
 *
 * Sharing it cannot change a plan: a reused entity is one whose authored inputs
 * are unchanged, which is the retention proof the canonical compiler checks per
 * entity. It is a cache, not decision state, and it is pruned to the document it
 * last compiled.
 *
 * Lifetime, stated rather than implied: this store lives as long as the module,
 * so after a document is closed it still holds that document's units (samples,
 * sections, query records — bounded by one document, never accumulating across
 * documents, because each compile prunes what the new document does not
 * contain). It is not part of any undo history or authored state, and no
 * consumer can observe it. The Stage host does not use this store at all; it
 * owns one for its own lifetime, released with the host's closure.
 */
const plannerCompileSession = createLayoutCompileSession();

function layoutPlanner(
	kind: string,
	prepare: (request: PlannerRequest<ProjectEnvelope>) => PlannerOutcome<ProjectEnvelope>
): DomainPlanner<ProjectEnvelope> {
	return {
		id: `layout.${kind}`,
		kind,
		admission: Object.freeze({ domain: 'layout', compound: false, units: false, resources: false }),
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare: (request) => withLayoutCompileSession(plannerCompileSession, () => prepare(request))
	};
}

/**
 * The intent must address exactly the subject its payload edits.
 *
 * Without this check a stale instrument (selection moved, payload not rebuilt)
 * could edit one Wall while its correspondence claims another survived, and the
 * accepted selection would requalify the wrong entry.
 */
function addressedSubject(
	request: PlannerRequest<ProjectEnvelope>,
	kind: LayoutSubjectKind,
	id: string
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
	if (request.intent.targets.length !== 1) {
		return { ok: false, message: 'A Layout precision intent addresses exactly one subject.' };
	}
	const target = request.intent.targets[0]!;
	if (target.domain !== 'layout' || target.subject.kind !== kind || target.subject.id !== id) {
		return {
			ok: false,
			message: `The intent must address the ${kind} "${id}" it edits.`
		};
	}
	return { ok: true };
}

/**
 * T1.P02.S01 §1 — the working level is an explicit captured input, never a field
 * read out of the document during planning. A missing or stale level fails closed.
 */
function capturedWorkingLevel(
	request: PlannerRequest<ProjectEnvelope>
): { readonly levelId: string } | PlannerOutcome<ProjectEnvelope> {
	const levelId = readLayoutWorkingLevel(request.capturedInputs);
	if (levelId === null) {
		return rejected('invalid-value', 'The intent must capture its working Layout level before evaluation.');
	}
	if (levelId !== request.snapshot.domain.source.units.layout.data.floor.id) {
		return rejected(
			'stale-level',
			`The captured working level '${levelId}' is not the accepted Layout floor.`
		);
	}
	return { levelId };
}

function prepared(
	request: PlannerRequest<ProjectEnvelope>,
	operationKind: string,
	subject: LayoutSubject,
	document: LayoutDocumentWallFirst,
	fields: readonly string[],
	options: { readonly created?: boolean; readonly id?: string } = {}
): PlannerOutcome<ProjectEnvelope> {
	const level = capturedWorkingLevel(request);
	if ('kind' in level) return level;
	const levelId = level.levelId;
	const reference = layoutReference(
		request.snapshot,
		subject,
		request.snapshot.domain.source.units.layout.header.contentRevision,
		levelId
	);
	const candidate: PreparedCandidate<ProjectEnvelope> = {
		operationId: request.intent.operationId,
		sourceKind: UNIT_SOURCE_KIND,
		sourceVersion: UNIT_SOURCE_VERSION,
		source: replaceUnitData(request.snapshot.domain.source, 'layout', document),
		changes: [{ kind: operationKind, subjectIds: [options.id ?? subject.id], fields: [...fields] }],
		correspondence: [
			options.created
				? { relation: 'created', before: null, after: reference }
				: { relation: 'preserved', before: reference, after: reference }
		],
		diagnostics: []
	};
	return { kind: 'prepared', candidate };
}

function wallHeightPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_HEIGHT_KIND, (request) => {
		const payload = readPayload(LAYOUT_WALL_HEIGHT_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId, height } = payload.value;
		if (!opaqueId(wallId) || !finitePositive(height)) {
			return rejected('invalid-value', 'A Wall height needs one wall id and one finite positive height in meters.');
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planExactWallHeight(request.snapshot.domain.source.units.layout.data, wallId, height);
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, plan.rejection.message);
		}
		return prepared(request, 'layout-wall-height', { kind: 'wall', id: wallId }, plan.document, [
			'height'
		]);
	});
}

function wallThicknessPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_THICKNESS_KIND, (request) => {
		const payload = readPayload(LAYOUT_WALL_THICKNESS_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId, thickness } = payload.value;
		if (!opaqueId(wallId) || !finitePositive(thickness)) {
			return rejected('invalid-value', 'A Wall thickness needs one wall id and one finite positive thickness in meters.');
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planExactWallThickness(
			request.snapshot.domain.source.units.layout.data,
			wallId,
			thickness
		);
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, plan.rejection.message);
		}
		return prepared(
			request,
			'layout-wall-thickness',
			{ kind: 'wall', id: wallId },
			plan.document,
			['thickness']
		);
	});
}

/**
 * Exact straight-Wall length with one explicit fixed endpoint.
 *
 * The endpoint is part of the intent, not inferred from whichever end happens to
 * be nearer the pointer: `start` keeps the canonical start Junction and moves the
 * end, `end` keeps the end and moves the start. The retained planner owns the
 * solve, the shared-Junction consequences and every identity/Opening/Room gate.
 */
function wallLengthPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_LENGTH_KIND, (request) => {
		const payload = readPayload(LAYOUT_WALL_LENGTH_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId, length, fixed } = payload.value;
		if (!opaqueId(wallId) || !finitePositive(length) || !isFixedEndpoint(fixed)) {
			return rejected(
				'invalid-value',
				'A Wall length needs one wall id, one finite positive length in meters and a start or end fixed endpoint.'
			);
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planExactWallLength(request.snapshot.domain.source.units.layout.data, {
			wallId,
			length,
			fixedEndpoint: fixed
		});
		if (plan.kind === 'rejected') return rejected(plan.rejection.code, plan.rejection.message);
		return prepared(request, 'layout-wall-length', { kind: 'wall', id: wallId }, plan.document, [
			'length'
		]);
	});
}

/** Exact straight-Wall angle, in canonical `atan2(z, x)` radians, one fixed endpoint. */
function wallAnglePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_ANGLE_KIND, (request) => {
		const payload = readPayload(LAYOUT_WALL_ANGLE_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId, angleRadians, fixed } = payload.value;
		if (!opaqueId(wallId) || !finiteNumber(angleRadians) || !isFixedEndpoint(fixed)) {
			return rejected(
				'invalid-value',
				'A Wall angle needs one wall id, one finite angle in radians and a start or end fixed endpoint.'
			);
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planExactWallAngle(request.snapshot.domain.source.units.layout.data, {
			wallId,
			angle: angleRadians,
			fixedEndpoint: fixed
		});
		if (plan.kind === 'rejected') return rejected(plan.rejection.code, plan.rejection.message);
		return prepared(request, 'layout-wall-angle', { kind: 'wall', id: wallId }, plan.document, [
			'angle'
		]);
	});
}

/** Rigid straight-Wall translation: one delta, both endpoints, no shape change. */
function wallMovePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_MOVE_KIND, (request) => {
		const payload = readPayload(LAYOUT_WALL_MOVE_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId, deltaX, deltaZ } = payload.value;
		if (!opaqueId(wallId) || !finiteNumber(deltaX) || !finiteNumber(deltaZ)) {
			return rejected(
				'invalid-value',
				'A rigid Wall move needs one wall id and finite X and Z deltas in meters.'
			);
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planRigidWallMove(request.snapshot.domain.source.units.layout.data, wallId, [deltaX, deltaZ]);
		if (plan.kind === 'rejected') return rejected(plan.rejection.code, plan.rejection.message);
		return prepared(request, 'layout-wall-move', { kind: 'wall', id: wallId }, plan.document, [
			'position'
		]);
	});
}

function openingMeasurePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_OPENING_MEASURE_KIND, (request) => {
		const payload = readPayload(LAYOUT_OPENING_MEASURE_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { openingId, field, value } = payload.value;
		if (!opaqueId(openingId) || !isLayoutOpeningField(field)) {
			return rejected(
				'invalid-value',
				'An Opening measure needs one opening id and one of offset, width, height or sill height.'
			);
		}
		// Offset and sill are non-negative; width and height must be positive. The
		// retained planner enforces the same rule, so this only names the field earlier.
		const valid = field === 'offset' || field === 'sillHeight' ? finiteNonNegative(value) : finitePositive(value);
		if (!valid) {
			return rejected(
				'invalid-value',
				`An Opening ${field} must be a finite ${field === 'offset' || field === 'sillHeight' ? 'non-negative' : 'positive'} number of meters.`
			);
		}
		const addressed = addressedSubject(request, 'opening', openingId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planUpdateWallFirstOpening(
			request.snapshot.domain.source.units.layout.data,
			openingId,
			{ [field]: value } as Parameters<typeof planUpdateWallFirstOpening>[2]
		);
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, plan.rejection.message);
		}
		return prepared(
			request,
			'layout-opening-measure',
			{ kind: 'opening', id: openingId },
			plan.document,
			[field]
		);
	});
}

function entityNamePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_ENTITY_NAME_KIND, (request) => {
		const payload = readPayload(LAYOUT_ENTITY_NAME_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { subjectKind, subjectId, name } = payload.value;
		if (
			(subjectKind !== 'wall' && subjectKind !== 'opening') ||
			!opaqueId(subjectId) ||
			typeof name !== 'string'
		) {
			return rejected(
				'invalid-value',
				'A Layout name edit needs one Wall or Opening id and one string name.'
			);
		}
		const addressed = addressedSubject(request, subjectKind, subjectId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const document = request.snapshot.domain.source.units.layout.data;
		const plan =
			subjectKind === 'wall'
				? planWallMetadataUpdate(document, subjectId, { name })
				: planOpeningMetadataUpdate(document, subjectId, { name });
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, plan.rejection.message);
		}
		return prepared(
			request,
			'layout-entity-name',
			{ kind: subjectKind, id: subjectId },
			plan.document,
			['name']
		);
	});
}

function plinthPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_PLINTH_PLACE_KIND, (request) => {
		const payload = readPayload(LAYOUT_PLINTH_PLACE_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { point, floorElevation, objectId } = payload.value;
		if (!opaqueId(objectId)) {
			return rejected('invalid-value', 'A plinth placement needs the captured object id.');
		}
		if (
			!Array.isArray(point) ||
			point.length !== 2 ||
			!point.every((value) => typeof value === 'number' && Number.isFinite(value))
		) {
			return rejected('invalid-value', 'A plinth placement needs two finite working-plane X/Z meters.');
		}
		if (typeof floorElevation !== 'number' || !Number.isFinite(floorElevation)) {
			return rejected('invalid-value', 'A plinth placement needs a finite floor datum.');
		}
		// The captured datum must still be the mounted level's datum: placing at a
		// stale elevation would create an object floating at the previous floor.
		const datumMeters = request.snapshot.domain.source.units.layout.data.floor.elevation;
		if (floorElevation !== datumMeters) {
			return rejected(
				'stale-datum',
				`The captured floor datum ${floorElevation} m no longer matches the mounted level datum ${datumMeters} m.`
			);
		}
		if (request.intent.targets.length !== 0) {
			return rejected('invalid-value', 'A plinth placement addresses no existing subject.');
		}
		// T1.P02.S01 §1 — identity is captured, not allocated: the nonce input
		// derives the object id, and the intent's captured allocation must agree.
		const capture = readLayoutIdCapture(request.capturedInputs);
		if (capture === null) {
			return rejected(
				'invalid-value',
				'A plinth placement must capture its identity nonce before evaluation.'
			);
		}
		const expectedObjectId = nextLayoutPresetObjectId(
			request.snapshot.domain.source.units.layout.data,
			capture
		);
		if (expectedObjectId !== objectId) {
			return rejected(
				'invalid-value',
				`The plinth payload names '${objectId}', but this operation's nonce derives '${expectedObjectId}'.`
			);
		}
		if (
			!request.intent.allocatedIds.some(
				(allocation) => allocation.kind === 'layout-object' && allocation.id === objectId
			)
		) {
			return rejected(
				'invalid-value',
				'A plinth placement must capture its new layout-object id before evaluation.'
			);
		}
		const level = capturedWorkingLevel(request);
		if ('kind' in level) return level;
		const plan = planCommitLayoutObjectPresetWithId(
			request.snapshot.domain.source.units.layout.data,
			'plinth',
			point as LayoutVec2,
			floorElevation,
			capture,
			objectId,
			level.levelId
		);
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, plan.rejection.message);
		}
		return prepared(
			request,
			'layout-plinth-place',
			{ kind: 'object', id: objectId },
			plan.document,
			['objects'],
			{ created: true, id: objectId }
		);
	});
}

/** The five production Layout planners, one operation kind each. */
export function createLayoutPlanners(): readonly DomainPlanner<ProjectEnvelope>[] {
	return [
		wallHeightPlanner(),
		wallThicknessPlanner(),
		wallLengthPlanner(),
		wallAnglePlanner(),
		wallMovePlanner(),
		openingMeasurePlanner(),
		entityNamePlanner(),
		plinthPlanner()
	];
}

/** The subject a selection names, or `null` for a non-Layout / read-only selection. */
export function layoutSubjectOf(
	selection: { readonly sourceKind: string; readonly sourceId: string } | null
): LayoutSubject | null {
	if (selection === null) return null;
	if (selection.sourceKind === 'wall') return { kind: 'wall', id: selection.sourceId };
	if (selection.sourceKind === 'opening') return { kind: 'opening', id: selection.sourceId };
	if (selection.sourceKind === 'object') return { kind: 'object', id: selection.sourceId };
	return null;
}

/**
 * The canonical frame of a **straight** Wall, read from the authored document.
 *
 * `null` for a curved Wall: exact length and exact angle are straight-Wall
 * solves (the retained planners refuse a curve with `curved_wall_unsupported`),
 * so this slice offers no such handle for one and its S04 scalar edits remain.
 * Direction is canonical start → end; the angle is the same `atan2(z, x)` the
 * planner solves in.
 */
export type WallFrame = {
	readonly wallId: string;
	readonly start: LayoutVec2;
	readonly end: LayoutVec2;
	readonly direction: LayoutVec2;
	readonly length: number;
	readonly angleRadians: number;
};

export function wallFrame(document: LayoutDocumentWallFirst, wallId: string): WallFrame | null {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (wall === undefined || wall.centerline.kind !== 'line') return null;
	const start = document.junctions.find((junction) => junction.id === wall.startJunctionId)?.point;
	const end = document.junctions.find((junction) => junction.id === wall.endJunctionId)?.point;
	if (start === undefined || end === undefined) return null;
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const length = Math.hypot(dx, dz);
	if (!(length > 0)) return null;
	return {
		wallId,
		start: [start[0], start[1]],
		end: [end[0], end[1]],
		direction: [dx / length, dz / length],
		length,
		angleRadians: Math.atan2(dz, dx)
	};
}

/**
 * The explicit parameter one pointer position names, given the endpoint that
 * **stays fixed**. This is the inverse the pointer path uses; it never builds a
 * document and never decides validity — the canonical planner does both.
 *
 * Dragging the start keeps the end fixed (`fixed: 'end'`), so each helper takes
 * the fixed endpoint explicitly rather than assuming which end is held.
 */
export function wallLengthFromPointer(
	frame: WallFrame,
	fixed: FixedWallEndpoint,
	point: readonly [number, number]
): number {
	const fixedPoint = fixed === 'start' ? frame.start : frame.end;
	// Signed distance **from the fixed endpoint toward the moving one**. The
	// planner always places the moved endpoint on the side of the fixed point the
	// Wall already extends to, so a pointer on the other side is not a length: a
	// magnitude here would mirror the preview across the fixed endpoint (and
	// install a Wall the pointer never named). Negative means the pointer crossed
	// the fixed endpoint; the adapter refuses it instead of clamping.
	const along =
		(point[0] - fixedPoint[0]) * frame.direction[0] + (point[1] - fixedPoint[1]) * frame.direction[1];
	return fixed === 'start' ? along : -along;
}

export function wallAngleFromPointer(
	fixedPoint: readonly [number, number],
	point: readonly [number, number],
	fixed: FixedWallEndpoint
): number {
	// The planner's angle is always the Wall's canonical **start → end**
	// direction. With `start` fixed, the pointer names that direction directly.
	// With `end` fixed it names the opposite ray, so the vector is reversed here —
	// otherwise dragging the start would rotate the Wall 180° away from the hand.
	const x = fixed === 'start' ? point[0] - fixedPoint[0] : fixedPoint[0] - point[0];
	const z = fixed === 'start' ? point[1] - fixedPoint[1] : fixedPoint[1] - point[1];
	return Math.atan2(z, x);
}

export type WallManipulationRequest =
	| { readonly kind: 'length'; readonly length: number }
	| { readonly kind: 'angle'; readonly angleRadians: number }
	| { readonly kind: 'move'; readonly delta: LayoutVec2 };

/** One Wall reshaped by a shared-Junction edit, at its candidate endpoint. */
export type WallNeighbourPreview = {
	readonly wallId: string;
	/** The point the edited junction moved this neighbour to. */
	readonly point: LayoutVec2;
};

export type WallManipulationPlan =
	| {
			readonly kind: 'planned';
			readonly wall: WallFrame;
			/** Neighbours the canonical candidate reshaped, never a second solve. */
			readonly neighbours: readonly WallNeighbourPreview[];
	  }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string };

/** The authored point of one Junction, or `null` when the document has none. */
function junctionPoint(document: LayoutDocumentWallFirst, junctionId: string): LayoutVec2 | null {
	const junction = document.junctions.find((entry) => entry.id === junctionId);
	return junction === undefined ? null : [junction.point[0], junction.point[1]];
}

/**
 * The junction points a request moves, named from the baseline's own identity.
 *
 * A length/angle edit moves the endpoint opposite the fixed one; a rigid
 * translation moves **both**. The planner applies exactly that set, so this
 * names the reach without re-deriving connectivity or a second motion.
 */
function movedJunctionIds(
	baseline: LayoutDocumentWallFirst,
	wallId: string,
	request: WallManipulationRequest,
	fixed: FixedWallEndpoint
): readonly string[] {
	const wall = baseline.walls.find((entry) => entry.id === wallId);
	if (wall === undefined) return [];
	if (request.kind === 'move') return [wall.startJunctionId, wall.endJunctionId];
	return [fixed === 'start' ? wall.endJunctionId : wall.startJunctionId];
}

/**
 * The neighbours a canonical candidate actually reshaped.
 *
 * Every Wall incident to a moved junction is re-derived by the retained
 * planner. This read reports those Walls and the candidate point the junction
 * moved them to, so the overlay can show the reach instead of claiming the
 * planner's validation is a preview. It reads Junction points rather than
 * Wall frames, so a curved neighbour — which has no straight frame — is still
 * named at the point the edit moved it to.
 */
function wallNeighbourPreviews(
	baseline: LayoutDocumentWallFirst,
	candidate: LayoutDocumentWallFirst,
	wallId: string,
	moved: readonly string[]
): readonly WallNeighbourPreview[] {
	const previews: WallNeighbourPreview[] = [];
	for (const neighbour of candidate.walls) {
		if (neighbour.id === wallId) continue;
		for (const junctionId of moved) {
			if (neighbour.startJunctionId !== junctionId && neighbour.endJunctionId !== junctionId) continue;
			const after = junctionPoint(candidate, junctionId);
			const before = junctionPoint(baseline, junctionId);
			if (after === null || before === null) continue;
			if (Math.hypot(after[0] - before[0], after[1] - before[1]) <= 1e-12) continue;
			previews.push({ wallId: neighbour.id, point: after });
			break;
		}
	}
	return previews;
}

/**
 * The one preview/commit solve for a Wall gesture or typed value.
 *
 * It calls the retained planner on the immutable baseline and returns the
 * candidate's own frame. Preview and commit therefore cannot disagree: both are
 * the planner's output, never a second interpolation of the pointer.
 */
export function planWallManipulation(
	baseline: LayoutDocumentWallFirst,
	wallId: string,
	request: WallManipulationRequest,
	fixed: FixedWallEndpoint
): WallManipulationPlan {
	let plan: PrecisionPlan;
	if (request.kind === 'length') {
		plan = planExactWallLength(baseline, { wallId, length: request.length, fixedEndpoint: fixed });
	} else if (request.kind === 'angle') {
		plan = planExactWallAngle(baseline, { wallId, angle: request.angleRadians, fixedEndpoint: fixed });
	} else {
		plan = planRigidWallMove(baseline, wallId, request.delta);
	}
	if (plan.kind === 'rejected') {
		return { kind: 'refused', code: plan.rejection.code, message: plan.rejection.message };
	}
	const wall = wallFrame(plan.document, wallId);
	if (wall === null) {
		return {
			kind: 'refused',
			code: 'unsupported-geometry',
			message: 'The candidate Wall has no straight frame to preview.'
		};
	}
	return {
		kind: 'planned',
		wall,
		neighbours: wallNeighbourPreviews(
			baseline,
			plan.document,
			wallId,
			movedJunctionIds(baseline, wallId, request, fixed)
		)
	};
}

/**
 * One F.4 intent for a Wall manipulation, with captured identity and revision.
 *
 * The reference names the level the accepted source owns, exactly as the S04
 * precision instrument does, so the target cannot name another level.
 */
export function wallManipulationIntent(input: {
	readonly request: WallManipulationRequest;
	readonly wallId: string;
	readonly fixed: FixedWallEndpoint;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	const reference: SemanticReference = {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: input.contentRevision },
		subject: { kind: 'wall', id: input.wallId },
		instancePath: [],
		location: { kind: 'layout-location', levelId: input.levelId, structureInstancePath: [] },
		componentId: null,
		capabilityId: null
	};
	const base = {
		operationId: input.operationId,
		projectId: input.projectId,
		revisionId: input.revisionId,
		contentRevision: input.contentRevision,
		levelId: input.levelId,
		targets: [reference]
	};
	// One literal per operation: a shared conditional object would widen its
	// unselected keys to `undefined`, which is not an F.4 JSON value.
	if (input.request.kind === 'length') {
		return buildLayoutIntent({
			...base,
			kind: LAYOUT_WALL_LENGTH_KIND,
			payload: { wallId: input.wallId, length: input.request.length, fixed: input.fixed }
		});
	}
	if (input.request.kind === 'angle') {
		return buildLayoutIntent({
			...base,
			kind: LAYOUT_WALL_ANGLE_KIND,
			payload: { wallId: input.wallId, angleRadians: input.request.angleRadians, fixed: input.fixed }
		});
	}
	return buildLayoutIntent({
		...base,
		kind: LAYOUT_WALL_MOVE_KIND,
		payload: {
			wallId: input.wallId,
			deltaX: input.request.delta[0],
			deltaZ: input.request.delta[1]
		}
	});
}

/**
 * Full typed values, never rounded display values. JavaScript's shortest
 * round-trip number formatting is the exact value that will be saved.
 */
export function formatMeters(value: number): string {
	return `${value} m`;
}

/** Every settled writable/read-only fact the Dimensions instrument shows. */
export function layoutFacts(
	document: LayoutDocumentWallFirst,
	subject: LayoutSubject
): readonly LayoutFact[] {
	if (subject.kind === 'wall') {
		const wall = document.walls.find((candidate) => candidate.id === subject.id);
		if (wall === undefined) return [];
		return [
			{ label: 'Kind', value: 'Wall' },
			{ label: 'Name', value: wall.name ?? '(unnamed)' },
			{ label: 'Height', value: formatMeters(wall.height) },
			{ label: 'Thickness', value: formatMeters(wall.thickness) },
			// Format 6 — the role is derived from Room boundary membership, shown
			// read-only because it follows geometry rather than a control.
			{ label: 'Role', value: `${deriveLayoutWallRole(document, wall.id) ?? 'free-standing'} (derived)` }
		];
	}
	if (subject.kind === 'opening') {
		const opening = document.openings.find((candidate) => candidate.id === subject.id);
		if (opening === undefined) return [];
		return [
			{ label: 'Kind', value: opening.kind === 'door' ? 'Door' : 'Window' },
			{ label: 'Name', value: opening.name ?? '(unnamed)' },
			{ label: 'Offset', value: formatMeters(opening.offset) },
			{ label: 'Width', value: formatMeters(opening.width) },
			{ label: 'Height', value: formatMeters(opening.height) },
			{ label: 'Sill', value: formatMeters(opening.sillHeight) }
		];
	}
	const object = document.objects.find((candidate) => candidate.id === subject.id);
	if (object === undefined) return [];
	return [
		{ label: 'Kind', value: object.kind },
		{ label: 'Name', value: '(read-only identity)' },
		{ label: 'Position', value: object.position.map(formatMeters).join(' · ') },
		{ label: 'Dimensions', value: object.dimensions.map(formatMeters).join(' · ') }
	];
}

/**
 * The facts a Dimensions instrument offers for editing, in fixed semantic order.
 * A fact is writable only when a production planner owns it; everything else is
 * reported read-only with the reason, never as an inert control.
 */
export type LayoutWritableFact =
	| { readonly id: string; readonly label: string; readonly value: number; readonly unit: 'm' }
	| { readonly id: string; readonly label: string; readonly value: number; readonly unit: 'deg' }
	| { readonly id: string; readonly label: string; readonly value: string; readonly unit: 'text' };

export function layoutWritableFacts(
	document: LayoutDocumentWallFirst,
	subject: LayoutSubject
): readonly LayoutWritableFact[] {
	if (subject.kind === 'wall') {
		const wall = document.walls.find((candidate) => candidate.id === subject.id);
		if (wall === undefined) return [];
		const frame = wallFrame(document, subject.id);
		// A curved Wall keeps every S04 scalar edit and gains no length/angle/rigid
		// field: those are straight-Wall solves and offering them would be an
		// invitation the canonical planner has to refuse.
		if (frame === null) {
			return [
				{ id: 'name', label: 'Name', value: wall.name ?? '', unit: 'text' },
				{ id: 'height', label: 'Height', value: wall.height, unit: 'm' },
				{ id: 'thickness', label: 'Thickness', value: wall.thickness, unit: 'm' }
			];
		}
		return [
			{ id: 'name', label: 'Name', value: wall.name ?? '', unit: 'text' },
			{ id: 'height', label: 'Height', value: wall.height, unit: 'm' },
			{ id: 'thickness', label: 'Thickness', value: wall.thickness, unit: 'm' },
			{ id: 'length', label: 'Length', value: frame.length, unit: 'm' },
			{ id: 'angle', label: 'Angle', value: (frame.angleRadians * 180) / Math.PI, unit: 'deg' },
			{ id: 'deltaX', label: 'Move ΔX', value: 0, unit: 'm' },
			{ id: 'deltaZ', label: 'Move ΔZ', value: 0, unit: 'm' }
		];
	}
	if (subject.kind === 'opening') {
		const opening = document.openings.find((candidate) => candidate.id === subject.id);
		if (opening === undefined) return [];
		return [
			{ id: 'name', label: 'Name', value: opening.name ?? '', unit: 'text' },
			{ id: 'offset', label: 'Offset', value: opening.offset, unit: 'm' },
			{ id: 'width', label: 'Width', value: opening.width, unit: 'm' },
			{ id: 'height', label: 'Height', value: opening.height, unit: 'm' },
			{ id: 'sillHeight', label: 'Sill', value: opening.sillHeight, unit: 'm' }
		];
	}
	return [];
}

/**
 * Parse exact numeric entry. TD-2: blank, non-finite and malformed input never
 * become zero and never become a `:invalid` state that a later blur can commit.
 */
export type MeasureParse =
	| { readonly ok: true; readonly value: number }
	| { readonly ok: false; readonly code: 'blank' | 'non-finite' | 'malformed'; readonly reason: string };

export function parseMeasureInput(text: string): MeasureParse {
	const trimmed = text.trim();
	if (trimmed.length === 0) {
		return { ok: false, code: 'blank', reason: 'Enter a value; an empty field is not zero.' };
	}
	const value = Number(trimmed);
	if (!Number.isFinite(value)) {
		if (/^[-+]?(infinity|nan)$/i.test(trimmed) || /^[-+]?\d+(\.\d+)?e[-+]?\d+$/i.test(trimmed)) {
			return { ok: false, code: 'non-finite', reason: 'The value must be finite.' };
		}
		return { ok: false, code: 'malformed', reason: 'Enter a decimal number of meters.' };
	}
	return { ok: true, value };
}

export type PlacementParse =
	| { readonly ok: true; readonly point: LayoutVec2 }
	| { readonly ok: false; readonly code: 'blank' | 'non-finite' | 'malformed'; readonly reason: string };

export function parsePlacementXZ(xText: string, zText: string): PlacementParse {
	const x = parseMeasureInput(xText);
	if (!x.ok) return x;
	const z = parseMeasureInput(zText);
	if (!z.ok) return z;
	return { ok: true, point: [x.value, z.value] };
}

/**
 * Build the F.4 intent for one writable fact, with captured identity and revision.
 *
 * The working level is always an explicit captured input (T1.P02.S01 §1); an
 * operation that mints Layout identity additionally captures its nonce here, so
 * the planner derives the exact ids this intent recorded. Neither value is read
 * out of the document by planning.
 */
export function buildLayoutIntent(input: {
	readonly kind: string;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
	readonly targets: readonly SemanticReference[];
	readonly payload: AuthoringIntent['payload'];
	readonly capture?: LayoutIdCapture;
	readonly allocatedIds?: AuthoringIntent['allocatedIds'];
}): AuthoringIntent {
	return {
		version: 1,
		kind: input.kind,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [...input.targets],
		payload: input.payload,
		capturedInputs: [
			layoutWorkingLevelInput(input.levelId),
			...(input.capture ? [layoutIdCaptureInput(input.capture)] : [])
		],
		allocatedIds: [...(input.allocatedIds ?? [])]
	};
}
