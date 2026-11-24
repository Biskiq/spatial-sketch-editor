import type { BootState } from '../boot-state';
import type { createProjectSession } from '../../project-session/project-session.svelte';

export function createBootRepair(deps: {
	readonly boot: () => BootState;
	readonly projectId: () => string;
	readonly repair: ReturnType<typeof createProjectSession>['repairBootImage'];
}) {
	let bootRepairBusy = $state(false);
	let bootRepairError = $state<string | null>(null);


	$effect(() => {
		deps.projectId();
		bootRepairError = null;
	});

	async function onBootRepairFileChosen(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		const boot = deps.boot();
		if (file === undefined || boot.status !== 'error' || boot.image === undefined) return;
		bootRepairBusy = true;
		bootRepairError = null;
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			const outcome = await deps.repair(boot.image, bytes);
			if (!outcome.ok) bootRepairError = outcome.message;
		} catch {
			bootRepairError = 'Could not read that file.';
		} finally {
			bootRepairBusy = false;
		}
	}

	return {
		get busy() { return bootRepairBusy; },
		get error() { return bootRepairError; },
		onFileChosen: onBootRepairFileChosen
	};
}
