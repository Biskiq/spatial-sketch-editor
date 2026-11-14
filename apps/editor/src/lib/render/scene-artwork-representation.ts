/**
 * E9/R5 — the retained Artwork handler of the Scene entity representation.
 *
 * `EntityArtwork.svelte` mounted one component, four meshes, four geometries and
 * up to six materials per Artwork. This handler draws the same result from the
 * Canvas stores:
 *
 * - **Geometry is shared by key.** The image is the store's `unit:plane` scaled
 *   to the image size; the frame ring, Mat ring and backing plate are keyed by
 *   the numbers they are built from. A Artworks of s distinct framed sizes hold
 *   1 + 3·s buffers.
 * - **Materials are store leases.** Frame, Mat and backing are Lambert surfaces
 *   keyed by colour and ghost state. The image surface is keyed by the loaded
 *   texture's own id, so two Artworks of one image share one material, and a
 *   replaced source can never reuse a material that still binds the old texture.
 * - **The image is a lease on the artwork scope.** The handler takes one lease
 *   per drawn source and gives it back when the source, the scope or the Artwork
 *   goes away. Nothing is drawn until the image arrives, and a failed image draws
 *   nothing and reports the error — the component's behaviour, unchanged.
 *
 * Three keys split an edit's work (see `SceneArtworkItem`): a placement edit
 * moves the retained group, a body edit rebuilds the meshes and their leases
 * while keeping the loaded image, and a source edit releases the image lease.
 *
 * **Retained portability exception (R5).** An image with transparent texels
 * keeps custom depth and distance materials with `alphaTest: 0.5`, so its shadow
 * has the image's silhouette while the surface still blends every texel.
 * Moving `alphaTest` onto the surface would give the same shadow but would also
 * discard the texels below 0.5 in the colour pass, which the blended surface
 * draws today. The colour image would differ, so the exception stays; the two
 * shadow materials are built by the store like every other surface.
 *
 * **Picking is unchanged.** The component never registered an Artwork with the
 * Stage pick index (Artwork is selected through its frame overlay), so this
 * handler registers nothing. `objectOf` reads the owned index.
 */
import { Group, Mesh, type Object3D, type Texture } from 'three';
import type { GeometryLease, GeometryStore } from './resources/geometry-store';
import type { MaterialLease, MaterialStore } from './resources/material-store';
import type { LambertMaterialDescriptor } from './resources/material-descriptor';
import type { SceneArtworkImage, SceneArtworkItem } from './resources/scene-render-item';

/** A decoded image, as the artwork scope yields it. */
export type ArtworkImageLoad = { readonly texture: Texture; readonly transparent: boolean };

/** One claim on a decoded image. `release` is idempotent. */
export type ArtworkImageLease = { readonly ready: Promise<ArtworkImageLoad>; release(): void };

/**
 * The image source a Canvas draws from: the Stage, Preview or release artwork
 * scope. A structural type, so this handler reads no authored-unit module.
 */
export type ArtworkImageSource = { acquire(image: SceneArtworkImage): ArtworkImageLease };

export type SceneArtworkRepresentationOptions = {
	readonly store: MaterialStore;
	readonly geometry: GeometryStore;
	/** The Stage placement ghost: translucent, casts and receives nothing. */
	readonly ghost?: boolean;
	/** An Artwork's image arrived and its body is drawn. */
	readonly onArrival?: (id: string) => void;
	/** An Artwork's image could not be drawn. */
	readonly onError?: (message: string) => void;
};

/** What one update did, as counts. */
export type SceneArtworkStats = {
	/** Artworks the handler holds after the update, drawn or still arriving. */
	readonly items: number;
	/** New image leases taken (new Artwork, new source or new scope). */
	readonly sourced: number;
	/** Bodies rebuilt around an already loaded image. */
	readonly rebodied: number;
	/** Groups moved without any rebuild. */
	readonly moved: number;
	/** Artworks released because the Scene no longer has them. */
	readonly released: number;
	/**
	 * Drawn Artworks taken off screen to be re-sourced (new source or scope). The
	 * frame changed imperatively, so a consumer must invalidate.
	 */
	readonly detached: number;
};

