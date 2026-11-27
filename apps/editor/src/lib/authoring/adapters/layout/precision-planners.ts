/**
 * The Layout precision operation set: one DomainPlanner per writable fact.
 *
 * Each planner validates its own payload shape, addresses exactly the subject
 * it edits and delegates the document change to a retained Layout planner. The
 * registry order is the admission order.
 */
import { planWallFirstRoomMove } from '@portfolio/layout-core/room';
import {
	planBendWallCurveKnot,
	planConvertWallToLine,
	planDeleteWallCurveKnot,
	planExactJunctionMove,
	planExactWallAngle,
	planExactWallHeight,
	planExactWallLength,
	planExactWallThickness,
	planOpeningMetadataUpdate,
	planRemoveSpace,
	planRigidWallMove,
	planRoomMetadataUpdate,
	planSetWallTop,
	planUpdateWallFirstOpening,
	planWallMetadataUpdate,
} from '@portfolio/layout-core/wall';
import {
	nextLayoutPresetObjectId,
	planCommitLayoutObjectPresetWithId,
	readLayoutIdCapture,
} from '@portfolio/layout-core/plan';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import type { DomainPlanner } from '@portfolio/project-model/f4';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { openingRefusalWords, refusalSubjects, wallRefusalWords } from './refusals';
import {
	LAYOUT_ENTITY_NAME_KIND,
	LAYOUT_JUNCTION_MOVE_KIND,
	LAYOUT_OPENING_MEASURE_KIND,
	LAYOUT_PLINTH_PLACE_KIND,
	LAYOUT_ROOM_MOVE_KIND,
	LAYOUT_ROOM_OVERHEAD_KIND,
	LAYOUT_SPACE_REMOVE_KIND,
	LAYOUT_WALL_ANGLE_KIND,
	LAYOUT_WALL_BEND_KIND,
	LAYOUT_WALL_HEIGHT_KIND,
	LAYOUT_WALL_KNOT_DELETE_KIND,
	LAYOUT_WALL_LENGTH_KIND,
	LAYOUT_WALL_MOVE_KIND,
	LAYOUT_WALL_STRAIGHTEN_KIND,
	LAYOUT_WALL_THICKNESS_KIND,
	LAYOUT_WALL_TOP_KIND,
	addressedSubject,
	capturedWorkingLevel,
	finiteNonNegative,
	finiteNumber,
	finitePositive,
	isFixedEndpoint,
	isOptionalPositive,
	isLayoutOpeningField,
	isLayoutWallTop,
	layoutPlanner,
	opaqueId,
	preparedLayoutCandidate,
	readPayload,
	rejected,
} from './precision';

function wallHeightPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_HEIGHT_KIND, (request) => {
		const payload = readPayload(LAYOUT_WALL_HEIGHT_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId, height } = payload.value;
		if (!opaqueId(wallId) || !finitePositive(height)) {
			return rejected(
				'invalid-value',
				'A Wall height needs one wall id and one finite positive height in meters.',
			);
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const baseline = request.snapshot.domain.source.units.layout.data;
		const plan = planExactWallHeight(baseline, wallId, height);
		if (plan.kind === 'rejected') {
			// A shorter Wall can cut into a hosted Opening. The V2b formatter names
			// that Opening, so Height and the top grip say the same words.
			return rejected(plan.rejection.code, wallTopRejectionWords(baseline, plan.rejection));
		}
		return preparedLayoutCandidate(
			request,
			'layout-wall-height',
			{ kind: 'wall', id: wallId },
			plan.document,
			['height'],
			{ surfaceLineage: [] },
		);
	});
}

/**
 * The top planner's refusal words, with the Opening its ids name.
 *
 * `planSetWallTop` reports an Opening id in `targetIds` when a lowered top would
 * cut into it; resolving that here is what keeps the Card and the Stage grip
 * from saying "an Opening" after V2c made the shape editable.
 */
export function wallTopRejectionWords(
	document: LayoutDocumentWallFirst,
	rejection: {
		readonly code: string;
		readonly message: string;
		readonly targetIds?: readonly string[];
	},
): string {
	return wallRefusalWords(
		rejection.code,
		rejection.message,
		refusalSubjects(document, rejection.targetIds, rejection.message),
	);
}

/**
 * The V2c top shape: Level, Slope or Gable in one retained write.
 *
 * `planSetWallTop` owns normalisation and every refusal, including the Opening
 * that a lowered top would cut into. Its `targetIds` name that Opening, so the
 * V2b refusal formatter can say which one instead of "an Opening".
 */
function wallTopPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_TOP_KIND, (request) => {
		const payload = readPayload(LAYOUT_WALL_TOP_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId, top, height } = payload.value;
		if (!opaqueId(wallId) || !isLayoutWallTop(top) || !isOptionalPositive(height)) {
			return rejected('invalid-value', 'Need a Wall id, a shape and an optional eave.');
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const baseline = request.snapshot.domain.source.units.layout.data;
		const plan = planSetWallTop(baseline, wallId, top, height);
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, wallTopRejectionWords(baseline, plan.rejection));
		}
		return preparedLayoutCandidate(
			request,
			'layout-wall-top',
			{ kind: 'wall', id: wallId },
			plan.document,
			['top', 'height'],
			{ surfaceLineage: [] },
		);
	});
}

function wallThicknessPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_THICKNESS_KIND, (request) => {
		const payload = readPayload(LAYOUT_WALL_THICKNESS_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId, thickness } = payload.value;
		if (!opaqueId(wallId) || !finitePositive(thickness)) {
			return rejected(
				'invalid-value',
				'A Wall thickness needs one wall id and one finite positive thickness in meters.',
			);
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planExactWallThickness(
			request.snapshot.domain.source.units.layout.data,
			wallId,
			thickness,
		);
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, plan.rejection.message);
		}
		return preparedLayoutCandidate(
			request,
			'layout-wall-thickness',
			{ kind: 'wall', id: wallId },
			plan.document,
			['thickness'],
			{ surfaceLineage: [] },
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
				'A Wall length needs one wall id, one finite positive length in meters and a start or end fixed endpoint.',
			);
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planExactWallLength(request.snapshot.domain.source.units.layout.data, {
			wallId,
			length,
			fixedEndpoint: fixed,
		});
		if (plan.kind === 'rejected') return rejected(plan.rejection.code, plan.rejection.message);
		return preparedLayoutCandidate(
			request,
			'layout-wall-length',
			{ kind: 'wall', id: wallId },
			plan.document,
			['length'],
			{ surfaceLineage: [] },
		);
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
				'A Wall angle needs one wall id, one finite angle in radians and a start or end fixed endpoint.',
			);
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planExactWallAngle(request.snapshot.domain.source.units.layout.data, {
			wallId,
			angle: angleRadians,
			fixedEndpoint: fixed,
		});
		if (plan.kind === 'rejected') return rejected(plan.rejection.code, plan.rejection.message);
		return preparedLayoutCandidate(
			request,
			'layout-wall-angle',
			{ kind: 'wall', id: wallId },
			plan.document,
			['angle'],
			{ surfaceLineage: [] },
		);
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
				'A rigid Wall move needs one wall id and finite X and Z deltas in meters.',
			);
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planRigidWallMove(request.snapshot.domain.source.units.layout.data, wallId, [
			deltaX,
			deltaZ,
		]);
		if (plan.kind === 'rejected') return rejected(plan.rejection.code, plan.rejection.message);
		return preparedLayoutCandidate(
			request,
			'layout-wall-move',
			{ kind: 'wall', id: wallId },
			plan.document,
			['position'],
			{ surfaceLineage: [] },
		);
	});
}

/**
 * The composite Bend planner. One grab, one candidate, one history entry:
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
				'A Wall bend needs one wall id, a finite non-negative arc distance, a finite bend point and the captured bend-point id.',
			);
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planBendWallCurveKnot(
			request.snapshot.domain.source.units.layout.data,
			wallId,
			{ distance, point: [x, z] },
			{ knotId },
		);
		if (plan.kind === 'rejected')
			return rejected(
				plan.rejection.code,
				wallRefusalWords(plan.rejection.code, plan.rejection.message),
			);
		return preparedLayoutCandidate(
			request,
			'layout-wall-bend',
			{ kind: 'wall', id: wallId },
			plan.document,
			['shape'],
			{ surfaceLineage: [] },
		);
	});
}

/**
 * Remove the active bend point. The retained delete-by-merge planner
 * owns the geometry, Opening fit and atomic refusal; the Card only names which
 * captured knot the creator made active.
 */
function wallKnotDeletePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_KNOT_DELETE_KIND, (request) => {
		const payload = readPayload(LAYOUT_WALL_KNOT_DELETE_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId, knotId } = payload.value;
		if (!opaqueId(wallId) || !opaqueId(knotId)) {
			return rejected(
				'invalid-value',
				'Removing a bend point needs one wall id and one bend-point id.',
			);
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planDeleteWallCurveKnot(
			request.snapshot.domain.source.units.layout.data,
			wallId,
			knotId,
		);
		if (plan.kind === 'rejected')
			return rejected(
				plan.rejection.code,
				wallRefusalWords(plan.rejection.code, plan.rejection.message),
			);
		return preparedLayoutCandidate(
			request,
			'layout-wall-knot-delete',
			{ kind: 'wall', id: wallId },
			plan.document,
			['shape'],
			{ surfaceLineage: [] },
		);
	});
}

/** Straighten Wall through the retained convert-to-line planner. */
function wallStraightenPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_STRAIGHTEN_KIND, (request) => {
		const payload = readPayload(LAYOUT_WALL_STRAIGHTEN_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId } = payload.value;
		if (!opaqueId(wallId))
			return rejected('invalid-value', 'Straightening a Wall needs one wall id.');
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planConvertWallToLine(request.snapshot.domain.source.units.layout.data, wallId);
		if (plan.kind === 'rejected') return rejected(plan.rejection.code, plan.rejection.message);
		return preparedLayoutCandidate(
			request,
			'layout-wall-straighten',
			{ kind: 'wall', id: wallId },
			plan.document,
			['shape'],
			{ surfaceLineage: [] },
		);
	});
}

/** Rigid Room-group translation: one delta for the Room and every Room joined to it. */
function roomMovePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_ROOM_MOVE_KIND, (request) => {
		const payload = readPayload(LAYOUT_ROOM_MOVE_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { roomId, deltaX, deltaZ } = payload.value;
		if (!opaqueId(roomId) || !finiteNumber(deltaX) || !finiteNumber(deltaZ)) {
			return rejected(
				'invalid-value',
				'A Room move needs one room id and finite X and Z deltas in meters.',
			);
		}
		const addressed = addressedSubject(request, 'room', roomId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planWallFirstRoomMove(request.snapshot.domain.source.units.layout.data, roomId, [
			deltaX,
			deltaZ,
		]);
		if (plan.kind === 'rejected') return rejected(plan.rejection.code, plan.rejection.message);
		return preparedLayoutCandidate(
			request,
			'layout-room-move',
			{ kind: 'room', id: roomId },
			plan.document,
			['position'],
			{ surfaceLineage: [] },
		);
	});
}

/**
 * Move one shared Junction freely. The selected Wall supplies the
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
				'A Junction move needs one wall id, one junction id and finite X and Z coordinates in meters.',
			);
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const wall = request.snapshot.domain.source.units.layout.data.walls.find(
			(candidate) => candidate.id === wallId,
		);
		if (
			wall === undefined ||
			(wall.startJunctionId !== junctionId && wall.endJunctionId !== junctionId)
		) {
			return rejected(
				'invalid-value',
				"The Junction must be one of the addressed Wall's endpoints.",
			);
		}
		const plan = planExactJunctionMove(
			request.snapshot.domain.source.units.layout.data,
			junctionId,
			[x, z],
		);
		if (plan.kind === 'rejected') return rejected(plan.rejection.code, plan.rejection.message);
		return preparedLayoutCandidate(
			request,
			'layout-junction-move',
			{ kind: 'wall', id: wallId },
			plan.document,
			['start', 'end'],
			{ surfaceLineage: [] },
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
				'An Opening measure needs one opening id and one of offset, width, height or sill height.',
			);
		}
		// Offset and sill are non-negative; width and height must be positive. The
		// retained planner enforces the same rule, so this only names the field earlier.
		const valid =
			field === 'offset' || field === 'sillHeight'
				? finiteNonNegative(value)
				: finitePositive(value);
		if (!valid) {
			return rejected(
				'invalid-value',
				`An Opening ${field} must be a finite ${field === 'offset' || field === 'sillHeight' ? 'non-negative' : 'positive'} number of meters.`,
			);
		}
		const addressed = addressedSubject(request, 'opening', openingId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planUpdateWallFirstOpening(
			request.snapshot.domain.source.units.layout.data,
			openingId,
			{ [field]: value } as Parameters<typeof planUpdateWallFirstOpening>[2],
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
								sillHeight: opening.sillHeight,
							}),
					[field]: value,
				}),
			);
		}
		return preparedLayoutCandidate(
			request,
			'layout-opening-measure',
			{ kind: 'opening', id: openingId },
			plan.document,
			[field],
			{ surfaceLineage: [] },
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
				'A Layout name edit needs one Wall, Opening or Room id and one string name.',
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
			['name'],
			{ surfaceLineage: [] },
		);
	});
}

/**
 * Overhead is authored intent, never geometry: `planRoomMetadataUpdate` owns the
 * patch, so this planner cannot smuggle in a boundary or virtual-edge change.
 * One accepted intent is one history entry, and Undo restores the lid exactly.
 */
function roomOverheadPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_ROOM_OVERHEAD_KIND, (request) => {
		const payload = readPayload(LAYOUT_ROOM_OVERHEAD_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { roomId, overhead } = payload.value;
		if (!opaqueId(roomId) || (overhead !== 'closed' && overhead !== 'open-to-sky')) {
			return rejected(
				'invalid-value',
				"A Room overhead edit needs one Room id and either 'closed' or 'open-to-sky'.",
			);
		}
		const addressed = addressedSubject(request, 'room', roomId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planRoomMetadataUpdate(request.snapshot.domain.source.units.layout.data, roomId, {
			overhead,
		});
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, plan.rejection.message);
		}
		return preparedLayoutCandidate(
			request,
			LAYOUT_ROOM_OVERHEAD_KIND,
			{ kind: 'room', id: roomId },
			plan.document,
			['overhead'],
			{ surfaceLineage: [] },
		);
	});
}

/**
 * Remove space is the open-Space-only command: the record goes, its Walls stay,
 * objects lose the association and the released anchors are pruned. The
 * canonical planner owns that meaning; this adapter only prepares its intent.
 */
function spaceRemovePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_SPACE_REMOVE_KIND, (request) => {
		const payload = readPayload(LAYOUT_SPACE_REMOVE_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { roomId } = payload.value;
		if (!opaqueId(roomId)) return rejected('invalid-value', 'Remove space needs one Room id.');
		const addressed = addressedSubject(request, 'room', roomId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const level = capturedWorkingLevel(request);
		if ('kind' in level) return level;
		const plan = planRemoveSpace(
			request.snapshot.domain.source.units.layout.data,
			roomId,
			level.levelId,
		);
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, plan.rejection.message);
		}
		return preparedLayoutCandidate(
			request,
			LAYOUT_SPACE_REMOVE_KIND,
			{ kind: 'room', id: roomId },
			plan.document,
			['rooms', 'objects', 'openings', 'junctions'],
			{ retired: true, surfaceLineage: plan.surfaceLineage },
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
			return rejected(
				'invalid-value',
				'A plinth placement needs two finite working-plane X/Z meters.',
			);
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
				`The captured floor datum ${floorElevation} m no longer matches the mounted level datum ${datumMeters} m.`,
			);
		}
		if (request.intent.targets.length !== 0) {
			return rejected('invalid-value', 'A plinth placement addresses no existing subject.');
		}
		// Identity is captured, not allocated: the nonce input
		// derives the object id, and the intent's captured allocation must agree.
		const capture = readLayoutIdCapture(request.capturedInputs);
		if (capture === null) {
			return rejected(
				'invalid-value',
				'A plinth placement must capture its identity nonce before evaluation.',
			);
		}
		const expectedObjectId = nextLayoutPresetObjectId(
			request.snapshot.domain.source.units.layout.data,
			capture,
		);
		if (expectedObjectId !== objectId) {
			return rejected(
				'invalid-value',
				`The plinth payload names '${objectId}', but this operation's nonce derives '${expectedObjectId}'.`,
			);
		}
		if (
			!request.intent.allocatedIds.some(
				(allocation) => allocation.kind === 'layout-object' && allocation.id === objectId,
			)
		) {
			return rejected(
				'invalid-value',
				'A plinth placement must capture its new layout-object id before evaluation.',
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
			level.levelId,
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
			{ created: true, id: objectId, surfaceLineage: [] },
		);
	});
}

/** The production Layout planners, one operation kind each. */
export function createLayoutPlanners(): readonly DomainPlanner<ProjectEnvelope>[] {
	return [
		wallHeightPlanner(),
		wallTopPlanner(),
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
		roomOverheadPlanner(),
		spaceRemovePlanner(),
		plinthPlanner(),
	];
}
