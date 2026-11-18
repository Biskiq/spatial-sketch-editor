/**
 * The Object Studio outline revision: one pending generator candidate.
 *
 * "Edit outline" is *generator editing*, not a section through the evaluated
 * body. This session holds the draft outline and extent captured from one
 * accepted form, previews every change through the same `set-form-profile`
 * planner Apply submits, and owns the task's one drag gesture. It writes no
 * source until Apply, allocates no identity, and changes no plane, key,
 * `nextKey` or whole-form scale.
 *
 * The profile plane's arithmetic is session work: a plan form's anchors live in
 * local X/Z at the form's base, an elevation form's in local X/Y. Camera still
 * owns the projection and the ray; this module only intersects the generator's
 * own plane and converts the hit to local source coordinates.
 */
import { Euler, Quaternion, Vector3 } from 'three';
import type { WorkingPlane } from '@portfolio/camera-core';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import { readAppPreferences } from '$lib/platform/app-preferences';
import { PROFILE_LIMITS } from '@portfolio/geometry-core';
import type { SceneFormEntity, Vec3 } from '@portfolio/project-model';
import {
	planSetFormProfile,
	type SceneOperationContext
} from '@portfolio/project-model/scene-planning';
import type {
	StageAdapterContext,
	StageAdapterServices,
	StageCandidatePreview,
	StageGhostMesh,
	StageInstrumentContent,
	StagePointerIntent
} from '$lib/authoring/stage/stage-adapter-host';
import {
	readingIntentClockSeconds,
	stageEnvelope,
	stageScene
} from '$lib/authoring/stage/stage-adapter-host';
import SceneProfileRevisionInstrument from './SceneProfileRevisionInstrument.svelte';
import { sceneEntityReference } from './placement';

/** Source-coordinate precision for a dragged anchor: the codec's 1 mm control. */
const PROFILE_QUANTUM_METERS = 0.001;
/** CSS radius that still presses an anchor's handle. */
const ANCHOR_HIT_CSS_PX = 14;
const ANCHOR_HIT_COARSE_CSS_PX = 22;

export type ProfileRevisionAnchor = {
	readonly key: number;
	readonly u: number;
	readonly v: number;
	readonly smooth: boolean;
};

export type ProfileRevisionState = {
	readonly entityId: string;
	readonly name: string;
	readonly plane: 'plan' | 'elevation';
	/** The extrusion fact's physical name and unit-bearing value. */
	readonly extentLabel: 'Height' | 'Depth';
	readonly anchors: readonly ProfileRevisionAnchor[];
	/** The authored source extent, before the form's own scale. */
	readonly extent: number;
	/** The physical extrusion dimension: `extent × form.scale[axis]`. */
	readonly physicalExtent: number;
	readonly dirty: boolean;
	readonly refusal: string | null;
};

export type ProfileRevisionApplyOutcome =
	| { readonly kind: 'installed' }
	| { readonly kind: 'refused'; readonly message: string }
	| { readonly kind: 'no-op' }
	| { readonly kind: 'closed' };

export type ProfileRevisionSession = {
	/** Capture one accepted form's generator. `false` leaves the task empty. */
	open(entityId: string | null): boolean;
	state(): ProfileRevisionState | null;
	setAnchor(index: number, patch: { readonly u?: number; readonly v?: number; readonly smooth?: boolean }): void;
	setExtentPhysical(meters: number): void;
	pointer(intent: StagePointerIntent, context: StageAdapterContext): boolean;
	candidatePreview(): StageCandidatePreview | null;
	ghost(): StageGhostMesh | null;
	apply(): Promise<ProfileRevisionApplyOutcome>;
	discard(): void;
	hasWork(): boolean;
	/** The instrument's one subscription to this binding's session. */
	subscribe(listener: () => void): () => void;
	dispose(): void;
};

type Lease = ReturnType<StageAdapterServices['stage']['acquireGesture']>;

type Press = {
	readonly evaluationId: string;
	readonly lease: Lease;
	readonly index: number;
	readonly start: { readonly u: number; readonly v: number };
};

function quantize(value: number): number {
	if (!Number.isFinite(value)) return value;
	const rounded = Math.round(value / PROFILE_QUANTUM_METERS) * PROFILE_QUANTUM_METERS;
	return Object.is(rounded, -0) ? 0 : rounded;
}

