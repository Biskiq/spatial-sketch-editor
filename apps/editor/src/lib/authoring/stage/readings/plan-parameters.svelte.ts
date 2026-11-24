import type { StageFacade } from '../stage-facade';
import { PLAN_DEFAULT_DEPTH_METERS } from '../plan-parameters';
import { planOverridesOf, type ResolvedSlice } from '../slice/slice-cut';

export function createReadingPlanParameters(input: {
	readonly facade: () => StageFacade | null;
	readonly resolvedSlice: () => ResolvedSlice | null;
}) {
	function attach(): void {
		// A finite Slice depth narrows what Plan shows and picks.
		$effect(() => {
			const reading = input.resolvedSlice();
			const stage = input.facade();
			if (stage === null) return;
			stage.setPlanParameters({
				depthMeters: reading === null
					? PLAN_DEFAULT_DEPTH_METERS
					: (planOverridesOf(reading).depthMeters ?? PLAN_DEFAULT_DEPTH_METERS)
			});
		});
	}

	return { attach };
}
