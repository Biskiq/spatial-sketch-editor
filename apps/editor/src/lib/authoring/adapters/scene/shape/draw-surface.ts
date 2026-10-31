/**
 * The one live object-draw session, for the Objects panel to read.
 *
 * The session belongs to the Scene binding, and an install replaces the binding
 * while the panel stays mounted. The same publish-and-read shape the Scene surface
 * uses; the revision is what the panel's subscription watches.
 */
import type { ObjectDrawSession } from './draw-session';

let current: ObjectDrawSession | null = null;
const listeners = new Set<() => void>();

/** Publish a session; a retiring one only clears itself, never its replacement. */
export function publishObjectDraw(next: ObjectDrawSession | null, retiring?: ObjectDrawSession): void {
	if (next === null && retiring !== current) return;
	current = next;
	for (const listener of listeners) listener();
}

export function objectDrawSession(): ObjectDrawSession | null {
	return current;
}

export function subscribeObjectDraw(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
