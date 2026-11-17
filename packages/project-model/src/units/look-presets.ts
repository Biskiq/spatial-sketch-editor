/**
 * The curated Look catalogue (T2.S6).
 *
 * A Look is **pure project-model data**, never stored in the document: identity
 * is an exact match of the World's Sky (heading excluded) and Treatment. The
 * catalogue is append-only and pinned by tests so a saved Look can never drift
 * underneath a project; adding a Look is a new entry, never an edit.
 *
 * A Look's Sky carries `heading: 0` as a placeholder only. `scene-look-apply`
 * always keeps the World's live noon heading, because a Look changes the light,
 * never which way the room faces.
 */
import type {
	SceneEnvironment,
	ScenePaletteSlot,
	SceneSky,
	SceneTreatment
} from '../scene';

export const SCENE_LOOK_IDS = ['riso', 'clay'] as const;

export type SceneLookId = (typeof SCENE_LOOK_IDS)[number];

/** One palette colour a Look seeds into an empty World palette. */
export type SceneLookPaletteEntry = {
	readonly name: string;
	readonly color: string;
};

/** One curated Look: an Atmosphere, a Treatment and, for Riso, a palette. */
export type SceneLookStart = {
	readonly id: SceneLookId;
	readonly label: string;
	readonly summary: string;
	/** Complete Sky except the heading, which apply keeps from the World. */
	readonly atmosphere: SceneSky;
	readonly treatment?: SceneTreatment;
	readonly palette: readonly SceneLookPaletteEntry[];
};

const LOOK_MOON = { color: '#c9d6ff', strength: 0.25 } as const;

export const SCENE_LOOK_STARTS: readonly SceneLookStart[] = [
	{
		id: 'riso',
		label: 'Riso',
		summary: 'A flat printed sky, crisp tinted shadows and flat-colour surfaces.',
		atmosphere: {
			preset: 'daylight',
			time: 13,
			heading: 0,
			arcHeight: 55,
			haze: 5,
			exposure: 0.15,
			softness: 0.05,
			sunShadows: true,
			moon: { ...LOOK_MOON },
			skyColor: '#f4d35e',
			groundColor: '#3d5a80'
		},
		treatment: 'flat-colour',
		palette: [
			{ name: 'Coral', color: '#ee6c4d' },
			{ name: 'Ink', color: '#293241' },
			{ name: 'Gold', color: '#f4d35e' }
		]
	},
	{
		id: 'clay',
		label: 'Clay',
		summary: 'A neutral overcast sky over one matte clay surface.',
		atmosphere: {
			preset: 'overcast',
			time: 13,
			heading: 0,
			arcHeight: 62,
			haze: 85,
			exposure: 0.3,
			softness: 0.9,
			sunShadows: true,
			moon: { ...LOOK_MOON },
			skyColor: '#e6e2da',
			groundColor: '#d4cec2'
		},
		treatment: 'clay',
		palette: []
	}
];

export function sceneLookStart(id: string): SceneLookStart | null {
	return SCENE_LOOK_STARTS.find((look) => look.id === id) ?? null;
}

/** The Look a World currently matches exactly, or `null` after any edit. */
export function sceneLookOf(
	environment: SceneEnvironment | null | undefined
): SceneLookStart | null {
	const sky = environment?.sky;
	if (sky === undefined) return null;
	return (
		SCENE_LOOK_STARTS.find(
			(look) =>
				look.treatment === environment?.treatment &&
				sameSkyIgnoringHeading(sky, look.atmosphere)
		) ?? null
	);
}

/**
 * Sky equality that ignores the heading. A Look is the same Look whichever way
 * the World faces, because apply rewrites only what the catalogue pins.
 */
export function sameSkyIgnoringHeading(a: SceneSky, b: SceneSky): boolean {
	return (
		a.preset === b.preset &&
		a.time === b.time &&
		a.arcHeight === b.arcHeight &&
		a.haze === b.haze &&
		a.exposure === b.exposure &&
		a.softness === b.softness &&
		a.sunShadows === b.sunShadows &&
		a.skyColor.toLowerCase() === b.skyColor.toLowerCase() &&
		a.groundColor.toLowerCase() === b.groundColor.toLowerCase() &&
		a.moon.color.toLowerCase() === b.moon.color.toLowerCase() &&
		a.moon.strength === b.moon.strength
	);
}

/**
 * The deterministic palette a Look seeds into a World that has none. The ids are
 * derived from the Look, never allocated by the editor: the same Look applied to
 * the same empty palette produces the same document on every device.
 */
export function sceneLookPaletteSlots(look: SceneLookStart): readonly ScenePaletteSlot[] {
	return look.palette.map((entry, index) => ({
		id: `look-${look.id}-${index + 1}`,
		name: entry.name,
		color: entry.color
	}));
}
