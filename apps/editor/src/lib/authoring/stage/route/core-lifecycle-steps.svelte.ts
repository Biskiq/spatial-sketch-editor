import { onMount } from 'svelte';
import { perfMark } from '$lib/platform/perf-marks';
import type { createProjectSession } from '../../project-session/project-session.svelte';
import type { FeatureLifecycle, LifecycleRegistration } from '../../workspace/protocol';
import type { BootIntent } from '../boot-state';
import { primaryEntry, type StageSelectionEntry } from '../semantic-selection';
import type { StageFacade } from '../stage-facade';
import { installStageInterruptions } from '../stage-interruption';
import type { StageSession } from '../stage-session';
import type { StageAssetLeases } from './stage-asset-leases.svelte';
import type { StageInputArbiter } from './stage-input.svelte';
import type { StageProjectEpoch } from './stage-project-epoch.svelte';
import type { StageShellCommands } from './stage-shell-commands';
import type { StageShellState } from './stage-shell-state.svelte';
import type { createStageHistoryCommand } from './stage-history-command';
import type { createStageViewing } from './stage-viewing';
import type { createStageViewport } from './stage-viewport.svelte';
import type { createStageWindowListeners } from './stage-window-listeners';

export function createCoreLifecycleSteps(input: {
	readonly projectId: string;
	readonly intent: BootIntent;
	readonly projectSession: Pick<ReturnType<typeof createProjectSession>, 'load'>;
	readonly stageEpoch: Pick<StageProjectEpoch, 'markTornDown' | 'dispose'>;
	readonly session: Pick<StageSession, 'gesture'>;
	readonly facade: () => StageFacade | null;
	readonly setSelection: (entry: StageSelectionEntry | null) => void;
	readonly clearRevealed: () => void;
	readonly assets: Pick<StageAssetLeases, 'disposeArtwork'>;
	readonly shell: StageShellState;
	readonly commands: Pick<
		StageShellCommands,
		'syncPrimarySelection' | 'syncContributedTask' | 'armWorldTool'
	>;
	readonly stageInput: Pick<StageInputArbiter, 'clearHover' | 'interrupt' | 'reset'>;
	readonly viewport: Pick<
		ReturnType<typeof createStageViewport>,
		'invalidatePlan' | 'refresh' | 'reset' | 'start' | 'dispose'
	>;
	readonly history: Pick<ReturnType<typeof createStageHistoryCommand>, 'run'>;
	readonly viewing: Pick<
		ReturnType<typeof createStageViewing>,
		'submitReading' | 'endPressForReading'
	>;
	readonly listeners: ReturnType<typeof createStageWindowListeners>;
}): LifecycleRegistration<'core'> {
	const { shell, commands, viewport, stageInput } = input;
	let removeInterruptions: () => void;

	function syncAcceptedTaskAndSelection(): void {
		shell.setTask(input.facade()?.session.task() ?? null);
		const facade = input.facade();
		commands.syncPrimarySelection(facade ? primaryEntry(facade.selectionState()) : null);
		commands.syncContributedTask();
	}

	return {
		interruptForReplacement: {
			'clear-hover': stageInput.clearHover,
			'interrupt-press': () => stageInput.interrupt('replacement'),
		},
		resetPresentationBeforeSwap: {
			'collapse-expanded-presentation': () => shell.setExpandedPresentationId(null),
		},
		resetPresentation: {
			'reset-selection-and-shell': () => {
				input.setSelection(null);
				shell.setTask(null);
				input.clearRevealed();
				shell.setNotice('');
				shell.setPendingDelete(null);
				shell.setArmedTool(null);
				shell.setCardOpen(true);
			},
			'reset-input': stageInput.reset,
			'reset-viewport': viewport.reset,
		},
		facadeMounted: { 'bind-facade': shell.bindFacade },
		adaptersChanged: {
			'refresh-adapter-presentation': () => {
				shell.bumpContributions();
				syncAcceptedTaskAndSelection();
			},
		},
		accepted: {
			'sync-task-and-selection': syncAcceptedTaskAndSelection,
			'invalidate-plan': viewport.invalidatePlan,
			refresh: viewport.refresh,
		},
		historyInstalled: {
			'install-selection': (outcome) => {
				const facade = input.facade();
				input.setSelection(facade ? primaryEntry(facade.selectionState()) : null);
				if (outcome.selectionClearedReason !== null) {
					shell.setNotice('The selected subject no longer exists in the restored source.');
				}
			},
			'invalidate-plan': viewport.invalidatePlan,
		},
		historyStep: { 'run-history': input.history.run },
		readingChange: {
			'submit-reading': input.viewing.submitReading,
			'end-press-for-reading': input.viewing.endPressForReading,
		},
		settlePending: {
			'refuse-during-gesture': () => {
				if (input.session.gesture() === null) return;
				shell.setNotice('Finish or cancel the current gesture first.');
				return false;
			},
			'arm-select': () => commands.armWorldTool('select'),
		},
		windowBlur: { 'release-snap': () => shell.suspendSnap(false) },
		leaveProject: { 'dispose-artwork-assets': input.assets.disposeArtwork },
		start: {
			'perf-mark': () => perfMark('stage:route-mounted'),
			'start-shell': shell.start,
			'start-viewport': viewport.start,
			'install-listeners': input.listeners.install,
			'install-interruptions': () => {
				removeInterruptions = installStageInterruptions(window, document, stageInput.interrupt);
			},
			'load-project': () => {
				void input.projectSession.load(input.projectId, input.intent);
			},
		},
		dispose: {
			'mark-torn-down': input.stageEpoch.markTornDown,
			'dispose-viewport': viewport.dispose,
			'dispose-shell': shell.dispose,
			'clear-hover': stageInput.clearHover,
			'remove-listeners': input.listeners.remove,
			'remove-interruptions': () => removeInterruptions(),
			'dispose-epoch': input.stageEpoch.dispose,
		},
	};
}

export function installLeaveProject(cell: { get(): Pick<FeatureLifecycle, 'leaveProject'> }): void {
	$effect(() => () => cell.get().leaveProject());
}

export function installStageMount(cell: {
	get(): Pick<FeatureLifecycle, 'start' | 'dispose'>;
}): void {
	onMount(() => {
		const lifecycle = cell.get();
		lifecycle.start();
		return lifecycle.dispose;
	});
}
