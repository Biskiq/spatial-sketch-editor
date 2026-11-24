import type { FeatureLifecycle } from '../../workspace/protocol';
import type { StageProjectEpoch } from './stage-project-epoch.svelte';

export function createStageHistoryCommand(input: {
	readonly epoch: Pick<StageProjectEpoch, 'undo' | 'redo'>;
	readonly lifecycle: () => Pick<FeatureLifecycle, 'historyStep'>;
}) {
	return {
		undo: () => input.lifecycle().historyStep('undo'),
		redo: () => input.lifecycle().historyStep('redo'),
		run(direction: 'undo' | 'redo'): void {
			if (direction === 'undo') void input.epoch.undo();
			else void input.epoch.redo();
		}
	};
}
