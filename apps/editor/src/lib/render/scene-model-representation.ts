/**
 * E8/R5 + R2c + G4 — the retained model handler of the Scene entity representation.
 *
 * `AssetModel.svelte` mounted one component per approved model: a GLB
 * subscription, a Svelte fallback tree with one material component per part, and
 * the entity's transform groups. This handler draws the same result from the
 * Canvas stores, under the one Scene root:
 *
 * ```
 * SceneEntity:<id>            transform-free root: the pick registration
 *   placement                 position, rotation, scale, visibility
 *     presentation            the asset's own orientation/scale correction
 *       fallback | instance   the fallback body until the model is drawn
 * ```
 *
 * - **The fallback is data.** The description resolves each part to a keyed store
 *   geometry and a canonical material descriptor (`fallback-shapes`), so equal
 *   parts across instances share one buffer and one material. The fallback draws
 *   at once, before the lazy model support has arrived.
 * - **The drawn instance is a realization.** A loaded template is cloned by
 *   `model-realization` (through the lazily loaded support): geometry shared,
 *   skinned hierarchies with their own skeletons, every surface a store lease, a
 *   remap and its texture variant as leases.
 * - **Every async step is gated.** A load begins a token on the entry's arrival
 *   gate and an arrival mounts only while that token is current; replacement and
 *   release close the gate. A presentation (arrival, style change) starts a new
 *   generation, and a texture completion applies only while its generation is
 *   still the newest. An unscoped look mounts at once and remaps when its textures
 *   arrive; a scoped look waits for them, so its first frame is already textured.
 * - **Every lease is given back.** A replaced source releases the instance, its
 *   material/texture leases and its template lease; a released entity also gives
 *   back its fallback leases and its pick registration. The handler disposes
 *   nothing itself: the stores and the per-Canvas loader own every GPU resource.
 * - **One caster channel.** The handler publishes `arrived` when an instance is
 *   drawn, `released` when it goes, and `changed` when a drawn instance's
 *   visibility or shadow flags change. Nothing animates, so `playing()` stays
 *   zero and the shadow owner never renders per frame for a model.
 *
 * Three keys split an edit's work (see `SceneModelItem`), and an update whose
 * items, support, URLs and texture scope are all unchanged does nothing at all.
 */
import { Group, Mesh, type Box3, type Object3D } from 'three';
import { countWork } from '@portfolio/layout-core';
import type { CasterChannel } from './resources/caster-channel';
import type { GeometryLease, GeometryStore } from './resources/geometry-store';
import type { MaterialLease, MaterialStore } from './resources/material-store';
import type { SceneModelItem, SceneModelLook } from './resources/scene-render-item';
import { loadEffectiveTextures, type TextureLoadScope } from './resources/texture-store';
import {
	createArrivalGate,
	modelLookFor,
	nextModelEntityId,
	texturesReady,
	type ArrivalGate
} from './models/model-presentation';
import type {
	ModelRealization,
	ModelRealizationOptions,
	ModelStyle
} from './models/model-realization';

/**
 * A drawn instance's inspection. Structurally the asset catalogue's `AssetMetrics`,
 * declared here because the catalogue types reach authored Scene truth, which no
 * representation may import.
 */
export type SceneModelMetrics = {
	dimensions: [number, number, number];
	meshCount: number;
	materialCount: number;
	triangleCount: number;
	animationNames: string[];
};

/** A parsed model: the template every instance clones, and its animation names. */
export type ModelTemplate = {
	readonly template: Object3D;
	readonly animationNames: readonly string[];
};

/** One instance's claim on a URL's template. `release` is idempotent. */
export type ModelTemplateLease = {
	readonly ready: Promise<ModelTemplate>;
	release(): void;
};

export type ModelLoaderStats = {
	/** Distinct URL requests made, monotone. */
	readonly requested: number;
	/** Requests that failed, monotone. */
	readonly failed: number;
	/** Templates cached now. */
	readonly templates: number;
	/** Template leases held now. */
	readonly leases: number;
};

/** The per-Canvas template cache. */
export type ModelTemplateLoader = {
	acquire(url: string): ModelTemplateLease;
	stats(): ModelLoaderStats;
	dispose(): void;
};

