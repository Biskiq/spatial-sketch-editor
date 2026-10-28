/**
 * T1.P02.S02 — the two bounded F.4 operations drawing adds.
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
	layoutIdCaptureInput,
	layoutWorkingLevelInput,
	materializeLayoutSourceForCapture,
	planDeleteWall,
	planWallChain,
	readLayoutIdCapture,
	readLayoutWorkingLevel,
	recordPreparedCowCandidate,
	type LayoutDocumentWallFirst,
	type LayoutIdCapture,
	type LayoutVec2,
	type WallFirstOpPlan
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
	canonicalUnitJson,
	replaceUnitData,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

import { layoutPlanner } from './precision';

export const LAYOUT_WALL_CHAIN_COMMIT_KIND = 'layout-wall-chain-commit';
export const LAYOUT_WALL_DELETE_KIND = 'layout-wall-delete';

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
	const expected = ['points', 'close', 'junctionSnaps', 'hostSnaps', 'thickness', 'height'];
	const unknown = Object.keys(payload).filter((key) => !expected.includes(key));
	if (unknown.length > 0) return { message: `The chain commit payload cannot carry ${unknown.join(', ')}.` };
	for (const key of expected) {
		if (!(key in payload)) return { message: `The chain commit payload is missing "${key}".` };
	}
	if (!Array.isArray(payload.points)) return { message: 'The chain commit payload needs a points array.' };
	const points: WallChainCommitPoint[] = [];
	for (const entry of payload.points) {
		if (!Array.isArray(entry) || entry.length !== 2) {
			return { message: 'Every chain point must be a [x, z] pair.' };
		}
		const [x, z] = entry as unknown[];
		if (typeof x !== 'number' || typeof z !== 'number' || !Number.isFinite(x) || !Number.isFinite(z)) {
			return { message: 'Every chain point must carry two finite numbers.' };
		}
		points.push([x, z]);
	}
	if (typeof payload.close !== 'boolean') return { message: 'The chain commit payload needs a boolean close.' };
	const readSnaps = <T>(
		value: unknown,
		key: string,
		read: (record: Record<string, unknown>) => T | null
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
		idKey: string
	): { pointIndex: number; id: string } | null => {
		const keys = Object.keys(record);
		if (keys.length !== 2 || !keys.includes('pointIndex') || !keys.includes(idKey)) return null;
		const pointIndex = record.pointIndex;
		const id = record[idKey];
		if (typeof pointIndex !== 'number' || !Number.isInteger(pointIndex) || pointIndex < 0) return null;
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
	if (thickness === undefined) return { message: 'Chain thickness must be null or a finite positive number.' };
	if (height === undefined) return { message: 'Chain height must be null or a finite positive number.' };
	return {
		points,
		close: payload.close,
		junctionSnaps: junctionSnaps as readonly { pointIndex: number; junctionId: string }[],
		hostSnaps: hostSnaps as readonly { pointIndex: number; wallId: string }[],
		thickness,
		height
	};
}

/**
 * An exact F.1 reference to one Layout subject of the operation's own level.
 *
 * Shared with the Opening operations (S03): they address a host Wall or an
 * Opening through the same reference shape, never a second encoding.
 */
export function layoutSubjectReference(input: {
	readonly kind: string;
	readonly id: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): SemanticReference {
	return {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: input.contentRevision },
		subject: { kind: input.kind, id: input.id },
		instancePath: [],
		location: { kind: 'layout-location', levelId: input.levelId, structureInstancePath: [] },
		componentId: null,
		capabilityId: null
	};
}

/**
 * The operation's captured nonce and working level, through the canonical
 * readers. A missing capture is a caller defect, never something to infer from
 * the document.
 *
 * Shared with the Opening operations (S03), which use the same captured
 * identity and level contract as every other Layout F.4 planner.
 */
export function readCapturedOperation(
	request: PlannerRequest<ProjectEnvelope>
): { readonly capture: LayoutIdCapture; readonly levelId: string } | PlannerOutcome<ProjectEnvelope> {
	const capture = readLayoutIdCapture(request.capturedInputs);
	if (capture === null) {
		return refused('The operation must capture its Layout identity before evaluation.');
	}
	const levelId = readLayoutWorkingLevel(request.capturedInputs);
	if (levelId === null) {
		return refused('The intent must capture its working Layout level before evaluation.');
	}
	return { capture, levelId };
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
			endpointHostSnaps: payload.hostSnaps
		});
		if (policy !== null) return refused(policy.message);
		const plan = planWallChain({
			baseline,
			points: payload.points,
			close: payload.close,
			capture,
			levelId,
			endpointJunctionSnaps: payload.junctionSnaps,
			endpointHostSnaps: payload.hostSnaps,
			...(payload.thickness === null ? {} : { thickness: payload.thickness }),
			...(payload.height === null ? {} : { height: payload.height })
		});
		if (plan.kind === 'rejected') {
			return {
				kind: 'rejected',
				code: plan.rejection.code,
				message: plan.rejection.message,
				diagnostics: []
			};
		}
		const contentRevision = request.snapshot.domain.source.units.layout.header.contentRevision;
		const document = plan.document;
		recordPreparedCowCandidate(request.intent.operationId, document, canonicalUnitJson(request.intent));
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
					subjectIds: [...plan.createdWallIds],
					fields: ['walls', 'junctions', 'rooms']
				}
			],
			correspondence: [
				...plan.createdWallIds.map((wallId) => ({
					relation: 'created' as const,
					before: null,
					after: layoutSubjectReference({ kind: 'wall', id: wallId, contentRevision, levelId })
				})),
				...plan.createdJunctionIds.map((junctionId) => ({
					relation: 'created' as const,
					before: null,
					after: layoutSubjectReference({ kind: 'junction', id: junctionId, contentRevision, levelId })
				})),
				...createdRoomIds.map((roomId) => ({
					relation: 'created' as const,
					before: null,
					after: layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId })
				})),
				...plan.retiredRoomIds.map((roomId) => ({
					relation: 'retired' as const,
					before: layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId }),
					after: null
				}))
			],
			diagnostics: []
		};
		return { kind: 'prepared', candidate };
	});
}

