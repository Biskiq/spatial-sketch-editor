import { type DomainPlanner, type PlannerRequest } from '../../f4/types';
import { type SemanticReference } from '../../references/types';
import { type SceneConnection, type ScenePathAnchor } from '../../scene';
import { ShapeReader } from '../../strict-shape';
import { prepared } from './experience/update';
import { refuse, envelopeOf, revisionOf, reference, targetOf, capturedId, allIds } from './shared';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '../source';
import { CAMERA_UNIT_FORMAT_VERSION, type ProjectEnvelope } from '../types';

/** Create one straight Camera connection between two existing Views. */
export const CAMERA_CONNECTION_CREATE_KIND = 'camera-connection-create';
/** Edit one Camera connection's interior anchors or per-direction duration. */
export const CAMERA_CONNECTION_UPDATE_KIND = 'camera-connection-update';
/** The canonical clearance a new Camera path carries; authored, never derived. */
export const CAMERA_CONNECTION_DEFAULT_CLEARANCE = 0.35;

export const CONNECTION_ANCHOR_KEYS = ['id', 'position'] as const;
export const CONNECTION_TIMING_KEYS = ['forward', 'reverse'] as const;
export const CONNECTION_TIMING_DIRECTION_KEYS = ['durationSeconds'] as const;
export const CONNECTION_UPDATE_KEYS = ['anchors', 'timing'] as const;
export const CONNECTION_CREATE_PAYLOAD_KEYS: readonly string[] = [];

export function sameUnorderedPair(
	connection: { readonly fromNodeId: string; readonly toNodeId: string },
	left: string,
	right: string,
): boolean {
	return (
		(connection.fromNodeId === left && connection.toNodeId === right) ||
		(connection.fromNodeId === right && connection.toNodeId === left)
	);
}

/** The two ordered `camera:view` targets a create names: from first, then to. */
export function orderedViewTargets(
	intent: PlannerRequest<ProjectEnvelope>['intent'],
): readonly [SemanticReference, SemanticReference] | null {
	if (intent.targets.length !== 2) return null;
	const [from, to] = intent.targets;
	if (
		from.domain !== 'camera' ||
		to.domain !== 'camera' ||
		from.subject.kind !== 'view' ||
		to.subject.kind !== 'view'
	) {
		return null;
	}
	return [from, to];
}

/**
 * Read the optional authored interior anchors. Current-format anchors are
 * world-local `{id, position}` records: a Room-owned point or a duplicate id is
 * refused rather than normalized into a second coordinate basis.
 */
export function readConnectionAnchors(
	reader: ShapeReader,
	input: unknown,
	path: string,
): ScenePathAnchor[] | null {
	if (!Array.isArray(input)) {
		reader.problem(path, 'not-an-array', `${path} must be an array of path anchors`);
		return null;
	}
	const anchors: ScenePathAnchor[] = [];
	const ids = new Set<string>();
	let ok = true;
	for (const [index, entry] of input.entries()) {
		const entryPath = `${path}[${index}]`;
		const record = reader.object(entry, entryPath, CONNECTION_ANCHOR_KEYS);
		if (record === null) {
			ok = false;
			continue;
		}
		const id = reader.opaqueId(record.id, `${entryPath}.id`);
		const position = reader.vector3(record.position, `${entryPath}.position`);
		if (id === null || position === null) {
			ok = false;
			continue;
		}
		if (ids.has(id)) {
			reader.problem(
				`${entryPath}.id`,
				'duplicate-anchor',
				`Camera path anchor "${id}" appears more than once`,
			);
			ok = false;
			continue;
		}
		ids.add(id);
		anchors.push({ id, position });
	}
	if (reader.issues.length !== 0) ok = false;
	return ok ? anchors : null;
}

export type ConnectionTimingUpdate = {
	readonly forward?: { readonly durationSeconds: number | null };
	readonly reverse?: { readonly durationSeconds: number | null };
};

