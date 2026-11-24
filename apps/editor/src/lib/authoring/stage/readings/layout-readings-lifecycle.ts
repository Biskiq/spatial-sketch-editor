export function createLayoutReadingsLifecycle(input: {
	readonly clearFace: () => void;
	readonly clearLift: () => void;
	readonly clearSlice: () => void;
	readonly resetCutaway: () => void;
	readonly clearCutawayFailures: () => void;
	readonly installEffects: readonly (() => void)[];
}) {
	for (const install of input.installEffects) install();

	function clearReadings(): void {
		input.clearLift();
		input.clearSlice();
		input.resetCutaway();
	}

	function reset(): void {
		input.clearFace();
		clearReadings();
		input.clearCutawayFailures();
	}

	return { clearReadings, reset };
}
