/**
 * T2 gallery UX recovery — the Light Card's Advanced registry.
 *
 * One ordered list of groups, each an ordered list of row descriptors. The Card
 * renders this list and holds no per-row markup; adding a feature is adding a
 * descriptor. Groups are in the approved fixed order, a group holds at most five
 * rows, a row that has no meaning for the selected kind is not rendered, and
 * every row contributes to its group's one-line summary.
 */
import type { Vec3 } from '@portfolio/project-model';
import {
	formatMultiplier,
	directionForPresentationAngles,
	presentationAngles
} from '$lib/authoring/look/light-presentation';
import {
	brightnessForSlider,
	brightnessSliderValue,
	colourAmount,
	hexToHsv,
	hsvToHex,
	nearestWarmth,
	warmthColorAt,
	warmthName
} from '$lib/authoring/look/light-color';
import { rotationForLightDirection } from '$lib/authoring/look/light-aim';
import { lightKindLabel, radiansToDegrees } from '$lib/authoring/look/light-units';

export type LightAdvancedKind = 'point' | 'spot' | 'directional';
export type LightAdvancedLight = {
	readonly light: LightAdvancedKind;
	readonly color: string;
	readonly intensity: number;
	readonly position: Vec3;
	readonly rotation: Vec3;
	readonly castShadow: boolean;
	readonly range?: number;
	readonly angle?: number;
	readonly penumbra?: number;
	readonly name?: string;
};

export type LightAdvancedValue = number | boolean | string | Vec3 | null;

export type LightAdvancedControl =
	/** White / Colour mode switch. */
	| { readonly kind: 'mode' }
	/** The Warmth ramp slider, −100…+100. */
	| { readonly kind: 'warmth' }
	/** The 132 px colour dial plus its amount readout and hex field. */
	| { readonly kind: 'colour' }
	| {
			readonly kind: 'slider';
			readonly min: number;
			readonly max: number;
			readonly step: number;
			readonly ends?: readonly [string, string];
			readonly centre?: string;
			readonly unit?: string;
			/** A small exact-value field beside the slider, with its own limits. */
			readonly field?: { readonly min: number; readonly max: number; readonly step: number };
			readonly format?: (value: number) => string;
	  }
	| {
			readonly kind: 'field';
			readonly min: number;
			readonly max: number;
			readonly step: number;
			readonly unit?: string;
	  }
	| { readonly kind: 'toggle' }
	| {
			readonly kind: 'triplet';
			readonly axes: readonly [string, string, string];
			readonly unit: string;
			/** Whether the middle value is position[1] − datum (the Height rule). */
			readonly relativeHeight?: boolean;
	  };

export type LightAdvancedRow = {
	readonly id: string;
	readonly label: string;
	readonly kinds: readonly LightAdvancedKind[];
	readonly control: LightAdvancedControl;
	read(light: LightAdvancedLight, datum: number): LightAdvancedValue;
	/** The `update-light` payload for one committed value. */
	write(
		value: LightAdvancedValue,
		light: LightAdvancedLight,
		datum: number
	): Record<string, unknown>;
	summary(light: LightAdvancedLight, datum: number): string;
};

export type LightAdvancedGroup = {
	readonly id: string;
	readonly label: string;
	readonly kinds: readonly LightAdvancedKind[];
	readonly rows: readonly LightAdvancedRow[];
	summary(light: LightAdvancedLight, datum: number): string;
};

const ALL: readonly LightAdvancedKind[] = ['point', 'spot', 'directional'];
const PLACED: readonly LightAdvancedKind[] = ['point', 'spot'];

function degrees(radians: number): number {
	return Math.round(radiansToDegrees(radians) * 10) / 10;
}

function reachReading(light: LightAdvancedLight): number | null {
	return light.range ?? null;
}

function reachLabel(light: LightAdvancedLight): string {
	return light.range === undefined ? 'unlimited' : `${light.range.toFixed(1)} m`;
}

function softnessLabel(penumbra: number): string {
	if (penumbra <= 0.01) return 'sharp';
	if (penumbra >= 0.99) return 'soft';
	return `${Math.round(penumbra * 100)}% soft`;
}

function targetFromRotation(light: LightAdvancedLight): Vec3 {
	const angles = presentationAngles(light.rotation);
	const forward = directionForPresentationAngles(angles.from, angles.heightInSky);
	return [
		light.position[0] + forward[0] * 3,
		light.position[1] + forward[1] * 3,
		light.position[2] + forward[2] * 3
	] as Vec3;
}

