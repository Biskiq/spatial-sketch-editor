/**
 * Three.js instrument paint, derived from the spatial grammar.
 *
 * Authored materials never participate in instrument paint. The values come from
 * `$lib/design/spatial-paint`; this module only exposes the numeric subset the
 * Stage's Three.js instruments already consume.
 */
import { SPATIAL_PAINT } from '$lib/design/spatial-paint';

export const STAGE_PAINT = Object.freeze({
	ink: SPATIAL_PAINT.ink,
	hover: SPATIAL_PAINT.hover,
	selection: SPATIAL_PAINT.selection
});
