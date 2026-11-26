/**
 * The product's Finish pictures (U1): catalogue, project and private-library
 * Finishes drawn as a flat, lit sample tile.
 *
 * One service per Stage. It owns three things and nothing else:
 *
 * 1. **Where a master comes from.** A catalogue entry with a current committed
 *  master (`catalogue-tiles.ts`) opens that one 256 px PNG and never a
 *  texture. Any other Finish, and a catalogue entry whose master is stale, is
 *  drawn by the E7 inspection host the Stage registers; with no host yet it
 *  has no picture and the shelf keeps its colour swatch.
 * 2. **Derivatives.** XS, S and M are made from the master in the browser and
 *  held as object URLs, keyed by the tile's key and size.
 * 3. **Isolation and failure.** A project Finish's pictures live under its
 *  texture scope's id, so a scope is never served another's; only successful
 *  outputs are cached, a failure or refusal is `null`, and the caller's
 *  swatch is the fallback.
 *
 * The master's *key* is the picture's identity: a recipe, pin or framing change
 * makes a new key, so an old picture is never served for a new Finish.
 */
import type { MaterialId } from '$lib/types/materials';
import { catalogueTile } from './catalogue-tiles';
import { materialThumbnailFraming } from '$lib/content/material-presentation';
import type { InspectionSubject } from './inspection-subject';
import type { InspectionRequest, InspectionState, InspectionThumbnail } from './inspection-host';
import { resolveSampleTile } from './sample-tile-resolve';
import { deriveTile, tileDerivativeFor, type TileDerivative } from './sample-tile-derivatives';
import { SAMPLE_TILE_MASTER_SIZE, type SampleTileFraming } from './sample-tile';

export type FinishTileSubject = Extract<InspectionSubject, { kind: 'finish' }>;

export type FinishTileSource =
	| { readonly kind: 'catalogue'; readonly id: MaterialId }
	| { readonly kind: 'finish'; readonly subject: FinishTileSubject }
	| { readonly kind: 'draft'; readonly subject: Extract<InspectionSubject, { kind: 'draft' }> };

/** Draw one master through the Stage's inspection host. */
export type FinishTileRender = (
	request: { readonly subject: InspectionSubject; readonly framing: SampleTileFraming | 'default' },
	signal?: AbortSignal,
) => Promise<InspectionThumbnail>;

/**
 * The Stage's one interactive inspection (Library detail and the Material
 * editor). A new observation replaces the previous one; the returned stop
 * releases it. Null while no Stage renderer is registered.
 */
export type FinishTileInspect = ((
	request: InspectionRequest,
	onState: (state: InspectionState) => void,
) => () => void) & {
	readonly retry?: () => void;
};

/**
 * A held picture. The URL stays valid until `release`: eviction, a scope
 * forget or a newer picture never revokes a URL some tile still shows.
 */
export type FinishTileLease = {
	readonly url: string;
	readonly key: string;
	/** Idempotent. The last release of a retired picture revokes its object URL. */
	release(): void;
};

type Master = { readonly key: string; readonly bytes: Blob; readonly uri?: string };
type Picture = { readonly url: string; readonly key: string };

/** Shared work: aborted only when its last holder leaves, never by one holder's cancel. */
type Job<T> = {
	readonly promise: Promise<T | null>;
	holders: number;
	settled: boolean;
	readonly controller: AbortController;
	/** The last holder left an unfinished job: the owner forgets it, so the next ask starts fresh. */
	onAbandon?: () => void;
};

type Entry = {
	job: Job<Picture>;
	/** Set once the picture exists; null while drawing or after a failure. */
	url: string | null;
	key: string;
	/** The URL is an object URL this service must revoke (a catalogue master's static URL is not). */
	owned: boolean;
	refs: number;
	/** Leases awaiting this picture that have not yet taken (or declined) it. */
	waiters: number;
	/** Left the cache (evicted, forgotten or disposed): no new holder, revoked at the last release. */
	dead: boolean;
	revoked: boolean;
};

const PICTURE_LIMIT = 192;
const MASTER_LIMIT = 64;
/** Draws in flight at once. The host has one lane; two keeps it fed without a backlog of open jobs. */
export const FINISH_TILE_RENDER_CONCURRENCY = 2;

/** The cache namespace: a catalogue picture is shared, a project one is its scope's. */
function namespaceOf(source: FinishTileSource): string {
	if (source.kind === 'catalogue') return 'catalogue';
	if (source.kind === 'draft') return 'draft';
	return `scope:${source.subject.scope.scopeId}`;
}

