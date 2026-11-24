/**
 * Align on wall and floor (T2.S8 U6): pure snap/step math + reactive session.
 *
 * Uses the live Stage through Camera (`wallFace.face` on the Card target's own
 * side for walls; `wallFace.faceFloor` Plan + `fit` for floors) and commits
 * every release or keyup as one E4 `mapping` patch through the Card adapter.
 */
import {
	baseRecipeOf,
	type FinishPatchEdit,
	type FinishSource
} from '@portfolio/project-model/scene-planning';
import { NEUTRAL_RECIPE, type Mapping, type Recipe } from '@portfolio/project-model/materials';
import type { CompiledLayoutGeometry, LayoutDocumentWallFirst } from '@portfolio/layout-core';
import { wallSideFaceFrame } from '$lib/layout/wall-face';
import { wallFace } from '$lib/authoring/layout/wall-face-store';
import type { FinishCardTarget } from './finish-card.svelte';

export function mod(value: number, period: number): number {
	return ((value % period) + period) % period;
}

/** Snap an offset in metres: 1 cm default, 1 mm with Shift. */
export function snapAlignOffset(meters: number, shiftKey: boolean): number {
	const step = shiftKey ? 0.001 : 0.01;
	return Number((Math.round(meters / step) * step).toFixed(4));
}

/** Snap a rotation in degrees: 15° default, free with Alt. */
export function snapAlignAngle(degrees: number, altKey: boolean): number {
	const next = altKey ? degrees : Math.round(degrees / 15) * 15;
	return Number(mod(next, 360).toFixed(1));
}

/** Keyboard arrow nudge for offset: 1 cm default, 10 cm with Shift. */
export function nudgeAlignOffset(
	current: readonly [number, number],
	key: string,
	shiftKey: boolean
): [number, number] | null {
	const step = shiftKey ? 0.1 : 0.01;
	switch (key) {
		case 'ArrowLeft':
			return [Number((current[0] - step).toFixed(4)), current[1]];
		case 'ArrowRight':
			return [Number((current[0] + step).toFixed(4)), current[1]];
		case 'ArrowUp':
			return [current[0], Number((current[1] + step).toFixed(4))];
		case 'ArrowDown':
			return [current[0], Number((current[1] - step).toFixed(4))];
		default:
			return null;
	}
}

/** Keyboard arrow nudge for rotation: ±15°. */
export function nudgeAlignAngle(currentDeg: number, key: string): number | null {
	if (key === 'ArrowLeft' || key === 'ArrowUp') return mod(currentDeg + 15, 360);
	if (key === 'ArrowRight' || key === 'ArrowDown') return mod(currentDeg - 15, 360);
	return null;
}

/** Build one E4 `mapping` patch for offset (metres) and angle (degrees). */
export function alignMappingEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	offsetMeters: readonly [number, number],
	angleDeg: number
): FinishPatchEdit[] {
	const base = baseRecipeOf({ id: '', name: '', base: source.base }, recipes) ?? NEUTRAL_RECIPE;
	const current = source.overrides?.mapping ?? base.mapping;
	const rotation = (mod(angleDeg, 360) * Math.PI) / 180;
	if (current.kind === 'uv') {
		const next: Mapping = {
			...current,
			rotation,
			offset: [Number(offsetMeters[0].toFixed(4)), Number(offsetMeters[1].toFixed(4))]
		};
		return JSON.stringify(base.mapping) === JSON.stringify(next)
			? source.overrides?.mapping === undefined
				? []
				: [{ field: 'mapping', op: 'reset' }]
			: [{ field: 'mapping', op: 'set', value: next }];
	}
	const tileX = Math.max(0.02, current.metric.tileMeters[0]);
	const tileY = Math.max(0.02, current.metric.tileMeters[1]);
	const ox = mod(offsetMeters[0], tileX) / tileX;
	const oy = mod(offsetMeters[1], tileY) / tileY;
	const next: Mapping = {
		kind: current.kind,
		metric: {
			tileMeters: [current.metric.tileMeters[0], current.metric.tileMeters[1]],
			rotation,
			offset: [Number(ox.toFixed(4)), Number(oy.toFixed(4))]
		}
	} as Mapping;
	if (JSON.stringify(base.mapping) === JSON.stringify(next)) {
		return source.overrides?.mapping === undefined ? [] : [{ field: 'mapping', op: 'reset' }];
	}
	return [{ field: 'mapping', op: 'set', value: next }];
}

/** One E4 `mapping` patch resetting offset to [0, 0] and rotation to 0. */
export function alignResetEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>
): FinishPatchEdit[] {
	return alignMappingEdits(source, recipes, [0, 0], 0);
}

export type AlignCorner = readonly [number, number, number];

export type ActiveFinishAlign = {
	readonly target: Extract<FinishCardTarget, { kind: 'surface' }>;
	readonly surface: 'wall' | 'floor';
	readonly place: string;
	readonly widthMeters: number;
	readonly heightMeters: number;
	/** The four world corners of the faced surface plane (bottom and top edges). */
	readonly corners: readonly AlignCorner[];
	readonly invoker: HTMLElement | null;
};

