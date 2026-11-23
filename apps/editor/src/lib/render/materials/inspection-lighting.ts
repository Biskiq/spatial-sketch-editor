/**
 * Recipe 1's two reference lighting rigs.
 *
 * Studio is a first-party deterministic environment: a 128×64 equirectangular
 * linear radiance field evaluated at texel centres in Y-up space, base 0.024,
 * plus a white radiance-0.8 patch within 22° of normalized (−1,1,1) and radiance
 * 0.3 within 30° of (1,0,−1). It is prefiltered once per Canvas generation with
 * the renderer's PMREM and never mutated by project lighting.
 *
 * **Lighting version 2** (owner decision, 2026-11-20): every v1 studio radiance
 * (base 0.12, key 4, fill 1.5) scaled by 0.2. v1 clipped 11.6% of a roughness-0.2
 * metal sphere in final sRGB at exposure 1; v2 keeps exposure 1, sRGB output and
 * the strict highlight gate. Geometry, angles and directions are unchanged.
 *
 * Grazing is a single white directional light of intensity 2 from normalized
 * (1,0.12,0.25), white ambient 0.15, and no reflection map.
 *
 * The constants and the source texture are versioned: F reuses exactly these for
 * catalogue evidence, so changing them is a new preview-recipe version. The
 * optional `radianceScale` multiplies the versioned recipe and exists only for
 * the dev calibration gate; the product recipe always leaves it at 1.
 */
import {
	AmbientLight,
	DataTexture,
	DirectionalLight,
	EquirectangularReflectionMapping,
	Group,
	LinearFilter,
	LinearSRGBColorSpace,
	RGBAFormat,
	FloatType,
	Vector3,
	type Texture
} from 'three';
import { PMREMGenerator } from 'three/webgpu';

export const INSPECTION_LIGHTING_VERSION = 2 as const;
/** v2 = v1 studio radiances × this factor; recorded so G can cite the derivation. */
export const STUDIO_RADIANCE_SCALE_FROM_V1 = 0.2;
export const STUDIO_ENVIRONMENT_WIDTH = 128;
export const STUDIO_ENVIRONMENT_HEIGHT = 64;
export const STUDIO_BASE_RADIANCE = 0.024;
export const STUDIO_KEY_RADIANCE = 0.8;
export const STUDIO_KEY_DEGREES = 22;
export const STUDIO_FILL_RADIANCE = 0.3;
export const STUDIO_FILL_DEGREES = 30;
export const GRAZING_KEY_INTENSITY = 2;
export const GRAZING_AMBIENT_INTENSITY = 0.15;

/**
 * `sample-tile` is U1's product thumbnail rig (recipe `sample-tile/1`, see
 * `sample-tile.ts`). It is a third rig beside the two engineering references:
 * studio and grazing, their constants and their 192 px derivatives stay as E7
 * froze them.
 */
export type InspectionRig = 'studio' | 'grazing' | 'sample-tile' | 'library-studio';

/**
 * `library-studio` is U5's creator-facing Studio for Library detail and the
 * Customise… draft (recipe `library-studio/1`): a brighter neutral room so a
 * white ceramic, a dark matte and a glossy metal all read on a light backdrop.
 * E7's `studio` and `grazing` stay the frozen engineering references and U1's
 * `sample-tile` stays the browse thumbnail rig; any change here is a new
 * recipe version, never an edit in place.
 *
 * The field is a neutral room: a floor-to-ceiling ramp, a large soft key box
 * upper left in front, a broad fill on the right and a rim strip behind, so a
 * glossy sphere shows readable highlights and a sheen edge. One soft key light
 * from the same side gives matte relief. The backdrop is a warm light grey.
 */
