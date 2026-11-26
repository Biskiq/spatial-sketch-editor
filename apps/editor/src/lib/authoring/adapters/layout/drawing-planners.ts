import { drawingRefusalWords } from './refusals';
/**
 * The two bounded F.4 operations drawing adds.
 *
 * | Operation | Kind | Canonical planner |
 * | --- | --- | --- |
 * | Commit one straight Wall chain | `layout-wall-chain-commit` | `planWallChain` |
 * | Delete one Wall with its hosted consequences | `layout-wall-delete` | `planDeleteWall` |
 *
 * Both are ordinary `DomainPlanner`s on the **same** registry, admission and
 * coordinator as the eight precision planners: nothing here is a second
 * acceptance path, a second compiler or a second identity system. The chain
 * planner re-runs the canonical planner against the accepted baseline on every
 * preview and every commit, and both operations capture their identity before
 * evaluation (`LayoutIdCapture` + the explicit working level), so a replay
 * reproduces the same ids and a stale baseline is refused rather than repaired.
 *
 * The intent is the *whole* operation: preview and final acceptance are the same
 * immutable input, and a cancel consumes no authored state because nothing is
 * written until acceptance.
 */
import {
	detectUnsupportedChainConnections,
	planDeleteWall,
	planWallChain,
	type LayoutDocumentWallFirst,
	type WallChainArc,
	type WallFirstOpPlan,
} from '@portfolio/layout-core/wall';
import { faceArea, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import {
	layoutIdCaptureInput,
	layoutWorkingLevelInput,
	type LayoutIdCapture,
	type LayoutSurfaceLineage,
} from '@portfolio/layout-core/plan';
import { materializeLayoutSourceForCapture } from '@portfolio/layout-core/kernel';
import {
	planCreateCircularRoom,
	planResizeClosedWallRadius,
	planTranslateClosedWall,
	roomBoundaryPolygon,
} from '@portfolio/layout-core/room';
import { recordPreparedCowCandidate } from '@portfolio/layout-core/world';
import type {
	AuthoringIntent,
	DomainPlanner,
	PlannerOutcome,
	PreparedCandidate,
} from '@portfolio/project-model/f4';
import {
	canonicalUnitJson,
	replaceUnitData,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope,
} from '@portfolio/project-model/units';

import {
	layoutPlanner,
	layoutSubjectReference,
	preparedLayoutCandidate,
	readCapturedOperation,
	registerLayoutSurfaceLineage,
} from './precision';
import { createRoundRoomPlanners } from './round-room-planners';

// The Opening operations address their host through the same reference and
// captured-identity readers; these stay reachable from the drawing module.
export { layoutSubjectReference, readCapturedOperation } from './precision';

export const LAYOUT_WALL_CHAIN_COMMIT_KIND = 'layout-wall-chain-commit';
export const LAYOUT_WALL_DELETE_KIND = 'layout-wall-delete';
/** One centre → rim Circle gesture becomes one closed Wall and one Room. */
export const LAYOUT_CIRCLE_ROOM_CREATE_KIND = 'layout-circle-room-create';
/** Exact radius edit on a closed Wall, preserving Opening stations. */
export const LAYOUT_CIRCLE_RADIUS_KIND = 'layout-circle-radius';
/** A circular Wall's body drag is one rigid translation. */
export const LAYOUT_CIRCLE_TRANSLATE_KIND = 'layout-circle-translate';

/** One draft vertex as the intent carries it: exact coordinates, no display units. */
export type WallChainCommitPoint = LayoutVec2;

export type WallChainCommitPayload = {
	readonly points: readonly WallChainCommitPoint[];
	readonly close: boolean;
	readonly junctionSnaps: readonly { readonly pointIndex: number; readonly junctionId: string }[];
	readonly hostSnaps: readonly { readonly pointIndex: number; readonly wallId: string }[];
	/** `null` when the chain uses the canonical authoring default. */
	readonly thickness: number | null;
	/** `null` when the chain resolves the birth height canonically. */
	readonly height: number | null;
	/**
	 * A3 — the one drawn Arc leg, or `null`/absent for a straight chain. The
	 * payload stays the same operation: one chain, one candidate, one history entry.
	 */
	readonly arc?: WallChainArc | null;
};

function refused(message: string): PlannerOutcome<ProjectEnvelope> {
	return { kind: 'rejected', code: 'invalid-value', message, diagnostics: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read one commit payload with **exactly** the keys the operation owns.
 *
 * A wrong-shaped or unknown key refuses rather than being ignored: a caller that
 * starts sending a field this operation does not support must be told so, not
 * have it silently dropped. Coordinates must be finite numbers — a `NaN` vertex
 * is a caller defect, never a point the planner should try to make sense of.
 */
function readChainPayload(payload: unknown): WallChainCommitPayload | { readonly message: string } {
	if (!isRecord(payload)) return { message: 'The chain commit payload must be an object.' };
	const expected = ['points', 'close', 'junctionSnaps', 'hostSnaps', 'thickness', 'height', 'arc'];
	const required = ['points', 'close', 'junctionSnaps', 'hostSnaps', 'thickness', 'height'];
	const unknown = Object.keys(payload).filter((key) => !expected.includes(key));
	if (unknown.length > 0)
		return { message: `The chain commit payload cannot carry ${unknown.join(', ')}.` };
	for (const key of required) {
		if (!(key in payload)) return { message: `The chain commit payload is missing "${key}".` };
	}
	if (!Array.isArray(payload.points))
		return { message: 'The chain commit payload needs a points array.' };
	const points: WallChainCommitPoint[] = [];
	for (const entry of payload.points) {
		if (!Array.isArray(entry) || entry.length !== 2) {
			return { message: 'Every chain point must be a [x, z] pair.' };
		}
		const [x, z] = entry as unknown[];
		if (
			typeof x !== 'number' ||
			typeof z !== 'number' ||
			!Number.isFinite(x) ||
			!Number.isFinite(z)
		) {
			return { message: 'Every chain point must carry two finite numbers.' };
		}
		points.push([x, z]);
	}
	if (typeof payload.close !== 'boolean')
		return { message: 'The chain commit payload needs a boolean close.' };
	const readSnaps = <T>(
		value: unknown,
		key: string,
		read: (record: Record<string, unknown>) => T | null,
	): readonly T[] | { readonly message: string } => {
		if (!Array.isArray(value)) return { message: `The chain commit payload needs a ${key} array.` };
		const snaps: T[] = [];
		for (const entry of value) {
			if (!isRecord(entry)) return { message: `Every ${key} entry must be an object.` };
			const parsed = read(entry);
			if (parsed === null) return { message: `Every ${key} entry must name an index and an id.` };
			snaps.push(parsed);
		}
		return snaps;
	};
	const readPointTarget = (
		record: Record<string, unknown>,
		idKey: string,
	): { pointIndex: number; id: string } | null => {
		const keys = Object.keys(record);
		if (keys.length !== 2 || !keys.includes('pointIndex') || !keys.includes(idKey)) return null;
		const pointIndex = record.pointIndex;
		const id = record[idKey];
		if (typeof pointIndex !== 'number' || !Number.isInteger(pointIndex) || pointIndex < 0)
			return null;
		if (typeof id !== 'string' || id.length === 0) return null;
		return { pointIndex, id };
	};
	const junctionSnaps = readSnaps(payload.junctionSnaps, 'junctionSnaps', (record) => {
		const parsed = readPointTarget(record, 'junctionId');
		return parsed === null ? null : { pointIndex: parsed.pointIndex, junctionId: parsed.id };
	});
	if ('message' in junctionSnaps) return junctionSnaps;
	const hostSnaps = readSnaps(payload.hostSnaps, 'hostSnaps', (record) => {
		const parsed = readPointTarget(record, 'wallId');
		return parsed === null ? null : { pointIndex: parsed.pointIndex, wallId: parsed.id };
	});
	if ('message' in hostSnaps) return hostSnaps;
	const optionalNumber = (value: unknown): number | null | undefined => {
		if (value === null) return null;
		if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
		return undefined;
	};
	const thickness = optionalNumber(payload.thickness);
	const height = optionalNumber(payload.height);
	if (thickness === undefined)
		return { message: 'Chain thickness must be null or a finite positive number.' };
	if (height === undefined)
		return { message: 'Chain height must be null or a finite positive number.' };
	const readArc = (value: unknown): WallChainArc | null | { readonly message: string } => {
		if (value === null) return null;
		if (!isRecord(value)) return { message: 'A chain arc must be an object or null.' };
		const keys = Object.keys(value);
		if (keys.length !== 2 || !('pointIndex' in value) || !('apex' in value)) {
			return { message: 'A chain arc is exactly { pointIndex, apex }.' };
		}
		const pointIndex = value.pointIndex;
		if (typeof pointIndex !== 'number' || !Number.isInteger(pointIndex) || pointIndex < 0) {
			return { message: 'A chain arc needs a non-negative integer leg index.' };
		}
		const apex =
			Array.isArray(value.apex) && value.apex.length === 2 ? (value.apex as unknown[]) : null;
		if (apex === null) return { message: 'An arc apex must be a [x, z] pair.' };
		const [x, z] = apex;
		if (
			typeof x !== 'number' ||
			typeof z !== 'number' ||
			!Number.isFinite(x) ||
			!Number.isFinite(z)
		) {
			return { message: 'An arc apex must carry two finite numbers.' };
		}
		return { pointIndex, apex: [x, z] };
	};
	const arc = payload.arc === undefined ? null : readArc(payload.arc);
	if (arc !== null && 'message' in arc) return arc;
	return {
		points,
		close: payload.close,
		junctionSnaps: junctionSnaps as readonly { pointIndex: number; junctionId: string }[],
		hostSnaps: hostSnaps as readonly { pointIndex: number; wallId: string }[],
		thickness,
		height,
		arc,
	};
}

/**
 * The chain-commit planner: one captured intent, one canonical plan, one
 * complete candidate document.
 *
 * The candidate's correspondence names every identity the operation created
 * (Walls, Junctions, Rooms) and every Room the reconciliation retired, so the
 * accepted selection requalifies through the same shared path as any other
 * accepted change — including the "select the last created Wall" rule, which the
 * adapter asks for by id from this plan's own `authoredWallIds`.
 */
function wallChainCommitPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_CHAIN_COMMIT_KIND, (request) => {
		const payload = readChainPayload(request.intent.payload);
		if ('message' in payload) return refused(payload.message);
		const captured = readCapturedOperation(request);
		if ('kind' in captured) return captured;
		const { capture, levelId } = captured;
		const baseline = request.snapshot.domain.source.units.layout.data;
		// The drawing policy refuses before the planner builds a candidate, so an
		// intent that bypassed the live preview still cannot author permitted-looking
		// overlap the creator never connected to.
		const policy = detectUnsupportedChainConnections({
			baseline,
			points: payload.points,
			close: payload.close,
			endpointJunctionSnaps: payload.junctionSnaps,
			endpointHostSnaps: payload.hostSnaps,
		});
		if (policy !== null) return refused(drawingRefusalWords(policy.code));
		const plan = planWallChain({
			roomNamePrefix: 'Room',
			baseline,
			points: payload.points,
			close: payload.close,
			capture,
			levelId,
			endpointJunctionSnaps: payload.junctionSnaps,
			endpointHostSnaps: payload.hostSnaps,
			...(payload.thickness === null ? {} : { thickness: payload.thickness }),
			...(payload.height === null ? {} : { height: payload.height }),
			...(payload.arc === null || payload.arc === undefined ? {} : { arc: payload.arc }),
		});
		if (plan.kind === 'rejected') {
			return {
				kind: 'rejected',
				code: plan.rejection.code,
				message: plan.rejection.message,
				diagnostics: [],
			};
		}
		const contentRevision = request.snapshot.domain.source.units.layout.header.contentRevision;
		const document = plan.document;
		recordPreparedCowCandidate(
			request.intent.operationId,
			document,
			canonicalUnitJson(request.intent),
		);
		materializeLayoutSourceForCapture(document);
		const createdRoomIds = plan.lineage.map((record) => record.roomId);
		const candidate: PreparedCandidate<ProjectEnvelope> = {
			operationId: request.intent.operationId,
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			source: replaceUnitData(request.snapshot.domain.source, 'layout', document),
			changes: [
				{
					kind: LAYOUT_WALL_CHAIN_COMMIT_KIND,
					subjectIds: [...plan.createdWallIds, ...plan.absorbedRoomIds],
					fields: ['walls', 'junctions', 'rooms'],
				},
			],
			correspondence: [
				...plan.createdWallIds.map((wallId) => ({
					relation: 'created' as const,
					before: null,
					after: layoutSubjectReference({ kind: 'wall', id: wallId, contentRevision, levelId }),
				})),
				...plan.createdJunctionIds.map((junctionId) => ({
					relation: 'created' as const,
					before: null,
					after: layoutSubjectReference({
						kind: 'junction',
						id: junctionId,
						contentRevision,
						levelId,
					}),
				})),
				...createdRoomIds.map((roomId) => ({
					relation: 'created' as const,
					before: null,
					after: layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId }),
				})),
				...plan.absorbedRoomIds.map((roomId) => ({
					relation: 'preserved' as const,
					before: layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId }),
					after: layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId }),
				})),
				...plan.retiredRoomIds.map((roomId) => ({
					relation: 'retired' as const,
					before: layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId }),
					after: null,
				})),
			],
			diagnostics: [],
		};
		registerLayoutSurfaceLineage(candidate, plan.surfaceLineage);
		return { kind: 'prepared', candidate };
	});
}