export function createFinishAlign() {
	let active = $state.raw<ActiveFinishAlign | null>(null);
	let refusal = $state<string | null>(null);

	function enter(input: {
		readonly target: FinishCardTarget;
		readonly place: string;
		readonly layout: LayoutDocumentWallFirst;
		readonly geometry: CompiledLayoutGeometry;
		readonly invoker?: HTMLElement | null;
	}): { readonly ok: true } | { readonly ok: false; readonly message: string } {
		refusal = null;
		const { target, place, layout, geometry, invoker } = input;
		if (target.kind !== 'surface') {
			return { ok: false, message: 'Align works on wall sides and room floors.' };
		}
		const surface = target.surface;
		if (surface.kind === 'wall-side') {
			const wallDoc = layout.walls.find((w) => w.id === surface.wallId);
			if (wallDoc !== undefined && wallDoc.centerline.kind !== 'line') {
				const message = 'Align needs a straight wall · use Pattern size and ↻ 90°';
				refusal = message;
				return { ok: false, message };
			}
			const compiled = geometry.walls.find((w) => w.wallId === surface.wallId);
			if (compiled === undefined) {
				const message = 'That wall is not compiled yet.';
				refusal = message;
				return { ok: false, message };
			}
			const frame = wallSideFaceFrame(compiled, surface.side);
			if (frame === null) {
				const message = 'Could not frame that wall side.';
				refusal = message;
				return { ok: false, message };
			}
			const outcome = wallFace.face({ wallId: compiled.wallId, frame });
			if (outcome.kind === 'refused') {
				const message = 'Camera could not face this wall right now.';
				refusal = message;
				return { ok: false, message };
			}
			// The faced surface plane: the compiled centreline endpoints moved to
			// the Card target's own side, between the Wall's floor and top. These
			// corners are projected through the live Camera so the ruler, grid and
			// mask sit on the drawn wall rather than on a guess.
			const first = compiled.samples[0]!;
			const last = compiled.samples[compiled.samples.length - 1]!;
			const mid = compiled.samples[Math.floor(compiled.samples.length / 2)]!;
			const tangentLength = Math.hypot(mid.tangent[0], mid.tangent[1]);
			const sideSign = surface.side === 'left' ? 1 : -1;
			const ox = tangentLength > 1e-9 ? (-mid.tangent[1] / tangentLength) * (compiled.thickness / 2) * sideSign : 0;
			const oz = tangentLength > 1e-9 ? (mid.tangent[0] / tangentLength) * (compiled.thickness / 2) * sideSign : 0;
			const y0 = compiled.bounds3.min[1];
			const y1 = compiled.bounds3.max[1];
			active = {
				target,
				surface: 'wall',
				place,
				widthMeters: Math.max(0.5, compiled.length),
				heightMeters: Math.max(0.5, compiled.height),
				corners: [
					[first.point[0] + ox, y0, first.point[1] + oz],
					[last.point[0] + ox, y0, last.point[1] + oz],
					[last.point[0] + ox, y1, last.point[1] + oz],
					[first.point[0] + ox, y1, first.point[1] + oz]
				],
				invoker: invoker ?? null
			};
			return { ok: true };
		}
		if (surface.kind === 'room-floor') {
			const room = geometry.rooms.find((r) => r.roomId === surface.roomId);
			if (room === undefined) {
				const message = 'That floor is not compiled yet.';
				refusal = message;
				return { ok: false, message };
			}
			const floorY = room.floorElevation;
			let minX = Infinity;
			let maxX = -Infinity;
			let minZ = Infinity;
			let maxZ = -Infinity;
			for (const [x, z] of room.floorPolygon) {
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (z < minZ) minZ = z;
				if (z > maxZ) maxZ = z;
			}
			if (!Number.isFinite(minX) || !(maxX > minX) || !(maxZ > minZ)) {
				const message = 'Floor bounds could not be framed.';
				refusal = message;
				return { ok: false, message };
			}
			const outcome = wallFace.faceFloor({
				roomId: room.roomId,
				bounds: { min: [minX, floorY, minZ], max: [maxX, floorY + 0.05, maxZ] }
			});
			if (outcome.kind === 'refused') {
				const message = 'Camera could not frame this floor right now.';
				refusal = message;
				return { ok: false, message };
			}
			active = {
				target,
				surface: 'floor',
				place,
				widthMeters: Math.max(0.5, maxX - minX),
				heightMeters: Math.max(0.5, maxZ - minZ),
				corners: [
					[minX, floorY, minZ],
					[maxX, floorY, minZ],
					[maxX, floorY, maxZ],
					[minX, floorY, maxZ]
				],
				invoker: invoker ?? null
			};
			return { ok: true };
		}
		return { ok: false, message: 'Align works on wall sides and room floors.' };
	}

	function putBack(restoreFocus = true): boolean {
		if (active === null) return false;
		const returnTo = active.invoker;
		const outcome = wallFace.putBack();
		if (outcome.kind !== 'restored') {
			refusal = 'Camera could not return to the previous view. Try Put back again.';
			return false;
		}
		active = null;
		refusal = null;
		if (restoreFocus && returnTo && returnTo.isConnected) {
			queueMicrotask(() => returnTo.focus());
		}
		return true;
	}

	function clear(): void {
		active = null;
		refusal = null;
	}

	return {
		get active() {
			return active;
		},
		get refusal() {
			return refusal;
		},
		enter,
		putBack,
		clear
	};
}

export type FinishAlign = ReturnType<typeof createFinishAlign>;
