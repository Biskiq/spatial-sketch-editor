import { createCutawayHost } from './cutaway-host.svelte';
import { createLayoutReadingsLifecycle } from './layout-readings-lifecycle';
import { createLiftHost } from './lift-host.svelte';
import { createReadingPlanParameters } from './plan-parameters.svelte';
import { createSliceHost } from './slice-host.svelte';
import { createUnfoldHost } from './unfold-host.svelte';
import { createWallFaceHost } from './wall-face-host.svelte';

export type LayoutReadingsDependencies = {
	readonly unfold: Parameters<typeof createUnfoldHost>[0];
	readonly slice: Parameters<typeof createSliceHost>[0];
	readonly lift: Parameters<typeof createLiftHost>[0];
	readonly cutaway: Parameters<typeof createCutawayHost>[0];
	readonly wallFace: Parameters<typeof createWallFaceHost>[0];
};

export function createLayoutReadingsFeature(deps: LayoutReadingsDependencies) {
	const unfold = createUnfoldHost(deps.unfold);
	const slice = createSliceHost(deps.slice);
	const lift = createLiftHost(deps.lift);
	const cutaway = createCutawayHost(deps.cutaway);
	const wallFace = createWallFaceHost(deps.wallFace);
	const plan = createReadingPlanParameters({ facade: deps.cutaway.facade, resolvedSlice: slice.resolved });
	const lifetime = createLayoutReadingsLifecycle({
		clearFace: wallFace.clear,
		clearLift: lift.clear,
		clearSlice: slice.clear,
		resetCutaway: cutaway.reset,
		clearCutawayFailures: cutaway.clearFailures
	});
	return {
		id: 'layout-readings' as const,
		attachReadings: () => {
			unfold.attachAnchor();
			cutaway.attachPreviewHold();
			slice.attachMirror();
			cutaway.attachClassification();
			plan.attach();
			lift.attachScope();
		},
		attachTeardown: slice.attachTeardown,
		attachCameraPorts: () => {
			wallFace.attachCameraPort();
			unfold.attachCameraPort();
		},
		get liftControl() { return lift.control; },
		get nearWallsControl() { return cutaway.control; },
		get sliceMode() { return slice.mode; },
		get alignHiddenWallIds() { return cutaway.alignHiddenWallIds; },
		ports: {
			resolvedSlice: slice.resolved,
			levelSlice: slice.level,
			drawSlice: slice.draw,
			sliceDraw: slice.controller,
			unfold: unfold.gestures,
			unfoldActive: unfold.active,
			setCutawayHeld: cutaway.setHeld
		},
		escape: {
			liftActive: lift.active,
			putBackLift: lift.putBack,
			sliceActive: slice.active,
			putBackSlice: slice.putBack,
			sliceDraftActive: slice.controller.hasDraft,
			cancelSliceDraft: slice.controller.cancelDraft
		},
		regions: {
			liftCanvas: lift.canvas,
			sliceCanvas: slice.canvas,
			unfoldCanvas: unfold.canvas,
			cutawayCanvas: cutaway.canvas,
			liftViewport: lift.viewport,
			sliceViewport: slice.viewport,
			overlay: slice.overlay
		},
		lifecycle: {
			resetPresentation: { reset: lifetime.reset },
			leaveProject: { 'clear-readings': lifetime.clearReadings },
			windowBlur: { 'release-hold': cutaway.releaseHold },
			dispose: {
				'dispose-unfold': unfold.dispose,
				'release-hold': cutaway.releaseHold,
				'clear-cutaway-mirror': cutaway.clearMirror
			}
		}
	};
}
