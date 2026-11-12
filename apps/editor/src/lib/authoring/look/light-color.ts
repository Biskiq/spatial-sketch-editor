/**
 * T2 gallery UX recovery — Warmth, Colour and Brightness presentation.
 *
 * Warmth is a white-balance ramp over the stored sRGB `color`; no kelvin value
 * is stored or shown. Colour is HSV with value fixed at 1, because darkness is
 * Brightness's job. Brightness is `π × 2^s`, so the accepted chips sit exactly
 * on the slider's stops.
 */
import { LIGHT_INTENSITY_REFERENCE } from './light-units';

export type WarmthStop = {
	/** −100 Candle … +100 Sky. */
	readonly w: number;
	readonly label: string;
	readonly color: string;
};

export const LIGHT_WARMTH_STOPS: readonly WarmthStop[] = [
	{ w: -100, label: 'Candle', color: '#ffb46b' },
	{ w: -50, label: 'Warm', color: '#ffd6a5' },
	{ w: 0, label: 'Neutral', color: '#ffffff' },
	{ w: 50, label: 'Cool', color: '#dbe9ff' },
	{ w: 100, label: 'Sky', color: '#b8d0ff' }
];

type Rgb = { readonly r: number; readonly g: number; readonly b: number };

export function hexToRgb(color: string): Rgb | null {
	const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color.trim());
	if (match === null) return null;
	return {
		r: Number.parseInt(match[1]!, 16),
		g: Number.parseInt(match[2]!, 16),
		b: Number.parseInt(match[3]!, 16)
	};
}

export function rgbToHex(rgb: Rgb): string {
	const channel = (value: number): string =>
		Math.round(Math.min(255, Math.max(0, value)))
			.toString(16)
			.padStart(2, '0');
	return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

function interpolate(left: number, right: number, amount: number): number {
	return left + (right - left) * amount;
}

/** The ramp's colour at `w`, piecewise-linear per sRGB channel. */
export function warmthColorAt(w: number): string {
	const clamped = Math.min(100, Math.max(-100, w));
	for (let index = 0; index < LIGHT_WARMTH_STOPS.length - 1; index += 1) {
		const left = LIGHT_WARMTH_STOPS[index]!;
		const right = LIGHT_WARMTH_STOPS[index + 1]!;
		if (clamped > right.w) continue;
		const amount = (clamped - left.w) / (right.w - left.w);
		const a = hexToRgb(left.color)!;
		const b = hexToRgb(right.color)!;
		return rgbToHex({
			r: Math.round(interpolate(a.r, b.r, amount)),
			g: Math.round(interpolate(a.g, b.g, amount)),
			b: Math.round(interpolate(a.b, b.b, amount))
		});
	}
	return LIGHT_WARMTH_STOPS.at(-1)!.color;
}

/** The ramp name shown beside the chips. */
export function warmthName(w: number): string {
	if (w <= -75) return 'Candle';
	if (w <= -25) return 'Warm';
	if (w < 25) return 'Neutral';
	if (w < 75) return 'Cool';
	return 'Sky';
}

/** The `w` whose ramp colour is nearest the stored colour. */
export function nearestWarmth(color: string): { w: number; exact: boolean } {
	const target = hexToRgb(color);
	if (target === null) return { w: 0, exact: false };
	let bestW = 0;
	let bestDistance = Infinity;
	let exact = false;
	for (let w = -100; w <= 100; w += 1) {
		const candidate = hexToRgb(warmthColorAt(w))!;
		const distance =
			(candidate.r - target.r) ** 2 +
			(candidate.g - target.g) ** 2 +
			(candidate.b - target.b) ** 2;
		if (distance < bestDistance) {
			bestDistance = distance;
			bestW = w;
		}
		const withinOne =
			Math.abs(candidate.r - target.r) <= 1 &&
			Math.abs(candidate.g - target.g) <= 1 &&
			Math.abs(candidate.b - target.b) <= 1;
		if (withinOne) exact = true;
	}
	return { w: bestW, exact };
}

/** Whether a stored colour is on the white ramp, and its `w`. */
export function warmthReading(color: string): { white: boolean; w: number; label: string } {
	const nearest = nearestWarmth(color);
	if (!nearest.exact) return { white: false, w: nearest.w, label: 'Custom' };
	return { white: true, w: nearest.w, label: warmthName(nearest.w) };
}

export type Hsv = { readonly hue: number; readonly saturation: number; readonly value: number };

/** HSV → six-digit sRGB hex. Hue is degrees, saturation/value are 0…1. */
export function hsvToHex(hue: number, saturation: number, value = 1): string {
	const h = ((hue % 360) + 360) % 360;
	const s = Math.min(1, Math.max(0, saturation));
	const v = Math.min(1, Math.max(0, value));
	const c = v * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = v - c;
	let r = 0;
	let g = 0;
	let b = 0;
	if (h < 60) [r, g, b] = [c, x, 0];
	else if (h < 120) [r, g, b] = [x, c, 0];
	else if (h < 180) [r, g, b] = [0, c, x];
	else if (h < 240) [r, g, b] = [0, x, c];
	else if (h < 300) [r, g, b] = [x, 0, c];
	else [r, g, b] = [c, 0, x];
	return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

/** Six-digit sRGB hex → HSV. A malformed colour reads as white at zero amount. */
export function hexToHsv(color: string): Hsv {
	const rgb = hexToRgb(color);
	if (rgb === null) return { hue: 0, saturation: 0, value: 1 };
	const r = rgb.r / 255;
	const g = rgb.g / 255;
	const b = rgb.b / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;
	let hue = 0;
	if (delta > 1e-9) {
		if (max === r) hue = 60 * (((g - b) / delta) % 6);
		else if (max === g) hue = 60 * ((b - r) / delta + 2);
		else hue = 60 * ((r - g) / delta + 4);
	}
	if (hue < 0) hue += 360;
	return { hue, saturation: max <= 1e-9 ? 0 : delta / max, value: max };
}

/** The Colour amount shown beside the dial. */
export function colourAmount(color: string): number {
	return Math.round(hexToHsv(color).saturation * 100);
}

/** The Brightness slider value `s`; chips sit at −2, −1, 0, 1, 2. */
export function brightnessSliderValue(intensity: number): number {
	if (!Number.isFinite(intensity) || intensity <= 1e-9) return -3;
	return Math.log2(intensity / LIGHT_INTENSITY_REFERENCE);
}

/** `intensity = π × 2^s` for a slider value. */
export function brightnessForSlider(value: number): number {
	const clamped = Math.min(3, Math.max(-3, value));
	return LIGHT_INTENSITY_REFERENCE * 2 ** clamped;
}

export const LIGHT_BRIGHTNESS_SLIDER_STOPS = [-2, -1, 0, 1, 2] as const;

/** Snap a slider value to a chip when it is within ±0.05 of one. */
export function snapBrightnessSlider(value: number): number {
	for (const stop of LIGHT_BRIGHTNESS_SLIDER_STOPS) {
		if (Math.abs(value - stop) <= 0.05) return stop;
	}
	return Math.round(value * 10) / 10;
}

/** Whether the slider thumb pins to an end for an out-of-range exact value. */
export function brightnessSliderPinned(intensity: number): boolean {
	if (!Number.isFinite(intensity) || intensity <= 1e-9) return true;
	const s = brightnessSliderValue(intensity);
	return s < -3 || s > 3;
}
