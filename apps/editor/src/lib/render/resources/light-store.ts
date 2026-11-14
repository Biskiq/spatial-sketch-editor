/**
 * E10/R6 — the light store: the one realizer of world lights on a Canvas.
 *
 * `slices.md` R6 makes one `light-store` realize every resolved light
 * descriptor, so neither an authored-light component nor the Sky constructs a
 * Three light of its own. This module is that one construction site for Point,
 * Spot and the Sun, and the one place their properties are applied.
 *
 * Lifetime is explicit and per lease, like the material store, but a light is
 * never shared: a light is a placed scene object, so every `acquire` constructs
 * its own instance and every lease owns exactly one light.
 *
 * - **acquire** constructs a light for a descriptor and applies it.
 * - **update** re-applies a descriptor of the same kind *in place*: the same
 *   Light object, its shadow map and its target survive. An equal key is a no-op.
 *   A different kind is refused — the caller replaces (release, then acquire),
 *   so a kind change is always visible as a replacement.
 * - **release** detaches the light and its target and disposes it (its shadow
 *   map included). Idempotent. A released lease refuses further updates.
 *
 * The store is per Canvas (`render-resources.ts`): WebGL shadow maps cannot cross
 * contexts and no lease can free another Canvas's light. `dispose` releases
 * every lease still held and refuses further acquires.
 *
 * Applying a descriptor is exactly what the pre-E10 components did: a Point and
 * Spot sit at their holder's origin with the descriptor's colour, intensity,
 * range, decay, cone and shadow flag on Three's per-kind shadow defaults; a Spot
 * aims at its own target one metre down local −Z; the Sun takes its world
 * position, target and full shadow configuration, and its shadow camera's
 * projection is recomputed whenever the frustum is applied.
 */
import { DirectionalLight, PointLight, SpotLight } from 'three';
import { lightKey, type LightDescriptor, type LightKind } from './light-descriptor';

/** The realized light for each descriptor kind. */
export type RealizedLight<K extends LightKind = LightKind> = K extends 'point'
	? PointLight
	: K extends 'spot'
		? SpotLight
		: DirectionalLight;

export type LightLease<K extends LightKind = LightKind> = {
	readonly kind: K;
	/** The current descriptor key. */
	readonly key: string;
	readonly light: RealizedLight<K>;
	/**
	 * Apply a descriptor of the same kind in place. Returns false when the key is
	 * unchanged (nothing was touched). Throws on a different kind or a released lease.
	 */
	update(descriptor: Extract<LightDescriptor, { kind: K }>): boolean;
	/** Detach and dispose the light. Safe to call once or many times. */
	release(): void;
};

export type LightStoreStats = {
	/** Lights held now. */
	readonly live: number;
	/** Lights this store has constructed, monotone. */
	readonly created: number;
	/** Lights this store has disposed, monotone. */
	readonly disposed: number;
	/** In-place updates that changed a light, monotone. */
	readonly updated: number;
};

export type LightStore = {
	acquire<D extends LightDescriptor>(descriptor: D): LightLease<D['kind']>;
	stats(): LightStoreStats;
	/** Release every lease still held and refuse further acquires. Idempotent. */
	dispose(): void;
};

function construct(kind: LightKind): RealizedLight {
	switch (kind) {
		case 'point':
			return new PointLight();
		case 'spot': {
			const spot = new SpotLight();
			// Three places a new Spot at DEFAULT_UP (0, 1, 0); a realized Spot sits
			// exactly at its holder's origin.
			spot.position.set(0, 0, 0);
			// The aim: one metre down local −Z, a child of the light at its origin,
			// so the holder's authored rotation steers the cone.
			spot.target.position.set(0, 0, -1);
			spot.add(spot.target);
			return spot;
		}
		case 'sun':
			return new DirectionalLight();
	}
}

function apply(light: RealizedLight, descriptor: LightDescriptor): void {
	light.color.set(descriptor.color);
	light.intensity = descriptor.intensity;
	switch (descriptor.kind) {
		case 'point': {
			const point = light as PointLight;
			point.distance = descriptor.distance;
			point.decay = descriptor.decay;
			point.castShadow = descriptor.castShadow;
			return;
		}
		case 'spot': {
			const spot = light as SpotLight;
			spot.distance = descriptor.distance;
			spot.decay = descriptor.decay;
			spot.angle = descriptor.angle;
			spot.penumbra = descriptor.penumbra;
			spot.castShadow = descriptor.castShadow;
			return;
		}
		case 'sun': {
			const sun = light as DirectionalLight;
			const { shadow } = descriptor;
			sun.position.set(...descriptor.position);
			sun.castShadow = true;
			sun.shadow.mapSize.set(shadow.mapSize, shadow.mapSize);
			sun.shadow.bias = shadow.bias;
			sun.shadow.normalBias = shadow.normalBias;
			sun.shadow.radius = shadow.radius;
			const camera = sun.shadow.camera;
			camera.left = shadow.camera.left;
			camera.right = shadow.camera.right;
			camera.top = shadow.camera.top;
			camera.bottom = shadow.camera.bottom;
			camera.near = shadow.camera.near;
			camera.far = shadow.camera.far;
			camera.updateProjectionMatrix();
			sun.target.position.set(...descriptor.target);
			sun.target.updateMatrixWorld();
			sun.shadow.needsUpdate = true;
			return;
		}
	}
}

export function createLightStore(): LightStore {
	const held = new Set<{ release(): void }>();
	let created = 0;
	let disposedCount = 0;
	let updated = 0;
	let disposed = false;

	return {
		acquire<D extends LightDescriptor>(descriptor: D): LightLease<D['kind']> {
			if (disposed) throw new Error('light store is disposed');
			const kind = descriptor.kind as D['kind'];
			const light = construct(kind) as RealizedLight<D['kind']>;
			apply(light, descriptor);
			created += 1;
			let key = lightKey(descriptor);
			let released = false;
			const lease: LightLease<D['kind']> = {
				kind,
				get key() {
					return key;
				},
				light,
				update(next) {
					if (released) throw new Error('light lease is released');
					if (next.kind !== kind) {
						throw new Error(`light lease is a ${kind}; a ${next.kind} replaces it (release, then acquire)`);
					}
					const nextKey = lightKey(next);
					if (nextKey === key) return false;
					apply(light, next);
					key = nextKey;
					updated += 1;
					return true;
				},
				release() {
					if (released) return;
					released = true;
					held.delete(lease);
					light.removeFromParent();
					if (light instanceof DirectionalLight) light.target.removeFromParent();
					light.dispose();
					disposedCount += 1;
				}
			};
			held.add(lease);
			return lease;
		},
		stats() {
			return { live: held.size, created, disposed: disposedCount, updated };
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			for (const lease of [...held]) lease.release();
		}
	};
}
