/**
 * The texture-resource store.
 *
 * It holds the source-texture cache and the per-effective-material variant pool,
 * counts references, and reports the two `texture:variant-*` counters. It is a
 * render resource that lives beside the material store that leases from it; it
 * is a module-level pool keyed by load scope, not one of the per-Canvas stores
 * in `render-resources.ts`.
 *
 * Variant release is **deferred**, as the rendering contract asks: a
 * variant whose count reaches zero is disposed at the next idle point, so a
 * release-then-reacquire inside one update never deletes a GPU texture.
 */
import {
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture as ThreeTexture
} from 'three';
import type { MaterialDefinition, MaterialTextureSlot } from '$lib/types/materials';
import { countWork } from '@portfolio/layout-core';
import type { TextureVariantSource } from './texture-variant';

export type LoadedTextureMaps = Partial<Record<MaterialTextureSlot, ThreeTexture>>;

export type MaterialTexturesResult =
  | { status: 'loading' }
  | { status: 'ready'; maps: LoadedTextureMaps }
  | { status: 'failed'; error: string; maps?: LoadedTextureMaps };

type SourceEntry = {
  /** Assigned immediately after construction, before the first await. */
  promise: Promise<ThreeTexture> | null;
  texture?: ThreeTexture;
  error?: string;
};

type VariantKey = string;

type VariantEntry = {
  maps: LoadedTextureMaps;
  refCount: number;
  /**
   * The variant's count reached zero.
   *
   * The GPU textures stay alive until the next idle point, so a release and a
   * re-acquire inside one update never delete and re-upload a texture. A later
   * acquire clears the mark and keeps the same maps.
   */
  pendingDispose: boolean;
};

/**
 * Variants released during the current update, waiting for the idle point.
 *
 * Deferred disposal is what makes a changed look cheap: Scene materials are
 * released and re-acquired inside one representation update whenever a mesh is
 * rebuilt, and disposing the old variant immediately would re-upload bytes that
 * the next entity with the same look is about to ask for.
 */
let pendingVariantDisposals = 0;
let flushScheduled = false;

function scheduleDeferredFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(() => {
    flushScheduled = false;
    flushDeferredTextureReleases();
  });
}

/**
 * Dispose every variant still at zero references. Called at the idle point (a
 * microtask after the update that released it) and by tests that need a
 * deterministic ending; safe to call at any time.
 */
/** A variant's default UV shift: the mapping's absence. */
const DEFAULT_OFFSET: readonly [number, number] = [0, 0];

export function flushDeferredTextureReleases(): void {
  for (const [key, entry] of variantCache) {
    if (!entry.pendingDispose || entry.refCount > 0) continue;
    for (const texture of Object.values(entry.maps)) texture?.dispose();
    variantCache.delete(key);
    pendingVariantDisposals -= 1;
    countWork('texture:variant-dispose');
  }
}

/** How many variants are waiting for the idle point. Observation only. */
export function deferredTextureReleaseCount(): number {
  return pendingVariantDisposals;
}

const loader = new TextureLoader();
const sourceCache = new Map<string, SourceEntry>();
const variantCache = new Map<VariantKey, VariantEntry>();
const materialLoadPromises = new Map<string, Promise<MaterialTexturesResult>>();

/**
 * The decode policy of one render slot.
 *
 * `srgb` is a colour input: the hardware decodes the stored sRGB bytes once.
 * `raw` is data: no transfer function, no premultiplication. The policy is part
 * of the source-cache key, so one URI bound as both a colour map and a data map
 * cannot inherit whichever slot loaded first.
 */
export type TextureDecodePolicy = 'srgb' | 'raw';

/**
 * The upload row convention.
 *
 * `legacy` preserves TextureLoader's bottom-up rows for the pre-S8 path, exactly
 * as every existing catalogue surface draws. `top` uploads top-first rows for a
 * sampled Finish, whose graph applies the one origin conversion at the sample
 * boundary.
 */
export type TextureRowStorage = 'legacy' | 'top';

