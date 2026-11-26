export function readStageCursor(input: {
	readonly viewEditKind: () => string | null;
	readonly dragMode: () => string | null;
	readonly taskKind: () => string | null;
	readonly lookThroughActive: () => boolean;
	readonly placingView: () => boolean;
	readonly hoverMove: () => boolean;
	readonly toolArmed: () => boolean;
}): 'turn' | 'grabbing' | 'look' | 'place-view' | 'move' | 'draw' | 'select' {
	const edit = input.viewEditKind();
	if (edit !== null) return edit === 'turn' ? 'turn' : 'grabbing';
	const drag = input.dragMode();
	if (drag === 'pan' || drag === 'orbit' || (drag === 'adapter' && input.taskKind() === null))
		return 'grabbing';
	if (input.lookThroughActive()) return 'look';
	if (input.placingView()) return 'place-view';
	if (input.hoverMove()) return 'move';
	if (input.taskKind() === 'layout-ink' || input.toolArmed()) return 'draw';
	return 'select';
}

export function createStageCursor(input: {
	readonly experience: Pick<Parameters<typeof readStageCursor>[0], 'viewEditKind' | 'placingView'>;
	readonly stageInput: Pick<import('./stage-input.svelte').StageInputArbiter, 'drag' | 'hoverMove'>;
	readonly shell: Pick<
		import('./stage-shell-state.svelte').StageShellState,
		'task' | 'armedHostTool'
	>;
	readonly lookThroughActive: () => boolean;
}) {
	return () =>
		readStageCursor({
			...input.experience,
			dragMode: () => input.stageInput.drag?.mode ?? null,
			taskKind: () => input.shell.task?.kind ?? null,
			lookThroughActive: input.lookThroughActive,
			hoverMove: () => input.stageInput.hoverMove,
			toolArmed: () => input.shell.armedHostTool !== null,
		});
}
