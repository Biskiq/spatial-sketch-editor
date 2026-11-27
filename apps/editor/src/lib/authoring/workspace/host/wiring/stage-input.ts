/**
 * The input-arbiter wiring module.
 *
 * The host supplies the live reads the arbiter arms against; the module keeps
 * the arbiter's argument literal, including the Slice-tool refusal, out of the
 * host body.
 */
import { createStageInputArbiter } from '../../../stage/route/stage-input.svelte';
import type { StageShellState } from '../../../stage/route/stage-shell-state.svelte';

type InputArbiterInput = Parameters<typeof createStageInputArbiter>[0];

export type StageInputWiring = Omit<
	InputArbiterInput,
	| 'armedHostTool'
	| 'measureTool'
	| 'eraserTool'
	| 'paintTool'
	| 'task'
	| 'dockToolArmed'
	| 'adapterTapOnly'
	| 'eraseHover'
	| 'setEraseHover'
	| 'setPaintHover'
	| 'sliceToolArmed'
	| 'onNotice'
	| 'onRefreshHostTools'
> & { readonly shell: StageShellState };

export function wireStageInput(input: StageInputWiring) {
	return createStageInputArbiter({
		facade: input.facade,
		scene: input.scene,
		evaluation: input.evaluation,
		rect: input.rect,
		measure: input.measure,
		stageElement: input.stageElement,
		session: input.session,
		activeLayer: input.activeLayer,
		artwork: input.artwork,
		unfold: input.unfold,
		stageCss: input.stageCss,
		capturePointer: input.capturePointer,
		press: input.press,
		armedHostTool: () => input.shell.armedHostTool,
		measureTool: () => input.shell.measureTool,
		eraserTool: () => input.shell.eraserTool,
		paintTool: () => input.shell.paintTool,
		task: () => input.shell.task,
		dockToolArmed: () => input.shell.armedTool !== null,
		adapterTapOnly: () => input.shell.activeWorldTool === 'room',
		planView: input.planView,
		previewing: input.previewing,
		pick: input.pick,
		viewMarkAt: input.viewMarkAt,
		eraseHover: () => input.shell.eraseHover,
		setEraseHover: (entry) => input.shell.setEraseHover(entry),
		setPaintHover: (entry) => input.shell.setPaintHover(entry),
		// The refusal belongs to the armed Slice **tool**, not to a live cut: back on
		// Select, the creator selects and drags everything below the cut.
		sliceToolArmed: () =>
			input.shell.activeWorldTool === 'slice' && !(input.sliceDraw()?.armed ?? false),
		sliceDraw: input.sliceDraw,
		onNotice: (message) => input.shell.setNotice(message),
		onRefreshHostTools: () => input.shell.refreshHostTools(),
		selectHit: input.selectHit,
		pan: input.pan,
		orbit: input.orbit,
		zoom: input.zoom,
		submit: input.submit,
		nowSeconds: input.nowSeconds,
	});
}
