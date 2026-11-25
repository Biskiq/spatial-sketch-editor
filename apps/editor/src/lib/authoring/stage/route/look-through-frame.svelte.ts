import type { RegionProps } from '../../workspace/region-ownership';
import type { StageExperienceBinding } from './stage-experience-binding.svelte';
import { untrack } from 'svelte';

/** Remeasure once the inspection's bound capture frame lands. */
function installLookThroughFrame(input: {
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


type LightFrame = RegionProps['viewport']['lookThrough'];

export function createLookThroughFrame(input: {
	readonly view: StageExperienceBinding;
	readonly light: () => LightFrame;
	readonly lightActive: () => boolean;
	readonly lightSession: () => object | null;
	readonly refresh: () => void;
}) {
	let element = $state<HTMLElement>();
	const { view } = input;
	const props = $derived.by(() => {
		const lightFrame = input.light();
		if (lightFrame !== null) return lightFrame;
		const current = view.lookThroughSession();
		if (current === null) return null;
		return {
			mode: 'view' as const,
			label: current.label,
			moved: view.lookThroughMoved(),
			confirm: view.lookThroughConfirm(),
			canUpdate: !(view.active?.busy ?? false),
			onUpdate: (): void => void view.updateLookThrough(view.lookThroughConfirm() !== null),
			onExit: view.exitLookThrough,
			onCapture: (): void => void view.captureProvisional(),
			onClearConfirm: view.clearLookThroughConfirm
		};
	});
	installLookThroughFrame({
		frame: () => element,
		viewSession: view.lookThroughSession,
		lightSession: input.lightSession,
		refresh: input.refresh
	});

	return {
		active: () => view.lookThroughActive() || input.lightActive(),
		get props() { return props; },
		get element() { return element; },
		set element(value: HTMLElement | undefined) { element = value; }
	};
}
