/**
 * The shell-state wiring module.
 *
 * Paint's one Finish intent stays here with the shell's state: the host supplies
 * the selection command and the Finish service, and the module keeps the
 * construction literal and the painted-one hand-off out of the host body.
 */
import { createStageShellState } from '../../../stage/route/stage-shell-state.svelte';

type ShellInput = Parameters<typeof createStageShellState>[0];

export type StageShellStateWiring = Omit<ShellInput, 'onPaintedOne'> & {
	readonly selectSource: (id: string) => void;
};

export function wireStageShellState(input: StageShellStateWiring) {
	return createStageShellState({
		session: input.session,
		facade: input.facade,
		evaluation: input.evaluation,
		rect: input.rect,
		measure: input.measure,
		previewing: input.previewing,
		lens: input.lens,
		selection: input.selection,
		finishes: input.finishes,
		onPaintedOne: (target) => {
			// A Paint click selects what it painted and opens that Finish; Paint stays
			// armed. The stroke's hit names the pre-write revision, so the subject is
			// selected by id against the source the write just installed.
			input.selectSource(target.entityId ?? target.hit.sourceId);
			const surface = target.assignmentSurfaces[0] ?? target.surface;
			if (target.entityId !== null)
				input.finishes()?.card.requestOpen({ kind: 'entity', entityId: target.entityId });
			else if (surface !== null) input.finishes()?.card.requestOpen({ kind: 'surface', surface });
		},
	});
}
