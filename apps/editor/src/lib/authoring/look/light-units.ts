/**
 * T2.S3 — the one light-unit vocabulary.
 *
 * Gate A measured `NoToneMapping`, exposure 1.0, sRGB output and a π reference
 * intensity for a point light at one metre. These helpers are the editor's only
 * conversion points: the Scene stores physical values, the Card shows the five
 * accepted Brightness stops and exact values under More, and the Stage draws
 * angle guides in degrees without ever writing degrees to the document.
 */
import type { SceneLightEntity } from '@portfolio/project-model';

/** Gate A's point-light reference intensity, in candela. */
export const LIGHT_INTENSITY_REFERENCE = Math.PI;

/** The five accepted Brightness stops. */
export const LIGHT_BRIGHTNESS_STOPS = [0.25, 0.5, 1, 2, 4] as const;
export type LightBrightnessStop = (typeof LIGHT_BRIGHTNESS_STOPS)[number];

/** The current Scene codec's maximum half-angle, in radians. */
export const LIGHT_MAX_HALF_ANGLE_RADIANS = Math.PI;

/** The guide is drawn no wider than this; the exact field still accepts π. */
export const LIGHT_GUIDE_MAX_HALF_ANGLE_DEGREES = 80;

/** A created spot's cutoff sits this far beyond the surface it was aimed at. */
export const LIGHT_SPOT_TARGET_MARGIN_METERS = 0.5;

/** The provisional warmth tokens. They are sRGB colours, not kelvin claims. */
export const LIGHT_WARMTH_TOKENS = [
	{ id: 'warm', label: 'Warm', color: '#ffd6a5' },
	{ id: 'neutral', label: 'Neutral', color: '#ffffff' },
	{ id: 'cool', label: 'Cool', color: '#dbe9ff' }
] as const;

export type LightWarmthToken = (typeof LIGHT_WARMTH_TOKENS)[number];

export function intensityForBrightnessStop(stop: number): number {
	return stop * LIGHT_INTENSITY_REFERENCE;
}

/**
 * The accepted stop only when the stored intensity is within 0.5% of it.
 * A custom value — including zero — reads Custom and is never rounded.
 */
export function brightnessStopForIntensity(intensity: number): LightBrightnessStop | null {
	if (!Number.isFinite(intensity) || intensity < 0) return null;
	for (const stop of LIGHT_BRIGHTNESS_STOPS) {
		const value = intensityForBrightnessStop(stop);
		if (Math.abs(value - intensity) <= value * 0.005) return stop;
	}
	return null;
}

export function radiansToDegrees(radians: number): number {
	return (radians * 180) / Math.PI;
}

export function degreesToRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

/** A spot's cutoff for a target at `distance`; the target itself is inside it. */
export function spotCutoffForTargetDistance(distance: number): number {
	return Math.max(distance, 0) + LIGHT_SPOT_TARGET_MARGIN_METERS;
}

/** A spot guide's drawable half-angle, bounded without changing the stored value. */
export function drawableSpotHalfAngle(angle: number): number {
	return Math.min(
		Math.max(angle, 0),
		degreesToRadians(LIGHT_GUIDE_MAX_HALF_ANGLE_DEGREES)
	);
}

export function lightKindLabel(light: SceneLightEntity['light']): string {
	return light === 'point' ? 'Point light' : 'Spot light';
}

/** The Card's Brightness value, e.g. `1× · π cd`. */
export function formatBrightness(intensity: number): string {
	const unit = 'cd';
	const stop = brightnessStopForIntensity(intensity);
	return stop === null
		? `${intensity.toFixed(2)} ${unit}`
		: stop === 1
			? `1× · π ${unit}`
			: `${stop}× · ${intensity.toFixed(3)} ${unit}`;
}
