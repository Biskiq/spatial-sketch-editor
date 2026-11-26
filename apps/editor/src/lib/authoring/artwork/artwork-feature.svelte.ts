import { createStageArtworkInteraction } from '../stage/route/stage-artwork-interaction.svelte';
import { createArtworkHost, type ArtworkDependencies } from './artwork-host.svelte';

export function createArtworkFeature(deps: ArtworkDependencies) {
	const host = createArtworkHost(deps);
	const interaction = createStageArtworkInteraction({
		...deps.interaction,
		canEdit: host.canPlace,
		pickVisibleFace: host.pickVisibleFace,
	});
	const view = host.connect(interaction);
	return {
		id: 'artwork' as const,
		ports: {
			input: interaction,
			canPlace: host.canPlace,
			cancel: view.cancel,
			escape: interaction.escape,
			card: interaction.card,
			leave: interaction.leave,
			arm: interaction.arm,
			importFiles: interaction.importFiles,
			dragOver: view.dragOver,
			drop: interaction.drop,
		},
		regions: { canvas: view.canvas, overlay: view.overlay, viewport: view.viewport },
		lifecycle: {
			resetPresentation: { cancel: view.cancelAll },
			settlePending: { cancel: view.cancel },
			leaveProject: { dispose: interaction.dispose },
		},
	};
}
