/**
 * `plan-text-measure.ts` — the production side of the P23.13 S3 `TextMeasure`
 * seam.
 *
 * Placement (spec §4) must test the *complete text rectangle*, so it needs real
 * extents — but the placer itself must stay pure and font-independent. This
 * module is the only place that touches a browser font: it measures with a
 * cached 2D canvas context, and the viewport invalidates it when the font
 * actually changes (font readiness, a theme/font token change, DPR change).
 *
 * A document without a DOM (SSR, a pure unit test) gets the deterministic
 * stand-in metrics from the placer instead, so nothing here is load-bearing for
 * correctness — only for fidelity.
 */
import {
	APPROXIMATE_TEXT_MEASURE,
	ROOM_LABEL_TEXT_STYLES,
	type TextExtent,
	type TextMeasure,
	type TextMeasureStyle
} from './plan-room-labels';

export type BrowserTextMeasure = {
	measure: TextMeasure;
	/** Drop every cached extent (font readiness/theme/viewport change). */
	invalidate: () => void;
	/** Monotonic identity of the current metrics; keys memoized placements. */
	generation: () => number;
};

const FALLBACK_FONT_FAMILY = 'ui-sans-serif, system-ui, sans-serif';

function resolveFontFamily(): string {
	if (typeof window === 'undefined' || typeof document === 'undefined') return FALLBACK_FONT_FAMILY;
	const declared = getComputedStyle(document.documentElement).getPropertyValue('--editor-font').trim();
	return declared.length > 0 ? declared : FALLBACK_FONT_FAMILY;
}

/**
 * Canvas-backed text extents. Cache keyed by `style|text`, invalidated whole:
 * extents are cheap to recompute and a partial invalidation could not be
 * reasoned about after a font swap.
 */
export function createBrowserTextMeasure(): BrowserTextMeasure {
	let context: CanvasRenderingContext2D | null = null;
	let family = resolveFontFamily();
	let currentGeneration = 0;
	const cache = new Map<string, TextExtent>();

	const contextFor = (): CanvasRenderingContext2D | null => {
		if (context) return context;
		if (typeof document === 'undefined') return null;
		const canvas = document.createElement('canvas');
		context = canvas.getContext('2d');
		return context;
	};

	const measure: TextMeasure = (text, style: TextMeasureStyle): TextExtent => {
		const key = `${style}|${text}`;
		const cached = cache.get(key);
		if (cached) return cached;
		const typography = ROOM_LABEL_TEXT_STYLES[style];
		const target = contextFor();
		let extent: TextExtent;
		if (target) {
			target.font = `${typography.weight} ${typography.fontSizePx}px ${family}`;
			// Width from the real advance; height from the line box the paint layer
			// uses, so a fit test can never disagree with what is drawn.
			extent = {
				width: target.measureText(text).width,
				height: typography.lineHeightPx
			};
		} else {
			extent = APPROXIMATE_TEXT_MEASURE(text, style);
		}
		cache.set(key, extent);
		return extent;
	};

	return {
		measure,
		invalidate: () => {
			cache.clear();
			context = null;
			family = resolveFontFamily();
			currentGeneration += 1;
		},
		generation: () => currentGeneration
	};
}