function subjectOf(source: FinishTileSource): InspectionSubject {
	return source.kind === 'catalogue' ? { kind: 'catalogue', id: source.id } : source.subject;
}

function framingOf(source: FinishTileSource): SampleTileFraming | 'default' {
	return source.kind === 'catalogue'
		? (materialThumbnailFraming[source.id] ?? 'default')
		: 'default';
}

function startJob<T>(run: (signal: AbortSignal) => Promise<T | null>): Job<T> {
	const controller = new AbortController();
	const job: Job<T> = {
		promise: Promise.resolve(null),
		holders: 0,
		settled: false,
		controller,
	};
	(job as { promise: Promise<T | null> }).promise = run(controller.signal)
		.catch(() => null)
		.then((value) => {
			job.settled = true;
			return value;
		});
	return job;
}

/** Join a job. A cancelled holder gets null at once; the last one out aborts the job. */
function hold<T>(job: Job<T>, signal?: AbortSignal): Promise<T | null> {
	if (signal?.aborted) return Promise.resolve(null);
	job.holders += 1;
	return new Promise((resolve) => {
		let left = false;
		const leave = (): void => {
			if (left) return;
			left = true;
			signal?.removeEventListener('abort', onAbort);
			job.holders -= 1;
		};
		const onAbort = (): void => {
			leave();
			if (job.holders === 0 && !job.settled) {
				job.controller.abort();
				job.onAbandon?.();
			}
			resolve(null);
		};
		signal?.addEventListener('abort', onAbort, { once: true });
		void job.promise.then((value) => {
			leave();
			resolve(value);
		});
	});
}

export type FinishTiles = ReturnType<typeof createFinishTiles>;

