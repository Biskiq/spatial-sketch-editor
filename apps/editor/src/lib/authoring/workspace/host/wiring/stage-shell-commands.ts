/**
 * The shell-commands wiring module.
 *
 * The host's capabilities are flattened here: the module composes the
 * Experience mirror, the Camera view calls and the project actions into the
 * command owner's argument literal.
 */
import { createStageShellCommands } from '../../../stage/route/stage-shell-commands';

type CommandInput = Parameters<typeof createStageShellCommands>[0];

export type StageShellCommandsWiring = Omit<CommandInput, 'experience' | 'view' | 'project'> & {
	readonly lens: CommandInput['experience']['lens'];
	readonly active: CommandInput['experience']['active'];
	readonly zoomIn: CommandInput['view']['zoomIn'];
	readonly zoomOut: CommandInput['view']['zoomOut'];
	readonly fit: CommandInput['view']['fit'];
	readonly requestScaleDetent: CommandInput['view']['requestScaleDetent'];
	readonly requestReplacement: CommandInput['project']['requestReplacement'];
	readonly downloadSourceJson: CommandInput['project']['downloadSourceJson'];
};

export function wireStageShellCommands(input: StageShellCommandsWiring) {
	return createStageShellCommands({
		facade: input.facade,
		planView: input.planView,
		session: input.session,
		shell: input.shell,
		selection: input.selection,
		setSelection: input.setSelection,
		clearExperienceFocus: input.clearExperienceFocus,
		experience: {
			lens: input.lens,
			active: input.active,
		},
		cardActions: input.cardActions,
		dockKeys: input.dockKeys,
		notice: input.notice,
		refreshHostTools: input.refreshHostTools,
		cancelArtwork: input.cancelArtwork,
		view: {
			zoomIn: input.zoomIn,
			zoomOut: input.zoomOut,
			fit: input.fit,
			requestScaleDetent: input.requestScaleDetent,
		},
		project: {
			requestReplacement: input.requestReplacement,
			downloadSourceJson: input.downloadSourceJson,
		},
		showExperienceWelcome: input.showExperienceWelcome,
		levelSlice: input.levelSlice,
		lightArmed: input.lightArmed,
		isStudioTool: input.isStudioTool,
		studioActive: input.studioActive,
		libraryReplaceQualified: input.libraryReplaceQualified,
		runStudioEntry: input.runStudioEntry,
	});
}