/** One open Space the deletion changed, named for the creator-facing summary. */
export type SpaceLifecycleNote = {
	readonly roomId: string;
	readonly name: string;
	readonly reason: string;
	readonly otherNames?: readonly string[];
	readonly successorName?: string;
	/** The survivor's overhead when an open merge overrules the merged Space's. */
	readonly successorOverhead?: 'closed' | 'open-to-sky';
};

/** What one Wall deletion does, derived from the canonical planner (never guessed). */
export type WallDeletionSummary = {
	readonly wallId: string;
	readonly hostedOpeningIds: readonly string[];
	readonly createdRoomIds: readonly string[];
	readonly retiredRoomIds: readonly string[];
	/** Enclosed predecessors this deletion turns into open Spaces. */
	readonly openedRoomIds: readonly string[];
	/** Open predecessors this deletion carries unchanged. */
	readonly keptOpenRoomIds: readonly string[];
	/** Why an open Space retired, with the names the consequence line reads. */
	readonly spaceNotes: readonly SpaceLifecycleNote[];
	/** Round Rooms that survive this change but lose their stated Round fact. */
	readonly clearedRoundRoomNames: readonly string[];
	readonly summary: string;
};

export type WallDeletionPreview =
	| ({
			readonly kind: 'planned';
			readonly document: LayoutDocumentWallFirst;
			readonly surfaceLineage: LayoutSurfaceLineage;
	  } & WallDeletionSummary)
	| { readonly kind: 'refused'; readonly code: string; readonly message: string };

