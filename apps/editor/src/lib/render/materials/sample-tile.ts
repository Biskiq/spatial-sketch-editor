/**
 * The product material thumbnail: a flat, lit **sample tile**.
 *
 * Recipe `sample-tile/1` draws one Finish as a front-on square window onto the
 * material, in the inspection host, on the inspection plane geometry, lit by the
 * `sample-tile` rig: a soft sky, a horizontal strip light whose reflection
 * crosses the upper part of a glossy sample as a sheen band, and one raking
 * key light that gives matte relief. The frame is the window, edge to edge,
 * with no background and no rim, so every pixel is material.
 *
 * The window is a **physical size in metres** (a few boards, one brick course,
 * a few linen threads), never a repeat count: a 3.4 m parquet tile shown whole
 * turns to noise at 56 px. The window and its centre are framing hints. They
 * live outside the Finish recipe, in the catalogue's presentation table, and a
 * project or imported Finish derives its window from its tile size. They are
 * part of the thumbnail's key, never of the recipe's identity.
 *
 * One 256 px master is rendered per Finish. XS, S and M derive from it (see
 * `sample-tile-derivatives.ts`), so opening a list never opens a full-resolution
 * texture. The inspection recipe 2 sphere and its 192 px references stay as engineering
 * references; this recipe has its own key.
 */
import { BufferGeometry, PlaneGeometry } from 'three';
import type { Mapping } from '@portfolio/project-model/materials';
import {
	INSPECTION_THUMBNAIL_EXPOSURE,
	INSPECTION_THUMBNAIL_PROFILE,
	INSPECTION_VERSION,
	inspectionPose,
	stableHash,
} from './inspection';
import { INSPECTION_GEOMETRY_VERSION } from './inspection-geometry';

/** Any change to the rig, pose, window rule or key is a new number here. */
export const SAMPLE_TILE_RECIPE = 'sample-tile/1' as const;
/** The one stored master, and the G slot's edge. */
export const SAMPLE_TILE_MASTER_SIZE = 256;

/** The rig this recipe lights with (a lighting-module name, versioned by the recipe). */
export const SAMPLE_TILE_RIG = 'sample-tile' as const;

export const SAMPLE_TILE_MIN_WINDOW_METERS = 0.05;
export const SAMPLE_TILE_MAX_WINDOW_METERS = 2;
const DEFAULT_WINDOW_FRACTION = 0.4;
/** The world size of the plane; the camera sees less, and the UV range is fitted to what it sees. */
const PLANE_HALF = 1;

/**
 * A framing hint: the physical window the thumbnail shows and where its centre
 * sits on the tile, in tile fractions (0.5 is the middle).
 */
export type SampleTileFraming = {
	readonly windowMeters: number;
	readonly centre?: readonly [number, number];
};

function clampWindow(meters: number): number {
	return Math.min(SAMPLE_TILE_MAX_WINDOW_METERS, Math.max(SAMPLE_TILE_MIN_WINDOW_METERS, meters));
}

/**
 * The window of a Finish with no authored hint: 40% of its smaller tile edge,
 * within 5 cm to 2 m. Deterministic from the effective tile size alone.
 */
export function defaultSampleTileFraming(
	tileMeters: readonly [number, number] | null,
): SampleTileFraming {
	if (tileMeters === null) return { windowMeters: 0.4 };
	const edge = Math.min(tileMeters[0], tileMeters[1]);
	return { windowMeters: clampWindow(Math.round(edge * DEFAULT_WINDOW_FRACTION * 1000) / 1000) };
}

/** The tile a Finish's mapping repeats at, or null when it has no metric (a native UV repeat). */
export function mappingTileMeters(mapping: Mapping): readonly [number, number] | null {
	return mapping.kind === 'uv' ? null : mapping.metric.tileMeters;
}

