import { goto, replaceState } from '$app/navigation';
import { eyeOfInspectionPose, fovYDegreesOf, type ViewportRect } from '@portfolio/camera-core/viewport';
import {
	PLACE_COPY_PARAM,
	STUDIO_ENTRY_PARAM,
	STUDIO_ENTRY_VALUE,
	STUDIO_OBJECT_PARAM
} from '$lib/platform/studio-entry';
import { beginFormCopyTransfer } from '../adapters/scene/library/transfer';
import { sceneEntityReference } from '../adapters/scene/placement';
import type { createProjectSession } from '../project-session/project-session.svelte';
import { readStageContentBounds } from '../stage/route/stage-content-bounds.svelte';
import type { StageShellCommands } from '../stage/route/stage-shell-commands';
import type { StageShellState } from '../stage/route/stage-shell-state.svelte';
import type { createStageViewing } from '../stage/route/stage-viewing';
import type { StageSelectionEntry } from '../stage/semantic-selection';
import type { StageFacade } from '../stage/stage-facade';
import { readingIntentClockSeconds } from '../stage/stage-input';
import type { createSubjectScope } from '../stage/subject-scope';
import { runPlaceCopy } from './place-copy-journey';
import type { StudioPorts } from './studio-controller.svelte';
import { isStudioOperation, studioAdmitsCardAction } from './studio-model';