/**
 * Plan one Wall deletion and read its consequences.
 *
 * The same function serves the Card's disclosure (before the creator commits)
 * and the planner below, so what the creator is shown and what acceptance does
 * come from one planner call — one immutable input, never a second opinion.
 */
export function planWallDeletion(options: {
	readonly document: LayoutDocumentWallFirst;
	readonly wallId: string;
	readonly capture: LayoutIdCapture;
	readonly levelId: string;
}): WallDeletionPreview {
	const plan: WallFirstOpPlan = planDeleteWall(
		options.document,
		options.wallId,
		options.capture,
		options.levelId,
	);
	if (plan.kind === 'rejected') {
		return { kind: 'refused', code: plan.rejection.code, message: plan.rejection.message };
	}
	const hostedOpeningIds = options.document.openings
		.filter((opening) => opening.wallId === options.wallId)
		.map((opening) => opening.id);
	const createdRoomIds = plan.lineage.map((record) => record.roomId);
	const baselineRoomById = new Map(options.document.rooms.map((room) => [room.id, room] as const));
	const resultRoomById = new Map(plan.document.rooms.map((room) => [room.id, room] as const));
	const openedRoomIds = options.document.rooms
		.filter(
			(room) =>
				room.virtualEdges.length === 0 &&
				(resultRoomById.get(room.id)?.virtualEdges.length ?? 0) > 0,
		)
		.map((room) => room.id);
	const keptOpenRoomIds = options.document.rooms
		.filter((room) => room.virtualEdges.length > 0 && resultRoomById.has(room.id))
		.map((room) => room.id);
	// C4 — a surviving Room that loses the stated fact says so in its own name.
	const clearedRoundRoomNames = options.document.rooms
		.filter(
			(room) =>
				room.round !== undefined &&
				resultRoomById.get(room.id) !== undefined &&
				resultRoomById.get(room.id)!.round === undefined,
		)
		.map((room) => room.name ?? room.id);
	const spaceNotes = (plan.spaceRetirements ?? []).map((retirement) => {
		const merged = baselineRoomById.get(retirement.roomId);
		const successor =
			retirement.successorRoomId === undefined
				? undefined
				: baselineRoomById.get(retirement.successorRoomId);
		return {
			roomId: retirement.roomId,
			name: merged?.name ?? retirement.roomId,
			reason: retirement.reason,
			...(retirement.otherRoomIds === undefined
				? {}
				: {
						otherNames: retirement.otherRoomIds.map(
							(roomId) => baselineRoomById.get(roomId)?.name ?? roomId,
						),
					}),
			...(retirement.successorRoomId === undefined
				? {}
				: {
						successorName: successor?.name ?? retirement.successorRoomId,
					}),
			...(merged !== undefined && successor !== undefined && merged.overhead !== successor.overhead
				? { successorOverhead: successor.overhead }
				: {}),
		};
	});
	const areaOf = (document: LayoutDocumentWallFirst, roomId: string): number | null => {
		const polygon = roomBoundaryPolygon(document, roomId);
		return polygon === null ? null : faceArea({ polygon });
	};
	const areaChanges = [...openedRoomIds, ...keptOpenRoomIds].flatMap((roomId) => {
		const before = areaOf(options.document, roomId);
		const after = areaOf(plan.document, roomId);
		if (before === null || after === null || Math.abs(after - before) <= 0.005) return [];
		return [
			{
				name: baselineRoomById.get(roomId)?.name ?? roomId,
				areaAfter: after,
			},
		];
	});
	const summary = wallDeletionSummary({
		hostedOpeningIds,
		createdRoomIds,
		retiredRoomIds: plan.retiredRoomIds,
		openedRoomNames: openedRoomIds.map((roomId) => baselineRoomById.get(roomId)?.name ?? roomId),
		keptOpenRoomNames: keptOpenRoomIds.map(
			(roomId) => baselineRoomById.get(roomId)?.name ?? roomId,
		),
		spaceNotes,
		areaChanges,
		clearedRoundRoomNames,
	});
	return {
		kind: 'planned',
		document: plan.document,
		surfaceLineage: plan.surfaceLineage,
		wallId: options.wallId,
		hostedOpeningIds,
		createdRoomIds,
		retiredRoomIds: [...plan.retiredRoomIds],
		openedRoomIds,
		keptOpenRoomIds,
		spaceNotes,
		clearedRoundRoomNames,
		summary,
	};
}

