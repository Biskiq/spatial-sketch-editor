/**
 * T2.P01.S03 — the Scene adapter: the first coherent Scene editing surface.
 *
 * It registers the Scene planners with the one F.4 coordinator and contributes
 * Place, Compose and Import through T1.P01.S07's AM-5 points. R217.S08 adds the
 * shared Stage mark vocabulary for a selected object: Move, Turn, a Scale point
 * disclosure and the Size ray it reveals. The same exact Position, Yaw and Size
 * values are the Card's writer. It edits no host core, route or shell module, and
 * it never writes Layout: support is consulted by the retained planner.
 *
 * X7 splits the one closure it used to be into owned modules, and this file keeps
 * what only an adapter can: registering the planners, composing one binding per
 * bind, and dispatching each Stage entry point to the module that owns the
 * lifetime it touches. The three never share state.
 *
 * - `./scene/placement-binding`: the placement session's arm, reopen, complete,
 *   clear and rebind lifetimes, and the drawn Shape tile.
 * - `./scene/object-mark-session`: the no-task Move, Turn, Size, Lift and Form-ray
 *   gestures, each holding its own lease and submitting the same planner the Card
 *   field does.
 * - `./scene/scene-contributions`: read-only facts, marks, tasks and Card
 *   projections.
 * - `./scene/candidate-presenter`: the pure Paper preview, overlay and ghost
 *   projection of whichever proposal is live.
 */

import type {
	StageAdapterFactory,
	StageAdapterServices,
	StageCandidatePreview,
	StageGhostMesh
} from '$lib/authoring/stage/stage-adapter-host';
import type {
	StageAdapter,
	StageAdapterBinding
} from '$lib/authoring/stage/stage-adapter-host';
import {
	NATIVE_PLACEMENT_PRIMITIVES,
	admittedCatalogueModelAssets,
	catalogueModelDefinition,
	nativePlacementDefinition
} from '$lib/authoring/scene/object-definition-policy';
import {
	createScenePlanners,
	createArtworkPlanners,
	type NormalizedPlacementDefinition
} from '@portfolio/project-model/scene-planning';
import SceneTransformInstrument from './scene/SceneTransformInstrument.svelte';
import ImportModelInstrumentLazy from './scene/import/ImportModelInstrumentLazy.svelte';
import { armedModelDefinition, creatorDefinitions } from './scene/import/definitions';
import {
	presentDrawnCandidate,
	presentGhosts,
	presentMarkOutline,
	presentOverlay,
	presentPlacementPreview
} from './scene/candidate-presenter';
import { createObjectMarkSession } from './scene/object-mark-session';
import { liveProjectId } from './scene/object-readings';
import { createPlacementBinding } from './scene/placement-binding';
import { createSceneContributions } from './scene/scene-contributions';
import { SCENE_COMPOSE_TASK, SCENE_IMPORT_KIND, SCENE_PLACE_KIND } from './scene/scene-task-ids';

