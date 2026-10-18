/**
 * T2.P01.S03 — the Scene adapter: the first coherent Scene editing surface.
 *
 * It registers `T2.P01.S02`'s seven Scene planners with the one F.4 coordinator
 * and contributes Place/Arrange Find entries, Card facts and one instrument
 * through T1.P01.S07's AM-5 points. It edits no host core, route or shell
 * module, and it never writes Layout: support is consulted by the retained
 * planner.
 *
 * The session (`./scene/placement`) owns arming, the gesture lease, the
 * candidate preview and the one cancel path. This factory only wires it to the
 * public Stage services.
 */

import type { StageAdapterFactory } from '$lib/authoring/stage/stage-adapter-host';
import type {
	StageAdapter,
	StageAdapterBinding,
	StageAdapterContext,
	StageCardFact,
	StageCardSubject,
	StageGhostMesh,
	StagePointerIntent
} from '$lib/authoring/stage/stage-facade';
import { currentStagePlanner, currentStageSource } from '$lib/authoring/stage/current-stage-source';
import {
	NATIVE_PLACEMENT_PRIMITIVES,
	nativePlacementDefinition
} from '$lib/authoring/scene/object-definition-policy';
import {
	chooseFloorSupport,
	floorSupportSnapshotOf,
	queryFloorSupports
} from '@portfolio/layout-core';
import { createScenePlanners, sceneSupportGenerationId } from '@portfolio/project-model';

import SceneTransformInstrument from './scene/SceneTransformInstrument.svelte';
import { candidateGhost } from './scene/candidate-ghost';
import {
	activeSceneSurface,
	publishSceneSurface,
	retireSceneSurface,
	sceneEntityReference,
	sceneSessionFromServices,
	sceneSurfaceFor,
	type SceneCandidate,
	type ScenePlacementSession,
	type SceneSurface
} from './scene/placement';
import { floorSupport, supportOccluders } from './scene/support-occlusion';

const SCENE_ARRANGE_TASK = 'scene-arrange';
const SCENE_PLACE_TASK = 'scene-place';

function entityFacts(
	source: ReturnType<typeof currentStageSource>['source'],
	entityId: string
): readonly StageCardFact[] {
	const entity = source.scene.entities.find((candidate) => candidate.id === entityId);
	if (entity === undefined) return [];
	return [
		{ label: 'Kind', value: entity.kind },
		{ label: 'Name', value: entity.name },
		{
			label: 'Position',
			value: entity.position.map((value) => `${value} m`).join(' · ')
		},
		{
			label: 'Yaw',
			value: `${entity.rotation[1]} rad`
		}
	];
}

/** The floor support one pointer position resolves against the drawn geometry. */
function pointerFloorSupport(
	context: StageAdapterContext,
	css: readonly [number, number],
	exceptEntityId: string | null
) {
	const ray = context.ray(css);
	if (ray === null) return { kind: 'none' as const, reason: 'degenerate' as const };
	const domain = context.snapshot.domain;
	return floorSupport(
		ray,
		domain.datumMeters,
		supportOccluders(domain.geometry, domain.scene, exceptEntityId)
	);
}

/**
 * The floor support a pointer Place may show, or `null`.
 *
 * A visible datum hit is not enough: the point must also be covered by exactly
 * one eligible compiled Room floor, so preview and the retained planner (which
 * re-derives the same support at commit) agree. The query is the Layout-owned
 * canonical resolution, reused here rather than a second membership test, and
 * `chooseFloorSupport` refuses `none` and `choice-required` exactly as commit
 * does. The point is the **snapped** X/Z the candidate will commit at, so an
 * enabled snap cannot move a shown pose off its floor. The drawn-geometry
 * occluder test still runs first so a Wall or plinth can never be mistaken for
 * floor.
 */