/** `1 Room` / `2 Rooms`, so no sentence has to spell the plural rule twice. */
function counted(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * The creator-facing words for one deletion, from the planner's own counts.
 *
 * Two sentences, because these are two facts: what goes (the Wall, and the
 * hosted Openings removed in its undo step) and what happens to the Rooms. One
 * clause list read "This deletes deletes 1 hosted Opening…", and its
 * enclosure clause — itself carrying an "and" — chained onto a second one.
 */
export function wallDeletionSummary(input: {
	readonly hostedOpeningIds: readonly string[];
	readonly createdRoomIds: readonly string[];
	readonly retiredRoomIds: readonly string[];
	readonly openedRoomNames?: readonly string[];
	readonly keptOpenRoomNames?: readonly string[];
	readonly spaceNotes?: readonly SpaceLifecycleNote[];
	readonly areaChanges?: readonly { readonly name: string; readonly areaAfter: number }[];
	readonly clearedRoundRoomNames?: readonly string[];
}): string {
	const removals = ['the Wall'];
	if (input.hostedOpeningIds.length > 0) {
		removals.push(
			`${counted(input.hostedOpeningIds.length, 'hosted Opening')} in the same undo step`,
		);
	}
	const spaceSentences: string[] = [];
	if ((input.openedRoomNames ?? []).length > 0) {
		spaceSentences.push(
			`It opens ${[...new Set(input.openedRoomNames)].join(' and ')}; one side is now open.`,
		);
	}
	for (const note of input.spaceNotes ?? []) {
		if (note.reason === 'merged') {
			const overhead =
				note.successorOverhead === undefined
					? ''
					: `; ${note.successorName ?? 'the survivor'}'s ${note.successorOverhead === 'open-to-sky' ? 'Open to sky' : 'Closed'} overhead wins`;
			spaceSentences.push(
				note.successorName === undefined
					? `It merges ${note.name}${overhead}.`
					: `It merges ${note.name} into ${note.successorName}${overhead}.`,
			);
			continue;
		}
		const reason =
			note.reason === 'outline-self-intersects'
				? 'its outline would cross itself'
				: note.reason === 'outline-not-positive'
					? 'its outline would have no area'
					: note.reason === 'overlaps'
						? `it would overlap ${note.otherNames?.[0] ?? 'another Space'}`
						: note.reason === 'contains'
							? `it would contain ${note.otherNames?.[0] ?? 'another Space'}`
							: note.reason === 'last-boundary-wall'
								? 'its last Wall is gone'
								: 'it was removed';
		spaceSentences.push(`It removes ${note.name} — ${reason}.`);
	}
	const keptOpen = [...new Set(input.keptOpenRoomNames ?? [])];
	if (keptOpen.length > 0) {
		spaceSentences.push(`It keeps ${keptOpen.join(' and ')} open.`);
	}
	for (const name of [...new Set(input.clearedRoundRoomNames ?? [])]) {
		spaceSentences.push(`${name} stops being round.`);
	}
	const areaChanges = input.areaChanges ?? [];
	for (const change of areaChanges) {
		spaceSentences.push(
			`${areaChanges.length === 1 ? 'Its' : `${change.name}'s`} area is now ${change.areaAfter.toFixed(2)} m².`,
		);
	}
	const rooms =
		spaceSentences.length > 0
			? spaceSentences.join(' ')
			: input.retiredRoomIds.length > 0 && input.createdRoomIds.length > 0
				? `It merges ${counted(input.retiredRoomIds.length, 'Room')}.`
				: input.retiredRoomIds.length > 0
					? `It opens the enclosure and retires ${counted(input.retiredRoomIds.length, 'Room')}.`
					: input.createdRoomIds.length > 0
						? `It creates ${counted(input.createdRoomIds.length, 'Room')}.`
						: 'It changes no Room.';
	return `This deletes ${removals.join(' and ')}. ${rooms}`;
}

/**
 * The Wall-delete planner: one captured intent, the canonical removal pipeline,
 * and a candidate whose correspondence retains the deleted identities.
 *
 * A retired Wall keeps its identity in the F.1 sense: the before-side reference
 * is recorded and the after side is explicitly absent, so Camera/Experience
 * references to it are never retargeted — they keep the id and their own
 * diagnostics. Hosted Openings are retired in the same accepted step.
 */
function wallDeletePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_DELETE_KIND, (request) => {
		const payload = request.intent.payload;
		if (
			!isRecord(payload) ||
			Object.keys(payload).length !== 1 ||
			typeof payload.wallId !== 'string'
		) {
			return refused('A Wall deletion payload is exactly { wallId }.');
		}
		const wallId = payload.wallId;
		if (wallId.length === 0) return refused('A Wall deletion needs one wall id.');
		const captured = readCapturedOperation(request);
		if ('kind' in captured) return captured;
		const { capture, levelId } = captured;
		const baseline = request.snapshot.domain.source.units.layout.data;
		if (request.intent.targets.length !== 1) {
			return refused('A Wall deletion addresses exactly one Wall.');
		}
		const target = request.intent.targets[0]!;
		if (
			target.domain !== 'layout' ||
			target.subject.kind !== 'wall' ||
			target.subject.id !== wallId
		) {
			return refused(`The intent must address the Wall "${wallId}" it deletes.`);
		}
		const plan = planWallDeletion({ document: baseline, wallId, capture, levelId });
		if (plan.kind === 'refused') {
			return { kind: 'rejected', code: plan.code, message: plan.message, diagnostics: [] };
		}
		const contentRevision = request.snapshot.domain.source.units.layout.header.contentRevision;
		recordPreparedCowCandidate(
			request.intent.operationId,
			plan.document,
			canonicalUnitJson(request.intent),
		);
		materializeLayoutSourceForCapture(plan.document);
		const candidate: PreparedCandidate<ProjectEnvelope> = {
			operationId: request.intent.operationId,
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			source: replaceUnitData(request.snapshot.domain.source, 'layout', plan.document),
			changes: [
				{
					kind: LAYOUT_WALL_DELETE_KIND,
					subjectIds: [wallId, ...plan.hostedOpeningIds],
					fields: ['walls', 'openings', 'junctions', 'rooms'],
				},
			],
			correspondence: [
				{
					relation: 'retired',
					before: layoutSubjectReference({ kind: 'wall', id: wallId, contentRevision, levelId }),
					after: null,
				},
				...plan.hostedOpeningIds.map((openingId) => ({
					relation: 'retired' as const,
					before: layoutSubjectReference({
						kind: 'opening',
						id: openingId,
						contentRevision,
						levelId,
					}),
					after: null,
				})),
				...plan.createdRoomIds.map((roomId) => ({
					relation: 'created' as const,
					before: null,
					after: layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId }),
				})),
				...plan.retiredRoomIds.map((roomId) => ({
					relation: 'retired' as const,
					before: layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId }),
					after: null,
				})),
			],
			diagnostics: [],
		};
		registerLayoutSurfaceLineage(candidate, plan.surfaceLineage);
		return { kind: 'prepared', candidate };
	});
}

