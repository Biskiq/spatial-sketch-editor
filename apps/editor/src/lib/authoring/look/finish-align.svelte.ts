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
import {
	MATERIAL_MAP_ROLES,
	NEUTRAL_RECIPE,
	type MapRole,
	type Mapping,
	type Recipe
} from '@portfolio/project-model/materials';
import type { CompiledLayoutGeometry } from '@portfolio/layout-core/geometry';
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { wallSideFaceFrame, type WallFaceFrame } from '$lib/layout/wall-face';
import { wallFace } from '$lib/authoring/layout/wall-face-store';
import type { FinishCardTarget } from './finish-card.svelte';
import {
	chartCorners,
	chartToWorld,
	floorChart,
	wallSideChart,
	withPlacement,
	wrapRotation,
	type AlignSurfaceChart
} from './align-chart';

export function mod(value: number, period: number): number {
	return ((value % period) + period) % period;
}

/**
 * The set mapping Align edits (E4 `mapping`), and the bound roles whose own
 * binding mapping would ignore it. Align refuses when the colour image is one
 * of those, because the grid would describe a mapping the creator cannot see.
 */
export function alignSetMapping(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>
): { readonly mapping: Mapping; readonly base: Mapping; readonly separateRoles: readonly MapRole[] } {
	const base = baseRecipeOf({ id: '', name: '', base: source.base }, recipes) ?? NEUTRAL_RECIPE;
	const mapping = source.overrides?.mapping ?? base.mapping;
	const separate: MapRole[] = [];
	for (const role of MATERIAL_MAP_ROLES) {
		const override = source.overrides?.maps?.[role];
		if (override === null) continue;
		const binding = (override ?? base.maps[role]) as { readonly mapping?: Mapping } | undefined;
		if (binding?.mapping !== undefined) separate.push(role);
	}
	return { mapping, base: base.mapping, separateRoles: separate };
}

/** One E4 `mapping` patch placing the pattern (rotation radians, offset tile fractions); tile size unchanged. */
export function alignPlacementEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	rotation: number,
	offset: readonly [number, number]
): FinishPatchEdit[] {
	const { mapping, base } = alignSetMapping(source, recipes);
	const next = withPlacement(mapping, wrapRotation(rotation), [mod(offset[0], 1) % 1, mod(offset[1], 1) % 1]);
	if (JSON.stringify(next) === JSON.stringify(mapping)) return [];
	if (JSON.stringify(next) === JSON.stringify(base)) {
		return source.overrides?.mapping === undefined ? [] : [{ field: 'mapping', op: 'reset' }];
	}
	return [{ field: 'mapping', op: 'set', value: next }];
}

/** One E4 `mapping` patch: no offset, no turn. */
export function alignResetEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>
): FinishPatchEdit[] {
	return alignPlacementEdits(source, recipes, 0, [0, 0]);
}

/** Arrow key → screen direction (px, y down). Null for other keys. */
export function alignArrowDirection(key: string): readonly [number, number] | null {
	switch (key) {
		case 'ArrowLeft':
			return [-1, 0];
		case 'ArrowRight':
			return [1, 0];
		case 'ArrowUp':
			return [0, -1];
		case 'ArrowDown':
			return [0, 1];
		default:
			return null;
	}
}

/** Arrow key on the round handle → ±15° (counter-clockwise as seen for Left/Up). */
export function alignArrowTurn(key: string): number | null {
	if (key === 'ArrowLeft' || key === 'ArrowUp') return 1;
	if (key === 'ArrowRight' || key === 'ArrowDown') return -1;
	return null;
}

export type AlignCorner = readonly [number, number, number];

/** What the Camera port needs to frame the surface inside the chrome-free region. */
export type AlignFit = {
	readonly center: AlignCorner;
	readonly surfaceMeters: readonly [number, number];
};

export type ActiveFinishAlign = {
	readonly target: Extract<FinishCardTarget, { kind: 'surface' }>;
	readonly surface: 'wall' | 'floor';
	readonly place: string;
	readonly widthMeters: number;
	readonly heightMeters: number;
	/** The surface's native UV chart in world space: the renderer's own parametrisation. */
	readonly chart: AlignSurfaceChart;
	/** The chart's four world corners: (uMin,vMin) (uMax,vMin) (uMax,vMax) (uMin,vMax). */
	readonly corners: readonly AlignCorner[];
	/** Unit direction from the surface toward the faced eye (walls: −look; floors: up). */
	readonly toward: AlignCorner;
	/** Walls in front of a faced wall side, cut to the floor while Align is open ([] for floors). */
	readonly occluders: readonly string[];
	readonly invoker: HTMLElement | null;
};

/**
 * Walls that could hide a faced wall side: every other Wall with any part on the
 * eye's side of the faced plane. Wall Align cuts them to the floor for the
 * session (view-only, like Paper during floor Align), whatever the near-wall
 * switch says, so the whole surface stays visible.
 */
export function alignOccluders(
	active: Pick<ActiveFinishAlign, 'surface' | 'target' | 'corners' | 'toward'>,
	walls: readonly { readonly wallId: string; readonly bounds3: { readonly min: readonly number[]; readonly max: readonly number[] } }[]
): string[] {
	if (active.surface !== 'wall' || active.target.surface.kind !== 'wall-side') return [];
	const faced = active.target.surface.wallId;
	const p = active.corners[0];
	if (p === undefined) return [];
	const [tx, ty, tz] = active.toward;
	const ids: string[] = [];
	for (const wall of walls) {
		if (wall.wallId === faced) continue;
		const { min, max } = wall.bounds3;
		let front = false;
		for (let corner = 0; corner < 8 && !front; corner += 1) {
			const x = (corner & 1) === 0 ? min[0]! : max[0]!;
			const y = (corner & 2) === 0 ? min[1]! : max[1]!;
			const z = (corner & 4) === 0 ? min[2]! : max[2]!;
			front = (x - p[0]) * tx + (y - p[1]) * ty + (z - p[2]) * tz > 1e-3;
		}
		if (front) ids.push(wall.wallId);
	}
	return ids.sort();
}

