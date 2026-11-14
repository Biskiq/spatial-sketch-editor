import { selectedRoomLabel } from './layout-subjects';
import { planarDeltaLabel } from '$lib/authoring/stage/stage-adapter-host';
import {
	mintLayoutIdCapture,
	resolveIsolatedRoomGroupSubgraph,
	resolveIsolatedRoomSubgraph,
	type LayoutIdCapture,
	type LayoutVec2
} from '@portfolio/layout-core';

import {
	type StageAdapterContext,
	type StageCardActionOutcome,
	type StageCandidatePreview,
	type StageKeyboardIntent,
	type StagePointerIntent
} from '$lib/authoring/stage/stage-adapter-host';
import { stageUnitRevision } from '$lib/authoring/stage/stage-adapter-host';
import type { GestureAcquisition, ProposalLease } from '$lib/authoring/stage/stage-adapter-host';

import { roomDuplicateRefusalWords, wallRefusalWords, type RoomDuplicateRejection } from './refusals';
import {
	LAYOUT_ROOM_DUPLICATE_KIND,
	roomDuplicateIntent,
	roomDuplicateIsCoincident
} from './room-duplicate-planners';
import { pointerDatumPoint } from './stage-pointer';
import type { StageHandleDescriptor } from '$lib/authoring/stage/stage-adapter-host';
import { LAYOUT_ROOM_MOVE_KIND, buildLayoutIntent } from './precision';
import { resolvePlanarDragSnap, type LayoutSnapWinner } from './snap';
import {
	buildCompiledLayoutCandidatePaper,
	type CandidatePaperGeometry,
	wallCenterlinePaper,
	candidatePreviewOf
} from './candidate-preview';
import { datumSnapDistance, isPointerDrag, type LayoutManipulationPorts } from './manipulation-support';

