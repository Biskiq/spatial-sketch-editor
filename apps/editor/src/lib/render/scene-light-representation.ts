/**
 * The retained representation of authored Scene lights.
 *
 * Authored Point and Spot lights are items of the resolved light description,
 * realized by the Canvas `LightStore` and placed here, with the representation
 * contract every other retained family has:
 *
 * - **One root, mounted once.** `object3d` is never replaced.
 * - **Patched by key.** An unchanged item touches nothing. A moved item moves
 *   its holder. A changed light of the same kind is updated in place through its
 *   lease (same Light object, same shadow map). A changed kind is a replacement:
 *   the old lease is released before the new one is acquired.
 * - **Lights come from the store.** Nothing here constructs a light; a removed
 *   item releases its lease, and `dispose` releases every lease.
 *
 * The holder carries the entity's position, Euler rotation and uniform scale;
 * the light sits at its origin and a Spot aims down its local −Z (the store's
 * realization), so an authored rotation steers the cone.
 */
import { Group } from 'three';
import type { LightLease, LightStore } from './resources/light-store';
import type { SceneLightDescription, SceneLightItem } from './scene-light-description';

export type SceneLightRepresentationStats = {
	/** Light items after the update. */
	readonly items: number;
	/** Items that acquired a new light (new entities and kind replacements). */
	readonly built: number;
	/** Same-kind lights updated in place. */
	readonly updated: number;
	/** Of the built items, how many replaced a light of another kind. */
	readonly replaced: number;
	/** Holders moved without touching their light. */
	readonly moved: number;
	/** Items whose light and placement were both unchanged. */
	readonly retained: number;
	/** Items removed and released because the Scene no longer has them. */
	readonly released: number;
};

export type SceneLightRepresentation = {
	readonly object3d: Group;
	update(description: SceneLightDescription): SceneLightRepresentationStats;
	/** The holder placing this light, or null. */
	objectOf(id: string): Group | null;
	/** The realized light for this entity, or null. Observation only. */
	lightOf(id: string): LightLease['light'] | null;
	/** Release every lease. Idempotent. */
	dispose(): void;
};

type Entry = {
	readonly holder: Group;
	lease: LightLease<'point' | 'spot'>;
	key: string;
	placementKey: string;
};

function place(holder: Group, item: SceneLightItem): void {
	const { position, rotation, scale } = item.transform;
	holder.position.set(position[0], position[1], position[2]);
	holder.rotation.set(rotation[0], rotation[1], rotation[2]);
	holder.scale.set(scale[0], scale[1], scale[2]);
}

export function createSceneLightRepresentation(options: { readonly lights: LightStore }): SceneLightRepresentation {
	const { lights } = options;
	const root = new Group();
	root.name = 'SceneLights';
	const entries = new Map<string, Entry>();
	let last: SceneLightDescription | null = null;
	let disposed = false;

	function acquire(holder: Group, item: SceneLightItem): LightLease<'point' | 'spot'> {
		const lease = lights.acquire(item.light);
		holder.add(lease.light);
		return lease;
	}

	return {
		object3d: root,
		update(description) {
			if (disposed) throw new Error('scene light representation is disposed');
			const zero = { items: description.items.length, built: 0, updated: 0, replaced: 0, moved: 0, retained: 0, released: 0 };
			if (description === last) return { ...zero, retained: description.items.length };
			last = description;
			let built = 0;
			let updated = 0;
			let replaced = 0;
			let moved = 0;
			let retained = 0;
			let released = 0;
			const seen = new Set<string>();
			for (const item of description.items) {
				seen.add(item.id);
				const entry = entries.get(item.id);
				if (entry === undefined) {
					const holder = new Group();
					holder.name = `SceneLight:${item.id}`;
					place(holder, item);
					const lease = acquire(holder, item);
					root.add(holder);
					entries.set(item.id, { holder, lease, key: item.key, placementKey: item.placementKey });
					built += 1;
					continue;
				}
				let touched = false;
				if (entry.placementKey !== item.placementKey) {
					place(entry.holder, item);
					entry.placementKey = item.placementKey;
					moved += 1;
					touched = true;
				}
				if (entry.key !== item.key) {
					if (entry.lease.kind === item.light.kind) {
						(entry.lease as LightLease<typeof item.light.kind>).update(item.light as never);
						updated += 1;
					} else {
						entry.lease.release();
						entry.lease = acquire(entry.holder, item);
						built += 1;
						replaced += 1;
					}
					entry.key = item.key;
					touched = true;
				}
				if (!touched) retained += 1;
			}
			for (const [id, entry] of entries) {
				if (seen.has(id)) continue;
				entry.lease.release();
				entry.holder.removeFromParent();
				entries.delete(id);
				released += 1;
			}
			return { items: description.items.length, built, updated, replaced, moved, retained, released };
		},
		objectOf(id) {
			return entries.get(id)?.holder ?? null;
		},
		lightOf(id) {
			return entries.get(id)?.lease.light ?? null;
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			for (const entry of entries.values()) {
				entry.lease.release();
				entry.holder.removeFromParent();
			}
			entries.clear();
			last = null;
		}
	};
}
