/**
 * R217.S28 — Look-through steps over the retained Camera presets (E7).
 *
 * Lens and Eye height are three-step shortcuts over exact authored Camera
 * values. The lens steps are the retained `CAMERA_LENS_PRESETS` (24, 50 and
 * 85 mm); eye-height steps move eye and target together by a floor-relative
 * delta. Nothing here writes or evaluates a pose: the Camera accepts the
 * resulting FOV or lift through its own intent and stays the one authority.
 */
import {
	CAMERA_LENS_PRESETS,
	findMatchingLensPreset,
	type LensPreset
} from '../camera/editor-camera-framing-authoring';
import { lensMillimetres } from './experience-model';

export type LensStep = {
	readonly label: 'Wide' | 'Normal' | 'Close';
	readonly preset: LensPreset;
	readonly fovYDegrees: number;
};

/** Conservatory's three lens steps, in order, over the retained focal lengths. */
export const LENS_STEPS: readonly LensStep[] = [
	{ label: 'Wide', preset: CAMERA_LENS_PRESETS[0]!, fovYDegrees: CAMERA_LENS_PRESETS[0]!.verticalFovDegrees },
	{ label: 'Normal', preset: CAMERA_LENS_PRESETS[1]!, fovYDegrees: CAMERA_LENS_PRESETS[1]!.verticalFovDegrees },
	{ label: 'Close', preset: CAMERA_LENS_PRESETS[2]!, fovYDegrees: CAMERA_LENS_PRESETS[2]!.verticalFovDegrees }
] as const;

export type EyeHeightStep = {
	readonly label: 'Seated' | 'Standing' | 'Raised';
	readonly metres: number;
};

/** Seated, the Camera default, and Raised (E7). */
export const EYE_HEIGHT_STEPS: readonly EyeHeightStep[] = [
	{ label: 'Seated', metres: 1.15 },
	{ label: 'Standing', metres: 1.65 },
	{ label: 'Raised', metres: 2.5 }
] as const;

/** The lens step an authored FOV matches, or null for a Custom lens. */
export function lensStepOf(fovYDegrees: number): LensStep | null {
	const preset = findMatchingLensPreset(fovYDegrees);
	if (preset === null) return null;
	return LENS_STEPS.find((step) => step.preset.name === preset.name) ?? null;
}

/** The nearest lens step, used as the starting point of a scroll step. */
export function nearestLensStep(fovYDegrees: number): LensStep {
	let best = LENS_STEPS[0]!;
	let distance = Number.POSITIVE_INFINITY;
	for (const step of LENS_STEPS) {
		const current = Math.abs(step.fovYDegrees - fovYDegrees);
		if (current < distance) {
			distance = current;
			best = step;
		}
	}
	return best;
}

/** One scroll step through the presets. Direction `-1` is wider, `1` is tighter. */
export function nextLensStep(fovYDegrees: number, direction: -1 | 1): LensStep {
	const current = lensStepOf(fovYDegrees);
	const index = current === null
		? nearestLensStep(fovYDegrees)
		: current;
	const at = LENS_STEPS.indexOf(index);
	const next = Math.max(0, Math.min(LENS_STEPS.length - 1, at + direction));
	return LENS_STEPS[next]!;
}

/** The eye-height step an authored height matches, or null between steps. */
export function eyeHeightStepOf(metres: number): EyeHeightStep | null {
	return EYE_HEIGHT_STEPS.find((step) => Math.abs(step.metres - metres) < 0.005) ?? null;
}

/** One step through Seated, Standing and Raised. */
export function nextEyeHeightStep(metres: number, direction: -1 | 1): EyeHeightStep {
	const current = eyeHeightStepOf(metres);
	const at = current === null
		? EYE_HEIGHT_STEPS.reduce(
				(best, step, index) =>
					Math.abs(step.metres - metres) < Math.abs(EYE_HEIGHT_STEPS[best]!.metres - metres) ? index : best,
				0
			)
		: EYE_HEIGHT_STEPS.indexOf(current);
	const next = Math.max(0, Math.min(EYE_HEIGHT_STEPS.length - 1, at + direction));
	return EYE_HEIGHT_STEPS[next]!;
}

/** The View Card's hero tag: *Normal · Standing*, or *Custom · 35 mm · Standing*. */
export function framingTag(fovYDegrees: number, eyeHeightMetres: number): string {
	const lens = lensStepOf(fovYDegrees);
	const lensWord = lens === null ? `Custom · ${lensMillimetres(fovYDegrees)} mm` : lens.label;
	const height = eyeHeightStepOf(eyeHeightMetres);
	const heightWord = height === null ? `${eyeHeightMetres.toFixed(2)} m` : height.label;
	return `${lensWord} · ${heightWord}`;
}