export function readConnectionTiming(
	reader: ShapeReader,
	input: unknown,
	path: string,
): ConnectionTimingUpdate | null {
	const record = reader.object(input, path, CONNECTION_TIMING_KEYS);
	if (record === null) return null;
	let ok = true;
	const update: {
		forward?: { durationSeconds: number | null };
		reverse?: { durationSeconds: number | null };
	} = {};
	for (const direction of ['forward', 'reverse'] as const) {
		const raw = record[direction];
		if (raw === undefined) continue;
		const directionPath = `${path}.${direction}`;
		const directionRecord = reader.object(raw, directionPath, CONNECTION_TIMING_DIRECTION_KEYS);
		if (directionRecord === null) {
			ok = false;
			continue;
		}
		if (!('durationSeconds' in directionRecord)) {
			reader.problem(directionPath, 'missing-field', `${directionPath} must name durationSeconds`);
			ok = false;
			continue;
		}
		if (directionRecord.durationSeconds === null) {
			update[direction] = { durationSeconds: null };
			continue;
		}
		const duration = reader.numberAtLeast(
			directionRecord.durationSeconds,
			`${directionPath}.durationSeconds`,
			0,
			true,
		);
		if (duration === null) {
			ok = false;
			continue;
		}
		update[direction] = { durationSeconds: duration };
	}
	if (!ok || reader.issues.length !== 0) return null;
	if (update.forward === undefined && update.reverse === undefined) {
		reader.problem(path, 'missing-field', `${path} names no direction to change`);
		return null;
	}
	return update;
}

/** Apply duration-only changes, preserving every other field of both directions. */
export function mergeConnectionTiming(
	previous: SceneConnection['timing'],
	update: ConnectionTimingUpdate,
): SceneConnection['timing'] {
	const next: NonNullable<SceneConnection['timing']> = { ...(previous ?? {}) };
	for (const direction of ['forward', 'reverse'] as const) {
		const change = update[direction];
		if (change === undefined) continue;
		const current = next[direction];
		if (change.durationSeconds === null) {
			if (current === undefined) continue;
			const { durationSeconds: _cleared, ...rest } = current;
			if (Object.keys(rest).length === 0) delete next[direction];
			else next[direction] = rest;
			continue;
		}
		next[direction] = { ...(current ?? {}), durationSeconds: change.durationSeconds };
	}
	return next.forward === undefined && next.reverse === undefined ? undefined : next;
}

/**
 * Create one straight Camera path between two current Views.
 *
 * Targets: exactly two `camera:view` references, from then to. The planner
 * allocates no identity — the captured connection id arrives in
 * `intent.allocatedIds` — writes an empty `auto-bezier` anchor list, the
 * canonical clearance and no timing, so Camera's own automatic duration is in
 * effect. An existing connection on the same unordered pair refuses: a Travel
 * never invents a duplicate path or picks one silently.
 */
export function createCameraConnectionCreatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.camera-connection-create',
		kind: CAMERA_CONNECTION_CREATE_KIND,
		admission: { domain: 'camera', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(
				request.intent.payload,
				'$.payload',
				CONNECTION_CREATE_PAYLOAD_KEYS,
			);
			if (payload === null || reader.issues.length !== 0) {
				return refuse('invalid-payload', 'The Camera path payload is not empty', reader.issues);
			}
			const pair = orderedViewTargets(request.intent);
			if (pair === null) {
				return refuse(
					'unsupported-operation',
					'camera-connection-create targets exactly two camera:view references, from then to',
				);
			}
			const [fromTarget, toTarget] = pair;
			if (fromTarget.subject.id === toTarget.subject.id) {
				return refuse('same-view', 'A Camera path needs two different Views');
			}
			const views = envelope.units.camera.data.views;
			const fromView = views.find((view) => view.id === fromTarget.subject.id);
			const toView = views.find((view) => view.id === toTarget.subject.id);
			if (fromView === undefined || toView === undefined) {
				return refuse('missing-target', 'A Camera path endpoint is not a View in this envelope');
			}
			const existing = envelope.units.camera.data.connections.find((connection) =>
				sameUnorderedPair(connection, fromView.id, toView.id),
			);
			if (existing !== undefined) {
				return refuse(
					'path-already-exists',
					`A Camera path already joins "${fromView.label}" and "${toView.label}"`,
				);
			}
			const connectionId = capturedId(request.intent, 'connection');
			if (connectionId === null || allIds(envelope).has(connectionId)) {
				return refuse(
					'invalid-identity',
					'The captured Camera connection id is missing or already used',
				);
			}
			const connection: SceneConnection = {
				id: connectionId,
				fromNodeId: fromView.id,
				toNodeId: toView.id,
				clearance: CAMERA_CONNECTION_DEFAULT_CLEARANCE,
				positionPath: { kind: 'auto-bezier', anchors: [] },
			};
			const connected = views.map((view) => {
				const other =
					view.id === fromView.id ? toView.id : view.id === toView.id ? fromView.id : null;
				if (other === null || view.connectedViewIds.includes(other)) return view;
				return { ...view, connectedViewIds: [...view.connectedViewIds, other] };
			});
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					camera: {
						header: { ...envelope.units.camera.header },
						data: {
							formatVersion: CAMERA_UNIT_FORMAT_VERSION,
							views: connected,
							connections: [...envelope.units.camera.data.connections, connection],
						},
					},
				},
			};
			return prepared(
				request,
				candidate,
				[
					{
						kind: 'camera.connection.created',
						subjectIds: [connection.id],
						fields: ['fromNodeId', 'toNodeId', 'clearance', 'positionPath'],
					},
				],
				[
					{
						relation: 'created',
						before: null,
						after: reference(
							'camera',
							'connection',
							connection.id,
							[],
							revisionOf(candidate, 'camera'),
						),
					},
				],
			);
		},
	};
}

