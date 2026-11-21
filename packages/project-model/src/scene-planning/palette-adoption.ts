import type { ScenePaletteSlot } from '../scene';
import type { CameraFreeSceneDocument as SceneDocument } from '../units/types';

/** One literal colour a World Finish can move onto a palette slot. */
export type PaletteAdoptionRow = {
	/** The literal `#rrggbb` to replace, lowercase. */
	readonly color: string;
	readonly slotId: string;
	readonly slotName: string;
	readonly slotColor: string;
	/** Project Finishes carrying the literal. */
	readonly finishes: number;
	/** Scene objects using those Finishes. */
	readonly objects: number;
};

/** The one adoption plan both the preview and `scene-palette-adopt` read. */
export type PaletteAdoptionPlan = {
	readonly rows: readonly PaletteAdoptionRow[];
	/** Palette slots available to adopt into; zero means nothing to do. */
	readonly slots: number;
	readonly skipped: {
		/** Finishes whose colour is already inherited from a slot. */
		readonly inherited: number;
		/** Finishes whose tint is an image, which adoption deliberately leaves alone. */
		readonly imageTints: number;
	};
};

/**
 * Compute palette adoption without writing: every literal Finish colour maps to
 * the nearest palette slot in CIE Lab (ΔE76). Image tints (`maps.color`) are
 * skipped because their colour modulates a picture rather than naming a surface;
 * inherited colours already follow a slot. Both are counted, never rewritten.
 *
 * The plan is deterministic and independent of preview state, so the writer can
 * revalidate a submitted mapping against it and refuse a stale one.
 */
export function planPaletteAdoption(scene: SceneDocument): PaletteAdoptionPlan {
	const slots = scene.palette ?? [];
	const objectsByFinish = new Map<string, number>();
	for (const entity of scene.entities) {
		const instanceId = (entity as { materialInstanceId?: string }).materialInstanceId;
		if (instanceId === undefined) continue;
		objectsByFinish.set(instanceId, (objectsByFinish.get(instanceId) ?? 0) + 1);
	}

	let inherited = 0;
	let imageTints = 0;
	const rows = new Map<string, { slot: ScenePaletteSlot; finishes: number; objects: number }>();
	if (slots.length > 0) {
		for (const instance of scene.materials) {
			const color = instance.overrides?.color;
			if (color === undefined || typeof color !== 'string') {
				inherited += 1;
				continue;
			}
			if (instance.overrides?.maps?.color !== undefined) {
				imageTints += 1;
				continue;
			}
			const literal = color.toLowerCase();
			if (!/^#[0-9a-f]{6}$/.test(literal)) continue;
			const slot = nearestSlot(literal, slots);
			if (slot === null) continue;
			const objects = objectsByFinish.get(instance.id) ?? 0;
			const existing = rows.get(literal);
			if (existing === undefined) {
				rows.set(literal, { slot, finishes: 1, objects });
			} else {
				existing.finishes += 1;
				existing.objects += objects;
			}
		}
	}

	return {
		rows: [...rows].map(([color, row]) => ({
			color,
			slotId: row.slot.id,
			slotName: row.slot.name,
			slotColor: row.slot.color.toLowerCase(),
			finishes: row.finishes,
			objects: row.objects
		})),
		slots: slots.length,
		skipped: { inherited, imageTints }
	};
}

/** Nearest palette slot by CIE Lab ΔE76; document order breaks a tie. */
export function nearestSlot(color: string, slots: readonly ScenePaletteSlot[]): ScenePaletteSlot | null {
	const target = hexToLab(color);
	if (target === null) return null;
	let best: ScenePaletteSlot | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const slot of slots) {
		const candidate = hexToLab(slot.color);
		if (candidate === null) continue;
		const distance =
			(target[0] - candidate[0]) ** 2 +
			(target[1] - candidate[1]) ** 2 +
			(target[2] - candidate[2]) ** 2;
		if (distance < bestDistance) {
			best = slot;
			bestDistance = distance;
		}
	}
	return best;
}

type Lab = readonly [number, number, number];

export function hexToLab(color: string): Lab | null {
	if (!/^#[0-9a-fA-F]{6}$/.test(color)) return null;
	const r = linearChannel(Number.parseInt(color.slice(1, 3), 16));
	const g = linearChannel(Number.parseInt(color.slice(3, 5), 16));
	const b = linearChannel(Number.parseInt(color.slice(5, 7), 16));
	// sRGB D65 → XYZ, normalised by the D65 white point.
	const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
	const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
	const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
	const f = (value: number): number =>
		value > 216 / 24389 ? Math.cbrt(value) : ((24389 / 27) * value + 16) / 116;
	const fx = f(x);
	const fy = f(y);
	const fz = f(z);
	return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function linearChannel(value: number): number {
	const channel = value / 255;
	return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}
