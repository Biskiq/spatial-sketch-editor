import {
	stageArmedDockId,
	stageContributedInstrument,
	stageDockView,
	stageFindView,
	stageInactiveTask,
	stageTaskHost,
	type StudioFindState,
} from './stage-contribution-view';
import type { StageFacade } from '../stage-facade';
import type { StageLens } from '../stage-session';
import type { StageSelectionView } from './stage-selection-view';
import type { StageShellState } from './stage-shell-state.svelte';

export function createStageContributionViews(input: {
	readonly facade: () => StageFacade | null;
	readonly selection: () => StageSelectionView;
	readonly lens: () => StageLens;
	readonly shell: StageShellState;
	readonly studio: () => StudioFindState | null;
}) {
	const { shell } = input;
	const dock = $derived(
		stageDockView({ facade: input.facade(), revision: shell.contributionsVersion }),
	);
	const inactiveTask = $derived(
		stageInactiveTask({
			facade: input.facade(),
			lens: input.lens(),
			revision: shell.contributionsVersion,
		}),
	);
	const instrument = $derived(
		stageContributedInstrument({
			facade: input.facade(),
			contributedTaskId: shell.contributedTaskId,
			revision: shell.contributionsVersion,
		}),
	);
	const task = $derived(stageTaskHost({ task: shell.task, armedHostTool: shell.armedHostTool }));
	const armedDockId = $derived(
		stageArmedDockId({
			task: shell.task,
			armedHostTool: shell.armedHostTool,
			armedTool: shell.armedTool,
			dockKeys: dock.keys,
		}),
	);
	const find = $derived(
		stageFindView({
			facade: input.facade(),
			revision: shell.contributionsVersion,
			lens: input.lens(),
			query: shell.findQuery,
			worldIndex: input.selection().worldIndex,
			dockKeys: dock.keys,
			studio: input.studio(),
		}),
	);
	return {
		dockKeys: () => dock.keys,
		inactiveTask: () => inactiveTask,
		instrument: () => instrument,
		task: () => task,
		armedDockKey: () => dock.keys.find((key) => key.id === armedDockId),
		findEntries: () => find.entries,
	};
}