const modeRow: LightAdvancedRow = {
	id: 'colour-mode',
	label: 'Mode',
	kinds: ALL,
	control: { kind: 'mode' },
	read: (light) => (nearestWarmth(light.color).exact ? 'white' : 'colour'),
	write: (value, light) =>
		value === 'white'
			? { color: warmthColorAt(nearestWarmth(light.color).w) }
			// Choosing the dial is a view change; the hue is written by the dial.
			: { color: light.color },
	summary: (light) =>
		nearestWarmth(light.color).exact
			? `${warmthName(nearestWarmth(light.color).w)} white`
			: 'Colour'
};

const warmthRow: LightAdvancedRow = {
	id: 'warmth',
	label: 'Warmth',
	kinds: ALL,
	control: { kind: 'warmth' },
	read: (light) => nearestWarmth(light.color).w,
	write: (value) => ({ color: warmthColorAt(Number(value)) }),
	summary: (light) => `${warmthName(nearestWarmth(light.color).w)} white`
};

const colourRow: LightAdvancedRow = {
	id: 'colour',
	label: 'Colour',
	kinds: ALL,
	control: { kind: 'colour' },
	read: (light) => light.color,
	write: (value) => ({ color: String(value) }),
	summary: (light) => `Colour ${light.color.toLowerCase()}`
};

const brightnessRow: LightAdvancedRow = {
	id: 'brightness',
	label: 'Brightness',
	kinds: ALL,
	control: {
		kind: 'slider',
		min: -3,
		max: 3,
		step: 0.1,
		ends: ['Dim', 'Bright'],
		centre: '1×',
		field: { min: 0, max: 1000, step: 0.001 }
	},
	read: (light) => brightnessSliderValue(light.intensity),
	write: (value) => ({ intensity: brightnessForSlider(Number(value)) }),
	summary: (light) => formatMultiplier(light.intensity)
};

const beamRow: LightAdvancedRow = {
	id: 'beam',
	label: 'Beam width',
	kinds: ['spot'],
	control: {
		kind: 'slider',
		min: 1,
		max: 80,
		step: 0.5,
		ends: ['Narrow', 'Wide'],
		unit: '°',
		field: { min: 1, max: 90, step: 0.5 },
		format: (value) => `${value.toFixed(1)}°`
	},
	read: (light) => degrees(light.angle ?? 0),
	write: (value) => ({ angle: (Number(value) * Math.PI) / 180 }),
	summary: (light) => `${degrees(light.angle ?? 0)}°`
};

const softnessRow: LightAdvancedRow = {
	id: 'softness',
	label: 'Edge softness',
	kinds: ['spot'],
	control: {
		kind: 'slider',
		min: 0,
		max: 100,
		step: 1,
		ends: ['Sharp', 'Soft'],
		unit: '%',
		field: { min: 0, max: 100, step: 1 }
	},
	read: (light) => Math.round((light.penumbra ?? 0) * 100),
	write: (value) => ({ penumbra: Math.min(1, Math.max(0, Number(value) / 100)) }),
	summary: (light) => softnessLabel(light.penumbra ?? 0)
};

const reachRow: LightAdvancedRow = {
	id: 'reach',
	label: 'Reach',
	kinds: PLACED,
	control: {
		kind: 'slider',
		min: 0.5,
		max: 10,
		step: 0.05,
		unit: 'm',
		field: { min: 0.1, max: 100, step: 0.05 }
	},
	read: reachReading,
	write: (value) => ({ range: value === null ? null : Number(value) }),
	summary: reachLabel
};

const fromRow: LightAdvancedRow = {
	id: 'direction-from',
	label: 'From',
	kinds: ['directional'],
	control: {
		kind: 'slider',
		min: 0,
		max: 359,
		step: 1,
		unit: '°',
		field: { min: 0, max: 359, step: 1 }
	},
	read: (light) => presentationAngles(light.rotation).from,
	write: (value, light) => {
		const angles = presentationAngles(light.rotation);
		const from = ((Number(value) % 360) + 360) % 360;
		return {
			rotation: rotationForLightDirection(
				directionForPresentationAngles(from, angles.heightInSky)
			)
		};
	},
	summary: (light) => `From ${Math.round(presentationAngles(light.rotation).from)}°`
};

const skyHeightRow: LightAdvancedRow = {
	id: 'direction-height',
	label: 'Height in sky',
	kinds: ['directional'],
	control: {
		kind: 'slider',
		min: 0,
		max: 90,
		step: 1,
		ends: ['Horizon', 'Overhead'],
		unit: '°',
		field: { min: -90, max: 90, step: 1 }
	},
	read: (light) => presentationAngles(light.rotation).heightInSky,
	write: (value, light) => {
		const angles = presentationAngles(light.rotation);
		return {
			rotation: rotationForLightDirection(
				directionForPresentationAngles(angles.from, Number(value))
			)
		};
	},
	summary: (light) =>
		`${Math.round(presentationAngles(light.rotation).heightInSky)}° high`
};

