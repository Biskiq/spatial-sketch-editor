/**
 * Resolved light descriptors: what a light is, never how it is built.
 *
 * Every world light goes through the resolved look: a pure function produces a
 * descriptor and one Canvas-scoped store realizes it. A
 * descriptor is plain, frozen, portable data — no Three object, no import — so
 * it can be compared, keyed and tested without a renderer, exactly like a
 * material descriptor (`material-descriptor.ts`).
 *
 * The kinds are the T2 kinds and nothing more: an authored **Point** and
 * **Spot**, and the Sky's one **Sun**. Authored Directional is retired (Scene
 * format 7); the Sun is not an authored kind and is never reachable from
 * a Scene entity.
 *
 * Units are the approved T2 pipeline units (Gate A), stated rather than implied: Point and Spot
 * intensity is candela with physical inverse-square `decay` 2 (Three's physical
 * mode, the only mode r187 has), `distance` 0 is unbounded, a cone is radians;
 * the Sun's intensity is lux. The store applies exactly these values.
 *
 * Shadows. A Point or Spot carries only its authored shadow flag; its shadow map
 * keeps Three's per-kind defaults (T2 approved no other configuration). The Sun
 * carries its complete shadow configuration — map size, biases, blur radius and
 * the orthographic camera frustum fitted to the World — because the Sky decides
 * all of it.
 */

export type LightVec3 = readonly [number, number, number];

/** Physical inverse-square falloff, the only decay T2 uses. */
export const PHYSICAL_LIGHT_DECAY = 2;

export type PointLightDescriptor = {
	readonly kind: 'point';
	/** sRGB CSS colour. */
	readonly color: string;
	/** Candela. */
	readonly intensity: number;
	/** Metres; 0 is unbounded. */
	readonly distance: number;
	readonly decay: number;
	readonly castShadow: boolean;
};

/**
 * A Spot aims down the local −Z axis of whatever holds it, so an authored
 * rotation steers it; the target is part of the realized light, not data.
 */
export type SpotLightDescriptor = {
	readonly kind: 'spot';
	readonly color: string;
	readonly intensity: number;
	readonly distance: number;
	readonly decay: number;
	/** Half-angle, radians. */
	readonly angle: number;
	readonly penumbra: number;
	readonly castShadow: boolean;
};

export type SunShadowDescriptor = {
	/** Square shadow-map size in texels. */
	readonly mapSize: number;
	readonly bias: number;
	readonly normalBias: number;
	readonly radius: number;
	/** The orthographic shadow camera's frustum, in the light's view space. */
	readonly camera: {
		readonly left: number;
		readonly right: number;
		readonly top: number;
		readonly bottom: number;
		readonly near: number;
		readonly far: number;
	};
};

/** The Sky's one Sun. It always casts; position and target are world space. */
export type SunLightDescriptor = {
	readonly kind: 'sun';
	readonly color: string;
	/** Lux. */
	readonly intensity: number;
	readonly position: LightVec3;
	readonly target: LightVec3;
	readonly shadow: SunShadowDescriptor;
};

export type LightDescriptor = PointLightDescriptor | SpotLightDescriptor | SunLightDescriptor;
export type LightKind = LightDescriptor['kind'];

function vec(value: LightVec3): string {
	return `${value[0]},${value[1]},${value[2]}`;
}

/**
 * The canonical key of a descriptor: equal keys are the same realized light.
 * Fields are written in a fixed order so a key never depends on how a
 * descriptor object was spelled.
 */
export function lightKey(descriptor: LightDescriptor): string {
	switch (descriptor.kind) {
		case 'point':
			return `point|${descriptor.color}|${descriptor.intensity}|${descriptor.distance}|${descriptor.decay}|${descriptor.castShadow}`;
		case 'spot':
			return `spot|${descriptor.color}|${descriptor.intensity}|${descriptor.distance}|${descriptor.decay}|${descriptor.angle}|${descriptor.penumbra}|${descriptor.castShadow}`;
		case 'sun': {
			const { shadow } = descriptor;
			const camera = shadow.camera;
			return [
				'sun',
				descriptor.color,
				descriptor.intensity,
				vec(descriptor.position),
				vec(descriptor.target),
				shadow.mapSize,
				shadow.bias,
				shadow.normalBias,
				shadow.radius,
				camera.left,
				camera.right,
				camera.top,
				camera.bottom,
				camera.near,
				camera.far
			].join('|');
		}
	}
}
