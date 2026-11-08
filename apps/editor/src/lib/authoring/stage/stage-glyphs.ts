import { SPATIAL_PAINT_ROLES } from '$lib/design/spatial-paint';

/** Sticker paths shared by the Stage marks and their cursor previews. */
export const STAGE_ARROW_GLYPH = 'M0,-2.7 H8 V-6.8 L16.5,0 L8,6.8 V2.7 H0 Z';
export const STAGE_MOVE_GLYPH = 'M0,-15 L6.4,-8 H2.5 V-2.5 H8 V-6.4 L15,0 L8,6.4 V2.5 H2.5 V8 H6.4 L0,15 L-6.4,8 H-2.5 V2.5 H-8 V6.4 L-15,0 L-8,-6.4 V-2.5 H-2.5 V-8 H-6.4 Z';
export const STAGE_SCALE_GLYPH = 'M-5,5 L5,-5 M-5,5 h4.2 M-5,5 v-4.2 M5,-5 h-4.2 M5,-5 v4.2';

export type StageResizeCursor = 'opening-edge' | 'opening-corner';

/** The pointer version reuses the Stage sticker path, omitting only its chip backing. */
export function stageResizeCursorCss(
	kind: StageResizeCursor,
	direction: readonly [number, number] | null | undefined
): string | null {
	if (direction === null || direction === undefined) return null;
	const [dx, dy] = direction;
	if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) === 0) return null;
	const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
	const art = kind === 'opening-corner'
		? `<g transform="rotate(${angle + 45}) scale(1.4)"><path d="${STAGE_SCALE_GLYPH}" fill="none" stroke="${SPATIAL_PAINT_ROLES.ink}" stroke-width="2.8"/><path d="${STAGE_SCALE_GLYPH}" fill="none" stroke="white" stroke-width="1.5"/></g>`
		: `<path d="${STAGE_ARROW_GLYPH}" transform="rotate(${angle}) translate(-8.25 0)" fill="white" stroke="${SPATIAL_PAINT_ROLES.ink}" stroke-width="1.1"/>`;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g transform="translate(16 16)" stroke-linecap="round" stroke-linejoin="round">${art}</g></svg>`;
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 16, auto`;
}