/**
 * The lazily loaded model support (`models/scene-model-support`), injected. A
 * structural type, so this handler imports neither the loader nor SkeletonUtils.
 */
export type SceneModelSupport = {
	createLoader(): ModelTemplateLoader;
	realize(template: Object3D, options: ModelRealizationOptions): ModelRealization;
	inspect(root: Object3D, animationNames: readonly string[]): { bounds: Box3; metrics: SceneModelMetrics };
};

export type SceneModelStatus = 'loading' | 'ready' | 'failed' | 'fallback';

/** What one model shows now: the asset QA page and tests read this. */
export type SceneModelState = {
	readonly status: SceneModelStatus;
	readonly error?: string;
	/** The drawn instance's inspection, in the asset's own frame. */
	readonly metrics?: SceneModelMetrics;
	readonly bounds?: Box3;
	/** Animation names of the drawn template. Playback is not a product feature. */
	readonly animationNames?: readonly string[];
};

/** Runtime inputs that are not Scene truth, read on every update. */
export type SceneModelContext = {
	readonly support: SceneModelSupport | null;
	/** Resolved approved creator-model bytes: model id → derivative URL. */
	readonly urls: ReadonlyMap<string, string> | null;
	/** The texture cache namespace a remap loads under. */
	readonly scope: TextureLoadScope | null;
};

export type SceneModelStats = {
	readonly items: number;
	/** New entities: root, fallback and (when loadable) a load. */
	readonly built: number;
	/** Entities this update did not touch. */
	readonly kept: number;
	/** Groups moved (or shown/hidden) without any rebuild. */
	readonly moved: number;
	/** Existing entities whose bytes changed: instance released, new load started. */
	readonly replaced: number;
	/** Fallback bodies rebuilt for a changed fallback. */
	readonly refallbacked: number;
	/** Presentations started for a changed look, wireframe, shadow flag or scope. */
	readonly restyled: number;
	/** Loads started this update, including ones waiting for the support to arrive. */
	readonly loads: number;
	readonly released: number;
};

export type SceneModelRepresentationOptions = {
	readonly store: MaterialStore;
	readonly geometry: GeometryStore;
	readonly casters: CasterChannel;
	/** Register an entity root with the host's pick index; returns the unregister. */
	readonly onRoot?: (id: string, root: Object3D) => (() => void) | void;
	/** A drawn instance mounted or restyled: the frame changed imperatively. */
	readonly onDrawn?: (id: string) => void;
	/** A model's load status changed. */
	readonly onState?: (id: string, state: SceneModelState) => void;
};

export type SceneModelRepresentation = {
	readonly object3d: Group;
	update(items: readonly SceneModelItem[], context: SceneModelContext): SceneModelStats;
	objectOf(id: string): Object3D | null;
	stateOf(id: string): SceneModelState | null;
	/** The per-Canvas loader's counts, or null before the support arrived. */
	loaderStats(): ModelLoaderStats | null;
	/** Resolves when no load or texture completion is still pending. Observation only. */
	idle(): Promise<void>;
	dispose(): void;
};

type Fallback = {
	readonly key: string;
	readonly group: Group;
	readonly geometries: GeometryLease[];
	readonly materials: MaterialLease[];
};

/** An arrived template, as the load that produced it named it. Plain data. */
type Arrival = {
	readonly token: number;
	readonly url: string;
	readonly support: SceneModelSupport;
	readonly template: Object3D;
	readonly animationNames: readonly string[];
};

/** The style one presentation applies, captured when the presentation starts. */
type Presentation = {
	readonly key: string;
	readonly look: SceneModelLook | null;
	readonly scope: TextureLoadScope | null;
	readonly wireframe: boolean;
	readonly castShadow: boolean;
	readonly receiveShadow: boolean;
};

