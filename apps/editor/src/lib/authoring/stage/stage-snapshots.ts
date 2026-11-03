/**
 * R217.S28 — the Stage snapshot service (E10).
 *
 * Snapshots are a **derived render**: the Stage's own renderer draws the exact
 * authored View pose through `camera-core` into one reusable offscreen target.
 * They are never serialized, never a second WebGL context, and never a second
 * Camera: the renderer registers one function, cards request images, and the
 * cache is keyed by the exact pose and the accepted source revision.
 *
 * This module is host-neutral: it holds no Three object, so the slot component
 * and the renderer can be tested separately from a browser.
 */

export type SnapshotPose = {
	readonly eye: readonly [number, number, number];
	readonly target: readonly [number, number, number];
	readonly fovDegrees: number;
};

export type SnapshotRequest = {
	readonly viewId: string;
	readonly sourceRevision: string;
	readonly pose: SnapshotPose;
	/** The capture frame's aspect (16:10). */
	readonly aspect: number;
};

export type SnapshotRenderer = (request: SnapshotRequest) => Promise<string | null>;

/** The cache bound. Slots beyond it are re-rendered lazily rather than retained. */
export const SNAPSHOT_CACHE_LIMIT = 64;

let renderer: SnapshotRenderer | null = null;
let generation = 0;
const invalidationListeners = new Set<() => void>();
const availabilityListeners = new Set<() => void>();
const cache = new Map<string, string>();
const order: string[] = [];
const inflight = new Map<string, Promise<string | null>>();
/** One offscreen target means one render at a time, even across different poses. */
let renderQueue: Promise<void> = Promise.resolve();

/**
 * Exact-pose identity. The View id is deliberately absent: two Views at the
 * identical pose and aspect describe the identical image, while any difference
 * in the full-precision pose is a different image. `generation` invalidates
 * every cached identity when the host or scene is replaced.
 */
export function snapshotKey(request: SnapshotRequest): string {
	const { eye, target, fovDegrees } = request.pose;
	return [
		request.sourceRevision,
		generation,
		String(request.aspect),
		String(eye[0]),
		String(eye[1]),
		String(eye[2]),
		String(target[0]),
		String(target[1]),
		String(target[2]),
		String(fovDegrees)
	].join('|');
}

export function registerStageSnapshotRenderer(next: SnapshotRenderer | null): () => void {
	const previous = renderer;
	renderer = next;
	if (next !== null && previous !== next) invalidateStageSnapshots();
	if (next === null && previous !== null) invalidateStageSnapshots();
	if (next !== null) for (const listener of availabilityListeners) listener();
	return () => {
		if (renderer === next) {
			renderer = null;
			invalidateStageSnapshots();
		}
	};
}

/**
 * A slot that mounted before the Stage host did waits here instead of polling;
 * the callback fires immediately when a host is already registered.
 */
export function onStageSnapshotAvailability(listener: () => void): () => void {
	availabilityListeners.add(listener);
	if (renderer !== null) listener();
	return () => {
		availabilityListeners.delete(listener);
	};
}

export function stageSnapshotAvailable(): boolean {
	return renderer !== null;
}

/** Asset geometry, helper layers or the render host changed: new images are owed. */
export function invalidateStageSnapshots(): void {
	generation += 1;
	cache.clear();
	order.length = 0;
	inflight.clear();
	for (const listener of invalidationListeners) listener();
}

/** A visible slot clears its painted image when the scene it described changes. */
export function onStageSnapshotsInvalidated(listener: () => void): () => void {
	invalidationListeners.add(listener);
	return () => invalidationListeners.delete(listener);
}

export function clearStageSnapshotCache(): void {
	cache.clear();
	order.length = 0;
	inflight.clear();
}

function renderSerially(
	host: SnapshotRenderer,
	request: SnapshotRequest,
	requestGeneration: number
): Promise<string | null> {
	const run = renderQueue.then(() => {
		// A queued render whose host was replaced or whose scene changed is obsolete;
		// do not spend a frame drawing an image no slot may use.
		if (renderer !== host || generation !== requestGeneration) return null;
		return host(request);
	});
	renderQueue = run.then(
		() => undefined,
		() => undefined
	);
	return run;
}

/**
 * Ask for one snapshot. A slot that is not visible yet never calls this; a cached
 * image is returned synchronously as a resolved promise. The renderer restores
 * its own state, and a failed render resolves `null` so the slot keeps its
 * placeholder rather than showing a false image. Different poses share one
 * render target, so their renders are serialized rather than overlapped.
 */
export function requestStageSnapshot(request: SnapshotRequest): Promise<string | null> {
	const host = renderer;
	if (host === null) return Promise.resolve(null);
	const key = snapshotKey(request);
	const cached = cache.get(key);
	if (cached !== undefined) return Promise.resolve(cached);
	const pending = inflight.get(key);
	if (pending !== undefined) return pending;
	const requestGeneration = generation;
	const render = renderSerially(host, request, requestGeneration)
		.then((url) => {
			if (url === null || renderer !== host || generation !== requestGeneration) return null;
			if (url !== null) {
				cache.set(key, url);
				order.push(key);
				while (order.length > SNAPSHOT_CACHE_LIMIT) {
					const oldest = order.shift();
					if (oldest !== undefined) cache.delete(oldest);
				}
			}
			return url;
		})
		.catch(() => null)
		.finally(() => {
			inflight.delete(key);
		});
	inflight.set(key, render);
	return render;
}
