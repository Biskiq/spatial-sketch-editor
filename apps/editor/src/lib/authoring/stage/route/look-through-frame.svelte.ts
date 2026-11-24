import { untrack } from 'svelte';

/** Remeasure once the inspection's bound capture frame lands. */
export function installLookThroughFrame(input: {
	readonly frame: () => HTMLElement | undefined;
	readonly viewSession: () => object | null;
	readonly lightSession: () => object | null;
	readonly refresh: () => void;
}): void {
	$effect(() => {
		const frame = input.frame();
		const view = input.viewSession();
		const light = input.lightSession();
		if (frame !== undefined && (view !== null || light !== null)) untrack(input.refresh);
	});
}
