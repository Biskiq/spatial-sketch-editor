/**
 * The group transform session: rigid Move and Turn for one selected group.
 *
 * One no-task group gesture at a time. The press captures the accepted baseline
 * and the group's own base plane; every move previews through the same
 * `scene-group-transform` planner the release submits, so the ghosts are the
 * poses acceptance will install and every member keeps its relative pose. The
 * lease is the Stage gesture lease, owned here for exactly the gesture's life
 * and released on release, pointer cancel, Escape, a selection change, a task
 * opening, a lease the host ended and disposal.
 *
 * This module owns the gesture and its refusal. It does not decide which marks
 * exist (`group-marks`) or what the Card offers (`group-card`); it reads the
 * accepted group through the snapshot and accepts only through
 * `services.authoring.accept`.
 */

import type {
	GestureAcquisition,
	StageAdapterContext,
	StageAdapterServices,
	StageCandidatePreview,
	StageGhostMesh,
	StageKeyboardIntent,
	StagePointerIntent,
} from '$lib/authoring/stage/stage-adapter-host';
import {
	draftingSnapIncrementMeters,
	snapDraftingPlacement,
	stageEnvelope,
	stageScene,
} from '$lib/authoring/stage/stage-adapter-host';
import type { SceneEntity, SceneObjectCluster, Vec3 } from '@portfolio/project-model/scene';
import {
	planGroupTransform,
	rigidPivot,
	type SceneGroupMemberContact,
	type SceneGroupMotion,
} from '@portfolio/project-model/scene-planning';
import { candidateGhost } from './candidate-ghost';
import { sceneClusterById, sceneClusterReference } from '../../scene/selection-target';
import {
	groupDeltaLabel,
	groupYawLabel,
	isSceneGroupMarkId,
	SCENE_GROUP_MARK,
} from './group-marks';
import { admittedModelFootprint, objectContact } from './object-readings';
import { groupFreeMemberPreview } from './group-preview';
import { type SceneCandidate } from './placement';

const FRAME = { origin: [0, 0, 0] as Vec3, yaw: 0 };
const PROJECT_WORLD = { version: 1, kind: 'project-world' } as const;
import { pointerPlanePoint } from './pointer-support';

export type SceneGroupGestureReading = {
	readonly clusterId: string;
	readonly markId: 'move' | 'turn';
	readonly refusal: string | null;
	readonly value: string;
};