function entityRotation(entity: SceneFormEntity): Euler {
	return new Euler(entity.rotation[0], entity.rotation[1], entity.rotation[2]);
}

function localToWorld(entity: SceneFormEntity, local: Vec3): Vec3 {
	return new Vector3(local[0], local[1], local[2])
		.applyEuler(entityRotation(entity))
		.add(new Vector3(entity.position[0], entity.position[1], entity.position[2]))
		.toArray() as Vec3;
}

function worldToLocal(entity: SceneFormEntity, world: Vec3): Vec3 {
	const inverse = new Quaternion().setFromEuler(entityRotation(entity)).invert();
	return new Vector3(world[0] - entity.position[0], world[1] - entity.position[1], world[2] - entity.position[2])
		.applyQuaternion(inverse)
		.toArray() as Vec3;
}

/** The generator's own plane in world space; Camera intersects it, never invents it. */
function generatorPlane(entity: SceneFormEntity): WorkingPlane {
	const origin = localToWorld(entity, [0, 0, 0]);
	const localNormal: Vec3 = entity.form.generator.plane === 'plan' ? [0, 1, 0] : [0, 0, 1];
	const tip = localToWorld(entity, localNormal);
	const length = Math.hypot(tip[0] - origin[0], tip[1] - origin[1], tip[2] - origin[2]);
	const normal: Vec3 =
		length > 1e-9
			? [(tip[0] - origin[0]) / length, (tip[1] - origin[1]) / length, (tip[2] - origin[2]) / length]
			: localNormal;
	return {
		originMeters: origin,
		normal,
		yawRadians: entity.rotation[1] + (entity.form.generator.plane === 'plan' ? 0 : Math.PI / 2),
		datumMeters: null,
		supportedLocalExtent: null
	};
}

/**
 * One source anchor's world point. The stored scale is part of the generator's
 * coordinate conversion: `extrudeProfile` builds the body at `u × scale.x` and
 * `v × scale.z` (plan) or `v × scale.y` (elevation), so the handle must use the
 * same product or it drifts off the rendered form after any ordinary Size edit.
 */
function anchorWorld(entity: SceneFormEntity, anchor: ProfileRevisionAnchor): Vec3 {
	const [scaleX, scaleY, scaleZ] = entity.form.scale;
	return entity.form.generator.plane === 'plan'
		? localToWorld(entity, [anchor.u * scaleX, 0, anchor.v * scaleZ])
		: localToWorld(entity, [anchor.u * scaleX, anchor.v * scaleY, 0]);
}

/** The extent axis: a plan form extrudes along local Y, an elevation form along Z. */
function extentAxis(entity: SceneFormEntity): 1 | 2 {
	return entity.form.generator.plane === 'plan' ? 1 : 2;
}

function sameAnchor(left: ProfileRevisionAnchor, right: ProfileRevisionAnchor): boolean {
	return left.key === right.key && left.u === right.u && left.v === right.v && left.smooth === right.smooth;
}

const STALE_SOURCE_MESSAGE =
	'The accepted source changed while the outline task was open. Discard and reopen it.';

/**
 * Whether the captured form is still the accepted one this draft was opened
 * against. The task holds a revision identity from entry, not the latest
 * snapshot: another install, a re-admitted source or an external change must
 * refuse the draft rather than apply it to a newer body.
 */
function sameCapturedSource(left: SceneFormEntity, right: SceneFormEntity): boolean {
	if (
		left.id !== right.id ||
		left.position.some((value, axis) => value !== right.position[axis]) ||
		left.rotation.some((value, axis) => value !== right.rotation[axis]) ||
		left.form.generator.plane !== right.form.generator.plane ||
		left.form.generator.kind !== right.form.generator.kind ||
		left.form.generator.extent !== right.form.generator.extent ||
		left.form.nextKey !== right.form.nextKey ||
		left.form.scale.some((value, axis) => value !== right.form.scale[axis])
	) {
		return false;
	}
	const leftOutline = left.form.generator.outline;
	const rightOutline = right.form.generator.outline;
	return (
		leftOutline.length === rightOutline.length &&
		leftOutline.every((anchor, index) => sameAnchor(anchor, rightOutline[index]!))
	);
}