/** What one Wall deletion does, derived from the canonical planner (never guessed). */
export type WallDeletionSummary = {
	readonly wallId: string;
	readonly hostedOpeningIds: readonly string[];
	readonly createdRoomIds: readonly string[];
	readonly retiredRoomIds: readonly string[];
	readonly summary: string;
};

export type WallDeletionPreview =
	| ({ readonly kind: 'planned'; readonly document: LayoutDocumentWallFirst } & WallDeletionSummary)
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
	const plan: WallFirstOpPlan = planDeleteWall(options.document, options.wallId, options.capture, options.levelId);
	if (plan.kind === 'rejected') {
		return { kind: 'refused', code: plan.rejection.code, message: plan.rejection.message };
	}
	const hostedOpeningIds = options.document.openings
		.filter((opening) => opening.wallId === options.wallId)
		.map((opening) => opening.id);
	const createdRoomIds = plan.lineage.map((record) => record.roomId);
	const summary = wallDeletionSummary({
		hostedOpeningIds,
		createdRoomIds,
		retiredRoomIds: plan.retiredRoomIds
	});
	return {
		kind: 'planned',
		document: plan.document,
		wallId: options.wallId,
		hostedOpeningIds,
		createdRoomIds,
		retiredRoomIds: [...plan.retiredRoomIds],
		summary
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
}): string {
	const removals = ['the Wall'];
	if (input.hostedOpeningIds.length > 0) {
		removals.push(`${counted(input.hostedOpeningIds.length, 'hosted Opening')} in the same undo step`);
	}
	const rooms =
		input.retiredRoomIds.length > 0 && input.createdRoomIds.length > 0
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
		if (!isRecord(payload) || Object.keys(payload).length !== 1 || typeof payload.wallId !== 'string') {
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
		if (target.domain !== 'layout' || target.subject.kind !== 'wall' || target.subject.id !== wallId) {
			return refused(`The intent must address the Wall "${wallId}" it deletes.`);
		}
		const plan = planWallDeletion({ document: baseline, wallId, capture, levelId });
		if (plan.kind === 'refused') {
			return { kind: 'rejected', code: plan.code, message: plan.message, diagnostics: [] };
		}
		const contentRevision = request.snapshot.domain.source.units.layout.header.contentRevision;
		recordPreparedCowCandidate(request.intent.operationId, plan.document, canonicalUnitJson(request.intent));
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
					fields: ['walls', 'openings', 'junctions', 'rooms']
				}
			],
			correspondence: [
				{
					relation: 'retired',
					before: layoutSubjectReference({ kind: 'wall', id: wallId, contentRevision, levelId }),
					after: null
				},
				...plan.hostedOpeningIds.map((openingId) => ({
					relation: 'retired' as const,
					before: layoutSubjectReference({ kind: 'opening', id: openingId, contentRevision, levelId }),
					after: null
				})),
				...plan.createdRoomIds.map((roomId) => ({
					relation: 'created' as const,
					before: null,
					after: layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId })
				})),
				...plan.retiredRoomIds.map((roomId) => ({
					relation: 'retired' as const,
					before: layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId }),
					after: null
				}))
			],
			diagnostics: []
		};
		return { kind: 'prepared', candidate };
	});
}

/** The two S02 drawing operations, registered beside the precision planners. */
export function createDrawingPlanners(): readonly DomainPlanner<ProjectEnvelope>[] {
	return [wallChainCommitPlanner(), wallDeletePlanner()];
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
				junctionId: snap.junctionId
			})),
			hostSnaps: input.payload.hostSnaps.map((snap) => ({ pointIndex: snap.pointIndex, wallId: snap.wallId })),
			thickness: input.payload.thickness,
			height: input.payload.height
		},
		// The capture and the working level are the **canonical** captured inputs, not a
		// phase-local encoding: the planner reads them through the same readers every
		// other Layout operation uses, so a replay reproduces the same ids.
		capturedInputs: [layoutWorkingLevelInput(input.levelId), layoutIdCaptureInput(input.capture)],
		allocatedIds: []
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
				levelId: input.levelId
			})
		],
		payload: { wallId: input.wallId },
		capturedInputs: [layoutWorkingLevelInput(input.levelId), layoutIdCaptureInput(input.capture)],
		allocatedIds: []
	};
}
