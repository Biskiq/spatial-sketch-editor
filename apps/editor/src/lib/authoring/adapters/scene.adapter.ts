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
import { createScenePlanners } from '@portfolio/project-model';

import SceneTransformInstrument from './scene/SceneTransformInstrument.svelte';
import { candidateGhost } from './scene/candidate-ghost';
import { activeSceneSurface } from './scene/placement';
import { floorSupport, supportOccluders } from './scene/support-occlusion';

const SCENE_ARRANGE_TASK = 'scene-arrange';

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
			return {
				tasks: [
					{
						id: 'scene-place',
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
						id: 'scene-place',
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
					const surface = activeSceneSurface();
					if (surface === null || surface.evaluationId !== adapterContext.evaluationId) return false;
					const session = surface.session;
					if (intent.phase === 'cancel') {
						dragOrigin = null;
						session.cancel();
						return true;
					}
					if (intent.phase === 'down') {
						const primary = adapterContext.selectionState().primary;
						if (primary === null || primary.domain !== 'scene' || primary.subject.kind !== 'entity') return false;
						const begun = session.begin(primary.subject.id);
						if (begun.kind === 'refused') return false;
						dragOrigin = { x: intent.css[0], yaw: session.baseline()?.rotation[1] ?? 0 };
						return true;
					}
					if (intent.phase === 'up') {
						dragOrigin = null;
						if (session.candidate() !== null) void session.commit();
						// A click, or a drag that produced no candidate, is not a proposal:
						// release the lease instead of holding it until task close.
						else session.cancel();
						return true;
					}
					// Shift-drag rotates around the declared pivot; the same planner the typed
					// yaw field uses receives the captured baseline plus the drag delta.
					if (intent.shift === true && dragOrigin !== null) {
						session.previewYaw(dragOrigin.yaw + (intent.css[0] - dragOrigin.x) * 0.01);
						return true;
					}
					// move: the pointer ray is resolved against the geometry the Stage
					// draws. A Wall, plinth or other object nearer than the datum is
					// support the creator cannot see, so it keeps the previous candidate
					// rather than placing a pose behind it.
					const ray = adapterContext.ray(intent.css);
					if (ray === null) return true;
					const domain = adapterContext.snapshot.domain;
					const support = floorSupport(
						ray,
						domain.datumMeters,
						supportOccluders(domain.geometry, domain.scene, session.subjectEntityId())
					);
					if (support.kind !== 'floor') return true;
					session.previewMove(support.worldPoint[0], support.worldPoint[2]);
					return true;
				},
				// Closing the task (Esc at the shell, replacement) uses the one cancel path.
				taskClosed() {
					dragOrigin = null;
					activeSceneSurface()?.session.cancel();
				},
				// The captured candidate is shown through the existing overlay surface,
				// so Plan and 3D present the same pose the planner would commit.
				overlay(context) {
					const surface = activeSceneSurface();
					if (surface === null || surface.evaluationId !== context.evaluationId) return [];
					const candidate = surface.session.candidate();
					if (candidate === null) return [];
					const css = context.project(candidate.position);
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
				ghosts(context): readonly StageGhostMesh[] {
					const surface = activeSceneSurface();
					if (surface === null || surface.evaluationId !== context.evaluationId) return [];
					const candidate = surface.session.candidate();
					if (candidate === null) return [];
					const entity = source.scene.entities.find((entry) => entry.id === candidate.entityId);
					if (entity === undefined) return [];
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
					if (task.kind !== 'place-object' && task.kind !== SCENE_ARRANGE_TASK) return null;
					return {
						summary: task.kind === 'place-object' ? 'Place object' : 'Arrange',
						view: { component: SceneTransformInstrument, services }
					};
				}
			};
		}
	};
	return adapter;
};