/** Circle payload: exact centre and rim points plus optional Wall dimensions. */
export type CircleRoomCreatePayload = {
	readonly center: LayoutVec2;
	readonly rim: LayoutVec2;
	readonly thickness: number | null;
	readonly height: number | null;
};

function readCircleRoomPayload(
	payload: unknown,
): CircleRoomCreatePayload | { readonly message: string } {
	if (!isRecord(payload)) return { message: 'The Circle payload must be an object.' };
	const expected = ['center', 'rim', 'thickness', 'height'];
	const unknown = Object.keys(payload).filter((key) => !expected.includes(key));
	if (unknown.length > 0)
		return { message: `The Circle payload cannot carry ${unknown.join(', ')}.` };
	for (const key of expected) {
		if (!(key in payload)) return { message: `The Circle payload is missing "${key}".` };
	}
	const point = (value: unknown): LayoutVec2 | null => {
		if (!Array.isArray(value) || value.length !== 2) return null;
		const [x, z] = value as unknown[];
		return typeof x === 'number' &&
			typeof z === 'number' &&
			Number.isFinite(x) &&
			Number.isFinite(z)
			? [x, z]
			: null;
	};
	const center = point(payload.center);
	const rim = point(payload.rim);
	if (center === null || rim === null)
		return { message: 'A Circle needs finite centre and rim [x, z] points.' };
	const optional = (value: unknown): number | null | undefined => {
		if (value === null) return null;
		if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
		return undefined;
	};
	const thickness = optional(payload.thickness);
	const height = optional(payload.height);
	if (thickness === undefined)
		return { message: 'Circle thickness must be null or a finite positive number.' };
	if (height === undefined)
		return { message: 'Circle height must be null or a finite positive number.' };
	return { center, rim, thickness, height };
}

function circleRoomCreatePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_CIRCLE_ROOM_CREATE_KIND, (request) => {
		const payload = readCircleRoomPayload(request.intent.payload);
		if ('message' in payload) return refused(payload.message);
		const captured = readCapturedOperation(request);
		if ('kind' in captured) return captured;
		const { capture, levelId } = captured;
		const baseline = request.snapshot.domain.source.units.layout.data;
		const plan = planCreateCircularRoom({
			baseline,
			center: payload.center,
			rim: payload.rim,
			capture,
			levelId,
			roomNamePrefix: 'Room',
			...(payload.thickness === null ? {} : { thickness: payload.thickness }),
			...(payload.height === null ? {} : { height: payload.height }),
		});
		if (plan.kind === 'rejected') {
			return {
				kind: 'rejected',
				code: plan.rejection.code,
				message: plan.rejection.message,
				diagnostics: [],
			};
		}
		const contentRevision = request.snapshot.domain.source.units.layout.header.contentRevision;
		recordPreparedCowCandidate(
			request.intent.operationId,
			plan.document,
			canonicalUnitJson(request.intent),
		);
		materializeLayoutSourceForCapture(plan.document);
		const candidate: PreparedCandidate<ProjectEnvelope> = {
			operationId: request.intent.operationId,
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			source: replaceUnitData(request.snapshot.domain.source, 'layout', plan.document),
			changes: [
				{
					kind: LAYOUT_CIRCLE_ROOM_CREATE_KIND,
					subjectIds: [plan.wallId],
					fields: ['walls', 'junctions', 'rooms'],
				},
			],
			correspondence: [
				{
					relation: 'created',
					before: null,
					after: layoutSubjectReference({
						kind: 'wall',
						id: plan.wallId,
						contentRevision,
						levelId,
					}),
				},
				{
					relation: 'created',
					before: null,
					after: layoutSubjectReference({
						kind: 'junction',
						id: plan.junctionId,
						contentRevision,
						levelId,
					}),
				},
				...plan.createdRoomIds.map((roomId) => ({
					relation: 'created' as const,
					before: null,
					after: layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId }),
				})),
			],
			diagnostics: [],
		};
		registerLayoutSurfaceLineage(candidate, plan.surfaceLineage);
		return { kind: 'prepared', candidate };
	});
}

function circleRadiusPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_CIRCLE_RADIUS_KIND, (request) => {
		const payload = request.intent.payload;
		if (!isRecord(payload)) return refused('The radius payload must be an object.');
		if (Object.keys(payload).length !== 2 || !('wallId' in payload) || !('radius' in payload)) {
			return refused('A radius edit payload is exactly { wallId, radius }.');
		}
		const { wallId, radius } = payload;
		if (typeof wallId !== 'string' || wallId.length === 0)
			return refused('A radius edit needs one wall id.');
		if (typeof radius !== 'number' || !Number.isFinite(radius) || radius <= 0) {
			return refused('A radius must be one finite positive number of meters.');
		}
		const plan = planResizeClosedWallRadius({
			document: request.snapshot.domain.source.units.layout.data,
			wallId,
			radius,
		});
		if (plan.kind === 'rejected') {
			return {
				kind: 'rejected',
				code: plan.rejection.code,
				message: plan.rejection.message,
				diagnostics: [],
			};
		}
		return preparedLayoutCandidate(
			request,
			LAYOUT_CIRCLE_RADIUS_KIND,
			{ kind: 'wall', id: wallId },
			plan.document,
			['radius', 'diameter'],
			{ surfaceLineage: plan.surfaceLineage },
		);
	});
}

function circleTranslatePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_CIRCLE_TRANSLATE_KIND, (request) => {
		const payload = request.intent.payload;
		if (!isRecord(payload)) return refused('The Circle move payload must be an object.');
		const expected = ['wallId', 'deltaX', 'deltaZ'];
		if (
			Object.keys(payload).length !== expected.length ||
			expected.some((key) => !(key in payload))
		) {
			return refused('A Circle move payload is exactly { wallId, deltaX, deltaZ }.');
		}
		const { wallId, deltaX, deltaZ } = payload;
		if (typeof wallId !== 'string' || wallId.length === 0)
			return refused('A Circle move needs one wall id.');
		if (
			typeof deltaX !== 'number' ||
			!Number.isFinite(deltaX) ||
			typeof deltaZ !== 'number' ||
			!Number.isFinite(deltaZ)
		) {
			return refused('A Circle move needs finite X and Z deltas in meters.');
		}
		const plan = planTranslateClosedWall({
			document: request.snapshot.domain.source.units.layout.data,
			wallId,
			delta: [deltaX, deltaZ],
		});
		if (plan.kind === 'rejected') {
			return {
				kind: 'rejected',
				code: plan.rejection.code,
				message: plan.rejection.message,
				diagnostics: [],
			};
		}
		return preparedLayoutCandidate(
			request,
			LAYOUT_CIRCLE_TRANSLATE_KIND,
			{ kind: 'wall', id: wallId },
			plan.document,
			['position'],
			{ surfaceLineage: plan.surfaceLineage },
		);
	});
}