/**
 * Edit one Camera connection's interior anchors or one direction's duration.
 *
 * Targets: exactly one `camera:connection` reference. `anchors` replaces the
 * interior list; `timing.forward` / `timing.reverse` writes only
 * `durationSeconds`, and `null` clears only that direction's duration. Easing,
 * the other direction, clearance, endpoints and every other field survive
 * verbatim. A payload the connection already satisfies refuses as a no-op.
 */
export function createCameraConnectionUpdatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.camera-connection-update',
		kind: CAMERA_CONNECTION_UPDATE_KIND,
		admission: { domain: 'camera', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', CONNECTION_UPDATE_KEYS);
			if (payload === null)
				return refuse(
					'invalid-payload',
					'The Camera path payload is not a valid shape',
					reader.issues,
				);
			const anchors =
				payload.anchors === undefined
					? undefined
					: readConnectionAnchors(reader, payload.anchors, '$.payload.anchors');
			const timing =
				payload.timing === undefined
					? undefined
					: readConnectionTiming(reader, payload.timing, '$.payload.timing');
			if (
				reader.issues.length !== 0 ||
				(payload.anchors !== undefined && anchors === null) ||
				(payload.timing !== undefined && timing === null)
			) {
				return refuse(
					'invalid-payload',
					'The Camera path payload is not a valid shape',
					reader.issues,
				);
			}
			if (anchors === undefined && timing === undefined) {
				return refuse('invalid-payload', 'The Camera path payload names no field to change');
			}
			const target = targetOf(request.intent, 'camera', 'connection');
			if (target === null) {
				return refuse(
					'unsupported-operation',
					'camera-connection-update targets exactly one camera:connection reference',
				);
			}
			const index = envelope.units.camera.data.connections.findIndex(
				(connection) => connection.id === target.subject.id,
			);
			if (index === -1) {
				return refuse(
					'missing-target',
					`camera connection "${target.subject.id}" is not in this envelope`,
				);
			}
			const previous = envelope.units.camera.data.connections[index]!;
			const nextAnchors = anchors === undefined || anchors === null ? undefined : anchors;
			const nextTiming =
				timing === undefined || timing === null
					? previous.timing
					: mergeConnectionTiming(previous.timing, timing);
			const updated: SceneConnection = {
				...previous,
				...(nextAnchors === undefined
					? {}
					: { positionPath: { ...previous.positionPath, anchors: nextAnchors } }),
				...(timing === undefined || timing === null
					? {}
					: nextTiming === undefined
						? {}
						: { timing: nextTiming }),
			};
			if (timing !== undefined && nextTiming === undefined)
				delete (updated as { timing?: unknown }).timing;
			const changedFields: string[] = [];
			if (
				anchors !== undefined &&
				JSON.stringify(previous.positionPath) !== JSON.stringify(updated.positionPath)
			) {
				changedFields.push('anchors');
			}
			if (
				timing !== undefined &&
				JSON.stringify(previous.timing) !== JSON.stringify(updated.timing)
			) {
				changedFields.push('timing');
			}
			if (changedFields.length === 0) {
				return refuse('no-op', 'The Camera path already has these values');
			}
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					camera: {
						header: { ...envelope.units.camera.header },
						data: {
							formatVersion: CAMERA_UNIT_FORMAT_VERSION,
							views: envelope.units.camera.data.views,
							connections: envelope.units.camera.data.connections.map((connection, position) =>
								position === index ? updated : connection,
							),
						},
					},
				},
			};
			return prepared(
				request,
				candidate,
				[{ kind: 'camera.connection.updated', subjectIds: [updated.id], fields: changedFields }],
				[
					{
						relation: 'preserved',
						before: reference(
							'camera',
							'connection',
							previous.id,
							[],
							revisionOf(envelope, 'camera'),
						),
						after: reference(
							'camera',
							'connection',
							previous.id,
							[],
							revisionOf(candidate, 'camera'),
						),
					},
				],
			);
		},
	};
}

/* --- Experience and Guide fields -------------------------------- */