type CapturedSource = {
	readonly revision: { readonly projectId: string; readonly revisionId: string };
	readonly sceneRevision: string;
};

let current: ProfileRevisionSession | null = null;

/** Publish the binding's one session; a retiring one only clears itself. */
export function publishProfileRevision(next: ProfileRevisionSession | null, retiring?: ProfileRevisionSession): void {
	if (next === null && retiring !== current) return;
	current = next;
}

export function profileRevisionSession(): ProfileRevisionSession | null {
	return current;
}

/** The world-space bounds of one evaluated form, or `null` if it cannot evaluate. */
function worldBoundsOf(entity: SceneFormEntity): { readonly min: Vec3; readonly max: Vec3 } | null {
	const mesh = evaluateFormMesh(entity.form);
	if (mesh === null) return null;
	const rotation = entityRotation(entity);
	const min: Vec3 = [Infinity, Infinity, Infinity];
	const max: Vec3 = [-Infinity, -Infinity, -Infinity];
	for (const x of [mesh.bounds.min[0], mesh.bounds.max[0]]) {
		for (const y of [mesh.bounds.min[1], mesh.bounds.max[1]]) {
			for (const z of [mesh.bounds.min[2], mesh.bounds.max[2]]) {
				const point = new Vector3(x, y, z)
					.applyEuler(rotation)
					.add(new Vector3(entity.position[0], entity.position[1], entity.position[2]));
				for (let axis = 0; axis < 3; axis += 1) {
					min[axis] = Math.min(min[axis]!, point.getComponent(axis));
					max[axis] = Math.max(max[axis]!, point.getComponent(axis));
				}
			}
		}
	}
	return { min, max };
}

/**
 * The profile task's surface half: camera entry, task ownership and dispatch.
 *
 * The adapter stays composition and dispatch; this binding owns the one piece
 * of session state that is not the planner draft — whether the outline task is
 * the open surface — so no other task and no placement hook can claim its press.
 */
export type ProfileRevisionBinding = {
	readonly session: ProfileRevisionSession;
	/** Whether the outline task currently owns the Stage surface. */
	active(): boolean;
	/** Capture the form, request the plane's reading and return the Card. */
	open(entityId: string | null, context: StageAdapterContext): StageInstrumentContent | null;
	pointer(intent: StagePointerIntent, context: StageAdapterContext): boolean;
	candidatePreview(): readonly StageCandidatePreview[];
	ghost(): StageGhostMesh | null;
	/** Esc, replacement or an installed write: the draft is gone. */
	taskClosed(): void;
	dispose(): void;
};

export function createProfileRevisionBinding(services: StageAdapterServices): ProfileRevisionBinding {
	const session = createProfileRevisionSession(services);
	let active = false;

	/**
	 * Put the Camera on the generator's plane. A plan profile is the one
	 * orthographic reading; an elevation profile uses Camera's `face` intent
	 * (there is no elevation reading) to look along the plane's own normal.
	 */
	function showProfilePlane(entityId: string, context: StageAdapterContext): void {
		const entity = stageScene(context.snapshot).entities.find((entry) => entry.id === entityId);
		if (entity?.kind !== 'form') return;
		const preference = readAppPreferences().reducedMotion;
		const reduced =
			preference ??
			(typeof globalThis.matchMedia === 'function'
				? globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
				: false);
		const clockSeconds = readingIntentClockSeconds(reduced, performance.now() / 1000);
		if (entity.form.generator.plane === 'plan') {
			context.requestIntent({ kind: 'set-reading', reading: 'plan' }, clockSeconds);
			return;
		}
		const bounds = worldBoundsOf(entity);
		if (bounds === null) return;
		const forward = new Vector3(0, 0, -1).applyEuler(entityRotation(entity)).normalize();
		context.requestIntent(
			{
				kind: 'face',
				bounds,
				look: [forward.x, forward.y, forward.z] as Vec3,
				rect: context.evaluation.rect
			},
			clockSeconds
		);
	}

	return {
		session,
		active: () => active,
		open(entityId, context) {
			if (active) {
				// The host reads this contribution again on every surface change, and the
				// session notifies one from inside the read. Re-capturing here would
				// release the proposal, discard typed anchors and — after an install,
				// when the session has already closed — register a second proposal and
				// notify again from inside the same read. The task owns this Card until
				// it closes, so keep answering with it; the session itself may be empty.
				return {
					summary: 'Edit outline',
					view: { component: SceneProfileRevisionInstrument, services }
				};
			}
			active = true;
			if (!session.open(entityId)) {
				active = false;
				return null;
			}
			if (entityId !== null) showProfilePlane(entityId, context);
			return {
				summary: 'Edit outline',
				view: { component: SceneProfileRevisionInstrument, services }
			};
		},
		pointer(intent, context) {
			return active && session.pointer(intent, context);
		},
		candidatePreview() {
			if (!active) return [];
			const outline = session.candidatePreview();
			return outline === null ? [] : [outline];
		},
		ghost() {
			return active ? session.ghost() : null;
		},
		taskClosed() {
			active = false;
			session.discard();
		},
		dispose() {
			active = false;
			session.dispose();
		}
	};
}