const positionRow: LightAdvancedRow = {
	id: 'position',
	label: 'Position',
	kinds: PLACED,
	control: { kind: 'triplet', axes: ['X', 'Height', 'Z'], unit: 'm', relativeHeight: true },
	read: (light, datum) => [
		Math.round(light.position[0] * 100) / 100,
		Math.round((light.position[1] - datum) * 100) / 100,
		Math.round(light.position[2] * 100) / 100
	],
	write: (value, _light, datum) => {
		const triplet = value as Vec3;
		return {
			position: [triplet[0], datum + triplet[1], triplet[2]] as Vec3
		};
	},
	summary: (light, datum) =>
		`${light.position[0].toFixed(2)} · ${(light.position[1] - datum).toFixed(2)} · ${light.position[2].toFixed(2)} m`
};

const aimRow: LightAdvancedRow = {
	id: 'aim',
	label: 'Aim toward (direction only)',
	kinds: ['spot'],
	control: { kind: 'triplet', axes: ['X', 'Height', 'Z'], unit: 'm' },
	read: (light) => {
		const target = targetFromRotation(light);
		return [
			Math.round(target[0] * 100) / 100,
			Math.round(target[1] * 100) / 100,
			Math.round(target[2] * 100) / 100
		];
	},
	write: (value, light) => {
		const target = value as Vec3;
		return {
			rotation: rotationForLightDirection([
				target[0] - light.position[0],
				target[1] - light.position[1],
				target[2] - light.position[2]
			])
		};
	},
	summary: () => 'Direction'
};

const shadowRow: LightAdvancedRow = {
	id: 'shadows',
	label: 'Cast shadows',
	kinds: ALL,
	control: { kind: 'toggle' },
	read: (light) => light.castShadow,
	write: (value) => ({ castShadow: Boolean(value) }),
	summary: (light) => (light.castShadow ? 'On' : 'Off')
};

/** Groups in the approved fixed order. */
export const LIGHT_ADVANCED_GROUPS: readonly LightAdvancedGroup[] = [
	{
		id: 'colour',
		label: 'Colour',
		kinds: ALL,
		rows: [modeRow, warmthRow, colourRow],
		summary: (light) => {
			const nearest = nearestWarmth(light.color);
			return nearest.exact
				? `${warmthName(nearest.w)} white`
				: `Colour ${light.color.toLowerCase()}`;
		}
	},
	{
		id: 'brightness',
		label: 'Brightness',
		kinds: ALL,
		rows: [brightnessRow],
		summary: (light) => formatMultiplier(light.intensity)
	},
	{
		id: 'shape',
		label: 'Shape',
		kinds: PLACED,
		rows: [beamRow, softnessRow, reachRow],
		summary: (light) =>
			light.light === 'spot'
				? `${degrees(light.angle ?? 0)}° · ${softnessLabel(light.penumbra ?? 0)} · ${reachLabel(light)}`
				: reachLabel(light)
	},
	{
		id: 'direction',
		label: 'Direction',
		kinds: ['directional'],
		rows: [fromRow, skyHeightRow],
		summary: (light) => {
			const angles = presentationAngles(light.rotation);
			return `From ${Math.round(angles.from)}° · ${Math.round(angles.heightInSky)}° high`;
		}
	},
	{
		id: 'position',
		label: 'Position',
		kinds: PLACED,
		rows: [positionRow, aimRow],
		summary: (light, datum) =>
			`${light.position[0].toFixed(2)} · ${(light.position[1] - datum).toFixed(2)} · ${light.position[2].toFixed(2)} m`
	},
	{
		id: 'shadows',
		label: 'Shadows',
		kinds: ALL,
		rows: [shadowRow],
		summary: (light) => (light.castShadow ? 'On' : 'Off')
	}
];

/** The groups that have at least one row for this kind. */
export function advancedGroupsFor(
	kind: LightAdvancedKind
): readonly LightAdvancedGroup[] {
	return LIGHT_ADVANCED_GROUPS.filter(
		(group) => group.kinds.includes(kind) && group.rows.some((row) => row.kinds.includes(kind))
	);
}

/** The rows in one group that apply to this kind, with no placeholder controls. */
export function advancedRowsFor(
	group: LightAdvancedGroup,
	kind: LightAdvancedKind
): readonly LightAdvancedRow[] {
	return group.rows.filter((row) => row.kinds.includes(kind));
}

/** The group's one-line summary, written in the shared vocabulary. */
export function advancedSummary(
	group: LightAdvancedGroup,
	light: LightAdvancedLight,
	datum: number
): string {
	return group.summary(light, datum);
}

/** The Card's kind line, e.g. `Point light`. */
export function advancedKindLabel(kind: LightAdvancedKind): string {
	return lightKindLabel(kind);
}

/** Re-exported so the Card's colour row reads one source. */
export { colourAmount, hexToHsv, hsvToHex, warmthColorAt, warmthName };