function pointerPlaceSupport(
	context: StageAdapterContext,
	css: readonly [number, number],
	snapStep: number | null
): { readonly x: number; readonly z: number; readonly elevation: number } | null {
	const visible = pointerFloorSupport(context, css, null);
	if (visible.kind !== 'floor') return null;
	const step = snapStep !== null && snapStep > 0 ? snapStep : null;
	const x = step === null ? visible.worldPoint[0] : Math.round(visible.worldPoint[0] / step) * step;
	const z = step === null ? visible.worldPoint[2] : Math.round(visible.worldPoint[2] / step) * step;
	const domain = context.snapshot.domain;
	const queried = queryFloorSupports(floorSupportSnapshotOf(domain.geometry), {
		generationId: sceneSupportGenerationId(context.snapshot.sourceContentId),
		x,
		z
	});
	if (queried.kind !== 'candidates') return null;
	const chosen = chooseFloorSupport(queried.candidates);
	if (chosen.kind !== 'resolved') return null;
	return { x, z, elevation: chosen.support.elevation };
}

export const createAdapter: StageAdapterFactory = (services) => {
	const planners = createScenePlanners();
	for (const planner of planners) {
		// Placement needs its admitted definitions, which carry an asynchronously
		// captured metadata identity; it is registered once that identity exists.
		if (planner.kind === 'place-object') continue;
		const registration = services.authoring.registerPlanner(currentStagePlanner(planner));
		if (registration.kind !== 'registered') {
			throw new Error(
				`Scene adapter planner "${planner.kind}" was refused: ${registration.reason} — ${registration.message}`
			);
		}
	}
	// Only the native primitives are admitted today; catalogue models stay
	// excluded until their r186 contact verification is recorded. The promise
	// settles in a microtask, long before the first accepted evaluation binds.
	void Promise.all(NATIVE_PLACEMENT_PRIMITIVES.map((primitive) => nativePlacementDefinition(primitive)))
		.then((definitions) => {
			const definitionPlace = createScenePlanners({ definitions }).find(
				(planner) => planner.kind === 'place-object'
			);
			if (definitionPlace === undefined) return;
			const registration = services.authoring.registerPlanner(currentStagePlanner(definitionPlace));
			// A refusal here means the epoch ended before registration; the adapter
			// is already unbound, so there is no live surface to report it on.
			if (registration.kind !== 'registered') return;
		});

	const adapter: StageAdapter = {
		id: 'scene',
		requiredCapabilities: ['stage-instrument-v1'],
		bind(context): StageAdapterBinding {
			const source = currentStageSource(context.snapshot).source;
			// One drag at a time: the press origin and the yaw it started from, so a
			// shift-drag is a rotation of the same captured baseline.
			let dragOrigin: { readonly x: number; readonly yaw: number } | null = null;
			/** The task this binding is showing; pointer behavior follows the invoked task. */
			let openTaskKind: string | null = null;
			/** Bumped by any close, so an in-flight install cannot reopen a closed tool. */
			let taskEpoch = 0;
			let abortReopen: (() => void) | null = null;
			/**
			 * The surface this press claimed, held for every later phase of the same
			 * gesture. A reading change can evaluate a new viewport mid-press; resolving
			 * the surface again on release would show a different, empty session and
			 * silently drop the pose the creator dragged.
			 */
			let gestureSurface: SceneSurface | null = null;
			/** The surface this binding published, with the snapshot it was keyed by. */
			let ownedSurface: { readonly snapshot: object; readonly surface: SceneSurface } | null = null;
			/** The surface this binding armed when it opened the current task. */
			let taskSurface: SceneSurface | null = null;

			/**
			 * Publish/read the surface for the **live** accepted snapshot and evaluation.
			 * A binding can outlive a reading change, so the bind-time snapshot is not
			 * used here: the surface must be keyed exactly as the instrument and the
			 * overlay read it.
			 */
			function surfaceFor(evaluationId: string, snapshot = services.stage.snapshot()): SceneSurface {
				const existing = activeSceneSurface(snapshot);
				if (existing !== null && existing.evaluationId === evaluationId) {
					if (openTaskKind === 'place-object') attachPlacePersistence(existing.session);
					return existing;
				}
				const session = sceneSessionFromServices({ services, evaluationId });
				const next: SceneSurface = { evaluationId, session };
				if (openTaskKind === 'place-object') attachPlacePersistence(session);
				// Publishing a different evaluation cancels the old proposal. The old
				// release is identity-checked, so it cannot remove this replacement.
				publishSceneSurface(snapshot, next);
				ownedSurface = { snapshot, surface: next };
				return next;
			}

			/** The surface this press claimed, or the one this binding published. */
			function liveSurface(): SceneSurface | null {
				return gestureSurface ?? ownedSurface?.surface ?? null;
			}

			/**
			 * Keep the persistent Place tool armed after its own accepted install.
			 *
			 * A placement commit — typed or pointer, they share this session — is
			 * accepted through the host's one install path, which closes the contributed
			 * task and retires this binding. The session reports that one commit, and this
			 * binding reopens its own Place task for the next placement; Esc/Select is the
			 * one path that ends the tool. The captured epoch makes an explicit close win
			 * the race against an acceptance still in flight: a close that is not this
			 * install bumps it, so the deferred reopen is dropped instead of resurrecting
			 * a tool the creator ended.
			 */
			function attachPlacePersistence(session: ScenePlacementSession): void {
				const epoch = taskEpoch;
				session.setPlacementCommittedListener(() => {
					if (epoch !== taskEpoch) return;
					reopenPlace();
				});
			}

			/** Reopen this binding's Place task once the rebuild makes it invocable. */
			function reopenPlace(): void {
				const stage = services.stage;
				let off: (() => void) | null = null;
				let settled = false;
				const finish = (): void => {
					if (settled) return;
					settled = true;
					off?.();
					off = null;
					abortReopen = null;
				};
				let opening = false;
				const attempt = (): void => {
					if (settled || opening) return;
					// The install already closed the task; if something else reopened it,
					// the tool is armed and this deferred reopen is done.
					if (stage.session.task() !== null) {
						finish();
						return;
					}
					opening = true;
					let opened = false;
					try {
						opened = stage.openContributedTask(SCENE_PLACE_TASK, 'scene').kind === 'opened';
					} finally {
						opening = false;
					}
					if (opened) finish();
				};
				off = stage.onAdaptersChanged(attempt);
				abortReopen = () => finish();
				// The rebuild that follows the install may already be live.
				attempt();
			}

			async function commitPointerPlace(session: ScenePlacementSession): Promise<void> {
				const outcome = await session.commitPlace();
				if (outcome.kind !== 'committed') {
					services.stage.notifySurfaceChange();
					return;
				}
				const placedId = session.placedEntityId();
				if (placedId !== null) {
					// Canonical selection of the new entity at the post-accept revision;
					// no Plan fragment is fabricated for a Scene-only subject.
					const reference = sceneEntityReference(
						placedId,
						services.stage.snapshot().sourceContentId
					);
					services.stage.setSelection({ ordered: [{ reference }], primary: reference });
				}
				services.stage.notifySurfaceChange();
				// The session reports the commit to the binding that attached persistence,
				// which reopens this persistent task through the host's one install path.
			}

			return {
				tasks: [
					{
						id: SCENE_PLACE_TASK,
						taskKind: 'place-object',
						label: 'Place object',
						targetRef: null,
						order: 20
					},
					{
						id: SCENE_ARRANGE_TASK,
						taskKind: SCENE_ARRANGE_TASK,
						label: 'Arrange',
						targetRef: context.selection()?.ref ?? null,
						order: 10
					}
				],
				findEntries: [
					{
						id: SCENE_PLACE_TASK,
						taskKind: 'place-object',
						label: 'Place object',
						railFamily: 'place',
						capability: 'scene',
						order: 20
					},
					{
						id: SCENE_ARRANGE_TASK,
						taskKind: SCENE_ARRANGE_TASK,
						label: 'Arrange',
						railFamily: 'arrange',
						capability: 'scene',
						order: 10
					}
				],
				// The pointer claim is offered before the host's navigation gesture and
				// only while this adapter's task owns the press. A refused clamp or a
				// missing selection refuses the claim rather than starting a drag.
				pointerIntent(intent: StagePointerIntent, adapterContext) {
					// Claim the surface once, on the press. Every later phase of this
					// gesture reads the same session even if the viewport is re-evaluated.
					if (intent.phase === 'down') gestureSurface = surfaceFor(adapterContext.evaluationId);
					const surface = gestureSurface ?? surfaceFor(adapterContext.evaluationId);
					const session = surface.session;
					if (intent.phase === 'cancel') {
						dragOrigin = null;
						gestureSurface = null;
						// An interruption is not Esc/Select: Place stays armed.
						session.abortGesture();
						return true;
					}
					if (intent.phase === 'down') {
						if (openTaskKind === 'place-object') {
							const primitive = session.placePrimitive();
							const begun = session.beginPlace(primitive);
							if (begun.kind === 'refused') {
								gestureSurface = null;
								return false;
							}
							const support = pointerPlaceSupport(adapterContext, intent.css, session.snapStep());
							if (support === null) {
								// No visible, compiled Room-floor support under the press: refuse
								// the claim rather than showing a pose commit would reject.
								session.abortGesture();
								gestureSurface = null;
								return false;
							}
							session.previewPlace(primitive, support.x, support.z, support.elevation);
							return true;
						}
						const primary = adapterContext.selectionState().primary;
						if (primary === null || primary.domain !== 'scene' || primary.subject.kind !== 'entity') {
							gestureSurface = null;
							return false;
						}
						const begun = session.begin(primary.subject.id);
						if (begun.kind === 'refused') {
							gestureSurface = null;
							return false;
						}
						dragOrigin = { x: intent.css[0], yaw: session.baseline()?.rotation[1] ?? 0 };
						return true;
					}
					if (intent.phase === 'up') {
						dragOrigin = null;
						gestureSurface = null;
						const proposed = session.candidate();
						if (openTaskKind === 'place-object') {
							if (proposed !== null && proposed.kind === 'place') void commitPointerPlace(session);
							else if (session.armed() === 'place') session.abortGesture();
							else session.cancel();
							return true;
						}
						if (proposed !== null) void session.commit();
						// A click, or a drag whose last move had no support, is not a
						// proposal: release the lease instead of holding it until task close.
						else session.cancel();
						return true;
					}
					// Shift-drag rotates around the declared pivot; the same planner the typed
					// yaw field uses receives the captured baseline plus the drag delta.
					if (intent.shift === true && dragOrigin !== null && openTaskKind !== 'place-object') {
						session.previewYaw(dragOrigin.yaw + (intent.css[0] - dragOrigin.x) * 0.01);
						return true;
					}
					if (openTaskKind === 'place-object') {
						// Place follows the pointer on the floor; a move without visible
						// compiled Room-floor support withdraws the displayed pose so release
						// cannot install it.
						const support = pointerPlaceSupport(adapterContext, intent.css, session.snapStep());
						if (support === null) {
							session.invalidatePreview();
							return true;
						}
						session.previewPlace(
							session.placePrimitive(),
							support.x,
							support.z,
							support.elevation
						);
						return true;
					}
					// move: the pointer ray is resolved against the geometry the Stage
					// draws. A Wall, plinth or other object nearer than the datum is
					// support the creator cannot see, so the obsolete candidate is
					// withdrawn rather than committed on release.
					const support = pointerFloorSupport(
						adapterContext,
						intent.css,
						session.subjectEntityId()
					);
					if (support.kind !== 'floor') {
						session.invalidatePreview();
						return true;
					}
					session.previewMove(support.worldPoint[0], support.worldPoint[2]);
					return true;
				},
				// Closing the task (Esc at the shell, replacement) uses the one cancel path.
				taskClosed() {
					dragOrigin = null;
					// Cancel the session this task armed (Place) or this press claimed
					// (Arrange), not whichever session another binding may have published.
					const closing = taskSurface ?? gestureSurface;
					gestureSurface = null;
					openTaskKind = null;
					taskSurface = null;
					closing?.session.cancel();
					// Any close ends the armed tool for good: bumping the epoch makes an
					// acceptance still in flight drop its deferred reopen, and the pending
					// reopen (if any) is aborted here rather than resurrecting the tool.
					taskEpoch += 1;
					abortReopen?.();
					abortReopen = null;
				},
				// The captured candidate is shown through the existing overlay surface,
				// so Plan and 3D present the same pose the planner would commit.
				overlay(adapterContext) {
					const surface = sceneSurfaceFor(adapterContext.snapshot, adapterContext.evaluationId);
					const candidate = surface?.session.candidate() ?? null;
					if (candidate === null) return [];
					const css = adapterContext.project(candidate.position);
					if (css === null) return [];
					const snap = candidate.snappedStep === null ? '' : ` · snap ${candidate.snappedStep} m`;
					return [
						{
							id: 'scene-candidate',
							css,
							label: `${candidate.worldXZ[0].toFixed(3)}, ${candidate.worldXZ[1].toFixed(3)} m · ${candidate.yaw.toFixed(3)} rad${snap}`
						}
					];
				},
				// The candidate is drawn as the object's own body at the captured pose,
				// in the one Canvas, so Plan and 3D show what Commit will install.
				ghosts(adapterContext): readonly StageGhostMesh[] {
					const surface = sceneSurfaceFor(adapterContext.snapshot, adapterContext.evaluationId);
					const candidate: SceneCandidate | null = surface?.session.candidate() ?? null;
					if (candidate === null) return [];
					const entity =
							candidate.entityId === null
								? null
								: adapterContext.snapshot.domain.scene.entities.find((entry) => entry.id === candidate.entityId) ??
									null;
					const ghost = candidateGhost(entity, candidate);
					return ghost === null ? [] : [ghost];
				},
				cardFacts(cardSubject: StageCardSubject) {
					// Only a Scene entity subject claims Scene facts; a Layout subject keeps
					// the Layout adapter's facts.
					if (cardSubject.sourceKind !== 'entity') return [];
					return entityFacts(source, cardSubject.sourceId);
				},
				instrument(task) {
					openTaskKind = task.kind;
					// Arm the surface for the evaluation the instrument will actually read,
					// not the bind-time one: a reading change does not rebuild the binding.
				const evaluationId = services.stage.evaluationId();
				if (task.kind === 'place-object' && evaluationId !== null) {
					taskSurface = surfaceFor(evaluationId, services.stage.snapshot());
					taskSurface.session.arm('place');
					// Typed and pointer Place commit through this session; listening here is
					// what keeps the tool persistent for a typed commit too.
					attachPlacePersistence(taskSurface.session);
				} else {
					taskSurface = liveSurface();
				}
					return {
						summary: task.kind === 'place-object' ? 'Place object' : 'Arrange',
						view: { component: SceneTransformInstrument, services }
					};
				},
				dispose() {
					gestureSurface = null;
					openTaskKind = null;
					taskSurface = null;
					abortReopen?.();
					abortReopen = null;
					// Teardown cancels exactly what this binding published or held. Reading
					// the registry's "current" entry would let an old binding cancel a
					// newer replacement it never owned.
					const owned = ownedSurface;
					ownedSurface = null;
					if (owned === null) return;
					owned.surface.session.cancel();
					retireSceneSurface(owned.snapshot, owned.surface);
				}
			};
		}
	};
	return adapter;
};