export const LIBRARY_STUDIO_RECIPE = 'library-studio/1';
export const LIBRARY_STUDIO_BACKGROUND = '#e2dfd8';
export const LIBRARY_STUDIO_FLOOR_RADIANCE = 0.22;
export const LIBRARY_STUDIO_CEILING_RADIANCE = 0.55;
export const LIBRARY_STUDIO_KEY_RADIANCE = 2.2;
export const LIBRARY_STUDIO_KEY_DEGREES = 34;
export const LIBRARY_STUDIO_FILL_RADIANCE = 0.9;
export const LIBRARY_STUDIO_FILL_DEGREES = 42;
export const LIBRARY_STUDIO_RIM_RADIANCE = 1.2;
export const LIBRARY_STUDIO_RIM_DEGREES = 18;
export const LIBRARY_STUDIO_LIGHT_INTENSITY = 0.9;
export const LIBRARY_STUDIO_KEY_DIRECTION: readonly [number, number, number] = [-0.7, 0.75, 0.9];
export const LIBRARY_STUDIO_FILL_DIRECTION: readonly [number, number, number] = [1, 0.2, 0.6];
export const LIBRARY_STUDIO_RIM_DIRECTION: readonly [number, number, number] = [0.2, 0.5, -1];

/**
 * The sample-tile rig's constants. Any change to one is a new thumbnail recipe
 * version (`SAMPLE_TILE_RECIPE`), never an edit in place.
 *
 * A flat sample viewed from the front reflects the part of the environment near
 * +Z, so the field is a soft sky ramp plus a horizontal strip light whose
 * reflection crosses the upper part of a glossy sample as a sheen band, and one
 * raking key light from the upper left that gives relief to matte surfaces.
 */
export const SAMPLE_TILE_SKY_LOW = 0.05;
export const SAMPLE_TILE_SKY_HIGH = 0.2;
export const SAMPLE_TILE_STRIP_RADIANCE = 1.6;
/** Strip centre elevation above the horizon, and its soft half-width (radians). */
export const SAMPLE_TILE_STRIP_ELEVATION = 0.17;
export const SAMPLE_TILE_STRIP_SIGMA_ELEVATION = 0.07;
export const SAMPLE_TILE_STRIP_SIGMA_AZIMUTH = 0.9;
export const SAMPLE_TILE_KEY_INTENSITY = 2;
export const SAMPLE_TILE_KEY_DIRECTION: readonly [number, number, number] = [-0.55, 0.6, 0.58];

const KEY_DIRECTION = new Vector3(-1, 1, 1).normalize();
const FILL_DIRECTION = new Vector3(1, 0, -1).normalize();
const GRAZING_DIRECTION = new Vector3(1, 0.12, 0.25).normalize();

/**
 * The inverse of Three r187's `equirectUV(direction)`:
 *
 * `u = atan2(z, x) / 2π + 1/2`, `v = asin(y) / π + 1/2`.
 *
 * The old formulation used `u` as longitude directly and `+cos` for latitude,
 * which baked every patch at the antipode of the direction it named. Sampling
 * through the renderer's mapping must round-trip to the authored direction.
 */
function directionFor(u: number, v: number): Vector3 {
	const longitude = (u - 0.5) * Math.PI * 2;
	const latitude = (v - 0.5) * Math.PI;
	const cosLatitude = Math.cos(latitude);
	return new Vector3(
		cosLatitude * Math.cos(longitude),
		Math.sin(latitude),
		cosLatitude * Math.sin(longitude)
	);
}

/**
 * The 128×64 studio field as linear RGBA floats, in row-major equirectangular
 * order. Exported whole for the reference-chart test and for a CPU re-derivation
 * of the same rig.
 */
export function studioEnvironmentPixels(
	width = STUDIO_ENVIRONMENT_WIDTH,
	height = STUDIO_ENVIRONMENT_HEIGHT,
	radianceScale = 1
): Float32Array {
	const pixels = new Float32Array(width * height * 4);
	const direction = new Vector3();
	const keyCos = Math.cos((STUDIO_KEY_DEGREES * Math.PI) / 180);
	const fillCos = Math.cos((STUDIO_FILL_DEGREES * Math.PI) / 180);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			direction.copy(directionFor((x + 0.5) / width, (y + 0.5) / height));
			let radiance = STUDIO_BASE_RADIANCE * radianceScale;
			if (direction.dot(KEY_DIRECTION) >= keyCos) radiance += STUDIO_KEY_RADIANCE * radianceScale;
			if (direction.dot(FILL_DIRECTION) >= fillCos) radiance += STUDIO_FILL_RADIANCE * radianceScale;
			const offset = (y * width + x) * 4;
			pixels[offset] = radiance;
			pixels[offset + 1] = radiance;
			pixels[offset + 2] = radiance;
			pixels[offset + 3] = 1;
		}
	}
	return pixels;
}

