/**
 * The Scene adapter's group-copy binding.
 *
 * Wraps the shared group-copy placement session for the lifetime of one adapter
 * binding: the armed copy (kept in the project-keyed arm store, so a reading
 * change rebinds without losing the tool), pointer and hover routing, the ghost,
 * the mount label and Escape. It owns no planning mathematics and draws nothing;
 * the session and the existing presenters do.
 *
 * It never opens a task and never writes the Scene itself: D8d/D8f own the entry
 * point that arms a fixture or a saved group, and acceptance still goes through
 * the one F.4 intent.
 */
import type {
	StageAdapterContext,
	StageAdapterServices,
	StageCandidatePreview,
	StageGhostMesh,
	StageKeyboardIntent,
	StageOverlayContribution,
	StagePointerIntent,
} from '$lib/authoring/stage/stage-adapter-host';
import { draftingSnapIncrementMeters } from '$lib/authoring/stage/stage-adapter-host';
import type { NormalizedPlacementDefinition } from '@portfolio/project-model/scene-planning';
import type { SceneEntity } from '@portfolio/project-model/scene';
import { sceneClusterReference } from '../../scene/selection-target';
import {
	armGroupCopy,
	createGroupCopyPlacementSession,
	groupCopyPointerAt,
	peekArmedGroupCopy,
	type ArmedGroupCopy,
	type GroupCopyPlacementSession,
} from './group-copy-placement-session';
import { liveProjectId } from './object-readings';
import type { SceneWriteOutcome } from './placement';
import { scenePlacementDefinitions } from './scene-placement-definitions';
import { stageLayout, stageScene } from '$lib/authoring/stage/stage-adapter-host';

export type GroupCopyBinding = {
	/** Whether a group copy is armed on this project. */
	armed(): boolean;
	/** Arm one copy, or clear the arm with `null`; no task, no write. */
	arm(copy: ArmedGroupCopy | null): void;
	pointer(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	hover(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	key(intent: StageKeyboardIntent): boolean;
	candidatePreviews(adapterContext: StageAdapterContext): readonly StageCandidatePreview[];
	ghosts(): readonly StageGhostMesh[];
	overlays(adapterContext: StageAdapterContext): readonly StageOverlayContribution[];
	/** A rebind or unmount releases the lease; the project's arm survives. */
	dispose(): void;
};

export function createGroupCopyBinding(
	services: StageAdapterServices,
	admitted: readonly NormalizedPlacementDefinition[],
	outline?: (
		context: StageAdapterContext,
		member: SceneEntity,
		role: StageCandidatePreview['role'],
	) => StageCandidatePreview | null,
): GroupCopyBinding {
	const projectId = liveProjectId(services);
	let busy = false;
	const session: GroupCopyPlacementSession = createGroupCopyPlacementSession({
		read: () => {
			const snapshot = services.stage.snapshot();
			return {
				projectId: snapshot.acceptedRevision.projectId,
				sourceContentId: snapshot.sourceContentId,
				layout: stageLayout(snapshot),
				scene: stageScene(snapshot),
				definitions: scenePlacementDefinitions(services, admitted),
			};
		},
		accept: async (intent) => {
			const outcome = await services.authoring.accept(intent);
			return outcome.kind === 'refused'
				? ({
						kind: 'refused',
						code: outcome.code,
						message: outcome.message,
					} satisfies SceneWriteOutcome)
				: outcome;
		},
		acceptedRevisionId: () => services.authoring.acceptedRevision().revisionId,
		acquireGesture: (request) => services.stage.acquireGesture(request),
		selectGroup: (clusterId) => {
			const revision = services.stage.snapshot().domain.unitRevisions.scene;
			const reference = sceneClusterReference(clusterId, revision);
			services.stage.setSelection({ ordered: [{ reference }], primary: reference });
		},
		notify: () => services.stage.notifySurfaceChange(),
		...(outline === undefined ? {} : { outline }),
	});

	const isArmed = (): boolean => peekArmedGroupCopy(projectId) !== null || session.armed() !== null;

	// A rebind is a reading change, not a disarm: the project's arm resumes.
	const pending = peekArmedGroupCopy(projectId);
	if (pending !== null) session.arm(pending);

	function snapshotStep(context: StageAdapterContext): number | null {
		return draftingSnapIncrementMeters(context.drafting());
	}

	function pointerFor(
		intent: StagePointerIntent,
		context: StageAdapterContext,
	): ReturnType<typeof groupCopyPointerAt> {
		return groupCopyPointerAt(context, intent.css, snapshotStep(context));
	}

	return {
		armed: isArmed,
		arm(copy) {
			armGroupCopy(projectId, copy);
			session.arm(copy);
			services.stage.notifySurfaceChange();
		},
		pointer(intent, context) {
			if (!isArmed()) return false;
			if (intent.phase === 'cancel') {
				session.abort();
				return true;
			}
			const pointer = pointerFor(intent, context);
			if (intent.phase === 'down') {
				const copy = session.armed() ?? peekArmedGroupCopy(projectId);
				if (copy === null) return false;
				session.begin(copy, pointer, intent.evaluationId, snapshotStep(context));
				services.stage.notifySurfaceChange();
				return true;
			}
			if (intent.phase === 'move') {
				session.preview(pointer, snapshotStep(context));
				services.stage.notifySurfaceChange();
				return true;
			}
			// A release with no candidate is a refusal, not a write: hold its words.
			if (session.candidate() === null) {
				session.abort();
				services.stage.notifySurfaceChange();
				return true;
			}
			if (busy) return true;
			busy = true;
			void session.commit().finally(() => {
				busy = false;
				services.stage.notifySurfaceChange();
			});
			return true;
		},
		hover(intent, context) {
			if (!isArmed()) return false;
			session.preview(pointerFor(intent, context), snapshotStep(context));
			services.stage.notifySurfaceChange();
			return true;
		},
		key(intent) {
			if (intent.kind !== 'cancel' || !isArmed()) return false;
			armGroupCopy(projectId, null);
			session.cancel();
			return true;
		},
		candidatePreviews: (context) => session.previews(context),
		ghosts: () => session.ghosts(),
		overlays: (context) => session.overlays(context),
		dispose() {
			session.reset();
		},
	};
}