type Entry = {
	readonly id: string;
	/** This entity's caster name on the channel. */
	readonly caster: string;
	readonly root: Group;
	readonly placement: Group;
	readonly presentation: Group;
	readonly gate: ArrivalGate;
	item: SceneModelItem;
	/** The bytes this entity draws: the item's source and the resolved URL. */
	source: string;
	url: string | null;
	/** The style the entity should show: the item's style and the scope. */
	style: string;
	scope: TextureLoadScope | null;
	fallback: Fallback | null;
	lease: ModelTemplateLease | null;
	arrival: Arrival | null;
	realization: ModelRealization | null;
	/** Bumped by every presentation, arrival and release: only the newest may apply. */
	generation: number;
	/** The style key the drawn instance shows now. */
	shown: string | null;
	state: SceneModelState;
	unregister: (() => void) | null;
};

function drawnFlags(item: SceneModelItem): string {
	return `${item.visible}|${item.castShadow}|${item.receiveShadow}`;
}

export function createSceneModelRepresentation(
	options: SceneModelRepresentationOptions
): SceneModelRepresentation {
	const object3d = new Group();
	object3d.name = 'SceneModels';
	const entries = new Map<string, Entry>();
	const pending = new Set<Promise<void>>();
	let loader: ModelTemplateLoader | null = null;
	let disposed = false;
	let previous: { items: readonly SceneModelItem[]; context: SceneModelContext } | null = null;

	function track(job: Promise<void>): void {
		pending.add(job);
		const settle = (): void => {
			pending.delete(job);
		};
		void job.then(settle, settle);
	}

	function setState(entry: Entry, state: SceneModelState): void {
		entry.state = state;
		options.onState?.(entry.id, state);
	}

	function place(entry: Entry, item: SceneModelItem): void {
		entry.placement.position.set(...item.transform.position);
		entry.placement.rotation.set(...item.transform.rotation);
		entry.placement.scale.set(...item.transform.scale);
		entry.placement.visible = item.visible;
	}

	function releaseFallback(entry: Entry): void {
		const fallback = entry.fallback;
		if (fallback === null) return;
		entry.fallback = null;
		fallback.group.removeFromParent();
		for (const lease of fallback.materials) lease.release();
		for (const lease of fallback.geometries) lease.release();
	}

	function buildFallback(entry: Entry): void {
		const { fallback } = entry.item;
		const group = new Group();
		group.name = `SceneModelFallback:${entry.id}`;
		const geometries: GeometryLease[] = [];
		const materials: MaterialLease[] = [];
		for (const part of fallback.parts) {
			const geometry = options.geometry.acquire(part.geometry);
			const material = options.store.acquire(part.material);
			geometries.push(geometry);
			materials.push(material);
			const mesh = new Mesh(geometry.geometry, material.material);
			mesh.position.set(...part.position);
			mesh.rotation.set(...part.rotation);
			mesh.scale.set(...part.geometryScale);
			mesh.castShadow = fallback.castShadow;
			mesh.receiveShadow = fallback.receiveShadow;
			group.add(mesh);
		}
		entry.presentation.add(group);
		entry.fallback = { key: entry.item.fallbackKey, group, geometries, materials };
	}

	/** The fallback shows while no instance is drawn, and always matches the item. */
	function syncFallback(entry: Entry): boolean {
		if (entry.realization !== null) return false;
		if (entry.fallback !== null && entry.fallback.key === entry.item.fallbackKey) return false;
		releaseFallback(entry);
		buildFallback(entry);
		return true;
	}

	/**
	 * Give back the drawn instance and its template lease, and reject every load and
	 * texture completion still in flight for this entity.
	 */
	function releaseSource(entry: Entry): void {
		entry.gate.close();
		entry.arrival = null;
		entry.generation += 1;
		entry.lease?.release();
		entry.lease = null;
		if (entry.realization !== null) {
			options.casters.publish({ kind: 'released', entity: entry.caster });
			entry.realization.root.removeFromParent();
			entry.realization.release();
			entry.realization = null;
		}
		entry.shown = null;
	}

	/**
	 * Show a presentation on the arrived template. The first show mounts the instance
	 * and retires the fallback; later shows restyle it. A gate-closed arrival never shows.
	 */
	function show(entry: Entry, current: Arrival, look: Presentation, textured: boolean): void {
		if (!entry.gate.accepts(current.token)) return;
		const style: ModelStyle = {
			look: look.look === null ? null : modelLookFor(look.look, look.scope, textured),
			wireframe: look.wireframe,
			castShadow: look.castShadow,
			receiveShadow: look.receiveShadow
		};
		const key = `${look.key}|${textured}`;
		if (entry.realization === null) {
			const next = current.support.realize(current.template, {
				asset: current.url,
				store: options.store,
				...style
			});
			const inspection = current.support.inspect(next.root, current.animationNames);
			entry.realization = next;
			entry.shown = key;
			releaseFallback(entry);
			entry.presentation.add(next.root);
			setState(entry, {
				status: 'ready',
				metrics: inspection.metrics,
				bounds: inspection.bounds,
				animationNames: current.animationNames
			});
			options.casters.publish({ kind: 'arrived', entity: entry.caster });
			options.onDrawn?.(entry.id);
			return;
		}
		if (entry.shown === key) return;
		entry.realization.restyle(style);
		entry.shown = key;
		options.onDrawn?.(entry.id);
	}

	/**
	 * Present the entity's current style on the arrived template. Every completion is
	 * checked against the generation it started under.
	 */
	function present(entry: Entry): void {
		const current = entry.arrival;
		if (current === null || !entry.gate.accepts(current.token)) return;
		const look: Presentation = {
			key: entry.style,
			look: entry.item.look,
			scope: entry.scope,
			wireframe: entry.item.wireframe,
			castShadow: entry.item.castShadow,
			receiveShadow: entry.item.receiveShadow
		};
		entry.generation += 1;
		const id = entry.generation;
		const active = look.look;
		if (active === null) {
			show(entry, current, look, false);
			return;
		}
		if (look.scope === null) show(entry, current, look, false);
		track(
			loadEffectiveTextures(active, look.scope)
				.catch(() => undefined)
				.then((result) => {
					if (disposed || id !== entry.generation) return;
					show(entry, current, look, texturesReady(result));
				})
		);
	}

	/** Begin loading the entity's bytes. The arrival mounts only under this token. */
	function startLoad(entry: Entry, support: SceneModelSupport, url: string): void {
		loader ??= support.createLoader();
		const token = entry.gate.begin();
		const lease = loader.acquire(url);
		entry.lease = lease;
		track(
			lease.ready.then(
				(loaded) => {
					if (disposed || !entry.gate.accepts(token)) return;
					entry.arrival = {
						token,
						url,
						support,
						template: loaded.template,
						animationNames: loaded.animationNames
					};
					present(entry);
				},
				(error: unknown) => {
					if (disposed || !entry.gate.accepts(token)) return;
					const message = error instanceof Error ? error.message : String(error);
					setState(entry, { status: 'failed', error: message });
					if (import.meta.env.DEV) {
						console.warn(`[scene-model] Failed to load ${entry.item.assetId} from ${url}`, error);
					}
				}
			)
		);
	}

	/** Start the entity's load once the support is here; report what it shows meanwhile. */
	function ensureLoad(entry: Entry, context: SceneModelContext): boolean {
		if (entry.url === null) {
			if (entry.state.status !== 'fallback') setState(entry, { status: 'fallback' });
			return false;
		}
		if (entry.lease !== null) return false;
		if (entry.state.status !== 'loading') setState(entry, { status: 'loading' });
		if (context.support === null) return false;
		startLoad(entry, context.support, entry.url);
		return true;
	}

	function sourceOf(item: SceneModelItem, context: SceneModelContext): { key: string; url: string | null } {
		const url = context.urls?.get(item.assetId) ?? item.catalogueUrl;
		return { key: `${item.sourceKey}|${url ?? '-'}`, url };
	}

	function styleOf(item: SceneModelItem, context: SceneModelContext): string {
		return `${item.styleKey}|${context.scope?.scopeId ?? '-'}`;
	}

	function build(item: SceneModelItem, context: SceneModelContext): Entry {
		countWork('representation:scene-model-entry');
		const root = new Group();
		root.name = `SceneEntity:${item.id}`;
		const placement = new Group();
		const presentation = new Group();
		placement.add(presentation);
		root.add(placement);
		const source = sourceOf(item, context);
		const entry: Entry = {
			id: item.id,
			caster: `model-host:${nextModelEntityId()}`,
			root,
			placement,
			presentation,
			gate: createArrivalGate(),
			item,
			source: source.key,
			url: source.url,
			style: styleOf(item, context),
			scope: context.scope,
			fallback: null,
			lease: null,
			arrival: null,
			realization: null,
			generation: 0,
			shown: null,
			state: { status: source.url === null ? 'fallback' : 'loading' },
			unregister: null
		};
		place(entry, item);
		presentation.rotation.set(...item.presentation.rotation);
		presentation.scale.setScalar(item.presentation.scale);
		buildFallback(entry);
		object3d.add(root);
		entry.unregister = options.onRoot?.(item.id, root) ?? null;
		options.onState?.(entry.id, entry.state);
		return entry;
	}

	function release(entry: Entry): void {
		releaseSource(entry);
		releaseFallback(entry);
		entry.unregister?.();
		entry.unregister = null;
		entry.root.removeFromParent();
	}

	return {
		object3d,

		update(items, context) {
			if (disposed) throw new Error('the scene model representation has been disposed');
			if (
				previous !== null &&
				previous.items === items &&
				previous.context.support === context.support &&
				previous.context.urls === context.urls &&
				previous.context.scope === context.scope
			) {
				return {
					items: entries.size,
					built: 0,
					kept: entries.size,
					moved: 0,
					replaced: 0,
					refallbacked: 0,
					restyled: 0,
					loads: 0,
					released: 0
				};
			}
			previous = { items, context };
			let built = 0;
			let kept = 0;
			let moved = 0;
			let replaced = 0;
			let refallbacked = 0;
			let restyled = 0;
			let loads = 0;
			const present_ = new Set<string>();

			for (const item of items) {
				present_.add(item.id);
				const existing = entries.get(item.id);
				if (existing === undefined) {
					const entry = build(item, context);
					entries.set(item.id, entry);
					built += 1;
					if (ensureLoad(entry, context)) loads += 1;
					continue;
				}
				const entry = existing;
				const before = entry.item;
				const source = sourceOf(item, context);
				const style = styleOf(item, context);
				let touched = false;
				entry.item = item;

				if (before.placementKey !== item.placementKey) {
					place(entry, item);
					moved += 1;
					touched = true;
				}
				if (entry.source !== source.key) {
					releaseSource(entry);
					entry.source = source.key;
					entry.url = source.url;
					entry.presentation.rotation.set(...item.presentation.rotation);
					entry.presentation.scale.setScalar(item.presentation.scale);
					replaced += 1;
					touched = true;
				}
				if (syncFallback(entry)) {
					refallbacked += 1;
					touched = true;
				}
				// A drawn caster that changed what it draws is a change the shadow owner
				// must observe, whether or not its surfaces changed too.
				if (entry.realization !== null && drawnFlags(before) !== drawnFlags(item)) {
					options.casters.publish({ kind: 'changed', entity: entry.caster });
				}
				if (entry.style !== style) {
					entry.style = style;
					entry.scope = context.scope;
					present(entry);
					restyled += 1;
					touched = true;
				}
				if (ensureLoad(entry, context)) {
					loads += 1;
					touched = true;
				}
				if (!touched) kept += 1;
			}

			let released = 0;
			for (const [id, entry] of entries) {
				if (present_.has(id)) continue;
				release(entry);
				entries.delete(id);
				released += 1;
			}

			return { items: entries.size, built, kept, moved, replaced, refallbacked, restyled, loads, released };
		},

		objectOf(id) {
			return entries.get(id)?.root ?? null;
		},

		stateOf(id) {
			return entries.get(id)?.state ?? null;
		},

		loaderStats() {
			return loader?.stats() ?? null;
		},

		async idle() {
			// An arrival enqueues its texture completion, so drain until nothing is pending.
			while (pending.size > 0) await Promise.all([...pending]);
		},

		dispose() {
			if (disposed) return;
			disposed = true;
			previous = null;
			for (const entry of entries.values()) release(entry);
			entries.clear();
			// After every instance is released: the templates are no longer drawn.
			loader?.dispose();
			loader = null;
		}
	};
}
