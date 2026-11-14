/**
 * E8/G4 — the caster channel: one per Canvas, the observable record of when a
 * shadow caster appears, leaves, or starts and stops animating.
 *
 * Shadow maps depend on caster content. Most caster content is an identity the
 * Stage already watches (the compiled geometry, the resolved Scene, the approved
 * model URLs). A model's *arrival* is not: its GLB parses asynchronously after its
 * URL is known, so no identity changes when its meshes are added. The model
 * representation publishes that arrival here, and the shadow owner invalidates
 * once for it. Animation is the other case: a playing action moves a caster every
 * frame, so the shadow owner renders per frame only while `playing()` is non-zero.
 *
 * The channel carries facts, not decisions. It owns no renderer object and no
 * GPU resource, and a publish never mounts or disposes anything.
 */

export type CasterEvent =
	/** A caster's meshes are mounted and drawn. */
	| { readonly kind: 'arrived'; readonly entity: string }
	/** A caster's meshes were removed, or its instance was released. */
	| { readonly kind: 'released'; readonly entity: string }
	/** A caster stayed mounted but its drawn state changed (visibility, shadow flags). */
	| { readonly kind: 'changed'; readonly entity: string }
	/** An entity's animation started or stopped moving its casters. */
	| { readonly kind: 'animating'; readonly entity: string; readonly playing: boolean };

export type CasterChannel = {
	/** Report one event to every current listener, in subscription order. */
	publish(event: CasterEvent): void;
	/** Observe events from now on. Returns the unsubscribe. */
	subscribe(listener: (event: CasterEvent) => void): () => void;
	/** Entities whose animation is playing now. Zero when nothing moves. */
	playing(): number;
	/** Drop every listener and refuse further publishes. Idempotent. */
	dispose(): void;
};

export function createCasterChannel(): CasterChannel {
	let listeners: ((event: CasterEvent) => void)[] = [];
	const playingEntities = new Set<string>();
	let disposed = false;

	return {
		publish(event) {
			if (disposed) return;
			if (event.kind === 'animating') {
				if (event.playing) playingEntities.add(event.entity);
				else playingEntities.delete(event.entity);
			}
			// A snapshot: a listener that unsubscribes or subscribes during dispatch
			// does not change who hears this event.
			for (const listener of [...listeners]) listener(event);
		},

		subscribe(listener) {
			if (disposed) return () => {};
			listeners = [...listeners, listener];
			let subscribed = true;
			return () => {
				if (!subscribed) return;
				subscribed = false;
				listeners = listeners.filter((candidate) => candidate !== listener);
			};
		},

		playing() {
			return playingEntities.size;
		},

		dispose() {
			if (disposed) return;
			disposed = true;
			listeners = [];
			playingEntities.clear();
		}
	};
}