/**
 * The sample-tile field as linear RGBA floats, row-major equirectangular like
 * the studio source: a sky ramp from the horizon up plus the strip light.
 */
export function sampleTileEnvironmentPixels(
	width = STUDIO_ENVIRONMENT_WIDTH,
	height = STUDIO_ENVIRONMENT_HEIGHT
): Float32Array {
	const pixels = new Float32Array(width * height * 4);
	const direction = new Vector3();
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			direction.copy(directionFor((x + 0.5) / width, (y + 0.5) / height));
			const up = Math.min(Math.max((direction.y + 0.35) / 1.25, 0), 1);
			const ramp = up * up * (3 - 2 * up);
			let radiance = SAMPLE_TILE_SKY_LOW + (SAMPLE_TILE_SKY_HIGH - SAMPLE_TILE_SKY_LOW) * ramp;
			const elevation = Math.asin(Math.min(Math.max(direction.y, -1), 1));
			const azimuth = Math.atan2(direction.x, direction.z);
			const dE = elevation - SAMPLE_TILE_STRIP_ELEVATION;
			radiance +=
				SAMPLE_TILE_STRIP_RADIANCE *
				Math.exp(-(dE * dE) / (2 * SAMPLE_TILE_STRIP_SIGMA_ELEVATION ** 2)) *
				Math.exp(-(azimuth * azimuth) / (2 * SAMPLE_TILE_STRIP_SIGMA_AZIMUTH ** 2));
			const offset = (y * width + x) * 4;
			pixels[offset] = radiance;
			pixels[offset + 1] = radiance;
			pixels[offset + 2] = radiance;
			pixels[offset + 3] = 1;
		}
	}
	return pixels;
}

/** The library-studio field as linear RGBA floats, row-major equirectangular. */
export function libraryStudioEnvironmentPixels(
	width = STUDIO_ENVIRONMENT_WIDTH,
	height = STUDIO_ENVIRONMENT_HEIGHT
): Float32Array {
	const pixels = new Float32Array(width * height * 4);
	const direction = new Vector3();
	const key = new Vector3(...LIBRARY_STUDIO_KEY_DIRECTION).normalize();
	const fill = new Vector3(...LIBRARY_STUDIO_FILL_DIRECTION).normalize();
	const rim = new Vector3(...LIBRARY_STUDIO_RIM_DIRECTION).normalize();
	const keyCos = Math.cos((LIBRARY_STUDIO_KEY_DEGREES * Math.PI) / 180);
	const fillCos = Math.cos((LIBRARY_STUDIO_FILL_DEGREES * Math.PI) / 180);
	const rimCos = Math.cos((LIBRARY_STUDIO_RIM_DEGREES * Math.PI) / 180);
	// A soft edge (smoothstep over the outer quarter of each patch's cosine span).
	const soft = (dot: number, edge: number): number => {
		const t = Math.min(Math.max((dot - edge) / ((1 - edge) * 0.25), 0), 1);
		return t * t * (3 - 2 * t);
	};
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			direction.copy(directionFor((x + 0.5) / width, (y + 0.5) / height));
			const up = (direction.y + 1) / 2;
			let radiance =
				LIBRARY_STUDIO_FLOOR_RADIANCE + (LIBRARY_STUDIO_CEILING_RADIANCE - LIBRARY_STUDIO_FLOOR_RADIANCE) * up;
			radiance += LIBRARY_STUDIO_KEY_RADIANCE * soft(direction.dot(key), keyCos);
			radiance += LIBRARY_STUDIO_FILL_RADIANCE * soft(direction.dot(fill), fillCos);
			radiance += LIBRARY_STUDIO_RIM_RADIANCE * soft(direction.dot(rim), rimCos);
			const offset = (y * width + x) * 4;
			pixels[offset] = radiance;
			pixels[offset + 1] = radiance;
			pixels[offset + 2] = radiance;
			pixels[offset + 3] = 1;
		}
	}
	return pixels;
}

function createLibraryStudioEnvironmentTexture(): DataTexture {
	return environmentTexture(libraryStudioEnvironmentPixels());
}