/** Object Studio's implementation of the Stage-facing controller ports. */
export function createStudioStagePorts(input: {
	readonly projectId: string;
	readonly facade: () => StageFacade | null;
	readonly commands: () => Pick<StageShellCommands, 'closeSelection' | 'selectStageReference' | 'closeTask' | 'armWorldTool'>;
	readonly shell: () => Pick<StageShellState,
		'activeWorldTool' | 'libraryOpen' | 'indexOpen' | 'setLibraryOpen' | 'setWorldPlateOpen' |
		'setIndexOpen' | 'setNotice' | 'reducedMotion' | 'bumpContributions' | 'nowSeconds'>;
	readonly subjectScope: ReturnType<typeof createSubjectScope>;
	readonly viewing: () => Pick<ReturnType<typeof createStageViewing>, 'submit'>;
	readonly projectSession: () => Pick<ReturnType<typeof createProjectSession>, 'headSave' | 'saveBeforeSwitch'>;
	readonly selection: () => StageSelectionEntry | null;
	readonly entities: StudioPorts['entities'];
	readonly rect: () => ViewportRect | null;
	readonly stageElement: () => HTMLElement | undefined;
	readonly clearHover: () => void;
	readonly studioActive: () => boolean;
	readonly studioCreating: () => boolean;
	readonly settlePending: () => boolean;
	readonly bumpRevision: () => void;
	readonly armCreation: () => void;
}): StudioPorts {
	function selectedEntityId(): string | null {
		const selection = input.selection();
		return selection?.reference.domain === 'scene' ? selection.reference.subject.id : null;
	}

	function contentBounds() {
		const facade = input.facade();
		return facade === null ? null : readStageContentBounds(facade);
	}

	return {
		entities: input.entities,
		selectedEntityId,
		select: (entityId) => {
			const stage = input.facade();
			if (stage === null) return false;
			if (entityId === null) {
				input.commands().closeSelection();
				return true;
			}
			input.commands().selectStageReference(
				sceneEntityReference(entityId, stage.snapshot().domain.unitRevisions.scene)
			);
			return true;
		},
		setScope: (scope) => {
			input.subjectScope.set(scope === null ? null : { entityId: scope.entityId, admitsOperation: isStudioOperation, admitsCardAction: (adapterId, subjectId, actionId) => studioAdmitsCardAction(scope.entityId, adapterId, subjectId, actionId) });
			input.clearHover();
			input.shell().bumpContributions();
			input.facade()?.notifySurfaceChange();
			input.bumpRevision();
		},
		captureView: () => {
			const camera = input.facade()?.camera.state();
			if (camera === undefined) return null;
			return {
				reading: camera.reading,
				eye: eyeOfInspectionPose(camera.pose),
				target: camera.pose.target,
				fovYDegrees: fovYDegreesOf(camera.pose),
				targetPlaneHeightMeters: camera.pose.targetPlaneHeightMeters
			};
		},
		restoreView: (record) => {
			const result = input.viewing().submit(
				{
					kind: 'set-view',
					eye: [record.eye[0], record.eye[1], record.eye[2]],
					target: [record.target[0], record.target[1], record.target[2]],
					fovYDegrees: record.fovYDegrees,
					transition: !input.shell().reducedMotion
				},
				input.shell().nowSeconds()
			);
			if (result?.kind !== 'accepted') return false;
			if (record.reading === 'plan') {
				input.viewing().submit({ kind: 'set-reading', reading: 'plan' }, readingIntentClockSeconds(input.shell().reducedMotion, input.shell().nowSeconds()));
			}
			return true;
		},
		rootBounds: (entityId) => input.facade()?.sceneBounds(entityId) ?? null,
		fit: (bounds) => {
			const rect = input.rect();
			if (input.facade() === null || rect === null) return false;
			return input.viewing().submit(
				{
					kind: 'fit',
					bounds: { min: [...bounds.min], max: [...bounds.max] },
					rect,
					// A lone object is framed with room around it, not edge to edge.
					paddingFraction: 0.3
				},
				input.shell().nowSeconds()
			)?.kind === 'accepted';
		},
		contentBounds: contentBounds,
		fitAll: () => {
			const bounds = contentBounds();
			const rect = input.rect();
			if (bounds === null || rect === null) return;
			input.viewing().submit({ kind: 'fit', bounds: { min: bounds.min, max: bounds.max }, rect, paddingFraction: 0.25 }, input.shell().nowSeconds());
		},
		armCreation: () => input.armCreation(),
		closeCreation: () => {
			const close = (): void => {
				// The placement task stays armed for repeat placing: Studio has its root now.
				input.commands().closeTask();
				if (input.shell().activeWorldTool === 'objects' || input.shell().libraryOpen) input.commands().armWorldTool('select');
				input.shell().setWorldPlateOpen(false);
				input.shell().setLibraryOpen(false);
			};
			close();
			// Placement settles its own tray after the accepted source: close it once more then.
			setTimeout(() => {
				if (input.studioActive() && !input.studioCreating()) close();
			}, 0);
		},
		settlePending: () => input.settlePending(),
		notice: (message) => input.shell().setNotice(message),
		syncUrl: (state) => {
			try {
				const url = new URL(window.location.href);
				if (state === null) {
					url.searchParams.delete(STUDIO_ENTRY_PARAM);
					url.searchParams.delete(STUDIO_OBJECT_PARAM);
				} else {
					url.searchParams.set(STUDIO_ENTRY_PARAM, STUDIO_ENTRY_VALUE);
					if (state.objectId === null) url.searchParams.delete(STUDIO_OBJECT_PARAM);
					else url.searchParams.set(STUDIO_OBJECT_PARAM, state.objectId);
				}
				replaceState(`${url.pathname}${url.search}`, {});
			} catch {
				// The address is a courtesy: a router that is not ready keeps the posture.
			}
		},
		navigate: (href) => void goto(href),
		placeCopy: async (rootId, current) => {
			const { saveFormCopyToMyObjects } = await import('$lib/authoring/adapters/scene/library/save');
			if (!current()) return false;
			const outcome = await runPlaceCopy(rootId, current, {
				entity: (id) => {
					const entry = input.facade()?.snapshot().domain.scene.entities.find((candidate) => candidate.id === id);
					return entry?.kind === 'form' ? entry : null;
				},
				isDirty: () => input.projectSession().headSave?.isDirty() === true,
				saveFirst: () => input.projectSession().saveBeforeSwitch(),
				saveToLibrary: (entity) => saveFormCopyToMyObjects(entity),
				beginTransfer: (itemId, name) => beginFormCopyTransfer({
					sourceProjectId: input.projectId, objectId: rootId, objectName: name, itemId,
					// Mint the exact entity the copy will occupy; it travels through the
					// intake to place-form-copy and identifies this insertion at settlement.
					entityId: `entity-${crypto.randomUUID()}`
				}),
				openChooser: (itemId) => goto(`/projects?${PLACE_COPY_PARAM}=${encodeURIComponent(itemId)}`),
				notice: (message) => input.shell().setNotice(message)
			});
			return outcome === 'navigated';
		},
		focusReturn: () => {
			setTimeout(() => {
				const card = document.querySelector<HTMLElement>('[data-editor-card], .card');
				const target = card?.querySelector<HTMLElement>('button, [tabindex]') ?? input.stageElement() ?? null;
				target?.focus({ preventScroll: true });
			}, 0);
		},
		indexOpen: () => input.shell().indexOpen,
		setIndexOpen: (open) => input.shell().setIndexOpen(open)
	};
}