export const createAdapter: StageAdapterFactory = (services: StageAdapterServices) => {
	// Every planner is registered once, and the placement planner's definitions
	// are re-read for each preparation instead of being frozen at registration:
	// a native definition's metadata identity is captured asynchronously, and an
	// approved creator model becomes placeable after the adapter is already
	// mounted. The intent still carries `metadataContentId`, so a stale
	// definition refuses (`definition-changed`) rather than placing something
	// else. Built-in catalogue models enter this set only after their r186 contact
	// verification is recorded; approved creator models remain project-scoped.
	const admitted: NormalizedPlacementDefinition[] = [];
	const planners = [...createArtworkPlanners(), ...createScenePlanners({
		definitions: () => {
			// The approved model a creator has armed is an admitted definition even
			// before its first placement installs the resource. A rebind (a drawing
			// install replaces the accepted source) clears the captured procedure
			// definitions, so the arm itself must keep the model placeable.
			const armed = armedModelDefinition(liveProjectId(services));
			return [...admitted, ...creatorDefinitions(), ...(armed === null ? [] : [armed])];
		}
	})];
	for (const planner of planners) {
		const registration = services.authoring.registerPlanner(planner);
		if (registration.kind !== 'registered') {
			throw new Error(
				`Scene adapter planner "${planner.kind}" was refused: ${registration.reason} — ${registration.message}`
			);
		}
	}
	void Promise.all([
		...NATIVE_PLACEMENT_PRIMITIVES.map((primitive) => nativePlacementDefinition(primitive)),
		...admittedCatalogueModelAssets().map((asset) => catalogueModelDefinition(asset.id))
	]).then((definitions) => {
		admitted.push(
			...definitions.filter(
				(definition): definition is NormalizedPlacementDefinition => definition !== null
			)
		);
	});

	const adapter: StageAdapter = {
		id: 'scene',
		// Handle admission refuses a grip that names anything outside this set. The
		// Scene marks name place-on-floor, set-yaw and resize-on-floor, all of which
		// are registered here; no mark introduces a fourth planner.
		plannerKinds: planners.map((planner) => planner.kind),
		requiredCapabilities: ['stage-instrument-v1'],
		bind(context): StageAdapterBinding {
			const placement = createPlacementBinding(services, context);
			const marks = createObjectMarkSession(services);
			const contributions = createSceneContributions(services, context, marks);

			function resetPlacementAndMarks(): void {
				marks.reset();
				placement.selectionChanged();
			}

			return {
				...contributions,
				// The pointer claim is offered before the host's navigation gesture and
				// only while this adapter's task owns the press (or a mark is live).
				// A refused clamp or a missing selection refuses the claim rather than
				// starting a drag.
				pointerIntent(intent, adapterContext) {
					if (placement.pointerPrelude(intent)) return true;
					const taskKind = placement.taskKind();
					// Compose is a typed command surface. It claims no pointer: a press over
					// the Stage during Compose is ordinary navigation, never an accidental
					// move/yaw of the selected entity.
					if (taskKind === SCENE_COMPOSE_TASK) return false;
					// With no contributed task open this binding is the selection's direct
					// manipulation surface: an admitted object or form mark claims its own
					// drag.
					if (taskKind === null) return marks.pointer(intent, adapterContext);
					return placement.pointerInTask(intent, adapterContext);
				},
				/**
				 * Escape during a live mark gesture cancels that writer before the host
				 * unwinds the selection. No task is open, so this is reached through the
				 * host's gesture-key path, not the contributed-task key path.
				 */
				keyIntent(intent) {
					if (placement.key(intent)) return true;
					return placement.taskKind() === null && marks.key(intent);
				},
				hoverIntent(intent, adapterContext) {
					return placement.hover(intent, adapterContext);
				},
				selectionChanged() {
					// A mark belongs to the subject it was drawn for; a new subject's
					// descriptors replace it, and a stale refusal would name the old one.
					resetPlacementAndMarks();
				},
				// Closing the task (Esc at the shell, replacement) uses the one cancel path.
				taskClosed() {
					resetPlacementAndMarks();
					placement.taskClosed();
				},
				candidatePreview(adapterContext): readonly StageCandidatePreview[] {
					if (placement.drawing()) {
						return presentDrawnCandidate(
							placement.drawPreview(adapterContext),
							adapterContext.snapshot.domain.datumMeters
						);
					}
					// Plan hides the Canvas ghost, so a mark gesture's proposal is drawn
					// there as its dashed footprint in the ghost colour.
					if (adapterContext.evaluation.settledReading === 'plan') {
						marks.prune();
						const markOutline = presentMarkOutline(adapterContext, marks.candidate());
						if (markOutline !== null) return [markOutline];
					}
					if (
						adapterContext.evaluation.settledReading !== 'plan' ||
						adapterContext.evaluation.renderedReading !== 'plan'
					) return [];
					return presentPlacementPreview(adapterContext, placement.view(adapterContext), marks.candidate());
				},
				// The captured candidate is shown through the existing overlay surface,
				// so Plan and 3D present the same pose the planner would commit.
				overlay(adapterContext) {
					if (placement.drawing()) return placement.drawOverlay(adapterContext);
					return presentOverlay(adapterContext, placement.view(adapterContext));
				},
				// The candidate is drawn as the object's own body at the captured pose,
				// in the one Canvas, so Plan and 3D show what Commit will install.
				ghosts(adapterContext): readonly StageGhostMesh[] {
					const object = marks.ghost(adapterContext);
					const leading: StageGhostMesh[] = [];
					if (placement.drawing()) leading.push(...placement.drawGhosts());
					if (object !== null) leading.push(object);
					return presentGhosts(adapterContext, placement.view(adapterContext), leading);
				},
				instrument(task) {
					placement.openTask(task.kind);
					if (task.kind === SCENE_IMPORT_KIND) {
						return {
							summary: 'Import a model',
							view: { component: ImportModelInstrumentLazy, services }
						};
					}
					return {
						summary:
							task.kind === SCENE_PLACE_KIND
								? 'Objects'
								: task.kind === SCENE_COMPOSE_TASK
									? 'Compose'
									: 'Import model',
						view: { component: SceneTransformInstrument, services }
					};
				},
				dispose() {
					marks.reset();
					placement.dispose();
				}
			};
		}
	};
	return adapter;
};
