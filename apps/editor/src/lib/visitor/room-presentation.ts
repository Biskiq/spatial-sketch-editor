/**
 * P21.4 — generic visitor room presentation.
 *
 * Neutral room tint data with no Chopin coupling. The legacy Chopin module
 * (content presentation for the frozen relic) re-exports this shape for its
 * caller records; the generic visitor shell + layout shell consume only this
 * module.
 * Type-only imports erase at runtime; the runtime neutral value has no
 * Chopin dependency.
 */

export type VisitorRoomPresentation = {
	subtitle?: string;
	mood?: string;
	color: string;
	accentColor: string;
	shell: 'layout' | 'bespoke';
};

export const neutralVisitorRoomPresentation: VisitorRoomPresentation = {
	color: '#4b4b52',
	accentColor: '#a6a6ad',
	shell: 'layout'
};

/** A physical Wall's default surface; Walls carry no authored material yet. */
export const DEFAULT_WALL_COLOR = '#f1e6cf';
/**
 * The Stage and Preview light differently, and both too dimly for a pale surface
 * to read as itself, so the default Wall holds part of its colour unlit. Diffuse
 * light on top still separates its faces.
 */
export const DEFAULT_WALL_UNLIT_SHARE = 0.5;
