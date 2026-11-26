/**
 * The viewport wiring module.
 *
 * One function, one factory call with its literal, so the host body stays a
 * construction sequence and the viewport's argument bag has one home. The
 * closures capture the host's state exactly as the inline call did.
 */
import type { StageFacade } from '../../../stage/stage-facade';
import type { StageShellState } from '../../../stage/route/stage-shell-state.svelte';
import { createStageViewport } from '../../../stage/route/stage-viewport.svelte';

export type StageViewportWiring = {
	readonly facade: () => StageFacade | null;
	readonly throughFrameElement: () => HTMLElement | null;
	readonly lookThroughActive: () => boolean;
	readonly previewing: () => boolean;
	readonly lens: () => 'world' | 'experience';
	readonly preferences: () => StageShellState['preferences'];
	readonly groundReachMeters: () => number | undefined;
	readonly nowSeconds: () => number;
	readonly advanceLookThroughZoom: (now: number) => void;
	readonly advancePlayback: (now: number) => void;
	readonly onBeforeRefresh: () => void;
	readonly onAfterRefresh: () => void;
};

export function wireStageViewport(deps: StageViewportWiring) {
	return createStageViewport({
		facade: deps.facade,
		throughFrameElement: deps.throughFrameElement,
		lookThroughActive: deps.lookThroughActive,
		previewing: deps.previewing,
		lens: deps.lens,
		roomLabels: () => ({
			plan: deps.preferences().roomLabels2d,
			threeD: deps.preferences().roomLabels3d,
		}),
		groundReachMeters: deps.groundReachMeters,
		nowSeconds: deps.nowSeconds,
		advanceLookThroughZoom: deps.advanceLookThroughZoom,
		advancePlayback: deps.advancePlayback,
		onBeforeRefresh: deps.onBeforeRefresh,
		onAfterRefresh: deps.onAfterRefresh,
	});
}
