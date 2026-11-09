/**
 * The spatial visualization grammar — one table for the drawing roles.
 *
 * These are **instrument and drawing** colours: the ink a gesture draws with, the
 * cobalt of a proposal, gold selection, the erase treatment, Paper and the mat,
 * and the grid's two surfaces. They are not shell chrome (that is
 * `presentation-tokens.css`) and not authored materials (a Scene's own colours
 * never participate here).
 *
 * The CSS declares the same roles as `--stage-*` custom properties so shell
 * components and the SVG overlays consume one grammar; `presentation-tokens.test.ts`
 * holds the two tables equal. Three.js paint is derived from this table instead of
 * restating the hex, so a spatial style can change in one place.
 *
 * A future spatial style changes this table and the base `--stage-*`
 * declarations together. It cannot be a CSS-only `[data-theme]` override:
 * Three.js consumes these numbers, not the custom properties, and the ownership
 * guard would reject the drift. Shell-only skins do not affect this table.
 */
export const SPATIAL_PAINT_ROLES = Object.freeze({
	/** Drawn marks and instrument linework. */
	ink: '#1b201c',
	/** A gesture's proposal: a hue no committed state uses. */
	proposal: '#2a62d6',
	/** Selection and the primary spatial accent. */
	selection: '#d4ad45',
	/** Hover / neutral targeting. */
	hover: '#4f8f6c',
	/** The erase treatment: red, never gold. */
	erase: '#d0412d',
	/** Paper's sheet: warm drafting stone, not the old cool sage-grey. */
	paper: '#e8e1d3',
	/** The mat outside the plate. */
	mat: '#1d3a33',
	/** Paper and plate grid inks. */
	gridMinor: '#a4a690',
	gridMajor: '#858a73',
	/** The mat's own grid inks (dark ground). */
	gridMatMinor: '#2b5147',
	gridMatMajor: '#3c6a5c'
} as const);

export type SpatialPaintRole = keyof typeof SPATIAL_PAINT_ROLES;

/** The CSS role each value is declared as, in `presentation-tokens.css`. */
export const SPATIAL_PAINT_CSS_VAR: Readonly<Record<SpatialPaintRole, string>> = Object.freeze({
	ink: '--stage-ink',
	proposal: '--stage-proposal',
	selection: '--stage-selection',
	hover: '--stage-hover',
	erase: '--stage-erase',
	paper: '--stage-paper',
	mat: '--stage-mat',
	gridMinor: '--stage-grid-minor',
	gridMajor: '--stage-grid-major',
	gridMatMinor: '--stage-grid-mat-minor',
	gridMatMajor: '--stage-grid-mat-major'
});

/** α `0xrrggbb` paint value for one role, for Three.js material colours. */
export function spatialPaintHex(role: SpatialPaintRole): number {
	return Number.parseInt(SPATIAL_PAINT_ROLES[role].slice(1), 16);
}

/** Every role as a Three.js paint value. */
export const SPATIAL_PAINT = Object.freeze(
	Object.fromEntries(
		(Object.keys(SPATIAL_PAINT_ROLES) as SpatialPaintRole[]).map((role) => [role, spatialPaintHex(role)])
	)
) as Readonly<Record<SpatialPaintRole, number>>;
