/**
 * The product's Finish pictures (U1): catalogue, project and private-library
 * Finishes drawn as a flat, lit sample tile.
 *
 * One service per Stage. It owns three things and nothing else:
 *
 * 1. **Where a master comes from.** A catalogue entry with a current committed
 *    master (`catalogue-tiles.ts`) opens that one 256 px PNG and never a
 *    texture. Any other Finish, and a catalogue entry whose master is stale, is
 *    drawn by the E7 inspection host the Stage registers; with no host yet it
 *    has no picture and the shelf keeps its colour swatch.
 * 2. **Derivatives.** XS, S and M are made from the master in the browser and
 *    held as object URLs, keyed by the tile's key and size.
 * 3. **Isolation and failure.** A project Finish's pictures live under its
 *    texture scope's id, so a scope is never served another's; only successful
 *    outputs are cached, a failure or refusal is `null`, and the caller's
 *    swatch is the fallback.
 *
 * The master's *key* is the picture's identity: a recipe, pin or framing change
 * makes a new key, so an old picture is never served for a new Finish.
 */
import type { MaterialId } from '$lib/types/materials';
import { catalogueTile } from './catalogue-tiles';
import { materialThumbnailFraming } from '$lib/content/material-presentation';
import type { InspectionSubject } from './inspection-subject';
import type { InspectionThumbnail } from './inspection-host';
import { resolveSampleTile } from './sample-tile-resolve';
import {
	deriveTile,
	tileDerivativeFor,
	type TileDerivative
} from './sample-tile-derivatives';
import { SAMPLE_TILE_MASTER_SIZE, type SampleTileFraming } from './sample-tile';

export type FinishTileSubject = Extract<InspectionSubject, { kind: 'finish' }>;

export type FinishTileSource =
	| { readonly kind: 'catalogue'; readonly id: MaterialId }
	| { readonly kind: 'finish'; readonly subject: FinishTileSubject };

/** Draw one master through the Stage's inspection host. */
export type FinishTileRender = (
	request: { readonly subject: InspectionSubject; readonly framing: SampleTileFraming | 'default' },
	signal?: AbortSignal
) => Promise<InspectionThumbnail>;

export type FinishTilePicture = { readonly url: string; readonly key: string };

type Master = { readonly key: string; readonly bytes: Blob; readonly uri?: string };

const PICTURE_LIMIT = 192;
const MASTER_LIMIT = 64;

/** The cache namespace: a catalogue picture is shared, a project one is its scope's. */
function namespaceOf(source: FinishTileSource): string {
	return source.kind === 'catalogue' ? 'catalogue' : `scope:${source.subject.scope.scopeId}`;
}

function subjectOf(source: FinishTileSource): InspectionSubject {
	return source.kind === 'catalogue' ? { kind: 'catalogue', id: source.id } : source.subject;
}

function framingOf(source: FinishTileSource): SampleTileFraming | 'default' {
	return source.kind === 'catalogue' ? (materialThumbnailFraming[source.id] ?? 'default') : 'default';
}

export type FinishTiles = ReturnType<typeof createFinishTiles>;