export function texturePolicyForSlot(slot: MaterialTextureSlot): TextureDecodePolicy {
  return slot === 'map' ? 'srgb' : 'raw';
}

/** The render slot one portable map role reads. */
export function textureSlotForRole(
  role: 'color' | 'normal' | 'roughness' | 'metalness' | 'occlusion'
): MaterialTextureSlot {
  switch (role) {
    case 'color':
      return 'map';
    case 'normal':
      return 'normalMap';
    case 'roughness':
      return 'roughnessMap';
    case 'metalness':
      return 'metalnessMap';
    case 'occlusion':
      return 'aoMap';
  }
}

/**
 * One source texture's render interpretation.
 *
 * The returned texture's `colorSpace` states the policy it was loaded under. The
 * caller must not mutate it; a second role with a different policy loads its own
 * entry, which is the fix for the one-cache-two-meanings defect.
 */
function applySourceDefaults(
  texture: ThreeTexture,
  policy: TextureDecodePolicy,
  storage: TextureRowStorage = 'legacy'
) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = policy === 'srgb' ? SRGBColorSpace : NoColorSpace;
  // Top-first storage for the sampled path; the legacy path keeps TextureLoader's
  // default so every existing surface draws exactly as before.
  if (storage === 'top') texture.flipY = false;
  // Data roles read raw channel values: never premultiply, never assume a
  // 4-byte alignment from the source image's own row width.
  texture.premultiplyAlpha = false;
  texture.unpackAlignment = 1;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 1;
  texture.needsUpdate = true;
}

/** Apply the slot's decode policy to a clone without second-guessing its source. */
function applyClonePolicy(texture: ThreeTexture, slot: MaterialTextureSlot) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = texturePolicyForSlot(slot) === 'srgb' ? SRGBColorSpace : NoColorSpace;
  texture.premultiplyAlpha = false;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 1;
  texture.needsUpdate = true;
}

/**
 * Phase 5.4 source-loader injection. Editors (the only known callers) wire
 * a default loader that consults `BinaryTextureStore` first, then falls
 * back to the legacy public-fetch path. The visitor NEVER sets this; its
 * legacy fetch path stays untouched.
 *
 * Lives at module scope, not a singleton, so multiple editor loads in tests
 * can swap freely without a class instance. The setter accepts `null` to
 * restore the legacy path.
 */
export type TextureSourceLoader = (
  uri: string,
  slot: MaterialTextureSlot
) => Promise<ThreeTexture>;

/**
 * Explicit release scope for cold visitor loads.
 *
 * When supplied, texture loads use `loader` (never the mutable process-global
 * default) and every cache key is prefixed with `scopeId`, so the same logical
 * URI in two projects/releases cannot share bytes. Editor callers omit the
 * scope and keep the legacy global-loader behavior untouched.
 */
export type TextureLoadScope = {
  scopeId: string;
  loader: TextureSourceLoader;
};

/**
 * Key-only view of a scope. Acquire/release never load — they only need the
 * cache namespace — so callers holding just a retained key (e.g. a remap key)
 * can release without fabricating a loader.
 */
export type TextureScopeKey = Pick<TextureLoadScope, 'scopeId'>;

function scopeIdOf(scope?: TextureLoadScope | TextureScopeKey | null): string | null {
  const id = scope?.scopeId;
  return id && id.length > 0 ? id : null;
}

function sourceKey(
  scope: TextureLoadScope | TextureScopeKey | null | undefined,
  url: string,
  policy: TextureDecodePolicy,
  storage: TextureRowStorage
): string {
  const id = scopeIdOf(scope);
  const base = `${policy}::${storage}::${url}`;
  return id ? `${id}::${base}` : base;
}

function materialPromiseKey(scope: TextureLoadScope | TextureScopeKey | null | undefined, materialId: string): string {
  const id = scopeIdOf(scope);
  return id ? `${id}::${materialId}` : materialId;
}

let defaultSourceLoader: TextureSourceLoader | null = null;

export function setDefaultTextureSourceLoader(loader: TextureSourceLoader | null): void {
  defaultSourceLoader = loader;
}