/** The chain drawing operations plus Circle creation, radius and move. */
export function createDrawingPlanners(): readonly DomainPlanner<ProjectEnvelope>[] {
	return [
		wallChainCommitPlanner(),
		wallDeletePlanner(),
		circleRoomCreatePlanner(),
		circleRadiusPlanner(),
		circleTranslatePlanner(),
		...createRoundRoomPlanners(),
	];
}

/** The F.4 intent for one Circle creation, with its captured identity and level. */
export function circleRoomCreateIntent(input: {
	readonly payload: CircleRoomCreatePayload;
	readonly capture: LayoutIdCapture;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: LAYOUT_CIRCLE_ROOM_CREATE_KIND,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [],
		payload: {
			center: [input.payload.center[0], input.payload.center[1]],
			rim: [input.payload.rim[0], input.payload.rim[1]],
			thickness: input.payload.thickness,
			height: input.payload.height,
		},
		capturedInputs: [layoutWorkingLevelInput(input.levelId), layoutIdCaptureInput(input.capture)],
		allocatedIds: [],
	};
}

/** The F.4 intent for one exact closed-Wall radius edit. */
export function circleRadiusIntent(input: {
	readonly wallId: string;
	readonly radius: number;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: LAYOUT_CIRCLE_RADIUS_KIND,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [
			layoutSubjectReference({
				kind: 'wall',
				id: input.wallId,
				contentRevision: input.contentRevision,
				levelId: input.levelId,
			}),
		],
		payload: { wallId: input.wallId, radius: input.radius },
		capturedInputs: [layoutWorkingLevelInput(input.levelId)],
		allocatedIds: [],
	};
}

/** The F.4 intent for one rigid closed-Wall move. */
export function circleTranslateIntent(input: {
	readonly wallId: string;
	readonly delta: LayoutVec2;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: LAYOUT_CIRCLE_TRANSLATE_KIND,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [
			layoutSubjectReference({
				kind: 'wall',
				id: input.wallId,
				contentRevision: input.contentRevision,
				levelId: input.levelId,
			}),
		],
		payload: { wallId: input.wallId, deltaX: input.delta[0], deltaZ: input.delta[1] },
		capturedInputs: [layoutWorkingLevelInput(input.levelId)],
		allocatedIds: [],
	};
}

/** The F.4 intent for one chain commit, with its captured identity and level. */
export function wallChainCommitIntent(input: {
	readonly payload: WallChainCommitPayload;
	readonly capture: LayoutIdCapture;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: LAYOUT_WALL_CHAIN_COMMIT_KIND,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [],
		payload: {
			points: input.payload.points.map((point) => [point[0], point[1]]),
			close: input.payload.close,
			junctionSnaps: input.payload.junctionSnaps.map((snap) => ({
				pointIndex: snap.pointIndex,
				junctionId: snap.junctionId,
			})),
			hostSnaps: input.payload.hostSnaps.map((snap) => ({
				pointIndex: snap.pointIndex,
				wallId: snap.wallId,
			})),
			thickness: input.payload.thickness,
			height: input.payload.height,
			...(input.payload.arc === null || input.payload.arc === undefined
				? {}
				: {
						arc: {
							pointIndex: input.payload.arc.pointIndex,
							apex: [input.payload.arc.apex[0], input.payload.arc.apex[1]],
						},
					}),
		},
		// The capture and the working level are the **canonical** captured inputs, not a
		// phase-local encoding: the planner reads them through the same readers every
		// other Layout operation uses, so a replay reproduces the same ids.
		capturedInputs: [layoutWorkingLevelInput(input.levelId), layoutIdCaptureInput(input.capture)],
		allocatedIds: [],
	};
}

/** The F.4 intent for one Wall deletion, addressed at the Wall it deletes. */
export function wallDeleteIntent(input: {
	readonly wallId: string;
	readonly capture: LayoutIdCapture;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: LAYOUT_WALL_DELETE_KIND,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [
			layoutSubjectReference({
				kind: 'wall',
				id: input.wallId,
				contentRevision: input.contentRevision,
				levelId: input.levelId,
			}),
		],
		payload: { wallId: input.wallId },
		capturedInputs: [layoutWorkingLevelInput(input.levelId), layoutIdCaptureInput(input.capture)],
		allocatedIds: [],
	};
}
