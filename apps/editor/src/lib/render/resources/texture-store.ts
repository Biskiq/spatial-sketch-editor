/**
 * E6/R2a — the texture-resource store.
 *
 * Moved here unchanged from `museum/materials/texture-cache.ts`: the same
 * source cache, the same per-effective-material variant pool, the same
 * reference counts and the same two `texture:variant-*` counters. Ownership is
 * what changed — a render resource now lives beside the material store that
 * leases it, not inside the museum components that happened to use it first.
 *
 * `renderer-refactor.md` §2.4 also asks for **deferred** variant release (a
 * variant whose count reaches zero is disposed at the next idle point, so a
 * release-then-reacquire inside one update never deletes a GPU texture). That
 * behaviour is R2b/E7's, with the Scene look that exercises it; E6 moves the
 * pool and establishes its owner without changing when a texture is released.
 */
import {
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
  promise: Promise<ThreeTexture>;
  texture?: ThreeTexture;
  error?: string;
};

type VariantKey = string;

type VariantEntry = {
  maps: LoadedTextureMaps;
  refCount: number;
  /**
   * E7/R2b — the variant's count reached zero.
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

function applySourceDefaults(texture: ThreeTexture, slot: MaterialTextureSlot) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = slot === 'map' ? SRGBColorSpace : NoColorSpace;
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
 * P22.1 — explicit release scope for cold visitor loads.
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

function sourceKey(scope: TextureLoadScope | TextureScopeKey | null | undefined, url: string): string {
  const id = scopeIdOf(scope);
  return id ? `${id}::${url}` : url;
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
  scope?: TextureLoadScope | null
): Promise<ThreeTexture> {
  const key = sourceKey(scope ?? null, url);
  const existing = sourceCache.get(key);
  if (existing) {
    if (existing.error) return Promise.reject(new Error(existing.error));
    if (existing.texture) return Promise.resolve(existing.texture);
    return existing.promise;
  }

  const promise = scope
    ? loadViaScopedLoader(key, url, slot, materialId, scope.loader)
    : defaultSourceLoader
      ? loadViaDefaultSourceLoader(key, url, slot, materialId)
      : loadViaTextureLoader(key, url, slot, materialId);

  sourceCache.set(key, { promise });
  return promise;
}

function loadViaTextureLoader(
  key: string,
  url: string,
  slot: MaterialTextureSlot,
  materialId: string
): Promise<ThreeTexture> {
  return new Promise<ThreeTexture>((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        applySourceDefaults(texture, slot);
        const entry = sourceCache.get(key);
        if (entry) entry.texture = texture;
        resolve(texture);
      },
      undefined,
      (event) => {
        const message = `Failed to load texture for material "${materialId}": ${url}`;
        console.warn(message, event);
        const entry = sourceCache.get(key);
        if (entry) entry.error = message;
        reject(new Error(message));
      }
    );
  });
}

async function loadViaDefaultSourceLoader(
  key: string,
  url: string,
  slot: MaterialTextureSlot,
  materialId: string
): Promise<ThreeTexture> {
  try {
    const texture = await defaultSourceLoader!(url, slot);
    applySourceDefaults(texture, slot);
    const entry = sourceCache.get(key);
    if (entry) entry.texture = texture;
    return texture;
  } catch (event) {
    const message = `Failed to load texture for material "${materialId}": ${url}`;
    console.warn(message, event);
    const entry = sourceCache.get(key);
    if (entry) entry.error = message;
    throw new Error(message);
  }
}

async function loadViaScopedLoader(
  key: string,
  url: string,
  slot: MaterialTextureSlot,
  materialId: string,
  scoped: TextureSourceLoader
): Promise<ThreeTexture> {
  try {
    const texture = await scoped(url, slot);
    applySourceDefaults(texture, slot);
    const entry = sourceCache.get(key);
    if (entry) entry.texture = texture;
    return texture;
  } catch (event) {
    const message = `Failed to load texture for material "${materialId}": ${url}`;
    console.warn(message, event);
    const entry = sourceCache.get(key);
    if (entry) entry.error = message;
    throw new Error(message);
  }
}

function variantKey(
  materialId: string,
  repeatX: number,
  repeatY: number,
  rotation: number,
  scope?: TextureLoadScope | TextureScopeKey | null
): VariantKey {
  const id = scopeIdOf(scope);
  const base = `${materialId}|${repeatX.toFixed(4)}|${repeatY.toFixed(4)}|${rotation.toFixed(4)}`;
  return id ? `${id}::${base}` : base;
}

function cloneMaps(
  sources: LoadedTextureMaps,
  repeatX: number,
  repeatY: number,
  rotation: number
): LoadedTextureMaps {
  const maps: LoadedTextureMaps = {};

  for (const [slot, source] of Object.entries(sources) as [MaterialTextureSlot, ThreeTexture][]) {
    if (!source) continue;
    const clone = source.clone();
    clone.wrapS = RepeatWrapping;
    clone.wrapT = RepeatWrapping;
    clone.colorSpace = source.colorSpace;
    clone.repeat.set(repeatX, repeatY);
    clone.rotation = rotation;
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
  scope?: TextureLoadScope | TextureScopeKey | null
): LoadedTextureMaps {
	countWork('texture:variant-acquire');
  const key = variantKey(definition.id, repeatX, repeatY, rotation, scope ?? null);
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

  const maps = cloneMaps(sourceMaps, repeatX, repeatY, rotation);
  variantCache.set(key, { maps, refCount: 1, pendingDispose: false });
  return maps;
}

export function releaseMaterialVariant(
  materialId: string,
  repeatX: number,
  repeatY: number,
  rotation = 0,
  scope?: TextureLoadScope | TextureScopeKey | null
) {
  const key = variantKey(materialId, repeatX, repeatY, rotation, scope ?? null);
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
  scope?: TextureLoadScope | TextureScopeKey | null
): VariantKey {
  const id = scopeIdOf(scope);
  const base = `eff|${seed}|${rx.toFixed(4)}|${ry.toFixed(4)}|${rot.toFixed(4)}`;
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
  scope?: TextureLoadScope | TextureScopeKey | null
): string {
  return effectiveVariantKey(seed, repeatX, repeatY, rotation, scope ?? null);
}

/** The published name of one catalogue-material variant, for a descriptor's key. */
export function materialTextureVariantKey(
  materialId: string,
  repeatX: number,
  repeatY: number,
  rotation = 0,
  scope?: TextureLoadScope | TextureScopeKey | null
): string {
  return variantKey(materialId, repeatX, repeatY, rotation, scope ?? null);
}

export function acquireEffectiveVariant(
  effective: TextureVariantSource,
  repeatX: number,
  repeatY: number,
  rotation = 0,
  scope?: TextureLoadScope | TextureScopeKey | null
): LoadedTextureMaps {
	countWork('texture:variant-acquire');
  const key = effectiveVariantKey(effective.variantSeed, repeatX, repeatY, rotation, scope ?? null);
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
    const cached = sourceCache.get(sourceKey(scope ?? null, url));
    if (!cached?.texture) continue;
    const source = cached.texture;
    const clone = source.clone();
    clone.wrapS = RepeatWrapping;
    clone.wrapT = RepeatWrapping;
    clone.colorSpace = source.colorSpace;
    clone.repeat.set(repeatX, repeatY);
    clone.rotation = rotation;
    clone.center.set(0.5, 0.5);
    clone.needsUpdate = true;
    maps[entrySlot] = clone;
  }
  variantCache.set(key, { maps, refCount: 1, pendingDispose: false });
  return maps;
}

export function releaseEffectiveVariant(
  seed: string,
  repeatX: number,
  repeatY: number,
  rotation = 0,
  scope?: TextureLoadScope | TextureScopeKey | null
): void {
  const key = effectiveVariantKey(seed, repeatX, repeatY, rotation, scope ?? null);
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
