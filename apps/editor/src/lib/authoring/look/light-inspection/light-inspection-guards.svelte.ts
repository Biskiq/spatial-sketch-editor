import type { StageLightInspection } from '../../stage/stage-adapter-host';
import type { LightLookThrough } from '../../stage/route/light-look-through.svelte';
import type { StageLens } from '../../stage/stage-session';
import { contribution } from '../../workspace/region-ownership';
import { armedLightKind } from '../light-tool.svelte';
import type { LightCoverage, LightThroughFrame } from './light-inspection-view';

export function createLightInspectionGuards(input: {
	readonly inspection: LightLookThrough;
	readonly lens: () => StageLens;
	readonly previewing: () => boolean;
	readonly readCoverage: () => LightCoverage;
}) {
	const { inspection } = input;
	const card: StageLightInspection = { enter: inspection.enter };

	function cancel(): void {
		inspection.cancel();
	}

	function lightArmed(projectId: string): boolean {
		return armedLightKind(projectId) !== null;
	}

	function attachGuards(): void {
		// A lens change and Preview takeover both replace the Stage's posture.
		$effect(() => {
			if (input.lens() !== 'world') inspection.cancel();
		});
		$effect(() => {
			if (input.previewing()) inspection.cancel();
		});
	}

	const coverage = $derived.by(input.readCoverage);
	const frame = $derived.by((): LightThroughFrame | null => {
		const session = inspection.session();
		if (session === null) return null;
		return {
			mode: 'light',
			label: session.label,
			moved: inspection.moved(),
			canUpdate: !inspection.busy(),
			beam: inspection.beam(),
			onUpdate: () => void inspection.finish(),
			onExit: () => inspection.exit()
		};
	});
	const viewport = contribution<'light-inspection', 'viewport'>()({
		get lightCoverage() { return coverage; }
	});

	attachGuards();
	return {
		card, cancel, lightArmed, attachGuards, viewport,
		get frame() { return frame; }
	};
}