function environmentTexture(pixels: Float32Array): DataTexture {
	const texture = new DataTexture(pixels, STUDIO_ENVIRONMENT_WIDTH, STUDIO_ENVIRONMENT_HEIGHT, RGBAFormat, FloatType);
	texture.mapping = EquirectangularReflectionMapping;
	texture.colorSpace = LinearSRGBColorSpace;
	texture.minFilter = LinearFilter;
	texture.magFilter = LinearFilter;
	texture.generateMipmaps = false;
	texture.needsUpdate = true;
	return texture;
}

function createSampleTileEnvironmentTexture(): DataTexture {
	const texture = new DataTexture(
		sampleTileEnvironmentPixels(),
		STUDIO_ENVIRONMENT_WIDTH,
		STUDIO_ENVIRONMENT_HEIGHT,
		RGBAFormat,
		FloatType
	);
	texture.mapping = EquirectangularReflectionMapping;
	texture.colorSpace = LinearSRGBColorSpace;
	texture.minFilter = LinearFilter;
	texture.magFilter = LinearFilter;
	texture.generateMipmaps = false;
	texture.needsUpdate = true;
	return texture;
}

/** The unprefiltered studio source, linear and equirectangular. */
export function createStudioEnvironmentTexture(radianceScale = 1): DataTexture {
	const texture = new DataTexture(
		studioEnvironmentPixels(STUDIO_ENVIRONMENT_WIDTH, STUDIO_ENVIRONMENT_HEIGHT, radianceScale),
		STUDIO_ENVIRONMENT_WIDTH,
		STUDIO_ENVIRONMENT_HEIGHT,
		RGBAFormat,
		FloatType
	);
	texture.mapping = EquirectangularReflectionMapping;
	texture.colorSpace = LinearSRGBColorSpace;
	texture.minFilter = LinearFilter;
	texture.magFilter = LinearFilter;
	texture.generateMipmaps = false;
	texture.needsUpdate = true;
	return texture;
}

export type InspectionLighting = {
	readonly rig: InspectionRig;
	readonly group: Group;
	/** The prefiltered environment, when the rig uses one. */
	environment(renderer: unknown): Texture | null;
	dispose(): void;
};

/** One rig's lights and source; PMREM is lazy and owned by the caller's generation. */
export function createInspectionLighting(
	rig: InspectionRig,
	options: { readonly radianceScale?: number } = {}
): InspectionLighting {
	const group = new Group();
	group.name = `InspectionLighting:${rig}`;
	let source: DataTexture | null = null;
	let prefiltered: { readonly texture: Texture; dispose(): void } | null = null;
	let generator: PMREMGenerator | null = null;

	if (rig === 'grazing') {
		const ambient = new AmbientLight(0xffffff, GRAZING_AMBIENT_INTENSITY);
		const key = new DirectionalLight(0xffffff, GRAZING_KEY_INTENSITY);
		key.position.copy(GRAZING_DIRECTION).multiplyScalar(10);
		key.target.position.set(0, 0, 0);
		group.add(ambient, key, key.target);
	} else if (rig === 'sample-tile' || rig === 'library-studio') {
		// Both product rigs pair a soft environment with one key at a fixed direction.
		const tile = rig === 'sample-tile';
		source = tile ? createSampleTileEnvironmentTexture() : createLibraryStudioEnvironmentTexture();
		const key = new DirectionalLight(0xffffff, tile ? SAMPLE_TILE_KEY_INTENSITY : LIBRARY_STUDIO_LIGHT_INTENSITY);
		key.position.set(...(tile ? SAMPLE_TILE_KEY_DIRECTION : LIBRARY_STUDIO_KEY_DIRECTION)).normalize().multiplyScalar(10);
		key.target.position.set(0, 0, 0);
		group.add(key, key.target);
	} else {
		source = createStudioEnvironmentTexture(options.radianceScale ?? 1);
	}

	return {
		rig,
		group,
					environment(renderer) {
			if (rig === 'grazing' || source === null) return null;
			if (prefiltered !== null) return prefiltered.texture;
			generator = new PMREMGenerator(renderer as never);
			prefiltered = generator.fromEquirectangular(source);
			return prefiltered.texture;
		},
		dispose() {
			source?.dispose();
			source = null;
			prefiltered?.dispose();
			prefiltered = null;
			generator?.dispose();
			generator = null;
		}
	};
}

/** Whether a rig needs an environment map; grazing explicitly uses none. */
export function inspectionRigUsesReflection(rig: InspectionRig): boolean {
	return rig === 'studio';
}