export function createProfileRevisionSession(
	services: StageAdapterServices
): ProfileRevisionSession {
	let base: SceneFormEntity | null = null;
	let captured: CapturedSource | null = null;
	let anchors: ProfileRevisionAnchor[] = [];
	let extent = 0;
	let refusal: string | null = null;
	let candidate: SceneFormEntity | null = null;
	let proposal: ReturnType<StageAdapterServices['stage']['session']['registerProposal']> | null = null;
	let press: Press | null = null;
	const listeners = new Set<() => void>();

	function notify(): void {
		for (const listener of listeners) listener();
	}

	function context(): SceneOperationContext | null {
		if (base === null) return null;
		const snapshot = services.stage.snapshot();
		return {
			layout: stageEnvelope(snapshot).units.layout.data,
			scene: stageScene(snapshot),
			sourceContentId: snapshot.domain.unitRevisions.scene
		};
	}

	function liveEntity(): SceneFormEntity | null {
		if (base === null) return null;
		const entity = stageScene(services.stage.snapshot()).entities.find((entry) => entry.id === base!.id);
		return entity?.kind === 'form' ? entity : null;
	}

	function staleReason(): string | null {
		if (base === null || captured === null) return null;
		const snapshot = services.stage.snapshot();
		if (
			snapshot.acceptedRevision.projectId !== captured.revision.projectId ||
			snapshot.acceptedRevision.revisionId !== captured.revision.revisionId ||
			snapshot.domain.unitRevisions.scene !== captured.sceneRevision
		) {
			return STALE_SOURCE_MESSAGE;
		}
		const live = liveEntity();
		if (live === null) return 'The object is no longer in the accepted source.';
		return sameCapturedSource(base, live) ? null : STALE_SOURCE_MESSAGE;
	}

	function dirty(): boolean {
		if (base === null) return false;
		if (extent !== base.form.generator.extent) return true;
		const existing = base.form.generator.outline;
		return anchors.length !== existing.length || anchors.some((anchor, index) => !sameAnchor(anchor, existing[index]!));
	}

	function replan(): void {
		const entity = base;
		const stale = staleReason();
		if (stale !== null) {
			candidate = null;
			refusal = stale;
			notify();
			services.stage.notifySurfaceChange();
			return;
		}
		const operationContext = context();
		if (entity === null || operationContext === null) {
			candidate = null;
			refusal = 'The object is no longer in the accepted source.';
			notify();
			services.stage.notifySurfaceChange();
			return;
		}
		const result = planSetFormProfile({
			context: operationContext,
			entityId: entity.id,
			outline: anchors,
			extent
		});
		if (result.kind === 'candidate') {
			const next = result.scene.entities.find((entry) => entry.id === entity.id);
			candidate = next?.kind === 'form' ? next : null;
			refusal = null;
		} else {
			candidate = null;
			refusal = result.code === 'no_op' ? null : result.message;
		}
		notify();
		services.stage.notifySurfaceChange();
	}

	function releasePress(): void {
		if (press?.lease.kind === 'granted' && press.lease.lease.active) press.lease.lease.release();
		press = null;
	}

	function close(): void {
		releasePress();
		if (proposal !== null && proposal.active) proposal.release();
		proposal = null;
		base = null;
		captured = null;
		anchors = [];
		extent = 0;
		refusal = null;
		candidate = null;
		notify();
		services.stage.notifySurfaceChange();
	}

	return {
		open(entityId) {
			if (entityId === null) return false;
			const entity = stageScene(services.stage.snapshot()).entities.find((entry) => entry.id === entityId);
			if (entity?.kind !== 'form') return false;
			if (base !== null) close();
			base = entity;
			const opening = services.stage.snapshot();
			captured = {
				revision: {
					projectId: opening.acceptedRevision.projectId,
					revisionId: opening.acceptedRevision.revisionId
				},
				sceneRevision: opening.domain.unitRevisions.scene
			};
			anchors = entity.form.generator.outline.map((anchor) => ({
				key: anchor.key,
				u: anchor.u,
				v: anchor.v,
				smooth: anchor.smooth
			}));
			extent = entity.form.generator.extent;
			refusal = null;
			candidate = null;
			releasePress();
			proposal = services.stage.session.registerProposal({
				owner: 'scene-profile-revision',
				reason: 'Apply or discard the outline revision first.'
			});
			replan();
			return true;
		},

		state() {
			if (base === null) return null;
			const axis = extentAxis(base);
			return {
				entityId: base.id,
				name: base.name,
				plane: base.form.generator.plane,
				extentLabel: axis === 1 ? 'Height' : 'Depth',
				anchors,
				extent,
				physicalExtent: extent * base.form.scale[axis],
				dirty: dirty(),
				refusal
			};
		},

		setAnchor(index, patch) {
			if (base === null || anchors[index] === undefined) return;
			const next = anchors.map((anchor, at) =>
				at !== index
					? anchor
					: {
							...anchor,
							...(patch.u === undefined ? {} : { u: patch.u }),
							...(patch.v === undefined ? {} : { v: patch.v }),
							...(patch.smooth === undefined ? {} : { smooth: patch.smooth })
						}
			);
			anchors = next;
			replan();
		},

		setExtentPhysical(meters) {
			if (base === null) return;
			const axis = extentAxis(base);
			const factor = base.form.scale[axis];
			if (!Number.isFinite(meters) || !(factor > 0)) return;
			extent = meters / factor;
			replan();
		},

		pointer(intent, adapterContext) {
			const entity = base;
			if (entity === null) return false;
			if (intent.phase === 'down') {
				if (press !== null) return false;
				const projected: { index: number; distance: number }[] = [];
				// `project` answers page CSS; a pointer intent is stage-local. Compare
				// both in the Stage's own space so a header or Card inset cannot move
				// every handle out of press reach.
				const rect = adapterContext.evaluation.rect;
				for (const [index, anchor] of anchors.entries()) {
					const css = adapterContext.project(anchorWorld(entity, anchor));
					if (css === null) continue;
					projected.push({
						index,
						distance: Math.hypot(css[0] - rect.left - intent.css[0], css[1] - rect.top - intent.css[1])
					});
				}
				const nearest = projected.sort((left, right) => left.distance - right.distance)[0];
				const radius = intent.coarse === true ? ANCHOR_HIT_COARSE_CSS_PX : ANCHOR_HIT_CSS_PX;
				if (nearest === undefined || nearest.distance > radius) return false;
				const anchor = anchors[nearest.index]!;
				const lease = services.stage.acquireGesture({
					owner: 'scene-profile-revision',
					evaluationId: intent.evaluationId,
					policy: 'cancel-on-reading-change'
				});
				if (lease.kind !== 'granted') {
					refusal = `The ${lease.owner} gesture owns the pointer; finish or cancel it first.`;
					notify();
					services.stage.notifySurfaceChange();
					return false;
				}
				press = {
					evaluationId: intent.evaluationId,
					lease,
					index: nearest.index,
					start: { u: anchor.u, v: anchor.v }
				};
				refusal = null;
				notify();
				return true;
			}

			const currentPress = press;
			if (currentPress === null) return false;
			if (intent.phase === 'cancel' || intent.evaluationId !== currentPress.evaluationId) {
				anchors = anchors.map((anchor, index) =>
					index !== currentPress.index ? anchor : { ...anchor, u: currentPress.start.u, v: currentPress.start.v }
				);
				releasePress();
				replan();
				return true;
			}
			if (intent.phase === 'up') {
				releasePress();
				replan();
				return true;
			}
			const ray = adapterContext.ray([intent.css[0] + adapterContext.evaluation.rect.left, intent.css[1] + adapterContext.evaluation.rect.top]);
			if (ray === null) return true;
			const hit = adapterContext.intersect(ray, generatorPlane(entity));
			if (hit.kind !== 'intersected') return true;
			const [scaleX, scaleY, scaleZ] = entity.form.scale;
			const plan = entity.form.generator.plane === 'plan';
			const scaleV = plan ? scaleZ : scaleY;
			if (!(scaleX > 0) || !(scaleV > 0)) return true;
			const local = worldToLocal(entity, hit.worldPoint as Vec3);
			const u = quantize(local[0] / scaleX);
			const v = quantize((plan ? local[2] : local[1]) / scaleV);
			if (
				!Number.isFinite(u) ||
				!Number.isFinite(v) ||
				Math.abs(u) > PROFILE_LIMITS.maxCoordinateMeters ||
				Math.abs(v) > PROFILE_LIMITS.maxCoordinateMeters
			) {
				return true;
			}
			anchors = anchors.map((anchor, index) =>
				index !== currentPress.index ? anchor : { ...anchor, u, v }
			);
			replan();
			return true;
		},

		candidatePreview() {
			const entity = base;
			if (entity === null) return null;
			const segments: [Vec3, Vec3][] = [];
			for (let index = 0; index < anchors.length; index += 1) {
				segments.push([
					anchorWorld(entity, anchors[index]!),
					anchorWorld(entity, anchors[(index + 1) % anchors.length]!)
				]);
			}
			return {
				id: 'scene-profile-revision-anchors',
				role: refusal === null ? 'subject' : 'refused',
				polygons: [],
				segments,
				labels: anchors.map((anchor, index) => ({
					world: anchorWorld(entity, anchor),
					text: `A${index + 1}`
				}))
			};
		},

		ghost() {
			if (candidate === null) return null;
			return {
				id: 'scene-profile-revision-body',
				center: [...candidate.position] as Vec3,
				yaw: candidate.rotation[1],
				shape: { kind: 'form', form: candidate.form }
			};
		},

		async apply() {
			if (base === null) return { kind: 'closed' };
			if (!dirty()) return { kind: 'no-op' };
			const stale = staleReason();
			if (stale !== null) {
				refusal = stale;
				notify();
				services.stage.notifySurfaceChange();
				return { kind: 'refused', message: stale };
			}
			const operationContext = context();
			if (operationContext === null) {
				refusal = 'The object is no longer in the accepted source.';
				notify();
				return { kind: 'refused', message: refusal };
			}
			const result = planSetFormProfile({
				context: operationContext,
				entityId: base.id,
				outline: anchors,
				extent
			});
			if (result.kind !== 'candidate') {
				refusal = result.kind === 'rejected' ? result.message : null;
				notify();
				services.stage.notifySurfaceChange();
				return { kind: 'refused', message: refusal ?? 'The revision is not valid yet.' };
			}
			const entityId = base.id;
			const opening = captured;
			if (opening === null) return { kind: 'refused', message: STALE_SOURCE_MESSAGE };
			const outcome = await services.authoring.accept({
				version: 1,
				kind: 'set-form-profile',
				operationId: globalThis.crypto.randomUUID(),
				expectedRevision: { ...opening.revision },
				targets: [sceneEntityReference(entityId, opening.sceneRevision)],
				payload: {
					entityId,
					outline: anchors.map((anchor) => ({ ...anchor })),
					extent
				},
				capturedInputs: [],
				allocatedIds: []
			});
			if (outcome.kind !== 'installed') {
				refusal =
					outcome.kind === 'refused'
						? outcome.message
						: 'The revision was not installed; try again.';
				notify();
				return { kind: 'refused', message: refusal };
			}
			close();
			return { kind: 'installed' };
		},

		discard() {
			close();
		},

		hasWork() {
			return base !== null;
		},

		dispose() {
			listeners.clear();
			releasePress();
			if (proposal !== null && proposal.active) proposal.release();
			proposal = null;
			base = null;
			captured = null;
			anchors = [];
			candidate = null;
			refusal = null;
		},

		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
	};
}
