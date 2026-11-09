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
 * | Rigid Room-group translation | `layout-room-move` | `planWallFirstRoomMove` |
 * | Opening offset/width/height/sill | `layout-opening-measure` | `planUpdateWallFirstOpening` |
 * | Wall/Opening/Room name | `layout-entity-name` | `planWallMetadataUpdate` / `planOpeningMetadataUpdate` / `planRoomMetadataUpdate` |
 * | Place → Layout plinth | `layout-plinth-place` | `planCommitLayoutObjectPresetWithId` |
 *
 * Explicitly absent: independent arch rise, an authored Wall role (format 6
 * derives it from Room boundary membership), profile conversion, Floor storey
 * height and Layout-object rename. Those are read-only facts and the Instrument
 * explains them as unavailable rather than exposing a disabled control that
 * looks writable.
 */

import {
	materializeLayoutSourceForCapture,
	createLayoutCompileSession,
	deriveLayoutWallRole,
	layoutIdCaptureInput,
	layoutWorkingLevelInput,
	lookupIndexedJunction,
	lookupIndexedObject,
	lookupIndexedOpening,
	lookupIndexedWall,
	nextLayoutPresetObjectId,
	planBendWallCurveKnot,
	planCommitLayoutObjectPresetWithId,
	planConvertWallToLine,
	planDeleteWallCurveKnot,
	readLayoutIdCapture,
	readLayoutWorkingLevel,
	recordPreparedCowCandidate,
	planExactJunctionMove,
	planExactWallAngle,
	planExactWallHeight,
	planExactWallLength,
	planExactWallThickness,
	planOpeningMetadataUpdate,
	planRigidWallMove,
	planWallFirstRoomMove,
	planUpdateWallFirstOpening,
	planRoomMetadataUpdate,
	planWallMetadataUpdate,
	projectPointToWallCenterline,
	wallCenterlineSamples,
	withLayoutCompileSession,
	type FixedWallEndpoint,
	type LayoutDocumentWallFirst,
	type LayoutIdCapture,
	type LayoutVec2
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
	canonicalUnitJson,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { openingRefusalWords } from './refusals';

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
/**
 * T1 C1 — one grab on an open Wall body becomes one bend point and one reshape.
 * The payload carries the physical arc distance the press resolved and the
 * captured id of the bend point the write may insert, so preview and commit
 * address the same identity.
 */
export const LAYOUT_WALL_BEND_KIND = 'layout-wall-bend';
/** C1/D2 — the Card's two knot shape actions, through one planner each. */
export const LAYOUT_WALL_KNOT_DELETE_KIND = 'layout-wall-knot-delete';
export const LAYOUT_WALL_STRAIGHTEN_KIND = 'layout-wall-straighten';
/**
 * Review pass 3 — a Room moves rigidly in X/Z. The retained planner moves the
 * Room's connected group (Rooms sharing a Wall travel together) and refuses
 * with the canonical gates' words; Scene objects stay where they are.
 */
export const LAYOUT_ROOM_MOVE_KIND = 'layout-room-move';
/** R217.S15 — one shared Junction moves freely in X/Z; every incident Wall follows. */
export const LAYOUT_JUNCTION_MOVE_KIND = 'layout-junction-move';

/** The one opening field each edit owns; the UI never sends a combined patch. */
export type LayoutOpeningField = 'offset' | 'width' | 'height' | 'sillHeight';

export type LayoutSubjectKind = 'wall' | 'opening' | 'object';

export type LayoutSubject = {
	readonly kind: LayoutSubjectKind;
	readonly id: string;
};

/** A Room is addressed only by the name planner; it has no field instrument. */
export type LayoutRoomSubject = { readonly kind: 'room'; readonly id: string };

/**
 * One read-only Card fact for a Layout subject. `fieldId` names the field the fact shows;
 * the Card drops it when the contributed writer edits that field, so each value appears once.
 */
export type LayoutFact = { readonly label: string; readonly value: string; readonly fieldId: string };

const PAYLOAD_KEYS: Readonly<Record<string, readonly string[]>> = {
	[LAYOUT_WALL_HEIGHT_KIND]: ['wallId', 'height'],
	[LAYOUT_WALL_THICKNESS_KIND]: ['wallId', 'thickness'],
	[LAYOUT_WALL_LENGTH_KIND]: ['wallId', 'length', 'fixed'],
	[LAYOUT_WALL_ANGLE_KIND]: ['wallId', 'angleRadians', 'fixed'],
	[LAYOUT_WALL_MOVE_KIND]: ['wallId', 'deltaX', 'deltaZ'],
	[LAYOUT_WALL_BEND_KIND]: ['wallId', 'distance', 'x', 'z', 'knotId'],
	[LAYOUT_WALL_KNOT_DELETE_KIND]: ['wallId', 'knotId'],
	[LAYOUT_WALL_STRAIGHTEN_KIND]: ['wallId'],
	[LAYOUT_ROOM_MOVE_KIND]: ['roomId', 'deltaX', 'deltaZ'],
	[LAYOUT_JUNCTION_MOVE_KIND]: ['wallId', 'junctionId', 'x', 'z'],
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
	subject: LayoutSubject | LayoutRoomSubject,
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
 * Every layout planner compiles the candidate it is about to accept. Live scalar
 * and Opening edits also plan from the accepted baseline. The session reuses
 * entities whose authored inputs did not change (T1.P02.S06 D.3 / H1).
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

/**
 * One Layout planner over the adapter's shared compile session.
 *
 * Exported for the S02 drawing planners (chain commit, Wall delete), which are
 * registered by the same adapter and must run their candidates through the same
 * session, source kind and admission shape as every other Layout operation.
 */
export function layoutPlanner(
	kind: string,
	prepare: (request: PlannerRequest<ProjectEnvelope>) => PlannerOutcome<ProjectEnvelope>
): DomainPlanner<ProjectEnvelope> {
	return {
		id: `layout.${kind}`,
		kind,
		admission: Object.freeze({ domain: 'layout', compound: false, units: false, resources: false }),
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare: (request) =>
			withLayoutCompileSession(plannerCompileSession, () => {
				plannerCompileSession.seedFromCompiled(request.snapshot.domain.source.units.layout.data);
				return prepare(request);
			})
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
	kind: LayoutSubjectKind | 'room',
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

/**
 * The shared result construction: one prepared candidate, one change record, one
 * preserve/create correspondence and the prepared-Cow registration the host uses
 * to link the cloned candidate after acceptance.
 */
export function preparedLayoutCandidate(
	request: PlannerRequest<ProjectEnvelope>,
	operationKind: string,
	subject: LayoutSubject | LayoutRoomSubject,
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
	recordPreparedCowCandidate(request.intent.operationId, document, canonicalUnitJson(request.intent));
	materializeLayoutSourceForCapture(document);
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
		return preparedLayoutCandidate(request, 'layout-wall-height', { kind: 'wall', id: wallId }, plan.document, [
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
		return preparedLayoutCandidate(
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
		return preparedLayoutCandidate(request, 'layout-wall-length', { kind: 'wall', id: wallId }, plan.document, [
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
		return preparedLayoutCandidate(request, 'layout-wall-angle', { kind: 'wall', id: wallId }, plan.document, [
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
		return preparedLayoutCandidate(request, 'layout-wall-move', { kind: 'wall', id: wallId }, plan.document, [
			'position'
		]);
	});
}

/**
 * C1 — the composite Bend planner. One grab, one candidate, one history entry:
 * a straight Wall becomes a chain when the grab inserts its first bend point,
 * and an invalid release rejects atomically through the retained planner.
 */
function wallBendPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_BEND_KIND, (request) => {
		const payload = readPayload(LAYOUT_WALL_BEND_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId, distance, x, z, knotId } = payload.value;
		if (
			!opaqueId(wallId) ||
			!finiteNonNegative(distance) ||
			!finiteNumber(x) ||
			!finiteNumber(z) ||
			!opaqueId(knotId)
		) {
			return rejected(
				'invalid-value',
				'A Wall bend needs one wall id, a finite non-negative arc distance, a finite bend point and the captured bend-point id.'
			);
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planBendWallCurveKnot(
			request.snapshot.domain.source.units.layout.data,
			wallId,
			{ distance, point: [x, z] },
			{ knotId }
		);
		if (plan.kind === 'rejected') return rejected(plan.rejection.code, plan.rejection.message);
		return preparedLayoutCandidate(request, 'layout-wall-bend', { kind: 'wall', id: wallId }, plan.document, [
			'shape'
		]);
	});
}

/**
 * C1/D2 — remove the active bend point. The retained delete-by-merge planner
 * owns the geometry, Opening fit and atomic refusal; the Card only names which
 * captured knot the creator made active.
 */
function wallKnotDeletePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_KNOT_DELETE_KIND, (request) => {
		const payload = readPayload(LAYOUT_WALL_KNOT_DELETE_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId, knotId } = payload.value;
		if (!opaqueId(wallId) || !opaqueId(knotId)) {
			return rejected('invalid-value', 'Removing a bend point needs one wall id and one bend-point id.');
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planDeleteWallCurveKnot(
			request.snapshot.domain.source.units.layout.data,
			wallId,
			knotId
		);
		if (plan.kind === 'rejected') return rejected(plan.rejection.code, plan.rejection.message);
		return preparedLayoutCandidate(request, 'layout-wall-knot-delete', { kind: 'wall', id: wallId }, plan.document, [
			'shape'
		]);
	});
}

/** C1 — Straighten Wall through the retained convert-to-line planner. */
function wallStraightenPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_STRAIGHTEN_KIND, (request) => {
		const payload = readPayload(LAYOUT_WALL_STRAIGHTEN_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId } = payload.value;
		if (!opaqueId(wallId)) return rejected('invalid-value', 'Straightening a Wall needs one wall id.');
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planConvertWallToLine(request.snapshot.domain.source.units.layout.data, wallId);
		if (plan.kind === 'rejected') return rejected(plan.rejection.code, plan.rejection.message);
		return preparedLayoutCandidate(request, 'layout-wall-straighten', { kind: 'wall', id: wallId }, plan.document, [
			'shape'
		]);
	});
}

/** Rigid Room-group translation: one delta for the Room and every Room joined to it. */
function roomMovePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_ROOM_MOVE_KIND, (request) => {
		const payload = readPayload(LAYOUT_ROOM_MOVE_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { roomId, deltaX, deltaZ } = payload.value;
		if (!opaqueId(roomId) || !finiteNumber(deltaX) || !finiteNumber(deltaZ)) {
			return rejected('invalid-value', 'A Room move needs one room id and finite X and Z deltas in meters.');
		}
		const addressed = addressedSubject(request, 'room', roomId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planWallFirstRoomMove(request.snapshot.domain.source.units.layout.data, roomId, [deltaX, deltaZ]);
		if (plan.kind === 'rejected') return rejected(plan.rejection.code, plan.rejection.message);
		return preparedLayoutCandidate(request, 'layout-room-move', { kind: 'room', id: roomId }, plan.document, ['position']);
	});
}

/**
 * R217.S15 — move one shared Junction freely. The selected Wall supplies the
 * F.1 target and the payload names the Junction that must be one of its ends, so
 * a stale gesture cannot move a Junction on another Wall. The retained planner
 * owns the shared-Junction consequences and every identity/Opening/Room gate.
 */
function junctionMovePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_JUNCTION_MOVE_KIND, (request) => {
		const payload = readPayload(LAYOUT_JUNCTION_MOVE_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId, junctionId, x, z } = payload.value;
		if (!opaqueId(wallId) || !opaqueId(junctionId) || !finiteNumber(x) || !finiteNumber(z)) {
			return rejected(
				'invalid-value',
				'A Junction move needs one wall id, one junction id and finite X and Z coordinates in meters.'
			);
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const wall = request.snapshot.domain.source.units.layout.data.walls.find(
			(candidate) => candidate.id === wallId
		);
		if (wall === undefined || (wall.startJunctionId !== junctionId && wall.endJunctionId !== junctionId)) {
			return rejected('invalid-value', "The Junction must be one of the addressed Wall's endpoints.");
		}
		const plan = planExactJunctionMove(
			request.snapshot.domain.source.units.layout.data,
			junctionId,
			[x, z]
		);
		if (plan.kind === 'rejected') return rejected(plan.rejection.code, plan.rejection.message);
		return preparedLayoutCandidate(
			request,
			'layout-junction-move',
			{ kind: 'wall', id: wallId },
			plan.document,
			['start', 'end']
		);
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
			const baseline = request.snapshot.domain.source.units.layout.data;
			const opening = baseline.openings.find((entry) => entry.id === openingId);
			return rejected(
				plan.rejection.code,
				openingRefusalWords(baseline, plan.rejection, {
					openingId,
					...(opening === undefined
						? {}
						: {
								wallId: opening.wallId,
								kind: opening.kind,
								offset: opening.offset,
								width: opening.width,
								height: opening.height,
								sillHeight: opening.sillHeight
							}),
					[field]: value
				})
			);
		}
		return preparedLayoutCandidate(
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
			(subjectKind !== 'wall' && subjectKind !== 'opening' && subjectKind !== 'room') ||
			!opaqueId(subjectId) ||
			typeof name !== 'string'
		) {
			return rejected(
				'invalid-value',
				'A Layout name edit needs one Wall, Opening or Room id and one string name.'
			);
		}
		const addressed = addressedSubject(request, subjectKind, subjectId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const document = request.snapshot.domain.source.units.layout.data;
		const plan =
			subjectKind === 'wall'
				? planWallMetadataUpdate(document, subjectId, { name })
				: subjectKind === 'room'
					? planRoomMetadataUpdate(document, subjectId, { name })
					: planOpeningMetadataUpdate(document, subjectId, { name });
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, plan.rejection.message);
		}
		return preparedLayoutCandidate(
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
		return preparedLayoutCandidate(
			request,
			'layout-plinth-place',
			{ kind: 'object', id: objectId },
			plan.document,
			['objects'],
			{ created: true, id: objectId }
		);
	});
}

/** The production Layout planners, one operation kind each. */
export function createLayoutPlanners(): readonly DomainPlanner<ProjectEnvelope>[] {
	return [
		wallHeightPlanner(),
		wallThicknessPlanner(),
		wallLengthPlanner(),
		wallAnglePlanner(),
		wallMovePlanner(),
		wallBendPlanner(),
		wallKnotDeletePlanner(),
		wallStraightenPlanner(),
		roomMovePlanner(),
		junctionMovePlanner(),
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
	/** The canonical Junctions the Wall's endpoints name. */
	readonly startJunctionId: string;
	readonly endJunctionId: string;
	readonly start: LayoutVec2;
	readonly end: LayoutVec2;
	readonly direction: LayoutVec2;
	readonly length: number;
	readonly angleRadians: number;
};

export function wallFrame(document: LayoutDocumentWallFirst, wallId: string): WallFrame | null {
	const wall = lookupIndexedWall(document, wallId);
	if (wall === undefined || wall.centerline.kind !== 'line') return null;
	const start = lookupIndexedJunction(document, wall.startJunctionId)?.point;
	const end = lookupIndexedJunction(document, wall.endJunctionId)?.point;
	if (start === undefined || end === undefined) return null;
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const length = Math.hypot(dx, dz);
	if (!(length > 0)) return null;
	return {
		wallId,
		startJunctionId: wall.startJunctionId,
		endJunctionId: wall.endJunctionId,
		start: [start[0], start[1]],
		end: [end[0], end[1]],
		direction: [dx / length, dz / length],
		length,
		angleRadians: Math.atan2(dz, dx)
	};
}

/**
 * The canonical frame of a **curved** open Wall: its sampled centerline read
 * through the one geometry authority, with physical arc distances.
 *
 * A straight Wall has no curved frame (`wallFrame` owns it), and a resolved
 * sample derivation is required: a chain that cannot be sampled is not
 * addressable, so the caller gets `null` rather than a guessed polyline.
 */
export type CurvedWallFrame = {
	readonly wallId: string;
	readonly startJunctionId: string;
	readonly endJunctionId: string;
	readonly start: LayoutVec2;
	readonly end: LayoutVec2;
	/** Exact sampled arc length, not the chord. */
	readonly length: number;
	readonly samples: readonly {
		readonly point: LayoutVec2;
		readonly distance: number;
		readonly tangent: LayoutVec2;
	}[];
};

/** One open Wall's sampled frame, straight or curved. */
export type OpenWallFrame = CurvedWallFrame;

/**
 * D1 — the frame the Bend gesture consumes. Unlike `curvedWallFrame` it also
 * resolves a straight Wall, because a body press must bend it on the spot; the
 * sampled length of a `line` centerline is its chord.
 */
export function openWallFrame(document: LayoutDocumentWallFirst, wallId: string): OpenWallFrame | null {
	const wall = lookupIndexedWall(document, wallId);
	if (wall === undefined) return null;
	const start = lookupIndexedJunction(document, wall.startJunctionId)?.point;
	const end = lookupIndexedJunction(document, wall.endJunctionId)?.point;
	if (start === undefined || end === undefined) return null;
	if (wall.startJunctionId === wall.endJunctionId) return null;
	const sampled = wallCenterlineSamples(
		{ id: wall.id, centerline: wall.centerline },
		[start[0], start[1]],
		[end[0], end[1]],
		'forward'
	);
	if (sampled === undefined || !(sampled.length > 0) || sampled.samples.length < 2) return null;
	return {
		wallId,
		startJunctionId: wall.startJunctionId,
		endJunctionId: wall.endJunctionId,
		start: [start[0], start[1]],
		end: [end[0], end[1]],
		length: sampled.length,
		samples: sampled.samples.map((sample) => ({
			point: [sample.point[0], sample.point[1]] as LayoutVec2,
			distance: sample.distance,
			tangent: [sample.tangent[0], sample.tangent[1]] as LayoutVec2
		}))
	};
}

export function curvedWallFrame(document: LayoutDocumentWallFirst, wallId: string): CurvedWallFrame | null {
	const wall = lookupIndexedWall(document, wallId);
	if (wall === undefined || wall.centerline.kind === 'line') return null;
	const start = lookupIndexedJunction(document, wall.startJunctionId)?.point;
	const end = lookupIndexedJunction(document, wall.endJunctionId)?.point;
	if (start === undefined || end === undefined) return null;
	const sampled = wallCenterlineSamples(
		{ id: wall.id, centerline: wall.centerline },
		[start[0], start[1]],
		[end[0], end[1]],
		'forward'
	);
	if (sampled === undefined || !(sampled.length > 0) || sampled.samples.length < 2) return null;
	return {
		wallId,
		startJunctionId: wall.startJunctionId,
		endJunctionId: wall.endJunctionId,
		start: [start[0], start[1]],
		end: [end[0], end[1]],
		length: sampled.length,
		samples: sampled.samples.map((sample) => ({
			point: [sample.point[0], sample.point[1]] as LayoutVec2,
			distance: sample.distance,
			tangent: [sample.tangent[0], sample.tangent[1]] as LayoutVec2
		}))
	};
}

/**
 * The centerline point at one physical arc distance, with its tangent.
 *
 * This is the arc-length inverse the Opening marks and the Bend gesture need:
 * a station names the same place on a curved host that it names on a straight
 * one. A distance outside `[0, length]` is refused, never clamped.
 */
export function curvedWallPointAt(
	frame: CurvedWallFrame,
	distance: number
): { readonly point: LayoutVec2; readonly tangent: LayoutVec2 } | null {
	if (!Number.isFinite(distance) || distance < 0 || distance > frame.length) return null;
	for (let index = 1; index < frame.samples.length; index += 1) {
		const previous = frame.samples[index - 1]!;
		const next = frame.samples[index]!;
		if (distance > next.distance) continue;
		const span = next.distance - previous.distance;
		const t = span > 0 ? (distance - previous.distance) / span : 0;
		return {
			point: [
				previous.point[0] + (next.point[0] - previous.point[0]) * t,
				previous.point[1] + (next.point[1] - previous.point[1]) * t
			],
			tangent: [
				previous.tangent[0] + (next.tangent[0] - previous.tangent[0]) * t,
				previous.tangent[1] + (next.tangent[1] - previous.tangent[1]) * t
			]
		};
	}
	const last = frame.samples.at(-1)!;
	return { point: [last.point[0], last.point[1]], tangent: [last.tangent[0], last.tangent[1]] };
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
	| { readonly kind: 'move'; readonly delta: LayoutVec2 }
	| { readonly kind: 'junction'; readonly junctionId: string; readonly point: LayoutVec2 };

/** One Wall reshaped by a shared-Junction edit, at its candidate endpoint. */
export type WallNeighbourPreview = {
	readonly wallId: string;
	/** The point the edited junction moved this neighbour to. */
	readonly point: LayoutVec2;
};

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
	if (input.request.kind === 'junction') {
		return buildLayoutIntent({
			...base,
			kind: LAYOUT_JUNCTION_MOVE_KIND,
			payload: {
				wallId: input.wallId,
				junctionId: input.request.junctionId,
				x: input.request.point[0],
				z: input.request.point[1]
			}
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
 * One C1 Bend intent: the physical station the press resolved, the pointer's
 * bend point, and the captured id the write may insert.
 *
 * Preview and commit build this same intent, so the document the preview draws
 * is the document acceptance writes, and Undo replays the captured knot id
 * rather than minting an occupancy-derived one.
 */
export function wallBendIntent(input: {
	readonly wallId: string;
	readonly distance: number;
	readonly point: LayoutVec2;
	readonly knotId: string;
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
	return buildLayoutIntent({
		operationId: input.operationId,
		projectId: input.projectId,
		revisionId: input.revisionId,
		contentRevision: input.contentRevision,
		levelId: input.levelId,
		targets: [reference],
		kind: LAYOUT_WALL_BEND_KIND,
		payload: {
			wallId: input.wallId,
			distance: input.distance,
			x: input.point[0],
			z: input.point[1],
			knotId: input.knotId
		}
	});
}

/** C1/D2 — one captured intent for removing the active bend point. */
export function wallKnotDeleteIntent(input: {
	readonly wallId: string;
	readonly knotId: string;
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
	return buildLayoutIntent({
		operationId: input.operationId,
		projectId: input.projectId,
		revisionId: input.revisionId,
		contentRevision: input.contentRevision,
		levelId: input.levelId,
		targets: [reference],
		kind: LAYOUT_WALL_KNOT_DELETE_KIND,
		payload: { wallId: input.wallId, knotId: input.knotId }
	});
}

/** C1 — one captured intent for Straighten Wall. */
export function wallStraightenIntent(input: {
	readonly wallId: string;
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
	return buildLayoutIntent({
		operationId: input.operationId,
		projectId: input.projectId,
		revisionId: input.revisionId,
		contentRevision: input.contentRevision,
		levelId: input.levelId,
		targets: [reference],
		kind: LAYOUT_WALL_STRAIGHTEN_KIND,
		payload: { wallId: input.wallId }
	});
}

/**
 * The station frame Opening marks consume: one `pointAt` that is linear on a
 * straight Wall (byte-identical to `framePoint`) and arc-length on a curved
 * one, so an Opening handle lands on the curve instead of on its chord.
 */
export type WallStationFrame = {
	readonly wallId: string;
	readonly start: LayoutVec2;
	readonly end: LayoutVec2;
	readonly length: number;
	readonly direction: LayoutVec2;
	readonly curved: boolean;
	readonly pointAt: (distance: number) => { readonly point: LayoutVec2; readonly tangent: LayoutVec2 } | null;
};

export function wallStationFrame(document: LayoutDocumentWallFirst, wallId: string): WallStationFrame | null {
	const curved = curvedWallFrame(document, wallId);
	if (curved !== null) {
		return {
			wallId,
			start: curved.start,
			end: curved.end,
			length: curved.length,
			direction: [
				(curved.end[0] - curved.start[0]) / Math.hypot(curved.end[0] - curved.start[0], curved.end[1] - curved.start[1]),
				(curved.end[1] - curved.start[1]) / Math.hypot(curved.end[0] - curved.start[0], curved.end[1] - curved.start[1])
			],
			curved: true,
			pointAt: (distance) => curvedWallPointAt(curved, distance)
		};
	}
	const straight = wallFrame(document, wallId);
	if (straight === null) return null;
	return {
		wallId,
		start: straight.start,
		end: straight.end,
		length: straight.length,
		direction: straight.direction,
		curved: false,
		pointAt: (distance) =>
			distance < 0 || distance > straight.length
				? null
				: {
						point: [
							straight.start[0] + straight.direction[0] * distance,
							straight.start[1] + straight.direction[1] * distance
						],
						tangent: straight.direction
					}
	};
}

/**
 * The physical station a document point names on one Wall, straight or curved.
 * `null` when the Wall is unresolved or its centerline cannot be sampled.
 */
export function wallStationAtPoint(
	document: LayoutDocumentWallFirst,
	wallId: string,
	point: readonly [number, number]
): number | null {
	const wall = lookupIndexedWall(document, wallId);
	if (wall === undefined) return null;
	const start = lookupIndexedJunction(document, wall.startJunctionId)?.point;
	const end = lookupIndexedJunction(document, wall.endJunctionId)?.point;
	if (start === undefined || end === undefined) return null;
	const projected = projectPointToWallCenterline(
		{ id: wall.id, centerline: wall.centerline },
		[start[0], start[1]],
		[end[0], end[1]],
		[point[0], point[1]]
	);
	return projected === undefined ? null : projected.distance;
}

/**
 * The physical station a document point names, only when the point actually
 * lies within `maxDistanceToPath` of the sampled centerline.
 *
 * A body press is resolved against the Wall's own samples rather than a scene
 * pick: a curved face has no chord to pick, and nearness is measured in the
 * same metres every station uses. A point outside the tolerance is not the
 * Wall's body and returns `null`.
 */
export function wallStationNearPoint(
	document: LayoutDocumentWallFirst,
	wallId: string,
	point: readonly [number, number],
	maxDistanceToPath: number
): number | null {
	const wall = lookupIndexedWall(document, wallId);
	if (wall === undefined) return null;
	const start = lookupIndexedJunction(document, wall.startJunctionId)?.point;
	const end = lookupIndexedJunction(document, wall.endJunctionId)?.point;
	if (start === undefined || end === undefined) return null;
	const projected = projectPointToWallCenterline(
		{ id: wall.id, centerline: wall.centerline },
		[start[0], start[1]],
		[end[0], end[1]],
		[point[0], point[1]]
	);
	if (projected === undefined || projected.distanceToPath > maxDistanceToPath) return null;
	return projected.distance;
}

/**
 * The Bend preview: the exact candidate the retained planner builds, or its
 * refusal. Preview and commit share the same captured knot id.
 */
export function previewWallBend(
	document: LayoutDocumentWallFirst,
	wallId: string,
	distance: number,
	point: readonly [number, number],
	knotId: string
):
	| { readonly kind: 'planned'; readonly document: LayoutDocumentWallFirst }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string } {
	const plan = planBendWallCurveKnot(document, wallId, { distance, point: [point[0], point[1]] }, { knotId });
	if (plan.kind === 'rejected') {
		return { kind: 'refused', code: plan.rejection.code, message: plan.rejection.message };
	}
	return { kind: 'planned', document: plan.document };
}

/**
 * C1/D2 — the exact candidate a Card knot action would install, or its refusal.
 * The action runs this before acceptance, so a refused edit is named without a
 * write and the accepted edit is the same planner's document.
 */
export function previewWallKnotDelete(
	document: LayoutDocumentWallFirst,
	wallId: string,
	knotId: string
):
	| { readonly kind: 'planned'; readonly document: LayoutDocumentWallFirst }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string } {
	const plan = planDeleteWallCurveKnot(document, wallId, knotId);
	return plan.kind === 'rejected'
		? { kind: 'refused', code: plan.rejection.code, message: plan.rejection.message }
		: { kind: 'planned', document: plan.document };
}

/** C1 — the exact Straighten candidate, or its refusal. */
export function previewWallStraighten(
	document: LayoutDocumentWallFirst,
	wallId: string
):
	| { readonly kind: 'planned'; readonly document: LayoutDocumentWallFirst }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string } {
	const plan = planConvertWallToLine(document, wallId);
	return plan.kind === 'rejected'
		? { kind: 'refused', code: plan.rejection.code, message: plan.rejection.message }
		: { kind: 'planned', document: plan.document };
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
		const wall = lookupIndexedWall(document, subject.id);
		if (wall === undefined) return [];
		return [
			{ label: 'Kind', value: 'Wall', fieldId: 'kind' },
			{ label: 'Name', value: wall.name ?? '(unnamed)', fieldId: 'name' },
			{ label: 'Height', value: formatMeters(wall.height), fieldId: 'height' },
			{ label: 'Thickness', value: formatMeters(wall.thickness), fieldId: 'thickness' },
			// Format 6 — the role is derived from Room boundary membership, shown
			// read-only because it follows geometry rather than a control.
			{ label: 'Role', value: `${deriveLayoutWallRole(document, wall.id) ?? 'free-standing'} (derived)`, fieldId: 'role' }
		];
	}
	if (subject.kind === 'opening') {
		const opening = lookupIndexedOpening(document, subject.id);
		if (opening === undefined) return [];
		return [
			{ label: 'Kind', value: opening.kind === 'door' ? 'Door' : 'Window', fieldId: 'kind' },
			{ label: 'Name', value: opening.name ?? '(unnamed)', fieldId: 'name' },
			{ label: 'Offset', value: formatMeters(opening.offset), fieldId: 'offset' },
			{ label: 'Width', value: formatMeters(opening.width), fieldId: 'width' },
			{ label: 'Height', value: formatMeters(opening.height), fieldId: 'height' },
			{ label: 'Sill', value: formatMeters(opening.sillHeight), fieldId: 'sillHeight' }
		];
	}
	const object = lookupIndexedObject(document, subject.id);
	if (object === undefined) return [];
	return [
		{ label: 'Kind', value: object.kind, fieldId: 'kind' },
		{ label: 'Name', value: '(read-only identity)', fieldId: 'name' },
		{ label: 'Position', value: object.position.map(formatMeters).join(' · '), fieldId: 'position' },
		{ label: 'Dimensions', value: object.dimensions.map(formatMeters).join(' · '), fieldId: 'dimensions' }
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
		const wall = lookupIndexedWall(document, subject.id);
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
			{ id: 'deltaZ', label: 'Move ΔZ', value: 0, unit: 'm' },
			// R217.S15 — the non-pointer path for the same shared-Junction planner.
			{ id: 'startX', label: 'Start X', value: frame.start[0], unit: 'm' },
			{ id: 'startZ', label: 'Start Z', value: frame.start[1], unit: 'm' },
			{ id: 'endX', label: 'End X', value: frame.end[0], unit: 'm' },
			{ id: 'endZ', label: 'End Z', value: frame.end[1], unit: 'm' }
		];
	}
	if (subject.kind === 'opening') {
		const opening = lookupIndexedOpening(document, subject.id);
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
 * The fields the Card's Layout writer edits for one subject: every writable field except
 * the name, which the Card header's rename writer owns. A read-only fact on the same
 * subject with one of these `fieldId`s is shown by the writer and is not repeated.
 */
export function layoutCardFieldIds(
	document: LayoutDocumentWallFirst,
	subject: LayoutSubject
): readonly string[] {
	return layoutWritableFacts(document, subject)
		.map((field) => field.id)
		.filter((id) => id !== 'name');
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