export type SceneGroupSession = {
	pointer(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	key(intent: StageKeyboardIntent): boolean;
	prune(): void;
	reset(): void;
	gesture(): SceneGroupGestureReading | null;
	/** A refusal that kept a gesture from starting, for the Card's own readout. */
	lastRefusal(): { readonly clusterId: string; readonly message: string } | null;
	/** Per-member ghosts at the proposed rigid pose. */
	ghosts(adapterContext: StageAdapterContext): readonly StageGhostMesh[];
	/** Per-member Plan outlines at the proposed pose. */
	candidatePreviews(adapterContext: StageAdapterContext): readonly StageCandidatePreview[];
};

type GroupGesture = {
	readonly clusterId: string;
	readonly lease: GestureAcquisition;
	readonly evaluationId: string;
	readonly pressCss: readonly [number, number];
	/** A press on the group's body, not one of its marks. */
	readonly bodyPress: boolean;
	readonly markId: 'move' | 'turn';
	readonly contacts: readonly SceneGroupMemberContact[];
	/** The group's base plane at the press, in metres. */
	readonly baseY: number;
	readonly centerXZ: readonly [number, number];
	/** The pointer's world XZ on the base plane at the press. */
	readonly grabXZ: readonly [number, number];
	/** The pointer's bearing around the centre at the press, in radians. */
	startAngle: number;
	motion: SceneGroupMotion;
	candidate: readonly SceneEntity[] | null;
	refusal: string | null;
};

function planePoint(
	context: StageAdapterContext,
	css: readonly [number, number],
	baseY: number,
): readonly [number, number] | null {
	const point = pointerPlanePoint(context, css, baseY);
	return point === null ? null : [point[0], point[2]];
}

function bearingAt(point: readonly [number, number], center: readonly [number, number]): number {
	return Math.atan2(point[1] - center[1], point[0] - center[0]);
}

function normalizeAngle(angle: number): number {
	let value = angle;
	while (value > Math.PI) value -= Math.PI * 2;
	while (value < -Math.PI) value += Math.PI * 2;
	return value;
}

/**
 * The adapter hands in the preview presenter so this module never imports an
 * owner itself (X7). The presenter is the same one the placement marks use.
 */
export type GroupCandidatePresenter = (
	context: StageAdapterContext,
	candidate: SceneCandidate | null,
) => StageCandidatePreview | null;

export function createSceneGroupSession(
	services: StageAdapterServices,
	presentCandidate: GroupCandidatePresenter,
): SceneGroupSession {
	let gesture: GroupGesture | null = null;
	let refusal: { readonly clusterId: string; readonly message: string } | null = null;

	function end(): void {
		const current = gesture;
		gesture = null;
		if (current?.lease.kind === 'granted' && current.lease.lease.active) {
			current.lease.lease.release();
		}
	}

	function prune(): void {
		const current = gesture;
		if (current === null) return;
		if (current.lease.kind !== 'granted' || !current.lease.lease.active) {
			gesture = null;
			refusal = {
				clusterId: current.clusterId,
				message: 'The reading changed; start the group gesture again.',
			};
		}
	}

	/** The one selected group, when the canonical selection is exactly it. */
	function selectedCluster(context: StageAdapterContext): SceneObjectCluster | null {
		const selection = context.selectionState();
		if (selection.ordered.length !== 1 || selection.primary === null) return null;
		const only = selection.primary;
		if (only.domain !== 'scene' || only.subject.kind !== 'cluster') return null;
		return sceneClusterById(stageScene(context.snapshot), only.subject.id);
	}

	function operationContext(context: StageAdapterContext) {
		return {
			layout: stageEnvelope(context.snapshot).units.layout.data,
			scene: stageScene(context.snapshot),
			sourceContentId: context.snapshot.sourceContentId,
		};
	}

	function applyPlan(current: GroupGesture, context: StageAdapterContext): void {
		current.candidate = null;
		const result = planGroupTransform({
			context: operationContext(context),
			clusterId: current.clusterId,
			motion: current.motion,
			contacts: current.contacts,
			onProposed: (members) => {
				current.candidate = members;
			},
		});
		current.refusal = result.kind === 'rejected' && result.code !== 'no_op' ? result.message : null;
	}

	function pointer(intent: StagePointerIntent, context: StageAdapterContext): boolean {
		if (services.stage.session.task() !== null) return false;
		prune();
		if (intent.phase === 'down') {
			const cluster = selectedCluster(context);
			if (cluster === null) return false;
			let markId: 'move' | 'turn' | null = null;
			let bodyPress = false;
			if (intent.handleId !== undefined) {
				if (intent.handleId === SCENE_GROUP_MARK.move) markId = 'move';
				else if (intent.handleId === SCENE_GROUP_MARK.turn) markId = 'turn';
				else return false;
			} else {
				const picked = services.stage.resolvePick({
					css: intent.css,
					evaluationId: intent.evaluationId,
					purpose: 'select',
					tool: null,
					...(intent.coarse === undefined ? {} : { coarse: intent.coarse }),
				});
				if (
					picked.kind !== 'resolved' ||
					picked.hit.reference?.domain !== 'scene' ||
					(picked.hit.reference.subject.kind !== 'cluster' &&
						picked.hit.reference.subject.kind !== 'entity') ||
					(picked.hit.reference.subject.kind === 'cluster'
						? picked.hit.reference.subject.id !== cluster.id
						: !cluster.memberIds.includes(picked.hit.reference.subject.id))
				)
					return false;
				markId = 'move';
				bodyPress = true;
			}
			const scene = stageScene(context.snapshot);
			const members = scene.entities.filter((entity) => cluster.memberIds.includes(entity.id));
			if (members.length < 2) return false;
			const contacts: SceneGroupMemberContact[] = [];
			let baseY = Infinity;
			for (const member of members) {
				baseY = Math.min(baseY, member.position[1]);
				if (member.kind === 'light' || member.kind === 'artwork') continue;
				const contactMinY = objectContact(services, member);
				if (contactMinY === null) return false;
				contacts.push({ entityId: member.id, contactMinY });
			}
			if (!Number.isFinite(baseY)) return false;
			const pivot = rigidPivot(members.map((member) => member.position));
			if (pivot === null) return false;
			const centerXZ = [pivot.x, pivot.z] as const;
			const grabXZ = planePoint(context, intent.css, baseY);
			if (grabXZ === null) return false;
			const acquisition = services.stage.acquireGesture({
				owner: 'scene-group-marks',
				evaluationId: intent.evaluationId,
				policy: 'cancel-on-reading-change',
			});
			if (acquisition.kind !== 'granted') {
				refusal = {
					clusterId: cluster.id,
					message: `The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`,
				};
				services.stage.notifySurfaceChange();
				return false;
			}
			if (gesture !== null) end();
			refusal = null;
			gesture = {
				clusterId: cluster.id,
				lease: acquisition,
				evaluationId: intent.evaluationId,
				pressCss: [intent.css[0], intent.css[1]],
				bodyPress,
				markId,
				contacts,
				baseY,
				centerXZ,
				grabXZ,
				startAngle: bearingAt(grabXZ, centerXZ),
				motion: { kind: 'move', deltaXZ: [0, 0] },
				candidate: null,
				refusal: null,
			};
			services.stage.notifySurfaceChange();
			return true;
		}

		const current = gesture;
		if (current === null) return false;
		if (current.lease.kind === 'granted' && !current.lease.lease.active) {
			gesture = null;
			refusal = {
				clusterId: current.clusterId,
				message: 'The content changed; start the group gesture again.',
			};
			services.stage.notifySurfaceChange();
			return true;
		}
		if (intent.phase === 'cancel') {
			end();
			services.stage.notifySurfaceChange();
			return true;
		}
		if (intent.evaluationId !== current.evaluationId && intent.phase !== 'up') {
			end();
			refusal = {
				clusterId: current.clusterId,
				message: 'The reading changed; start the group gesture again.',
			};
			services.stage.notifySurfaceChange();
			return true;
		}
		if (intent.phase === 'move') {
			if (current.markId === 'move') {
				const point = planePoint(context, intent.css, current.baseY);
				if (point === null) {
					current.candidate = null;
					current.refusal = 'The pointer ray is not on the group’s floor.';
				} else {
					const step = draftingSnapIncrementMeters(context.drafting());
					const raw: [number, number] = [
						point[0] - current.grabXZ[0],
						point[1] - current.grabXZ[1],
					];
					const snappedOrigin = snapDraftingPlacement(
						[current.grabXZ[0] + raw[0], current.grabXZ[1] + raw[1]],
						step,
					);
					const deltaXZ: [number, number] = [
						Number((snappedOrigin.x - current.grabXZ[0]).toFixed(9)),
						Number((snappedOrigin.z - current.grabXZ[1]).toFixed(9)),
					];
					current.motion = { kind: 'move', deltaXZ };
					applyPlan(current, context);
				}
			} else {
				const point = planePoint(context, intent.css, current.baseY);
				if (point === null) {
					current.candidate = null;
					current.refusal = 'The pointer is not on the turn plane.';
				} else {
					const delta = normalizeAngle(current.startAngle - bearingAt(point, current.centerXZ));
					const step = Math.PI / 12;
					const yaw = intent.altKey ? delta : Math.round(delta / step) * step;
					current.motion = { kind: 'turn', yaw: Number(yaw.toFixed(9)) };
					applyPlan(current, context);
				}
			}
			services.stage.notifySurfaceChange();
			return true;
		}

		const preview = current;
		end();
		if (preview.bodyPress && !movedEnough(preview.pressCss, intent.css)) {
			services.stage.notifySurfaceChange();
			return true;
		}
		if (preview.candidate === null || preview.refusal !== null) {
			if (preview.refusal !== null)
				refusal = { clusterId: preview.clusterId, message: preview.refusal };
			services.stage.notifySurfaceChange();
			return true;
		}
		const snapshot = services.stage.snapshot();
		void services.authoring
			.accept({
				version: 1,
				kind: 'scene-group-transform',
				operationId: globalThis.crypto.randomUUID(),
				expectedRevision: snapshot.acceptedRevision,
				targets: [sceneClusterReference(preview.clusterId, snapshot.domain.unitRevisions.scene)],
				payload: {
					clusterId: preview.clusterId,
					motion:
						preview.motion.kind === 'move'
							? { kind: 'move', deltaXZ: [...preview.motion.deltaXZ] }
							: { kind: 'turn', yaw: preview.motion.yaw },
					frame: FRAME,
					frameReference: PROJECT_WORLD,
					contacts: preview.contacts.map((contact) => ({
						entityId: contact.entityId,
						contactMinY: contact.contactMinY,
					})),
				} as never,
				capturedInputs: [],
				allocatedIds: [],
			})
			.then(
				(outcome) => {
					if (outcome.kind === 'refused') {
						refusal = { clusterId: preview.clusterId, message: outcome.message };
					}
					services.stage.notifySurfaceChange();
				},
				(error: unknown) => {
					refusal = {
						clusterId: preview.clusterId,
						message: error instanceof Error ? error.message : 'The accepted install failed.',
					};
					services.stage.notifySurfaceChange();
				},
			);
		services.stage.notifySurfaceChange();
		return true;
	}

	function movedEnough(
		press: readonly [number, number],
		release: readonly [number, number],
	): boolean {
		return Math.hypot(release[0] - press[0], release[1] - press[1]) >= 4;
	}

	function memberCandidates(): readonly SceneCandidate[] {
		prune();
		const current = gesture;
		if (current?.candidate === null || current?.candidate === undefined) return [];
		return current.candidate.map(
			(planned): SceneCandidate => ({
				kind: current.motion.kind === 'move' ? 'move' : 'yaw',
				entityId: planned.id,
				primitive: null,
				position: [...planned.position] as Vec3,
				rotation: [...planned.rotation] as Vec3,
				worldXZ: [planned.position[0], planned.position[2]],
				yaw: planned.rotation[1],
				scale: planned.kind === 'primitive' || planned.kind === 'model' ? (planned.scale ?? 1) : 1,
				snappedStep: null,
				...(planned.kind === 'form' ? { form: planned.form } : {}),
			}),
		);
	}

	return {
		pointer,
		key(intent) {
			if (gesture === null || intent.kind !== 'cancel') return false;
			end();
			services.stage.notifySurfaceChange();
			return true;
		},
		prune,
		reset() {
			if (gesture !== null) end();
			refusal = null;
		},
		lastRefusal: () => refusal,
		gesture() {
			prune();
			const current = gesture;
			if (current === null) return null;
			return {
				clusterId: current.clusterId,
				markId: current.markId,
				refusal: current.refusal,
				value:
					current.motion.kind === 'move'
						? groupDeltaLabel(current.motion.deltaXZ)
						: groupYawLabel(current.motion.yaw),
			};
		},
		ghosts(adapterContext) {
			prune();
			const current = gesture;
			const candidates = memberCandidates();
			if (current === null) return [];
			const scene = stageScene(adapterContext.snapshot);
			const ghosts: StageGhostMesh[] = [];
			for (const candidate of candidates) {
				const entity = scene.entities.find((entry) => entry.id === candidate.entityId);
				if (entity === undefined) continue;
				const ghost = candidateGhost(entity, candidate, {
					modelFootprint:
						entity.kind === 'model'
							? admittedModelFootprint(adapterContext.snapshot, entity.assetId)
							: null,
					modelContactMinY: current.contacts.find((entry) => entry.entityId === entity.id)
						?.contactMinY,
					treatment: current.refusal === null ? 'subject' : 'refused',
				});
				if (ghost !== null) ghosts.push({ ...ghost, id: `scene-group-${candidate.entityId}` });
			}
			return ghosts;
		},
		candidatePreviews(adapterContext) {
			prune();
			const current = gesture;
			if (current?.candidate == null) return [];
			const role = current.refusal === null ? 'subject' : 'refused';
			const plan = adapterContext.evaluation.renderedReading === 'plan';
			return memberCandidates().flatMap((candidate, index) => {
				const member = current.candidate![index]!;
				const outline =
					groupFreeMemberPreview(member, adapterContext) ??
					(plan ? presentCandidate(adapterContext, candidate) : null);
				return outline === null
					? []
					: [{ ...outline, id: `scene-group-outline:${member.id}`, role }];
			});
		},
	};
}

/** A group mark's refusal for the Card/mark readout, when one is current. */
export function groupRefusalOf(session: SceneGroupSession, clusterId: string): string | null {
	const reading = session.gesture();
	if (reading !== null && reading.clusterId === clusterId) return reading.refusal;
	const last = session.lastRefusal();
	return last !== null && last.clusterId === clusterId ? last.message : null;
}

export function groupLiveMark(
	session: SceneGroupSession,
	clusterId: string,
): { readonly markId: string; readonly value: string; readonly refusal: string | null } | null {
	const reading = session.gesture();
	if (reading === null || reading.clusterId !== clusterId) return null;
	return {
		markId: reading.markId === 'move' ? SCENE_GROUP_MARK.move : SCENE_GROUP_MARK.turn,
		value: reading.value,
		refusal: reading.refusal,
	};
}

export function isGroupMarkHandle(handleId: string | undefined): boolean {
	return handleId !== undefined && isSceneGroupMarkId(handleId);
}