export function createFinishTiles(
	options: {
		readonly fetchMaster?: (uri: string, signal?: AbortSignal) => Promise<Blob | null>;
	} = {},
) {
	const fetchMaster =
		options.fetchMaster ??
		(async (uri: string, signal?: AbortSignal) => {
			const response = await fetch(uri, { signal });
			return response.ok ? await response.blob() : null;
		});

	let render: FinishTileRender | null = null;
	let inspector: FinishTileInspect | null = null;
	/** Bumps when a renderer registers or leaves, so pending pictures retry. */
	let epoch = $state(0);
	let disposed = false;

	const masters = new Map<string, Job<Master>>();
	const pictures = new Map<string, Entry>();

	// Draw slots: a shelf of many project Finishes queues here, not in the host.
	let drawing = 0;
	let peakDrawing = 0;
	const waiting: Array<(release: (() => void) | null) => void> = [];

	function grant(): () => void {
		drawing += 1;
		peakDrawing = Math.max(peakDrawing, drawing);
		let freed = false;
		return () => {
			if (freed) return;
			freed = true;
			drawing -= 1;
			waiting.shift()?.(grant());
		};
	}

	function acquireSlot(signal: AbortSignal): Promise<(() => void) | null> {
		if (signal.aborted) return Promise.resolve(null);
		if (drawing < FINISH_TILE_RENDER_CONCURRENCY) return Promise.resolve(grant());
		return new Promise((resolve) => {
			const turn = (release: (() => void) | null): void => {
				signal.removeEventListener('abort', onAbort);
				resolve(release);
			};
			const onAbort = (): void => {
				const index = waiting.indexOf(turn);
				if (index >= 0) waiting.splice(index, 1);
				resolve(null);
			};
			signal.addEventListener('abort', onAbort, { once: true });
			waiting.push(turn);
		});
	}

	function revoke(entry: Entry): void {
		if (entry.revoked) return;
		entry.revoked = true;
		if (entry.owned && entry.url !== null) URL.revokeObjectURL(entry.url);
	}

	/** A retired picture's URL goes once no lease holds it and no waiter is about to take it. */
	function reap(entry: Entry): void {
		if (entry.dead && entry.refs === 0 && entry.waiters === 0) revoke(entry);
	}

	/**
	 * Leave the cache. In use: the URL lives until its last release. Eviction
	 * only cancels a draw nobody waits for; a forget or dispose (`cancel`) stops
	 * it regardless, because its textures are gone.
	 */
	function retire(entry: Entry, cancel = false): void {
		entry.dead = true;
		if (!entry.job.settled && (cancel || entry.job.holders === 0)) entry.job.controller.abort();
		reap(entry);
	}

	function remember<T>(
		map: Map<string, T>,
		key: string,
		value: T,
		limit: number,
		release?: (value: T) => void,
	): void {
		map.delete(key);
		map.set(key, value);
		while (map.size > limit) {
			const oldest = map.keys().next().value as string;
			const evicted = map.get(oldest);
			map.delete(oldest);
			if (release !== undefined && evicted !== undefined) release(evicted);
		}
	}

	/** The key a source's picture will carry, without drawing it. */
	function keyOf(source: FinishTileSource): string | null {
		if (source.kind === 'catalogue') {
			const current = catalogueTile(source.id);
			if (current !== undefined) return current.key;
		}
		return resolveSampleTile(subjectOf(source), framingOf(source)).key;
	}

	async function masterOf(source: FinishTileSource, signal: AbortSignal): Promise<Master | null> {
		if (source.kind === 'catalogue') {
			const current = catalogueTile(source.id);
			if (current !== undefined) {
				const bytes = await fetchMaster(current.uri, signal);
				return bytes === null ? null : { key: current.key, bytes, uri: current.uri };
			}
		}
		// A project Finish, or a catalogue entry whose committed master is stale.
		const release = await acquireSlot(signal);
		if (release === null) return null;
		try {
			const draw = render;
			if (draw === null || signal.aborted) return null;
			const result = await draw({ subject: subjectOf(source), framing: framingOf(source) }, signal);
			if (result.status !== 'ready') return null;
			return { key: result.key, bytes: new Blob([result.png as BlobPart], { type: 'image/png' }) };
		} finally {
			release();
		}
	}

	function entryOf(
		source: FinishTileSource,
		cssPx: number,
		devicePixelRatio: number,
	): Entry | null {
		if (disposed) return null;
		const derivative: TileDerivative = tileDerivativeFor(cssPx, devicePixelRatio);
		const namespace = namespaceOf(source);
		const key = keyOf(source);
		if (key === null) return null;
		const pictureKey = `${namespace}|${key}|${derivative.edge}`;
		const hit = pictures.get(pictureKey);
		if (hit !== undefined) {
			remember(pictures, pictureKey, hit, PICTURE_LIMIT, retire);
			return hit;
		}
		const masterKey = `${namespace}|${key}`;
		const entry: Entry = {
			job: undefined as never,
			url: null,
			key,
			owned: false,
			refs: 0,
			waiters: 0,
			dead: false,
			revoked: false,
		};
		entry.job = startJob<Picture>(async (signal) => {
			let master = masters.get(masterKey);
			if (master === undefined) {
				master = startJob((s) => masterOf(source, s));
				masters.set(masterKey, master);
				const made = master;
				made.onAbandon = () => {
					if (masters.get(masterKey) === made) masters.delete(masterKey);
				};
				void made.promise.then((value) => {
					// Only a success stays: a failure or a cancel is asked again.
					if (value === null && masters.get(masterKey) === made) masters.delete(masterKey);
				});
				while (masters.size > MASTER_LIMIT) masters.delete(masters.keys().next().value as string);
			}
			const found = await hold(master, signal);
			if (found === null) return null;
			// Cancelled (last waiter left, forgotten or disposed) while drawing: make
			// nothing that nobody could revoke. An evicted draw with waiters goes on.
			entry.key = found.key;
			const alive = (): boolean => !disposed && !signal.aborted;
			if (!alive()) return null;
			// M is the master itself; a catalogue master is served by its own URL.
			if (derivative.edge === SAMPLE_TILE_MASTER_SIZE) {
				const url = found.uri ?? URL.createObjectURL(found.bytes);
				entry.owned = found.uri === undefined;
				entry.url = url;
				return { url, key: found.key };
			}
			if (typeof createImageBitmap === 'undefined') return null;
			const bitmap = await createImageBitmap(found.bytes);
			try {
				const blob = await deriveTile(bitmap, derivative);
				if (blob === null || !alive()) return null;
				const url = URL.createObjectURL(blob);
				entry.owned = true;
				entry.url = url;
				return { url, key: found.key };
			} finally {
				bitmap.close();
			}
		});
		entry.job.onAbandon = () => {
			if (pictures.get(pictureKey) === entry) pictures.delete(pictureKey);
			entry.dead = true;
		};
		remember(pictures, pictureKey, entry, PICTURE_LIMIT, retire);
		void entry.job.promise.then((result) => {
			if (result === null && pictures.get(pictureKey) === entry) {
				pictures.delete(pictureKey);
				entry.dead = true;
			}
		});
		return entry;
	}

	function take(entry: Entry): FinishTileLease | null {
		if (entry.url === null || entry.revoked) return null;
		entry.refs += 1;
		let released = false;
		return {
			url: entry.url,
			key: entry.key,
			release() {
				if (released) return;
				released = true;
				entry.refs -= 1;
				reap(entry);
			},
		};
	}

	return {
		/** The Stage registers its inspection host here; returns the unregister. */
		registerRenderer(next: FinishTileRender): () => void {
			render = next;
			epoch += 1;
			return () => {
				if (render === next) {
					render = null;
					epoch += 1;
				}
			};
		},
		/** The Stage registers its interactive inspection here; returns the unregister. */
		registerInspector(next: FinishTileInspect): () => void {
			inspector = next;
			epoch += 1;
			return () => {
				if (inspector === next) {
					inspector = null;
					epoch += 1;
				}
			};
		},
		/**
		 * Observe one interactive inspection through the Stage's host. Returns the
		 * release, or null when no Stage renderer is registered (read `epoch`).
		 */
		inspect(
			request: InspectionRequest,
			onState: (state: InspectionState) => void,
		): (() => void) | null {
			if (disposed || inspector === null) return null;
			return inspector(request, onState);
		},
		/** Reactive: a renderer registered or left. */
		get epoch(): number {
			return epoch;
		},
		keyOf,
		/**
		 * A picture already made, held now and synchronously (no flash on a re-render);
		 * null when it still has to be made.
		 */
		leaseNow(
			source: FinishTileSource,
			cssPx: number,
			devicePixelRatio: number,
		): FinishTileLease | null {
			if (disposed) return null;
			const key = keyOf(source);
			if (key === null) return null;
			const edge = tileDerivativeFor(cssPx, devicePixelRatio).edge;
			const entry = pictures.get(`${namespaceOf(source)}|${key}|${edge}`);
			if (entry === undefined) return null;
			remember(pictures, `${namespaceOf(source)}|${key}|${edge}`, entry, PICTURE_LIMIT, retire);
			return take(entry);
		},
		/**
		 * Hold the picture, making it if needed. Null when it cannot be made or the
		 * holder cancelled. Cancelling stops the work only if no one else wants it.
		 */
		async lease(
			source: FinishTileSource,
			cssPx: number,
			devicePixelRatio: number,
			signal?: AbortSignal,
		): Promise<FinishTileLease | null> {
			const entry = entryOf(source, cssPx, devicePixelRatio);
			if (entry === null) return null;
			entry.waiters += 1;
			let result: Picture | null;
			try {
				result = await hold(entry.job, signal);
			} finally {
				entry.waiters -= 1;
			}
			const lease = result === null || signal?.aborted || disposed ? null : take(entry);
			// Retired while this waiter was on its way and nobody else took it.
			if (lease === null) reap(entry);
			return lease;
		},
		/** Reload the live inspection request's failed images and redraw. */
		retry(): void {
			inspector?.retry?.();
		},
		/** Drop every picture of one project scope (its textures were disposed). In-use URLs live to their last release. */
		forgetScope(scopeId: string): void {
			const prefix = `scope:${scopeId}|`;
			for (const key of [...masters.keys()]) {
				if (!key.startsWith(prefix)) continue;
				const job = masters.get(key);
				masters.delete(key);
				if (job !== undefined && !job.settled) job.controller.abort();
			}
			for (const [key, entry] of [...pictures]) {
				if (!key.startsWith(prefix)) continue;
				pictures.delete(key);
				retire(entry, true);
			}
		},
		stats() {
			let urls = 0;
			for (const entry of pictures.values())
				if (entry.owned && entry.url !== null && !entry.revoked) urls += 1;
			return {
				masters: masters.size,
				pictures: pictures.size,
				urls,
				renderer: render !== null,
				drawing,
				drawQueued: waiting.length,
				peakDrawing,
			};
		},
		dispose(): void {
			disposed = true;
			render = null;
			inspector = null;
			for (const job of masters.values()) if (!job.settled) job.controller.abort();
			masters.clear();
			// A picture a tile still shows lives to its last release, as after an eviction.
			for (const entry of pictures.values()) retire(entry, true);
			pictures.clear();
			while (waiting.length > 0) waiting.shift()?.(null);
		},
	};
}
