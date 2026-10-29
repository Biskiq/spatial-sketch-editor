/** Map wall time to the Camera inspection clock without changing its evaluator. */
export function createEditorMotionClock() {
	let realBase = 0;
	let clockBase = 0;
	let factor = 1;
	return {
		read(realSeconds: number): number {
			return clockBase + (realSeconds - realBase) * factor;
		},
		setSpeed(speed: 'slow' | 'normal' | 'fast', realSeconds: number): void {
			clockBase += (realSeconds - realBase) * factor;
			realBase = realSeconds;
			factor = speed === 'slow' ? 0.5 : speed === 'fast' ? 2 : 1;
		}
	};
}