/** TEST-ONLY: clear any injected loader so legacy path is restored. */
export function __resetDefaultSourceLoaderForTests(): void {
  defaultSourceLoader = null;
}

function loadSource(
  url: string,
  slot: MaterialTextureSlot,
  materialId: string,
  scope?: TextureLoadScope | null,
  storage: TextureRowStorage = 'legacy'
): Promise<ThreeTexture> {
  const policy = texturePolicyForSlot(slot);
  const key = sourceKey(scope ?? null, url, policy, storage);
  const existing = sourceCache.get(key);
  if (existing) {
    if (existing.error) return Promise.reject(new Error(existing.error));
    if (existing.texture) return Promise.resolve(existing.texture);
    if (existing.promise !== null) return existing.promise;
    return Promise.reject(new Error('Texture load is not available.'));
  }

  // The entry is the identity a late completion must still own. A Retry, a pin
  // change or a disposed scope replaces the entry; an older promise must not
  // write its result into the newer one.
  const entry: SourceEntry = { promise: null };
  const promise = scope
    ? loadViaScopedLoader(key, url, slot, materialId, scope.loader, entry, policy, storage)
    : defaultSourceLoader
      ? loadViaDefaultSourceLoader(key, url, slot, materialId, entry, policy, storage)
      : loadViaTextureLoader(key, url, slot, materialId, entry, policy, storage);

  entry.promise = promise;
  sourceCache.set(key, entry);
  return promise;
}

function loadViaTextureLoader(
  key: string,
  url: string,
  slot: MaterialTextureSlot,
  materialId: string,
  entry: SourceEntry,
  policy: TextureDecodePolicy,
  storage: TextureRowStorage
): Promise<ThreeTexture> {
  return new Promise<ThreeTexture>((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        applySourceDefaults(texture, policy, storage);
        if (sourceCache.get(key) === entry) entry.texture = texture;
        resolve(texture);
      },
      undefined,
      (event) => {
        const message = `Failed to load texture for material "${materialId}": ${url}`;
        console.warn(message, event);
        if (sourceCache.get(key) === entry) entry.error = message;
        reject(new Error(message));
      }
    );
  });
}

async function loadViaDefaultSourceLoader(
  key: string,
  url: string,
  slot: MaterialTextureSlot,
  materialId: string,
  entry: SourceEntry,
  policy: TextureDecodePolicy,
  storage: TextureRowStorage
): Promise<ThreeTexture> {
  try {
    const texture = await defaultSourceLoader!(url, slot);
    applySourceDefaults(texture, policy, storage);
    if (sourceCache.get(key) === entry) entry.texture = texture;
    return texture;
  } catch (event) {
    const message = `Failed to load texture for material "${materialId}": ${url}`;
    console.warn(message, event);
    if (sourceCache.get(key) === entry) entry.error = message;
    throw new Error(message);
  }
}

async function loadViaScopedLoader(
  key: string,
  url: string,
  slot: MaterialTextureSlot,
  materialId: string,
  scoped: TextureSourceLoader,
  entry: SourceEntry,
  policy: TextureDecodePolicy,
  storage: TextureRowStorage
): Promise<ThreeTexture> {
  try {
    const texture = await scoped(url, slot);
    applySourceDefaults(texture, policy, storage);
    if (sourceCache.get(key) === entry) entry.texture = texture;
    return texture;
  } catch (event) {
    const message = `Failed to load texture for material "${materialId}": ${url}`;
    console.warn(message, event);
    if (sourceCache.get(key) === entry) entry.error = message;
    throw new Error(message);
  }
}

function variantKey(
  materialId: string,
  repeatX: number,
  repeatY: number,
  rotation: number,
  scope?: TextureLoadScope | TextureScopeKey | null,
  offset: readonly [number, number] = DEFAULT_OFFSET
): VariantKey {
  const id = scopeIdOf(scope);
  const base = `${materialId}|${repeatX.toFixed(4)}|${repeatY.toFixed(4)}|${rotation.toFixed(4)}|${offset[0].toFixed(4)}|${offset[1].toFixed(4)}`;
  return id ? `${id}::${base}` : base;
}