export type SceneArtworkRepresentation = {
	readonly object3d: Group;
	update(items: readonly SceneArtworkItem[], scope: ArtworkImageSource | null): SceneArtworkStats;
	objectOf(id: string): Object3D | null;
	/** Resolves when no image is still arriving. Observation only. */
	idle(): Promise<void>;
	dispose(): void;
};

/** The drawn meshes of one Artwork and the leases they hold. */
type Body = {
	readonly geometries: GeometryLease[];
	readonly materials: MaterialLease[];
};

type Entry = {
	readonly id: string;
	readonly sourceKey: string;
	readonly scope: ArtworkImageSource | null;
	readonly group: Group;
	item: SceneArtworkItem;
	lease: ArtworkImageLease | null;
	loaded: ArtworkImageLoad | null;
	body: Body | null;
	/** Cleared on release, so a late arrival cannot draw a released Artwork. */
	live: boolean;
};

/** The ghost's translucency, as the component drew it. */
const GHOST_OPACITY = 0.65;
/** The shadow silhouette threshold of the retained alpha exception. */
const SHADOW_ALPHA_TEST = 0.5;

function placeGroup(group: Group, item: SceneArtworkItem): void {
	group.position.set(...item.position);
	group.rotation.set(...item.rotation);
}

export function createSceneArtworkRepresentation(
	options: SceneArtworkRepresentationOptions
): SceneArtworkRepresentation {
	const { store, geometry } = options;
	const ghost = options.ghost ?? false;
	const object3d = new Group();
	object3d.name = ghost ? 'SceneArtworkGhost' : 'SceneArtworks';
	const entries = new Map<string, Entry>();
	const pending = new Set<Promise<void>>();
	let previousItems: readonly SceneArtworkItem[] | null = null;
	let previousScope: ArtworkImageSource | null = null;
	let disposed = false;

	/** A plain (untextured) body surface: frame, Mat or backing. */
	function plain(color: string): LambertMaterialDescriptor {
		return { kind: 'lambert', color, transparent: ghost, opacity: ghost ? GHOST_OPACITY : 1, depthWrite: !ghost };
	}

	function buildBody(entry: Entry, loaded: ArtworkImageLoad): Body {
		const item = entry.item;
		const geometries: GeometryLease[] = [];
		const materials: MaterialLease[] = [];
		const maps = { map: loaded.texture };
		const mapKey = `artwork:${loaded.texture.uuid}`;
		const mesh = (
			name: string,
			lease: GeometryLease,
			material: MaterialLease,
			z: number,
			castShadow: boolean
		): Mesh => {
			geometries.push(lease);
			materials.push(material);
			const drawn = new Mesh(lease.geometry, material.material);
			drawn.name = `${name}:${item.id}`;
			drawn.position.z = z;
			drawn.castShadow = castShadow && !ghost;
			drawn.receiveShadow = !ghost;
			entry.group.add(drawn);
			return drawn;
		};

		const image = mesh(
			'SceneArtworkImage',
			geometry.acquire({ kind: 'unit', shape: 'plane' }),
			store.acquire(
				{
					kind: 'lambert',
					map: mapKey,
					transparent: loaded.transparent || ghost,
					depthWrite: !loaded.transparent && !ghost,
					opacity: ghost ? GHOST_OPACITY : 1
				},
				maps
			),
			0,
			true
		);
		image.scale.set(item.imageSize[0], item.imageSize[1], 1);
		if (loaded.transparent && !ghost) {
			const depth = store.acquire(
				{ kind: 'depth', map: mapKey, alphaTest: SHADOW_ALPHA_TEST, packing: 'rgba' },
				maps
			);
			const distance = store.acquire({ kind: 'distance', map: mapKey, alphaTest: SHADOW_ALPHA_TEST }, maps);
			materials.push(depth, distance);
			image.customDepthMaterial = depth.material;
			image.customDistanceMaterial = distance.material;
		}
		if (item.frame !== null) {
			mesh('SceneArtworkFrame', geometry.acquire(item.frame.geometry), store.acquire(plain(item.frame.color)), item.frame.z, true);
		}
		if (item.mat !== null) {
			mesh('SceneArtworkMat', geometry.acquire(item.mat.geometry), store.acquire(plain(item.mat.color)), item.mat.z, false);
		}
		if (item.backing !== null) {
			mesh(
				'SceneArtworkBacking',
				geometry.acquire(item.backing.geometry),
				store.acquire(plain(item.backing.color)),
				item.backing.z,
				false
			);
		}
		return { geometries, materials };
	}

	function releaseLeases(body: Body): void {
		// Materials go back before the image lease that owns their texture.
		for (const lease of body.materials) lease.release();
		for (const lease of body.geometries) lease.release();
	}

	function releaseBody(entry: Entry): void {
		if (entry.body === null) return;
		entry.group.clear();
		releaseLeases(entry.body);
		entry.body = null;
	}

	/**
	 * Rebuild around the loaded image. The new leases are taken before the old
	 * ones go back, so a resize that keeps a colour or a size keeps its material
	 * and buffer instead of disposing and rebuilding them.
	 */
	function rebuild(entry: Entry): void {
		const previous = entry.body;
		entry.group.clear();
		entry.body = null;
		draw(entry);
		if (previous !== null) releaseLeases(previous);
	}

	function release(entry: Entry): void {
		entry.live = false;
		entry.group.removeFromParent();
		releaseBody(entry);
		entry.loaded = null;
		entry.lease?.release();
		entry.lease = null;
	}

	function draw(entry: Entry): void {
		if (entry.loaded === null) return;
		entry.body = buildBody(entry, entry.loaded);
		if (entry.group.parent !== object3d) object3d.add(entry.group);
	}

	function source(item: SceneArtworkItem, scope: ArtworkImageSource | null): Entry {
		const group = new Group();
		group.name = `SceneArtwork:${item.id}`;
		placeGroup(group, item);
		const entry: Entry = {
			id: item.id,
			sourceKey: item.sourceKey,
			scope,
			group,
			item,
			lease: null,
			loaded: null,
			body: null,
			live: true
		};
		if (scope === null) return entry;
		const lease = scope.acquire(item.image);
		entry.lease = lease;
		const job = lease.ready.then(
			(loaded) => {
				if (disposed || !entry.live) return;
				entry.loaded = loaded;
				draw(entry);
				options.onArrival?.(entry.id);
			},
			(error: unknown) => {
				if (disposed || !entry.live) return;
				options.onError?.(error instanceof Error ? error.message : 'Artwork could not be displayed.');
			}
		);
		pending.add(job);
		void job.then(() => pending.delete(job));
		return entry;
	}

	return {
		object3d,

		update(items, scope) {
			if (disposed) throw new Error('the scene artwork representation has been disposed');
			if (items === previousItems && scope === previousScope) {
				return { items: entries.size, sourced: 0, rebodied: 0, moved: 0, released: 0, detached: 0 };
			}
			previousItems = items;
			previousScope = scope;
			let sourced = 0;
			let rebodied = 0;
			let moved = 0;
			let detached = 0;
			const present = new Set<string>();
			for (const item of items) {
				present.add(item.id);
				const existing = entries.get(item.id);
				if (existing !== undefined && existing.sourceKey === item.sourceKey && existing.scope === scope) {
					const previous = existing.item;
					existing.item = item;
					if (previous.bodyKey !== item.bodyKey) {
						if (existing.loaded !== null) {
							rebuild(existing);
							rebodied += 1;
						}
					}
					if (previous.placementKey !== item.placementKey) {
						placeGroup(existing.group, item);
						moved += 1;
					}
					continue;
				}
				if (existing !== undefined) {
					if (existing.group.parent === object3d) detached += 1;
					release(existing);
				}
				entries.set(item.id, source(item, scope));
				sourced += 1;
			}
			let released = 0;
			for (const [id, entry] of entries) {
				if (present.has(id)) continue;
				release(entry);
				entries.delete(id);
				released += 1;
			}
			return { items: entries.size, sourced, rebodied, moved, released, detached };
		},

		objectOf(id) {
			return entries.get(id)?.group ?? null;
		},

		async idle() {
			while (pending.size > 0) await Promise.all([...pending]);
		},

		dispose() {
			if (disposed) return;
			disposed = true;
			previousItems = null;
			previousScope = null;
			for (const entry of entries.values()) release(entry);
			entries.clear();
		}
	};
}