export function createRoomGestureSession({
	services,
	document,
	levelId,
	contentRevision,
	publishRefusal,
	settleRefusal
}: LayoutManipulationPorts) {
	type RoomMoveGesture = {
		readonly roomId: string;
		readonly evaluationId: string;
		readonly revision: string;
		readonly pressCss: readonly [number, number];
		readonly pressPoint: readonly [number, number];
		readonly labelWorld: [number, number, number];
		readonly lease: Extract<GestureAcquisition, { kind: 'granted' }>;
		delta: readonly [number, number];
		snap: LayoutSnapWinner | null;
		readonly centerlines: CandidatePaperGeometry | null;
		readonly movedRooms: number;
		readonly refusal: string | null;
	};
	let roomMove: RoomMoveGesture | null = null;
	const ROOM_MOVE_MARK = 'layout-room-move-mark';
	function endRoomMove(): void {
		const current = roomMove;
		roomMove = null;
		if (current?.lease.lease.active) current.lease.lease.release();
	}
	function roomMoveDescriptors(ctx: StageAdapterContext): readonly StageHandleDescriptor[] {
		const label = selectedRoomLabel(ctx);
		if (label === null) return [];
		const current = roomMove?.roomId === label.roomId ? roomMove : null;
		const at: [number, number, number] =
			current === null
				? label.world
				: [label.world[0] + current.delta[0], label.world[1], label.world[2] + current.delta[1]];
		return [
			{
				id: ROOM_MOVE_MARK,
				kind: 'point',
				role: 'edit',
				draw: { cross: true },
				anchor: at,
				axis: [1, 0, 0],
				extent: 0.5,
				// Below the Room's name and area, so the label stays readable.
				screen: { offset: [0, 34] },
				label: 'Room position',
				fact: 'position',
				verb: 'Position',
				planner: LAYOUT_ROOM_MOVE_KIND,
				value:
					current === null
						? 'Δx 0.00 · Δz 0.00 m'
						: `${planarDeltaLabel(current.delta[0], current.delta[1])}${current.movedRooms > 1 ? ` · ${current.movedRooms} Rooms` : ''}`,
				refusal: current?.refusal ?? null
			}
		];
	}
	function roomMovePointer(intent: StagePointerIntent, ctx: StageAdapterContext): boolean {
		if (intent.phase === 'down') {
			if (intent.handleId !== ROOM_MOVE_MARK) return false;
			const label = selectedRoomLabel(ctx);
			const point = pointerDatumPoint(ctx, intent.css);
			if (label === null || point === null) return false;
			const lease = services.stage.acquireGesture({
				owner: 'layout-room-move',
				evaluationId: intent.evaluationId,
				policy: 'cancel-on-reading-change'
			});
			if (lease.kind !== 'granted') return false;
			settleRefusal(null);
			const isolation = resolveIsolatedRoomGroupSubgraph(document, label.roomId);
			const centerlines =
				isolation.kind === 'success'
					? wallCenterlinePaper(
							document,
							new Set(isolation.subgraph.wallIds),
							ctx.snapshot.domain.datumMeters
						)
					: null;
			roomMove = {
				roomId: label.roomId,
				evaluationId: intent.evaluationId,
				revision: services.authoring.acceptedRevision().revisionId,
				pressCss: intent.css,
				pressPoint: [point[0], point[1]],
				labelWorld: label.world,
				lease,
				delta: [0, 0],
				snap: null,
				centerlines,
				movedRooms: isolation.kind === 'success' ? isolation.subgraph.roomIds.length : 1,
				refusal:
					isolation.kind === 'rejected'
						? wallRefusalWords(isolation.rejection.code, isolation.rejection.message)
						: null
			};
			services.stage.notifySurfaceChange();
			return true;
		}
		const current = roomMove;
		if (current === null) return false;
		if (
			intent.phase === 'cancel' ||
			intent.evaluationId !== current.evaluationId ||
			!current.lease.lease.active
		) {
			endRoomMove();
			services.stage.notifySurfaceChange();
			return true;
		}
		if (intent.phase === 'move') {
			if (!isPointerDrag(current.pressCss, intent.css)) {
				current.delta = [0, 0];
				current.snap = null;
				services.stage.notifySurfaceChange();
				return true;
			}
			const point = pointerDatumPoint(ctx, intent.css);
			if (point === null) return true;
			const snapped = resolvePlanarDragSnap(current.pressPoint, point, ctx.drafting(), (from, to) =>
				datumSnapDistance(ctx, from, to)
			);
			const delta: [number, number] = [
				Number((snapped.point[0] - current.pressPoint[0]).toFixed(9)),
				Number((snapped.point[1] - current.pressPoint[1]).toFixed(9))
			];
			current.snap = snapped.winner;
			current.delta = delta;
			services.stage.notifySurfaceChange();
			return true;
		}
		// Release: one captured candidate, one intent, one history entry.
		endRoomMove();
		if (
			intent.phase === 'up' &&
			(current.delta[0] !== 0 || current.delta[1] !== 0) &&
			isPointerDrag(current.pressCss, intent.css)
		) {
			if (current.refusal === null) void commitRoomMove(current);
			else settleRoomRefusal(current, current.refusal);
		}
		services.stage.notifySurfaceChange();
		return true;
	}
	async function commitRoomMove(current: RoomMoveGesture): Promise<void> {
		const snapshot = services.stage.snapshot();
		if (stageUnitRevision(snapshot, 'layout') !== contentRevision) return;
		const outcome = await services.authoring.accept(
			buildLayoutIntent({
				kind: LAYOUT_ROOM_MOVE_KIND,
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: current.revision,
				contentRevision,
				levelId,
				targets: [
					{
						version: 1,
						domain: 'layout',
						subject: { kind: 'room', id: current.roomId },
						revision: { kind: 'exact', contentRevision },
						instancePath: [],
						location: { kind: 'layout-location', levelId, structureInstancePath: [] },
						componentId: null,
						capabilityId: null
					}
				],
				payload: { roomId: current.roomId, deltaX: current.delta[0], deltaZ: current.delta[1] }
			})
		);
		if (
			outcome.kind === 'refused' &&
			stageUnitRevision(services.stage.snapshot(), 'layout') === contentRevision
		) {
			settleRoomRefusal(current, wallRefusalWords(outcome.code, outcome.message));
		}
		services.stage.notifySurfaceChange();
	}
	function settleRoomRefusal(current: RoomMoveGesture, text: string): void {
		settleRefusal({
			subject: { kind: 'room', roomId: current.roomId },
			contentRevision,
			point: [current.labelWorld[0] + current.delta[0], current.labelWorld[2] + current.delta[1]],
			text
		});
	}

	function roomMoveKey(intent: StageKeyboardIntent): boolean {
		if (roomMove === null || intent.kind !== 'cancel') return false;
		endRoomMove();
		services.stage.notifySurfaceChange();
		return true;
	}
	/** The moved Walls' dashed centrelines, or the Room outline red dashed with its reason. */
	function roomMovePreviews(ctx: StageAdapterContext, y: number): readonly StageCandidatePreview[] {
		const current = roomMove;
		if (current === null || (current.delta[0] === 0 && current.delta[1] === 0)) return [];
		const label = {
			world: [
				current.labelWorld[0] + current.delta[0],
				current.labelWorld[1],
				current.labelWorld[2] + current.delta[1]
			] as [number, number, number],
			text:
				current.refusal ??
				`${planarDeltaLabel(current.delta[0], current.delta[1])}${current.movedRooms > 1 ? ` · ${current.movedRooms} Rooms` : ''}`
		};
		if (current.centerlines !== null) {
			const shift = ([x, height, z]: [number, number, number]): [number, number, number] => [
				x + current.delta[0],
				height,
				z + current.delta[1]
			];
			return [
				candidatePreviewOf({
					id: 'layout-room-move-candidate',
					role: 'subject',
					geometry: {
						polygons: [],
						segments: current.centerlines.segments.map(([a, b]) => [shift(a), shift(b)])
					},
					labels: [label],
					snap: current.snap === null ? undefined : { world: label.world, name: current.snap.name }
				})
			];
		}
		const room = ctx.snapshot.domain.geometry.rooms.find((entry) => entry.roomId === current.roomId);
		if (room === undefined) return [];
		const polygon = room.floorPolygon;
		const segments: [[number, number, number], [number, number, number]][] = polygon.map(
			(point, index) => {
				const next = polygon[(index + 1) % polygon.length]!;
				return [
					[point[0] + current.delta[0], y, point[1] + current.delta[1]],
					[next[0] + current.delta[0], y, next[1] + current.delta[1]]
				];
			}
		);
		return [
			candidatePreviewOf({
				id: 'layout-room-move-candidate',
				role: 'refused',
				geometry: { polygons: [], segments },
				labels: [label]
			})
		];
	}

	/*
	 * T1 A4 — Duplicate an isolated Room. The Card arms one task; the task's
	 * unpressed moves carry the complete cloned Room as one proposal, and a
	 * click accepts it through one captured intent. The initial proposal is
	 * placed one metre clear of the source, so Duplicate never proposes an
	 * ambiguous coincident copy and a click before any move still places it.
	 * Nothing here is a mark, an armed dock tool or a second document.
	 */
	type RoomDuplicateSession = {
		readonly roomId: string;
		readonly capture: LayoutIdCapture;
		readonly defaultDelta: LayoutVec2;
		readonly center: LayoutVec2;
		/** The last pointer point on the datum, or `null` before the first move. */
		pointer: LayoutVec2 | null;
		/** The first pointer point a move named; every later move is relative to it. */
		origin: LayoutVec2 | null;
		delta: LayoutVec2;
		readonly revision: string;
		readonly subjectIds: ReadonlySet<string>;
		paper: { key: string; geometry: CandidatePaperGeometry } | null;
		snap: LayoutSnapWinner | null;
	};
	let roomDuplicate: RoomDuplicateSession | null = null;
	/** The Room the Card asked to duplicate, consumed by the task's instrument. */
	let pendingRoomDuplicateId: string | null = null;
	let roomDuplicateNotice: RoomDuplicateRejection | null = null;
	let roomDuplicateCommitting = false;
	let roomDuplicateProposal: ProposalLease | null = null;
	const ROOM_DUPLICATE_PREVIEW_ID = 'layout-room-duplicate-candidate';

	function endRoomDuplicate(): void {
		roomDuplicate = null;
		roomDuplicateNotice = null;
		roomDuplicateProposal?.release();
		roomDuplicateProposal = null;
	}

	/** The compiled floor extent, with the authored boundary as a fallback. */
	function roomDuplicateFrame(
		roomId: string
	): { readonly center: LayoutVec2; readonly delta: LayoutVec2 } | null {
		const compiled = services.stage
			.snapshot()
			.domain.geometry.rooms.find((entry) => entry.roomId === roomId);
		let points: readonly LayoutVec2[] =
			compiled !== undefined && compiled.floorPolygon.length >= 3 ? compiled.floorPolygon : [];
		if (points.length === 0) {
			const room = document.rooms.find((entry) => entry.id === roomId);
			const collected: LayoutVec2[] = [];
			for (const ref of room?.boundary ?? []) {
				const wall = document.walls.find((entry) => entry.id === ref.wallId);
				if (wall === undefined) continue;
				for (const junctionId of [wall.startJunctionId, wall.endJunctionId]) {
					const junction = document.junctions.find((entry) => entry.id === junctionId);
					if (junction !== undefined) collected.push(junction.point);
				}
			}
			points = collected;
		}
		if (points.length === 0) return null;
		const minX = Math.min(...points.map((point) => point[0]));
		const maxX = Math.max(...points.map((point) => point[0]));
		const minZ = Math.min(...points.map((point) => point[1]));
		const maxZ = Math.max(...points.map((point) => point[1]));
		const width = Math.max(0, maxX - minX);
		return {
			center: [(minX + maxX) / 2, (minZ + maxZ) / 2],
			// One clear metre past the source's own extent. The planner never
			// invents a delta; this is the adapter's initial proposal only.
			delta: [Number((width + 1).toFixed(3)), 0]
		};
	}

	/** Begin one Room copy: one capture, one proposal lease, one initial delta. */
	function beginRoomDuplicate(roomId: string): boolean {
		const room = document.rooms.find((entry) => entry.id === roomId);
		if (room === undefined) {
			roomDuplicateNotice = { code: 'unknown_room' };
			return false;
		}
		const isolation = resolveIsolatedRoomSubgraph(document, roomId);
		if (isolation.kind === 'rejected') {
			roomDuplicateNotice = isolation.rejection;
			return false;
		}
		const frame = roomDuplicateFrame(roomId);
		if (frame === null) {
			roomDuplicateNotice = { code: 'unresolvable_floor' };
			return false;
		}
		roomDuplicate = {
			roomId,
			capture: mintLayoutIdCapture(),
			defaultDelta: frame.delta,
			center: frame.center,
			pointer: null,
			origin: null,
			delta: frame.delta,
			revision: services.authoring.acceptedRevision().revisionId,
			subjectIds: new Set([
				roomId,
				...isolation.subgraph.wallIds,
				...isolation.subgraph.openingIds,
				...isolation.subgraph.associatedObjectIds
			]),
			paper: null,
			snap: null
		};
		roomDuplicateNotice = null;
		roomDuplicateProposal?.release();
		roomDuplicateProposal = services.stage.session.registerProposal({
			owner: LAYOUT_ROOM_DUPLICATE_KIND,
			reason: 'A Room copy is live; place it or cancel it — Undo is available once it settles.'
		});
		return true;
	}

	/** Translate the proposal by pointer motion, relative to the first move. */
	function moveRoomDuplicate(ctx: StageAdapterContext, point: LayoutVec2): void {
		const current = roomDuplicate;
		if (current === null) return;
		roomDuplicateNotice = null;
		current.pointer = [point[0], point[1]];
		if (current.origin === null) {
			current.origin = [point[0], point[1]];
			current.snap = null;
			return;
		}
		const origin = current.origin;
		const snapped = resolvePlanarDragSnap(origin, point, ctx.drafting(), (from, to) =>
			datumSnapDistance(ctx, from, to)
		);
		current.delta = [
			Number((current.defaultDelta[0] + snapped.point[0] - origin[0]).toFixed(9)),
			Number((current.defaultDelta[1] + snapped.point[1] - origin[1]).toFixed(9))
		];
		current.snap = snapped.winner;
	}

	function roomDuplicateSelected(): boolean {
		return services.stage.session.task()?.kind === LAYOUT_ROOM_DUPLICATE_KIND;
	}

	function roomDuplicatePointer(intent: StagePointerIntent, ctx: StageAdapterContext): boolean {
		if (!roomDuplicateSelected()) return false;
		if (intent.phase === 'cancel') {
			endRoomDuplicate();
			services.stage.notifySurfaceChange();
			return true;
		}
		if (intent.phase === 'down') {
			const point = pointerDatumPoint(ctx, intent.css);
			if (point !== null) moveRoomDuplicate(ctx, [point[0], point[1]]);
			const current = roomDuplicate;
			if (current === null) {
				roomDuplicateNotice = { code: 'unknown_room' };
				services.stage.notifySurfaceChange();
				return true;
			}
			if (roomDuplicateIsCoincident(current.delta)) {
				roomDuplicateNotice = { code: 'coincident_with_source' };
				services.stage.notifySurfaceChange();
				return true;
			}
			void commitRoomDuplicate(current);
			return true;
		}
		if (intent.phase === 'move') {
			const point = pointerDatumPoint(ctx, intent.css);
			if (point !== null) {
				moveRoomDuplicate(ctx, [point[0], point[1]]);
				services.stage.notifySurfaceChange();
			}
			return true;
		}
		// `up` belongs to the press that committed (or refused) on `down`.
		return true;
	}

	function roomDuplicateHover(intent: StagePointerIntent, ctx: StageAdapterContext): boolean {
		if (intent.phase !== 'move' || !roomDuplicateSelected() || roomDuplicate === null) return false;
		const point = pointerDatumPoint(ctx, intent.css);
		if (point === null) return false;
		moveRoomDuplicate(ctx, [point[0], point[1]]);
		services.stage.notifySurfaceChange();
		return true;
	}

	async function commitRoomDuplicate(current: RoomDuplicateSession): Promise<void> {
		if (roomDuplicateCommitting) return;
		roomDuplicateCommitting = true;
		try {
			const snapshot = services.stage.snapshot();
			if (stageUnitRevision(snapshot, 'layout') !== contentRevision) return;
			const outcome = await services.authoring.accept(
				roomDuplicateIntent({
					roomId: current.roomId,
					delta: [current.delta[0], current.delta[1]],
					capture: current.capture,
					operationId: globalThis.crypto.randomUUID(),
					projectId: snapshot.acceptedRevision.projectId,
					revisionId: current.revision,
					contentRevision,
					levelId
				})
			);
			if (outcome.kind === 'refused') {
				if (roomDuplicate !== current) return;
				roomDuplicateNotice = { code: outcome.code, message: outcome.message };
				services.stage.notifySurfaceChange();
				return;
			}
			if (roomDuplicate === current) endRoomDuplicate();
			services.stage.notifySurfaceChange();
		} finally {
			roomDuplicateCommitting = false;
		}
	}

	/** The complete cloned Room as one proposal; a refusal carries its words. */
	function roomDuplicatePreviews(ctx: StageAdapterContext, y: number): readonly StageCandidatePreview[] {
		const current = roomDuplicate;
		if (current === null) return [];
		const rejection = roomDuplicateIsCoincident(current.delta)
			? { code: 'coincident_with_source' }
			: roomDuplicateNotice;
		const refused =
			rejection === null
				? null
				: rejection.code === 'planner-rejected'
					? (rejection.message ?? roomDuplicateRefusalWords(document, rejection))
					: roomDuplicateRefusalWords(document, rejection);
		const anchor: [number, number, number] =
			current.pointer === null
				? [current.center[0] + current.delta[0], y, current.center[1] + current.delta[1]]
				: [current.pointer[0], y, current.pointer[1]];
		const label = refused ?? `Copy · ${planarDeltaLabel(current.delta[0], current.delta[1])}`;
		const result = services.stage.plan();
		if (result.kind === 'evaluated') {
			const plan = result.plan;
			const key = JSON.stringify([
				y,
				plan.cutHeightMeters,
				plan.depthMeters,
				plan.sourceKindFilter,
				plan.reveal
			]);
			if (current.paper?.key !== key) {
				current.paper = {
					key,
					geometry: buildCompiledLayoutCandidatePaper(
						ctx.snapshot.domain.geometry,
						plan,
						y,
						current.subjectIds,
						new Set(),
						null
					).subject
				};
			}
		}
		const paper = current.paper?.geometry;
		const shift = ([x, height, z]: [number, number, number]): [number, number, number] => [
			x + current.delta[0],
			height,
			z + current.delta[1]
		];
		return [
			candidatePreviewOf({
				id: ROOM_DUPLICATE_PREVIEW_ID,
				role: refused === null ? 'subject' : 'refused',
				geometry: {
					polygons: paper?.polygons.map((polygon) => polygon.map(shift)) ?? [],
					segments: paper?.segments.map(([a, b]) => [shift(a), shift(b)]) ?? []
				},
				labels: [{ world: anchor, text: label }],
				snap: current.snap === null ? undefined : { world: anchor, name: current.snap.name }
			})
		];
	}
	function requestDuplicate(roomId: string): StageCardActionOutcome {
		pendingRoomDuplicateId = roomId;
		const opened = services.stage.openContributedTask(LAYOUT_ROOM_DUPLICATE_KIND, 'layout');
		if (opened.kind !== 'opened') {
			pendingRoomDuplicateId = null;
			return { kind: 'refused', message: opened.message };
		}
		return {
			kind: 'accepted',
			message: 'Move the pointer, then click to place the copy. Escape cancels.'
		};
	}

	function duplicateInstrument() {
		// The Card names the Room; opening the task closes any previous
		// contributed task first, so the request is consumed here, after that
		// close, and never by a clear on `taskClosed`.
		const roomId = pendingRoomDuplicateId;
		pendingRoomDuplicateId = null;
		const started = roomId !== null && beginRoomDuplicate(roomId);
		const room = roomId === null ? undefined : document.rooms.find((entry) => entry.id === roomId);
		return {
			summary: 'Duplicate Room',
			facts: [
				{
					label: 'Copy',
					value:
						room === undefined ? 'One isolated Room' : `${room.name}, its Walls, Junctions and Openings`
				},
				{
					label: 'Place',
					value: started
						? 'Move the pointer, then click. Escape cancels.'
						: roomDuplicateNotice === null
							? 'Select an isolated Room and choose Duplicate.'
							: roomDuplicateRefusalWords(document, roomDuplicateNotice)
				}
			]
		};
	}

	function previews(ctx: StageAdapterContext, y: number) {
		if (roomDuplicate !== null) return roomDuplicatePreviews(ctx, y);
		return roomMove === null ? null : roomMovePreviews(ctx, y);
	}

	return {
		endRoomMove,
		endRoomDuplicate,
		roomMoveDescriptors,
		roomMovePointer,
		roomMoveKey,
		roomDuplicatePointer,
		roomDuplicateHover,
		requestDuplicate,
		duplicateInstrument,
		previews
	};
}