function fitOf(chart: AlignSurfaceChart): AlignFit {
	return {
		center: chartToWorld(chart, [(chart.uMin + chart.uMax) / 2, (chart.vMin + chart.vMax) / 2]),
		surfaceMeters: [(chart.uMax - chart.uMin) * chart.uvMeters[0], (chart.vMax - chart.vMin) * chart.uvMeters[1]]
	};
}

export function createFinishAlign() {
	let active = $state.raw<ActiveFinishAlign | null>(null);
	let refusal = $state<string | null>(null);
	/** The last framing request, so a resize or a lane change can re-frame without a new standpoint. */
	let framing: { readonly kind: 'wall'; readonly frame: WallFaceFrame; readonly fit: AlignFit } | { readonly kind: 'floor'; readonly bounds: { readonly min: AlignCorner; readonly max: AlignCorner }; readonly fit: AlignFit } | null = null;

	function refuse(message: string): { readonly ok: false; readonly message: string } {
		refusal = message;
		return { ok: false, message };
	}

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
				return refuse('Align needs a straight wall · use Pattern size and ↻ 90°');
			}
			const compiled = geometry.walls.find((w) => w.wallId === surface.wallId);
			if (compiled === undefined || compiled.samples.length === 0) return refuse('That wall is not compiled yet.');
			const frame = wallSideFaceFrame(compiled, surface.side);
			if (frame === null) return refuse('Could not frame that wall side.');
			// The renderer's own chart: u is arc length from the wall's start on both
			// sides, v is height above the wall's floor, on the Card target's side.
			const first = compiled.samples[0]!;
			const mid = compiled.samples[Math.floor(compiled.samples.length / 2)]!;
			const chart = wallSideChart({
				start: first.point,
				startDistance: first.distance,
				tangent: mid.tangent,
				normal: [-mid.tangent[1], mid.tangent[0]],
				side: surface.side,
				thickness: compiled.thickness,
				length: compiled.length,
				floorY: compiled.bounds3.min[1],
				topY: compiled.bounds3.max[1]
			});
			const fit = fitOf(chart);
			const outcome = wallFace.face({ wallId: compiled.wallId, frame, fit });
			if (outcome.kind === 'refused') return refuse('Camera could not face this wall right now.');
			framing = { kind: 'wall', frame, fit };
			const corners = chartCorners(chart).map((uv) => chartToWorld(chart, uv));
			const toward: AlignCorner = [-frame.look[0], -frame.look[1], -frame.look[2]];
			active = {
				target,
				surface: 'wall',
				place,
				widthMeters: Math.max(0.01, compiled.length),
				heightMeters: Math.max(0.01, chart.vMax - chart.vMin),
				chart,
				corners,
				toward,
				occluders: alignOccluders({ surface: 'wall', target, corners, toward }, geometry.walls),
				invoker: invoker ?? null
			};
			return { ok: true };
		}
		if (surface.kind === 'room-floor') {
			const room = geometry.rooms.find((r) => r.roomId === surface.roomId);
			if (room === undefined) return refuse('That floor is not compiled yet.');
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
			if (!Number.isFinite(minX) || !(maxX > minX) || !(maxZ > minZ)) return refuse('Floor bounds could not be framed.');
			const chart = floorChart({ floorY, minX, maxX, minZ, maxZ });
			const fit = fitOf(chart);
			const bounds = { min: [minX, floorY, minZ] as AlignCorner, max: [maxX, floorY + 0.05, maxZ] as AlignCorner };
			const outcome = wallFace.faceFloor({ roomId: room.roomId, bounds, fit });
			if (outcome.kind === 'refused') return refuse('Camera could not frame this floor right now.');
			framing = { kind: 'floor', bounds, fit };
			active = {
				target,
				surface: 'floor',
				place,
				widthMeters: maxX - minX,
				heightMeters: maxZ - minZ,
				chart,
				corners: chartCorners(chart).map((uv) => chartToWorld(chart, uv)),
				toward: [0, 1, 0],
				occluders: [],
				invoker: invoker ?? null
			};
			return { ok: true };
		}
		return { ok: false, message: 'Align works on wall sides and room floors.' };
	}

	/**
	 * Re-frame the active surface for a changed region (resize, Index or Card
	 * toggled). The entry standpoint is untouched, so Put back still returns to
	 * where Align started. A refusal leaves one line in the bar.
	 */
	function reframe(): boolean {
		if (active === null || framing === null) return false;
		const outcome =
			framing.kind === 'wall'
				? wallFace.reframe({ frame: framing.frame, fit: framing.fit })
				: wallFace.reframe({ floor: framing.bounds, fit: framing.fit });
		if (outcome.kind === 'refused') {
			refusal = 'Camera could not re-frame this surface. Put back and try again.';
			return false;
		}
		if (refusal?.startsWith('Camera could not re-frame')) refusal = null;
		return true;
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
		framing = null;
		refusal = null;
		if (restoreFocus && returnTo && returnTo.isConnected) {
			queueMicrotask(() => returnTo.focus());
		}
		return true;
	}

	function clear(): void {
		active = null;
		framing = null;
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
		reframe,
		putBack,
		clear
	};
}

export type FinishAlign = ReturnType<typeof createFinishAlign>;