export function createFinishTiles(options: { readonly fetchMaster?: (uri: string, signal?: AbortSignal) => Promise<Blob | null> } = {}) {
	const fetchMaster =
		options.fetchMaster ??
		(async (uri: string, signal?: AbortSignal) => {
			const response = await fetch(uri, { signal });
			return response.ok ? await response.blob() : null;
		});

	let render: FinishTileRender | null = null;
	/** Bumps when a renderer registers or leaves, so pending pictures retry. */
	let epoch = $state(0);
	let disposed = false;

	const masters = new Map<string, Promise<Master | null>>();
	const pictures = new Map<string, Promise<FinishTilePicture | null>>();
	const urls = new Map<string, string>();

	function remember<T>(map: Map<string, T>, key: string, value: T, limit: number, release?: (value: T) => void): void {
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

	async function masterOf(source: FinishTileSource, signal?: AbortSignal): Promise<Master | null> {
		if (source.kind === 'catalogue') {
			const current = catalogueTile(source.id);
			if (current !== undefined) {
				const bytes = await fetchMaster(current.uri, signal);
				return bytes === null ? null : { key: current.key, bytes, uri: current.uri };
			}
		}
		// A project Finish, or a catalogue entry whose committed master is stale.
		if (render === null) return null;
		const result = await render({ subject: subjectOf(source), framing: framingOf(source) }, signal);
		if (result.status !== 'ready') return null;
		return { key: result.key, bytes: new Blob([result.png as BlobPart], { type: 'image/png' }) };
	}

	function picture(
		source: FinishTileSource,
		cssPx: number,
		devicePixelRatio: number,
		signal?: AbortSignal
	): Promise<FinishTilePicture | null> {
		if (disposed || signal?.aborted) return Promise.resolve(null);
		const derivative: TileDerivative = tileDerivativeFor(cssPx, devicePixelRatio);
		const namespace = namespaceOf(source);
		const key = keyOf(source);
		if (key === null) return Promise.resolve(null);
		const pictureKey = `${namespace}|${key}|${derivative.edge}`;
		const hit = pictures.get(pictureKey);
		if (hit !== undefined) {
			remember(pictures, pictureKey, hit, PICTURE_LIMIT);
			return hit;
		}
		const pending = (async (): Promise<FinishTilePicture | null> => {
			try {
				const masterKey = `${namespace}|${key}`;
				let master = masters.get(masterKey);
				if (master === undefined) {
					master = masterOf(source, signal);
					remember(masters, masterKey, master, MASTER_LIMIT);
				}
				const found = await master;
				if (found === null || disposed) return null;
				// M is the master itself; a catalogue master is served by its own URL.
				if (derivative.edge === SAMPLE_TILE_MASTER_SIZE) {
					const url = found.uri ?? URL.createObjectURL(found.bytes);
					if (found.uri === undefined) urls.set(pictureKey, url);
					return { url, key: found.key };
				}
				if (typeof createImageBitmap === 'undefined') return null;
				const bitmap = await createImageBitmap(found.bytes);
				try {
					const blob = await deriveTile(bitmap, derivative);
					if (blob === null || disposed) return null;
					const url = URL.createObjectURL(blob);
					urls.set(pictureKey, url);
					return { url, key: found.key };
				} finally {
					bitmap.close();
				}
			} catch {
				return null;
			}
		})();
		remember(pictures, pictureKey, pending, PICTURE_LIMIT);
		// Only a successful output stays cached: a failure is asked again.
		void pending.then((result) => {
			if (result === null && pictures.get(pictureKey) === pending) {
				pictures.delete(pictureKey);
				masters.delete(`${namespace}|${key}`);
			}
		});
		return pending;
	}

	function revokeAll(): void {
		for (const url of urls.values()) URL.revokeObjectURL(url);
		urls.clear();
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
		/** Reactive: a renderer registered or left. */
		get epoch(): number {
			return epoch;
		},
		keyOf,
		picture,
		/** Drop every picture of one project scope (its textures were disposed). */
		forgetScope(scopeId: string): void {
			const prefix = `scope:${scopeId}|`;
			for (const map of [masters, pictures]) {
				for (const key of [...map.keys()]) if (key.startsWith(prefix)) map.delete(key);
			}
			for (const [key, url] of [...urls]) {
				if (!key.startsWith(prefix)) continue;
				URL.revokeObjectURL(url);
				urls.delete(key);
			}
		},
		stats() {
			return { masters: masters.size, pictures: pictures.size, urls: urls.size, renderer: render !== null };
		},
		dispose(): void {
			disposed = true;
			render = null;
			masters.clear();
			pictures.clear();
			revokeAll();
		}
	};
}