function cloneMaps(
  sources: LoadedTextureMaps,
  repeatX: number,
  repeatY: number,
  rotation: number,
  offset: readonly [number, number] = DEFAULT_OFFSET
): LoadedTextureMaps {
  const maps: LoadedTextureMaps = {};

  for (const [slot, source] of Object.entries(sources) as [MaterialTextureSlot, ThreeTexture][]) {
    if (!source) continue;
    const clone = source.clone();
    // The role decides the transfer function, not whichever slot loaded the
    // source first. This is the one-cache-two-meanings defect's fix.
    applyClonePolicy(clone, slot);
    clone.flipY = source.flipY;
    clone.repeat.set(repeatX, repeatY);
    clone.rotation = rotation;
    clone.offset.set(offset[0], offset[1]);
    clone.center.set(0.5, 0.5);
    clone.needsUpdate = true;
    maps[slot] = clone;
  }

  return maps;
}

export async function loadMaterialTextures(
  definition: MaterialDefinition,
  scope?: TextureLoadScope | null
): Promise<MaterialTexturesResult> {
  const textures = definition.textures;
  if (!textures || Object.keys(textures).length === 0) {
    return { status: 'failed', error: `Material "${definition.id}" has no texture paths` };
  }

  const promiseKey = materialPromiseKey(scope ?? null, definition.id);
  const cached = materialLoadPromises.get(promiseKey);
  if (cached) return cached;

  const promise = (async (): Promise<MaterialTexturesResult> => {
    const maps: LoadedTextureMaps = {};
    const errors: string[] = [];

    await Promise.all(
      (Object.entries(textures) as [MaterialTextureSlot, string][]).map(async ([slot, url]) => {
        try {
          maps[slot] = await loadSource(url, slot, definition.id, scope ?? null);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      })
    );

    if (!maps.map && errors.length > 0) {
      return { status: 'failed', error: errors.join('; '), maps };
    }

    if (errors.length > 0) {
      console.warn(
        `Material "${definition.id}" loaded partially; using available maps. ${errors.join('; ')}`
      );
    }

    return { status: 'ready', maps };
  })();

  materialLoadPromises.set(promiseKey, promise);
  return promise;
}

export function acquireMaterialVariant(
  definition: MaterialDefinition,
  sourceMaps: LoadedTextureMaps,
  repeatX: number,
  repeatY: number,
  rotation = 0,
  scope?: TextureLoadScope | TextureScopeKey | null,
  offset: readonly [number, number] = DEFAULT_OFFSET
): LoadedTextureMaps {
	countWork('texture:variant-acquire');
  const key = variantKey(definition.id, repeatX, repeatY, rotation, scope ?? null, offset);
  const existing = variantCache.get(key);
  if (existing) {
    existing.refCount += 1;
    if (existing.pendingDispose) {
      // Re-acquired before the idle point: the same maps stay on the GPU.
      existing.pendingDispose = false;
      pendingVariantDisposals -= 1;
    }
    return existing.maps;
  }

  const maps = cloneMaps(sourceMaps, repeatX, repeatY, rotation, offset);
  variantCache.set(key, { maps, refCount: 1, pendingDispose: false });
  return maps;
}

export function releaseMaterialVariant(
  materialId: string,
  repeatX: number,
  repeatY: number,
  rotation = 0,
  scope?: TextureLoadScope | TextureScopeKey | null,
  offset: readonly [number, number] = DEFAULT_OFFSET
) {
  const key = variantKey(materialId, repeatX, repeatY, rotation, scope ?? null, offset);
  const existing = variantCache.get(key);
  if (!existing) return;
  // A duplicate release is a caller bug, not a second claim: an already-zero
  // entry must not schedule a second disposal.
  if (existing.refCount <= 0) return;

  existing.refCount -= 1;
  if (existing.refCount > 0) return;

  existing.pendingDispose = true;
  pendingVariantDisposals += 1;
  scheduleDeferredFlush();
}

/**
 * Drop one cached source failure (or a loaded source) so the next load retries.
 *
 * The source cache remembers a failed load permanently, which is right for an
 * immutable catalogue path but wrong for a creator image: a blocked request, a
 * replaced pin or a creator's explicit Retry must be able to ask again. Only
 * the named scope's entry is dropped; every other Canvas keeps its lease.
 */
/** @returns whether a cached texture was disposed here. */
export function invalidateTextureSource(scopeId: string | null, url: string): boolean {
  const prefix = scopeId === null ? '' : `${scopeId}::`;
  const suffix = `::${url}`;
  let disposed = false;
  for (const [key, entry] of [...sourceCache]) {
    if (!key.endsWith(suffix)) continue;
    if (prefix !== '') {
      if (!key.startsWith(prefix)) continue;
    } else if (!key.startsWith('srgb::') && !key.startsWith('raw::')) {
      // A null scope invalidates the un-scoped namespace only.
      continue;
    }
    sourceCache.delete(key);
    entry.texture?.dispose();
    disposed ||= entry.texture !== undefined;
  }
  return disposed;
}

/**
 * Drop a scope's material-level results so a Retry (or a new route) runs the
 * material loader again instead of replaying a cached failure. The source cache
 * remains the byte cache; successes reload from it without another fetch.
 */
export function invalidateScopedMaterialLoads(scopeId: string): void {
  const prefix = `${scopeId}::`;
  for (const key of materialLoadPromises.keys()) {
    if (key.startsWith(prefix)) materialLoadPromises.delete(key);
  }
}

/** Test helper: clear in-memory caches (does not dispose GPU sources still referenced). */
export function resetTextureCachesForTests() {
  for (const entry of variantCache.values()) {
    for (const texture of Object.values(entry.maps)) texture?.dispose();
  }
  variantCache.clear();
  pendingVariantDisposals = 0;
  flushScheduled = false;
  materialLoadPromises.clear();
  sourceCache.clear();
}

// ---------------------------------------------------------------------------
// Phase 5.3 — per-effective material-instance variant pool.
// ---------------------------------------------------------------------------

export type EffectiveLoadResult =
  | { status: 'ready'; maps: LoadedTextureMaps }
  | { status: 'partial'; maps: LoadedTextureMaps; failed: string[] }
  | { status: 'failed'; error: string; maps: LoadedTextureMaps }
  | { status: 'fallback' };

/**
 * Source loader reused by both Phase 5.2 catalogue path and Phase 5.3 effective
 * path. Same URL produces a single `THREE.Texture` instance regardless of caller.
 */
export function loadSourceTexture(
  url: string,
  slot: MaterialTextureSlot,
  scope?: TextureLoadScope | null
): Promise<ThreeTexture> {
  return loadSource(url, slot, 'effective', scope ?? null);
}

export async function loadEffectiveTextures(
  effective: TextureVariantSource,
  scope?: TextureLoadScope | null
): Promise<EffectiveLoadResult> {
  const entries = Object.entries(effective.slotUris) as [MaterialTextureSlot, string][];
  if (entries.length === 0) {
    return { status: 'fallback' };
  }

  const maps: LoadedTextureMaps = {};
  const failed: string[] = [];

  await Promise.all(
    entries.map(async ([entrySlot, url]) => {
      try {
        maps[entrySlot] = await loadSourceTexture(url, entrySlot, scope ?? null);
      } catch (error) {
        failed.push(error instanceof Error ? error.message : String(error));
      }
    })
  );

  if (!maps.map) {
    if (failed.length > 0) {
      return { status: 'failed', error: failed.join('; '), maps };
    }
    return { status: 'fallback' };
  }

  if (failed.length > 0) return { status: 'partial', maps, failed };
  return { status: 'ready', maps };
}

function effectiveVariantKey(
  seed: string,
  rx: number,
  ry: number,
  rot: number,
  scope?: TextureLoadScope | TextureScopeKey | null,
  offset: readonly [number, number] = DEFAULT_OFFSET
): VariantKey {
  const id = scopeIdOf(scope);
  const base = `eff|${seed}|${rx.toFixed(4)}|${ry.toFixed(4)}|${rot.toFixed(4)}|${offset[0].toFixed(4)}|${offset[1].toFixed(4)}`;
  return id ? `${id}::${base}` : base;
}

/**
 * The published name of one effective variant, for a material descriptor's key.
 *
 * The descriptor must record the texture identity without holding Three objects,
 * so the variant pool is the one place that names it. A look's material key is
 * therefore a function of its variant key, and equal looks share one material.
 */
export function effectiveTextureVariantKey(
  seed: string,
  repeatX: number,
  repeatY: number,
  rotation = 0,
  scope?: TextureLoadScope | TextureScopeKey | null,
  offset: readonly [number, number] = DEFAULT_OFFSET
): string {
  return effectiveVariantKey(seed, repeatX, repeatY, rotation, scope ?? null, offset);
}

/** The published name of one catalogue-material variant, for a descriptor's key. */
export function materialTextureVariantKey(
  materialId: string,
  repeatX: number,
  repeatY: number,
  rotation = 0,
  scope?: TextureLoadScope | TextureScopeKey | null,
  offset: readonly [number, number] = DEFAULT_OFFSET
): string {
  return variantKey(materialId, repeatX, repeatY, rotation, scope ?? null, offset);
}

export function acquireEffectiveVariant(
  effective: TextureVariantSource,
  repeatX: number,
  repeatY: number,
  rotation = 0,
  scope?: TextureLoadScope | TextureScopeKey | null,
  offset: readonly [number, number] = DEFAULT_OFFSET
): LoadedTextureMaps {
	countWork('texture:variant-acquire');
  const key = effectiveVariantKey(effective.variantSeed, repeatX, repeatY, rotation, scope ?? null, offset);
  const existing = variantCache.get(key);
  if (existing) {
    existing.refCount += 1;
    if (existing.pendingDispose) {
      existing.pendingDispose = false;
      pendingVariantDisposals -= 1;
    }
    return existing.maps;
  }

  const maps: LoadedTextureMaps = {};
  for (const [entrySlot, url] of Object.entries(effective.slotUris) as [
    MaterialTextureSlot,
    string
  ][]) {
    const cached = sourceCache.get(
      sourceKey(scope ?? null, url, texturePolicyForSlot(entrySlot), 'legacy')
    );
    if (!cached?.texture) continue;
    const source = cached.texture;
    const clone = source.clone();
    applyClonePolicy(clone, entrySlot);
    clone.flipY = source.flipY;
    clone.repeat.set(repeatX, repeatY);
    clone.rotation = rotation;
    clone.offset.set(offset[0], offset[1]);
    clone.center.set(0.5, 0.5);
    clone.needsUpdate = true;
    maps[entrySlot] = clone;
  }
  variantCache.set(key, { maps, refCount: 1, pendingDispose: false });
  return maps;
}

/**
 * The source texture a sampled Finish view reads.
 *
 * Storage is top-first and the slot supplies the decode policy, so the sample
 * graph can apply exactly one origin conversion. The key includes both, so the
 * same URI sampled as colour and as data never shares one interpretation.
 */
export function loadFinishTexture(
  uri: string,
  role: 'color' | 'normal' | 'roughness' | 'metalness' | 'occlusion',
  scope?: TextureLoadScope | null
): Promise<ThreeTexture> {
  return loadSource(uri, textureSlotForRole(role), 'finish', scope ?? null, 'top');
}

export function releaseEffectiveVariant(
  seed: string,
  repeatX: number,
  repeatY: number,
  rotation = 0,
  scope?: TextureLoadScope | TextureScopeKey | null,
  offset: readonly [number, number] = DEFAULT_OFFSET
): void {
  const key = effectiveVariantKey(seed, repeatX, repeatY, rotation, scope ?? null, offset);
  const existing = variantCache.get(key);
  if (!existing) return;
  if (existing.refCount <= 0) return;

  existing.refCount -= 1;
  if (existing.refCount > 0) return;

  // Deferred: release and re-acquire inside one update keeps the GPU texture.
  existing.pendingDispose = true;
  pendingVariantDisposals += 1;
  scheduleDeferredFlush();
}