/** A hint made safe: a finite window within bounds, a centre within the tile. */
export function normalizeSampleTileFraming(
	framing: SampleTileFraming,
): Required<SampleTileFraming> {
	const centre = framing.centre ?? [0.5, 0.5];
	const unit = (value: number): number =>
		Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
	return {
		windowMeters: clampWindow(Number.isFinite(framing.windowMeters) ? framing.windowMeters : 0.4),
		centre: [unit(centre[0]), unit(centre[1])],
	};
}

/** The pixel-affecting facts the window contributes to a thumbnail key. */
export function sampleTileFramingKey(framing: SampleTileFraming): string {
	const { windowMeters, centre } = normalizeSampleTileFraming(framing);
	return `window=${windowMeters.toFixed(4)}@${centre[0].toFixed(3)},${centre[1].toFixed(3)}`;
}

/**
 * The sample tile's key. It hashes the effective untreated recipe identity,
 * the thumbnail recipe, the window, the size and every inspection version that
 * can change pixels, so a recipe change leaves no stale picture and nothing
 * scope-private reaches it.
 */
export function sampleTileKey(input: {
	readonly recipeKey: string;
	readonly framing: SampleTileFraming;
	readonly width?: number;
	readonly height?: number;
	readonly lightingVersion: number;
}): string {
	const width = Math.round(input.width ?? SAMPLE_TILE_MASTER_SIZE);
	const height = Math.round(input.height ?? input.width ?? SAMPLE_TILE_MASTER_SIZE);
	const text = [
		SAMPLE_TILE_RECIPE,
		`inspection@${INSPECTION_VERSION}`,
		`lighting@${input.lightingVersion}`,
		`geometry@${INSPECTION_GEOMETRY_VERSION}`,
		input.recipeKey,
		sampleTileFramingKey(input.framing),
		`${width}x${height}`,
		`exposure=${INSPECTION_THUMBNAIL_EXPOSURE}`,
		INSPECTION_THUMBNAIL_PROFILE,
	].join('|');
	return `tile-${stableHash(text)}`;
}

/** The metric facts a sample tile binds against: one UV unit is the window, in metres. */
export function sampleTileMetricFacts(framing: SampleTileFraming): {
	readonly uvMeters: readonly [number, number];
	readonly surfaceMeters: readonly [number, number];
} {
	const { windowMeters } = normalizeSampleTileFraming(framing);
	return { uvMeters: [windowMeters, windowMeters], surfaceMeters: [windowMeters, windowMeters] };
}

/**
 * The window plane. It is larger than the camera sees (so no background shows
 * at the edges) and its UV0 is fitted so the **visible** square is exactly one
 * window of `windowMeters`, centred where the hint says. `tileMeters` places the
 * centre: the window starts at `centre × tile − window / 2` metres.
 */
export function createSampleTileGeometry(
	framing: SampleTileFraming,
	tileMeters: readonly [number, number] | null,
): BufferGeometry {
	const { windowMeters, centre } = normalizeSampleTileFraming(framing);
	const { eye, fovYDegrees } = inspectionPose('plane');
	const distance = Math.hypot(...eye);
	const visibleHalf = distance * Math.tan((fovYDegrees * Math.PI) / 360);
	const uvHalf = PLANE_HALF / (2 * visibleHalf);
	const shift = (axis: 0 | 1): number => {
		const tile = tileMeters?.[axis];
		return tile === undefined ? 0 : (centre[axis] * tile - windowMeters / 2) / windowMeters;
	};
	const geometry = new PlaneGeometry(2 * PLANE_HALF, 2 * PLANE_HALF, 1, 1);
	const position = geometry.getAttribute('position');
	const uv = geometry.getAttribute('uv');
	for (let index = 0; index < position.count; index += 1) {
		const sx = Math.sign(position.getX(index));
		const sy = Math.sign(position.getY(index));
		uv.setXY(index, 0.5 + shift(0) + sx * uvHalf, 0.5 + shift(1) + sy * uvHalf);
	}
	uv.needsUpdate = true;
	return geometry;
}
