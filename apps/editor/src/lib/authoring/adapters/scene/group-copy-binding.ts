/**
 * The Scene adapter's group-copy binding.
 *
 * Wraps the shared group-copy placement session for the lifetime of one adapter
 * binding: the armed copy (kept in the project-keyed arm store, so a reading
 * change rebinds without losing the tool), pointer and hover routing, the ghost,
 * the mount label and Escape. It owns no planning mathematics and draws nothing;
 * the session and the existing presenters do.
 *
 * The store is the single authority. Every routing question reconciles it with
 * the live session first, so arming a different template, clearing the arm from
 * another surface or the binding being rebuilt can never leave an older ghost,
 * lease or candidate behind. A newly armed copy previews at the last known
 * pointer before its first press, and every candidate carries the accepted
 * revision it was prepared against.
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
import {
	draftingSnapIncrementMeters,
	stageEnvelope,
	stageLayout,
	stageScene,
} from '$lib/authoring/stage/stage-adapter-host';
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
	type GroupCopyPointer,
} from './group-copy-placement-session';
import { liveProjectId } from './object-readings';
import type { SceneWriteOutcome } from './placement';
import { scenePlacementDefinitions } from './scene-placement-definitions';

export type GroupCopyBinding = {
	/** Whether a group copy is armed on this project. */
	armed(): boolean;
	/** Arm one copy, or clear the arm with `null`; no task, no write. */
	arm(copy: ArmedGroupCopy | null): void;
	pointer(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	hover(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	/** An idle, unpressed move with no task open: preview only, never a press. */
	idleHover(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	key(intent: StageKeyboardIntent): boolean;
	candidatePreviews(adapterContext: StageAdapterContext): readonly StageCandidatePreview[];
	ghosts(adapterContext: StageAdapterContext): readonly StageGhostMesh[];
	overlays(adapterContext: StageAdapterContext): readonly StageOverlayContribution[];
	/** A rebind or unmount releases the lease; the project's arm survives. */
	dispose(): void;
};

/** The pointer state one binding remembers between routing questions. */
type PointerMemory = {
	/** The last pointer the Stage offered, kept for the arm-time preview. */
	lastCss: readonly [number, number] | null;
	/** A newly armed copy has not yet derived its first ghost. */
	needsPreview: boolean;
	/** A press this binding owns began on the Stage. */
	pressed: boolean;
};

function pointerAt(
	context: StageAdapterContext,
	css: readonly [number, number],
): GroupCopyPointer | null {
	return groupCopyPointerAt(context, css, draftingSnapIncrementMeters(context.drafting()));
}

/**
 * Make the live session match the project's store, dropping any stale copy.
 *
 * `arm` always starts from a disarm, so the previous template's candidate,
 * captured ids and lease never survive a switch. Clearing the arm releases the
 * lease and withdraws the ghost; the caller owns the render that follows.
 */
function synchronizeArm(
	projectId: string,
	session: GroupCopyPlacementSession,
	memory: PointerMemory,
	setQuiet: (quiet: boolean) => void,
): void {
	const stored = peekArmedGroupCopy(projectId);
	if (stored === session.armed()) return;
	memory.pressed = false;
	if (stored === null) {
		memory.needsPreview = false;
		setQuiet(true);
		try {
			session.cancel();
		} finally {
			setQuiet(false);
		}
		return;
	}
	session.arm(stored);
	memory.needsPreview = true;
}

/** Derive the armed copy's first ghost at the pointer the Stage last saw. */
function previewArmedAt(
	context: StageAdapterContext,
	session: GroupCopyPlacementSession,
	memory: PointerMemory,
): void {
	if (!memory.needsPreview || memory.lastCss === null) return;
	memory.needsPreview = false;
	session.preview(
		pointerAt(context, memory.lastCss),
		draftingSnapIncrementMeters(context.drafting()),
	);
}

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
	const memory: PointerMemory = { lastCss: null, needsPreview: false, pressed: false };
	let busy = false;
	/** Store reconciliation clears quietly; the caller owns that render. */
	let quiet = false;

	const notify = (): void => {
		if (!quiet) services.stage.notifySurfaceChange();
	};

	const session: GroupCopyPlacementSession = createGroupCopyPlacementSession({
		read: () => {
			const snapshot = services.stage.snapshot();
			return {
				projectId: snapshot.acceptedRevision.projectId,
				sourceContentId: snapshot.sourceContentId,
				layout: stageLayout(snapshot),
				scene: stageScene(snapshot),
				envelope: stageEnvelope(snapshot),
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
		notify,
		...(outline === undefined ? {} : { outline }),
	});

	const synchronize = (): void =>
		synchronizeArm(projectId, session, memory, (value) => {
			quiet = value;
		});
	const isArmed = (): boolean => {
		synchronize();
		return peekArmedGroupCopy(projectId) !== null;
	};

	// A rebind is a reading change, not a disarm: the project's arm resumes.
	const pending = peekArmedGroupCopy(projectId);
	if (pending !== null) session.arm(pending);

	return {
		armed: isArmed,
		arm(copy) {
			armGroupCopy(projectId, copy);
			memory.pressed = false;
			memory.needsPreview = copy !== null;
			if (copy === null) {
				quiet = true;
				try {
					session.cancel();
				} finally {
					quiet = false;
				}
			} else {
				session.arm(copy);
			}
			services.stage.notifySurfaceChange();
		},
		pointer(intent, context) {
			if (!isArmed()) return false;
			if (intent.phase === 'cancel') {
				memory.pressed = false;
				session.abort();
				notify();
				return true;
			}
			memory.lastCss = intent.css;
			memory.needsPreview = false;
			const pointer = pointerAt(context, intent.css);
			if (intent.phase === 'down') {
				const copy = peekArmedGroupCopy(projectId);
				if (copy === null) return false;
				memory.pressed = true;
				session.begin(
					copy,
					pointer,
					intent.evaluationId,
					draftingSnapIncrementMeters(context.drafting()),
				);
				notify();
				return true;
			}
			if (intent.phase === 'move') {
				session.preview(pointer, draftingSnapIncrementMeters(context.drafting()));
				notify();
				return true;
			}
			// A release without a press (a template switch cancelled it) writes
			// nothing; the armed copy simply previews again on the next move.
			if (!memory.pressed) return true;
			memory.pressed = false;
			// A release with no candidate is a refusal, not a write: hold its words.
			if (session.candidate() === null) {
				session.abort();
				notify();
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
			if (intent.phase === 'cancel') {
				session.abort();
				notify();
				return true;
			}
			memory.lastCss = intent.css;
			memory.needsPreview = false;
			session.preview(
				pointerAt(context, intent.css),
				draftingSnapIncrementMeters(context.drafting()),
			);
			notify();
			return true;
		},
		idleHover(intent, context) {
			// Remember the pointer even before the tool is armed: arming from a
			// panel must show the ghost where the creator already points.
			if (intent.phase !== 'move') return false;
			memory.lastCss = intent.css;
			if (!isArmed()) return false;
			memory.needsPreview = false;
			session.preview(
				pointerAt(context, intent.css),
				draftingSnapIncrementMeters(context.drafting()),
			);
			notify();
			return true;
		},
		key(intent) {
			if (intent.kind !== 'cancel' || !isArmed()) return false;
			memory.pressed = false;
			armGroupCopy(projectId, null);
			session.cancel();
			return true;
		},
		candidatePreviews(context) {
			synchronize();
			previewArmedAt(context, session, memory);
			return session.previews(context);
		},
		ghosts(context) {
			synchronize();
			previewArmedAt(context, session, memory);
			return session.ghosts();
		},
		overlays(context) {
			synchronize();
			previewArmedAt(context, session, memory);
			return session.overlays(context);
		},
		dispose() {
			memory.pressed = false;
			session.reset();
		},
	};
}
