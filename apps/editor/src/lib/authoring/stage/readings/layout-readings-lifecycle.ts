export function createLayoutReadingsLifecycle(input: {
	readonly clearFace: () => void;
	readonly clearLift: () => void;
	readonly clearSlice: () => void;
	readonly resetCutaway: () => void;
	readonly clearCutawayFailures: () => void;
}) {
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
