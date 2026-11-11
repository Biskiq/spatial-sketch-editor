import { SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { probeArtworkImage, type ArtworkImage } from '@portfolio/project-model';

export type ArtworkBytes = { bytes: Uint8Array; mime: string };
type Loaded = { texture: Texture; transparent: boolean };
type Entry = { references: number; loaded: Loaded | null; ready: Promise<Loaded> };

export type ArtworkScope = {
	acquire(image: ArtworkImage): { ready: Promise<Loaded>; release(): void };
	dispose(): void;
};

/** One lifecycle per Stage, Preview or release. Raw source stays outside renderer state. */
export function createArtworkScope(
	resolve: (image: ArtworkImage, signal: AbortSignal) => Promise<ArtworkBytes>
): ArtworkScope {
	const entries = new Map<string, Entry>();
	const abort = new AbortController();
	const loader = new TextureLoader();
	async function load(image: ArtworkImage): Promise<Loaded> {
		const { bytes, mime } = await resolve(image, abort.signal);
		abort.signal.throwIfAborted();
		const probed = probeArtworkImage(bytes);
		if (probed.mime !== mime || probed.pixelWidth !== image.pixelWidth || probed.pixelHeight !== image.pixelHeight) {
			throw new Error('Artwork image differs from the saved source.');
		}
		const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: mime }));
		try {
			const texture = await loader.loadAsync(url);
			try {
				abort.signal.throwIfAborted();
				const decoded = texture.image as HTMLImageElement;
				if (decoded.naturalWidth !== image.pixelWidth || decoded.naturalHeight !== image.pixelHeight) {
					throw new Error('Artwork decoded dimensions differ from the saved source.');
				}
				texture.colorSpace = SRGBColorSpace;
				let transparent = false;
				if (mime !== 'image/jpeg') {
					const canvas = document.createElement('canvas');
					canvas.width = image.pixelWidth;
					canvas.height = image.pixelHeight;
					const context = canvas.getContext('2d', { willReadFrequently: true });
					if (context === null) transparent = true;
					else {
						context.drawImage(decoded, 0, 0);
						const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
						for (let i = 3; i < rgba.length; i += 4) {
							if (rgba[i] !== 255) { transparent = true; break; }
						}
						canvas.width = canvas.height = 0;
					}
				}
				return { texture, transparent };
			} catch (error) {
				texture.dispose();
				throw error;
			}
		} finally {
			URL.revokeObjectURL(url);
		}
	}

	function retire(key: string, entry: Entry) {
		if (entries.get(key) !== entry) return;
		entries.delete(key);
		entry.loaded?.texture.dispose();
	}
	return {
		acquire(image) {
			const key = `${image.assetId}/${image.pixelWidth}/${image.pixelHeight}`;
			let entry = entries.get(key);
			if (!entry) {
				const pending: Entry = { references: 0, loaded: null, ready: load(image).then((loaded) => {
					if (entries.get(key) === pending) pending.loaded = loaded;
					else loaded.texture.dispose();
					return loaded;
				}) };
				entries.set(key, pending);
				entry = pending;
			}
			const leased = entry;
			leased.references++;
			let released = false;
			return { ready: leased.ready, release() {
				if (released) return;
				released = true;
				if (--leased.references === 0) retire(key, leased);
			} };
		},
		dispose() {
			abort.abort();
			for (const [key, entry] of entries) retire(key, entry);
		}
	};
}
