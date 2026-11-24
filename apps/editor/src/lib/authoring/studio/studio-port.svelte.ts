import { untrack } from 'svelte';
import type { StudioLens } from './studio-view';
import type { StageObjectStudio } from '../stage/stage-adapter-host';
import type { StudioController } from './studio-controller.svelte';

/**
 * Studio's typed port to the rest of the host, and the two session values that
 * describe a requested-but-not-yet-possible creation.
 *
 * `revision` is Studio's own presentation tick: it changes when the scoped body
 * changes, so Find and the World surfaces re-read the controller.
 */
export function createStudioPort(input: {
	readonly controller: () => StudioController | undefined;
	readonly lens: () => StudioLens;
	readonly previewing: () => boolean;
	readonly armObjects: () => void;
	readonly dockReady: () => boolean;
}) {
	let revision = $state(0);
	let armPending = $state(false);

	const objectStudioPort: StageObjectStudio = {
		available: () => {
			const studio = input.controller();
			return studio !== undefined && !studio.active && input.lens() === 'world' && !input.previewing();
		},
		edit: (entityId) => {
			const studio = input.controller();
			return studio !== undefined && studio.enterFromWorld(entityId, 'edit-in-studio')
				? { kind: 'entered' }
				: { kind: 'refused', message: 'That object cannot be edited in Object Studio.' };
		}
	};

	function bumpRevision(): void {
		revision += 1;
	}

	/** The controller's arm request: wait for the dock's Objects key, then arm it. */
	function armCreation(): void {
		if (input.dockReady()) input.armObjects();
		else armPending = true;
	}

	/** Appendix A row 22: the pending arm retries as the dock and Studio settle. */
	function attachArm(): void {
		$effect(() => {
			if (!armPending) return;
			const studio = input.controller();
			if (!studio?.active) {
				armPending = false;
				return;
			}
			if (!input.dockReady()) return;
			armPending = false;
			untrack(() => input.armObjects());
		});
	}

	return {
		objectStudioPort,
		bumpRevision,
		armCreation,
		attachArm,
		get revision() { return revision; },
		get armPending() { return armPending; }
	};
}
