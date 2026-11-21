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

export type InspectionRig = 'studio' | 'grazing';

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
