/**
 * C4 — the Round Room's radius ray.
 *
 * The whole is the Room, so a radius drag belongs to the Room, not to one arc.
 * A press captures the selected Room and one gesture lease; every move runs the
 * canonical `planResizeRoundRoomRadius` planner over the accepted baseline and
 * draws its complete candidate; the release submits exactly that radius once,
 * through the same retained planner. Nothing here is a second geometry writer:
 * the Card's Radius field, the Stage ray and the F.4 commit all resolve the same
 * `room.round` fact with the same planner.
 *
 * A refused candidate publishes its own reason and keeps the accepted document
 * untouched. A cancelled gesture or a stale baseline writes nothing.
 */
import { planResizeRoundRoomRadius } from '@portfolio/layout-core/room';
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { stageLayout, stageUnitRevision } from '$lib/authoring/stage/stage-adapter-host';
import type {
	StageAdapterContext,
	StageCandidatePreview,
	StagePointerIntent,
} from '$lib/authoring/stage/stage-adapter-host';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-adapter-host';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';

import { candidatePreviewOf, wallCenterlinePaper } from './candidate-preview';
import { pointerDatumPoint } from './stage-pointer';
import { selectedRoundRoom } from './layout-subjects';
import { roundRoomRadiusIntent } from './round-room-planners';
import { isPointerDrag, type LayoutManipulationPorts } from './manipulation-support';

export const ROUND_ROOM_RADIUS_MARK = 'layout-round-room-radius-mark';

type RoundRoomRadiusGesture = {
	readonly roomId: string;
	readonly evaluationId: string;
	readonly revision: string;
	readonly pressCss: readonly [number, number];
	readonly center: LayoutVec2;
	readonly direction: LayoutVec2;
	readonly lease: Extract<GestureAcquisition, { kind: 'granted' }>;
	preview: LayoutDocumentWallFirst | null;
	changedWallIds: ReadonlySet<string>;
	radius: number | null;
	refusal: string | null;
};

export function createRoundRoomRadiusSession({
	services,
	document,
	contentRevision,
	publishRefusal,
	settleRefusal,
}: LayoutManipulationPorts) {
	let gesture: RoundRoomRadiusGesture | null = null;

	function end(): void {
		const current = gesture;
		gesture = null;
		if (current?.lease.lease.active) current.lease.lease.release();
	}

	function refusal(): string | null {
		return gesture?.refusal ?? null;
	}

	/** One Stage mark writes the whole Room: a centre, a ray, and one rim knob. */
	function pointer(intent: StagePointerIntent, ctx: StageAdapterContext): boolean {
		const active = gesture;
		if (active === null) {
			if (intent.phase !== 'down' || intent.handleId !== ROUND_ROOM_RADIUS_MARK) return false;
			const selected = selectedRoundRoom(stageLayout(ctx.snapshot), ctx);
			if (selected === null) return false;
			const point = pointerDatumPoint(ctx, intent.css);
			if (point === null) return false;
			const acquisition = services.stage.acquireGesture({
				owner: 'layout-round-room-radius',
				evaluationId: intent.evaluationId,
				policy: 'cancel-on-reading-change',
			});
			if (acquisition.kind !== 'granted') {
				publishRefusal(
					`The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`,
				);
				return false;
			}
			const dx = selected.seam[0] - selected.center[0];
			const dz = selected.seam[1] - selected.center[1];
			const length = Math.hypot(dx, dz);
			gesture = {
				roomId: selected.roomId,
				evaluationId: intent.evaluationId,
				revision: services.authoring.acceptedRevision().revisionId,
				pressCss: intent.css,
				center: selected.center,
				direction: length > 0 ? [dx / length, dz / length] : [1, 0],
				lease: acquisition,
				preview: null,
				changedWallIds: new Set(),
				radius: null,
				refusal: null,
			};
			services.stage.notifySurfaceChange();
			return true;
		}

		if (intent.phase === 'cancel' || intent.evaluationId !== active.evaluationId) {
			end();
			publishRefusal(null);
			services.stage.notifySurfaceChange();
			return true;
		}
		if (intent.phase === 'move') {
			if (!isPointerDrag(active.pressCss, intent.css)) {
				active.preview = null;
				active.radius = null;
				active.refusal = null;
				publishRefusal(null);
				services.stage.notifySurfaceChange();
				return true;
			}
			const point = pointerDatumPoint(ctx, intent.css);
			if (point === null) return true;
			const radius = Math.hypot(point[0] - active.center[0], point[1] - active.center[1]);
			if (!(radius > 0)) {
				active.preview = null;
				active.radius = null;
				active.refusal = 'A radius must be greater than zero.';
				publishRefusal(active.refusal);
				services.stage.notifySurfaceChange();
				return true;
			}
			const planned = planResizeRoundRoomRadius({
				document: stageLayout(ctx.snapshot),
				roomId: active.roomId,
				radius,
			});
			if (planned.kind === 'rejected') {
				active.preview = null;
				active.changedWallIds = new Set();
				active.radius = null;
				active.refusal = planned.rejection.message;
			} else {
				active.preview = planned.document;
				active.changedWallIds = new Set(planned.changedWallIds);
				active.radius = radius;
				active.refusal = null;
			}
			publishRefusal(active.refusal);
			services.stage.notifySurfaceChange();
			return true;
		}

		// Release: one captured write, never a clamped repair.
		const current = gesture;
		if (current === null) return true;
		const radius = current.radius;
		const roomId = current.roomId;
		end();
		publishRefusal(null);
		if (radius !== null && current.refusal === null) {
			void commit(roomId, radius, current.revision);
		} else if (current.refusal !== null) {
			settleRefusal({
				subject: { kind: 'room', roomId },
				contentRevision,
				point: [current.center[0], current.center[1]],
				text: current.refusal,
			});
		}
		services.stage.notifySurfaceChange();
		return true;
	}

	async function commit(roomId: string, radius: number, revision: string): Promise<void> {
		const snapshot = services.stage.snapshot();
		if (stageUnitRevision(snapshot, 'layout') !== contentRevision) return;
		const outcome = await services.authoring.accept(
			roundRoomRadiusIntent({
				roomId,
				radius,
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: revision,
				contentRevision,
				levelId: snapshot.domain.layoutLevelId,
			}),
		);
		if (outcome.kind === 'refused') publishRefusal(outcome.message);
		services.stage.notifySurfaceChange();
	}

	/** The complete candidate as one cobalt proposal, plus the live radius tag. */
	function previews(datumMeters: number): readonly StageCandidatePreview[] | null {
		const current = gesture;
		if (current === null) return null;
		const knob = current.radius ?? 0;
		const point: [number, number, number] = [
			current.center[0] + current.direction[0] * knob,
			datumMeters,
			current.center[1] + current.direction[1] * knob,
		];
		if (current.preview === null) {
			if (current.refusal === null) return null;
			return [
				candidatePreviewOf({
					id: 'layout-round-room-radius-candidate',
					role: 'refused',
					geometry: { polygons: [], segments: [] },
					labels: [{ world: point, text: current.refusal }],
				}),
			];
		}
		const geometry = wallCenterlinePaper(current.preview, current.changedWallIds, datumMeters);
		return [
			candidatePreviewOf({
				id: 'layout-round-room-radius-candidate',
				role: 'subject',
				geometry,
				labels: [
					{
						world: point,
						text: `Radius ${(current.radius ?? 0).toFixed(2)} m`,
					},
				],
			}),
		];
	}

	function markState(): { readonly roomRadiusRefusal: string | null } {
		return { roomRadiusRefusal: refusal() };
	}

	return { pointer, previews, end, refusal, markState };
}
