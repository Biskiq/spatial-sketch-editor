/**
 * The Stage's neutral illumination: drawn whenever no World environment is
 * shown (Paper, or the Studio sky). One definition, read by the Stage Canvas
 * and by Current World inspection, so a swatch inspected "in the World" under
 * the neutral rig is lit exactly as the Stage lights it.
 */
export const STAGE_NEUTRAL_AMBIENT_INTENSITY = 0.45;

export const STAGE_NEUTRAL_DIRECTIONALS: readonly {
	readonly position: readonly [number, number, number];
	readonly intensity: number;
}[] = Object.freeze([
	Object.freeze({
		position: Object.freeze([6, 12, 8]) as readonly [number, number, number],
		intensity: 1.1,
	}),
	Object.freeze({
		position: Object.freeze([-8, 6, -6]) as readonly [number, number, number],
		intensity: 0.35,
	}),
]);
