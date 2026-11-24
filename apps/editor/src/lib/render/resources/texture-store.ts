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
  Texture as ThreeTextureClass,
  TextureLoader,
  type Texture as ThreeTexture
} from 'three';
import type { MaterialDefinition, MaterialTextureSlot } from '$lib/types/materials';
import { countWork } from '@portfolio/layout-core';
import { probeRawImage } from './image-encoding';
import { ImageLoadFailure, isImageLoadFailure } from './image-load-failure';
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
  failure?: ImageLoadFailure;
  /** Callers still waiting; the final abort cancels the shared IO. */
  waiters: number;
  /** The shared load was cancelled; a late completion must not install. */
  cancelled: boolean;
  controller: AbortController | null;
  /** True while this entry is the cache's retained owner of its source. */
  cacheOwned: boolean;
  /** Compressed source bytes retained for this entry, when the loader knows them. */
  compressedBytes: number;
  /** Estimated decoded RGBA8 bytes for this entry's source image. */
  decodedBytes: number;
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

let liveCompressedBytes = 0;
let liveDecodedBytes = 0;
let peakCompressedBytes = 0;
let peakDecodedBytes = 0;

export type TextureSourceMemoryStats = {
  /** Loaded source entries retained by the cache. */
  readonly liveSources: number;
  /** Compressed file bytes retained, where a loader reports them. */
  readonly compressedBytes: number;
  /** Estimated decoded RGBA8 CPU bytes retained. */
  readonly decodedBytes: number;
  /** Highest compressed-byte total observed since the last reset. */
  readonly peakCompressedBytes: number;
  /** Highest decoded-CPU-byte total observed since the last reset. */
  readonly peakDecodedBytes: number;
};

/**
 * The plan's separate source-memory readings.
 *
 * `compressedBytes` counts bytes a loader could report (raw fetch/scoped bytes);
 * it is not a synthetic estimate for a legacy loader that never exposes its
 * response body. `decodedBytes` is an RGBA8 estimate from the image dimensions,
 * not browser heap accounting. Both are released when the owning scope tears
 * down.
 */
export function textureSourceMemoryStats(): TextureSourceMemoryStats {
  return {
    liveSources: sourceCache.size,
    compressedBytes: liveCompressedBytes,
    decodedBytes: liveDecodedBytes,
    peakCompressedBytes,
    peakDecodedBytes
  };
}

function decodedCpuBytesOf(texture: ThreeTexture): number {
  const image = texture.image as
    | { width?: unknown; height?: unknown; naturalWidth?: unknown; naturalHeight?: unknown }
    | null
    | undefined;
  const width = Number(image?.width ?? image?.naturalWidth);
  const height = Number(image?.height ?? image?.naturalHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return 0;
  return Math.round(width * height * 4);
}

function compressedBytesOf(texture: ThreeTexture): number {
  const value = (texture.userData as { s8SourceBytes?: unknown } | undefined)?.s8SourceBytes;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

function setEntryCompressedBytes(entry: SourceEntry, bytes: number): void {
  if (!entry.cacheOwned) return;
  const next = Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : 0;
  liveCompressedBytes -= entry.compressedBytes;
  entry.compressedBytes = next;
  liveCompressedBytes += next;
  peakCompressedBytes = Math.max(peakCompressedBytes, liveCompressedBytes);
}

function setEntryDecodedBytes(entry: SourceEntry, bytes: number): void {
  if (!entry.cacheOwned) return;
  const next = Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : 0;
  liveDecodedBytes -= entry.decodedBytes;
  entry.decodedBytes = next;
  liveDecodedBytes += next;
  peakDecodedBytes = Math.max(peakDecodedBytes, liveDecodedBytes);
}

/**
 * Final-owner cleanup for decoded bitmaps.
 *
 * A decoder hands the store an `ImageBitmap` (or any closable image). The
 * source texture and every variant clone of it share that one bitmap through
 * Three's `Source`, so no single texture is its owner. Each texture that holds
 * the bitmap registers here once; its `dispose` event drops one interest, and
 * the last interest closes the bitmap. A texture that is never disposed keeps
 * its bitmap open, so a live clone can still re-upload after an invalidated
 * source disposes.
 */
type ClosableImage = { close(): void };
const decodedImageOwners = new Map<ClosableImage, number>();
const decodedImageTextures = new WeakSet<ThreeTexture>();
let closedDecodedImages = 0;

function closableImageOf(texture: ThreeTexture): ClosableImage | null {
  const image = texture.image as unknown;
  if (image === null || typeof image !== 'object') return null;
  return typeof (image as { close?: unknown }).close === 'function'
    ? (image as ClosableImage)
    : null;
}

/** Register one texture as an owner of its decoded bitmap. Idempotent per texture. */
export function retainDecodedImage(texture: ThreeTexture): void {
  const image = closableImageOf(texture);
  if (image === null || decodedImageTextures.has(texture)) return;
  decodedImageTextures.add(texture);
  decodedImageOwners.set(image, (decodedImageOwners.get(image) ?? 0) + 1);
  const onDispose = () => {
    texture.removeEventListener('dispose', onDispose);
    const remaining = (decodedImageOwners.get(image) ?? 1) - 1;
    if (remaining > 0) {
      decodedImageOwners.set(image, remaining);
      return;
    }
    decodedImageOwners.delete(image);
    closedDecodedImages += 1;
    image.close();
  };
  texture.addEventListener('dispose', onDispose);
}

export type DecodedImageStats = {
  /** Decoded bitmaps with at least one undisposed owning texture. */
  readonly open: number;
  /** Bitmaps closed by their final owner since the last reset. */
  readonly closed: number;
};

/** Observation only: open and closed decoded bitmaps. */
export function decodedImageStats(): DecodedImageStats {
  return { open: decodedImageOwners.size, closed: closedDecodedImages };
}

/** Remove one retained source and its memory from the live totals. */
function removeSourceEntry(key: string, entry: SourceEntry): void {
  if (entry.cacheOwned) {
    entry.cacheOwned = false;
    liveCompressedBytes -= entry.compressedBytes;
    liveDecodedBytes -= entry.decodedBytes;
    entry.compressedBytes = 0;
    entry.decodedBytes = 0;
  }
  if (sourceCache.get(key) === entry) sourceCache.delete(key);
}

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
export type TextureSourceLoadOptions = {
  readonly policy: TextureDecodePolicy;
  readonly storage: TextureRowStorage;
  /** Aborted when the last caller waiting on this shared source leaves. */
  readonly signal?: AbortSignal;
};

export type TextureSourceLoader = (
  uri: string,
  slot: MaterialTextureSlot,
  options?: TextureSourceLoadOptions
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

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The texture load was cancelled.', 'AbortError');
}

/**
 * Drop one in-flight source when its final waiter leaves.
 *
 * A completed texture stays cached: the IO is already paid for, and another
 * caller may legitimately join it. An in-flight entry is removed so a late
 * completion cannot install into a cache key its caller abandoned.
 */
function cancelSourceEntry(key: string, entry: SourceEntry): void {
  if (entry.texture !== undefined) return;
  entry.cancelled = true;
  entry.controller?.abort();
  removeSourceEntry(key, entry);
}

/**
 * Wait for one shared source, tracking interest for cancellation.
 *
 * Every caller joins the same promise; only when the last one aborts is the
 * shared fetch/decode aborted. One cancellation therefore never stops bytes
 * another visible surface still needs.
 */
function waitForSource(
  key: string,
  entry: SourceEntry,
  promise: Promise<ThreeTexture>,
  signal?: AbortSignal
): Promise<ThreeTexture> {
  entry.waiters += 1;
  const leave = (): void => {
    entry.waiters = Math.max(0, entry.waiters - 1);
  };
  if (signal === undefined) return promise.finally(leave);
  if (signal.aborted) {
    leave();
    if (entry.waiters === 0) cancelSourceEntry(key, entry);
    return Promise.reject(abortReason(signal));
  }
  return new Promise<ThreeTexture>((resolve, reject) => {
    let done = false;
    const onAbort = (): void => {
      if (done) return;
      done = true;
      signal.removeEventListener('abort', onAbort);
      leave();
      if (entry.waiters === 0) cancelSourceEntry(key, entry);
      reject(abortReason(signal));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (texture) => {
        if (done) return;
        done = true;
        signal.removeEventListener('abort', onAbort);
        leave();
        resolve(texture);
      },
      (error: unknown) => {
        if (done) return;
        done = true;
        signal.removeEventListener('abort', onAbort);
        leave();
        reject(error);
      }
    );
  });
}

function loadSource(
  url: string,
  slot: MaterialTextureSlot,
  materialId: string,
  scope?: TextureLoadScope | null,
  storage: TextureRowStorage = 'legacy',
  signal?: AbortSignal
): Promise<ThreeTexture> {
  const policy = texturePolicyForSlot(slot);
  const key = sourceKey(scope ?? null, url, policy, storage);
  const existing = sourceCache.get(key);
  if (existing) {
    if (existing.error) {
      return Promise.reject(
        existing.failure !== undefined
          ? new ImageLoadFailure(existing.error, existing.failure.phase, existing.failure.httpStatus)
          : new Error(existing.error)
      );
    }
    if (existing.texture) return Promise.resolve(existing.texture);
    if (existing.promise !== null) return waitForSource(key, existing, existing.promise, signal);
    return Promise.reject(new Error('Texture load is not available.'));
  }
  if (signal?.aborted) return Promise.reject(abortReason(signal));

  // The entry is the identity a late completion must still own. A Retry, a pin
  // change or a disposed scope replaces the entry; an older promise must not
  // write its result into the newer one.
  const controller = new AbortController();
  const entry: SourceEntry = {
    promise: null,
    waiters: 0,
    cancelled: false,
    controller,
    cacheOwned: false,
    compressedBytes: 0,
    decodedBytes: 0
  };
  const sourceSignal = controller.signal;
  const promise = scope
    ? loadViaScopedLoader(key, url, slot, materialId, scope.loader, entry, policy, storage, sourceSignal)
    : defaultSourceLoader
      ? loadViaDefaultSourceLoader(key, url, slot, materialId, entry, policy, storage, sourceSignal)
      : loadViaTextureLoader(key, url, slot, materialId, entry, policy, storage, sourceSignal);

  entry.promise = promise;
  sourceCache.set(key, entry);
  entry.cacheOwned = true;
  // A failed read releases its compressed-byte reservation; the entry stays
  // cached as a failure so a retry still has to invalidate it explicitly.
  void promise.catch(() => {
    if (entry.texture === undefined) setEntryCompressedBytes(entry, 0);
  });
  return waitForSource(key, entry, promise, signal);
}

function loadViaTextureLoader(
  key: string,
  url: string,
  slot: MaterialTextureSlot,
  materialId: string,
  entry: SourceEntry,
  policy: TextureDecodePolicy,
  storage: TextureRowStorage,
  signal: AbortSignal
): Promise<ThreeTexture> {
  const legacy = (): Promise<ThreeTexture> =>
    new Promise<ThreeTexture>((resolve, reject) => {
      loader.load(
        url,
        (texture) => {
          retainDecodedImage(texture);
          if (entry.cancelled || signal.aborted) {
            texture.dispose();
            reject(abortReason(signal));
            return;
          }
          applySourceDefaults(texture, policy, storage);
          setEntryCompressedBytes(entry, compressedBytesOf(texture));
          setEntryDecodedBytes(entry, decodedCpuBytesOf(texture));
          if (sourceCache.get(key) === entry) entry.texture = texture;
          resolve(texture);
        },
        undefined,
        (event) => {
          if (entry.cancelled || signal.aborted) {
            reject(abortReason(signal));
            return;
          }
          const message = `Failed to load texture for material "${materialId}": ${url}`;
          console.warn(message, event);
          if (sourceCache.get(key) === entry) entry.error = message;
          reject(new Error(message));
        }
      );
    });

  // Raw catalogue/fixture bytes must not go through the browser's colour-managed
  // `<img>` decode. Fetch the file and hand the decoder an identity contract; a
  // failure is a failed raw load, never a silent sRGB fallback.
  if (policy === 'raw') {
    return (async () => {
      if (typeof createImageBitmap !== 'function' || typeof fetch !== 'function') {
        throw new Error(`Raw texture loading requires fetch and createImageBitmap: ${url}`);
      }
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      setEntryCompressedBytes(entry, bytes.byteLength);
      // Validate the container before the decoder allocates an RGBA buffer.
      probeRawImage(bytes);
      const bitmap = await createImageBitmap(new Blob([bytes], { type: blob.type || 'image/png' }), {
        imageOrientation: 'none',
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none'
      });
      if (entry.cancelled || signal.aborted) {
        bitmap.close();
        throw abortReason(signal);
      }
      const texture = new ThreeTextureClass(bitmap);
      retainDecodedImage(texture);
      applySourceDefaults(texture, policy, storage);
      setEntryCompressedBytes(entry, bytes.byteLength);
      setEntryDecodedBytes(entry, decodedCpuBytesOf(texture));
      if (sourceCache.get(key) === entry) entry.texture = texture;
      return texture;
    })();
  }
  return legacy();
}

async function loadViaDefaultSourceLoader(
  key: string,
  url: string,
  slot: MaterialTextureSlot,
  materialId: string,
  entry: SourceEntry,
  policy: TextureDecodePolicy,
  storage: TextureRowStorage,
  signal: AbortSignal
): Promise<ThreeTexture> {
  try {
    const texture = await defaultSourceLoader!(url, slot, { policy, storage, signal });
    retainDecodedImage(texture);
    if (entry.cancelled || signal.aborted) {
      texture.dispose();
      throw abortReason(signal);
    }
    applySourceDefaults(texture, policy, storage);
    setEntryCompressedBytes(entry, compressedBytesOf(texture));
    setEntryDecodedBytes(entry, decodedCpuBytesOf(texture));
    if (sourceCache.get(key) === entry) entry.texture = texture;
    return texture;
  } catch (event) {
    if (entry.cancelled || signal.aborted) throw abortReason(signal);
    const message = `Failed to load texture for material "${materialId}": ${url}`;
    console.warn(message, event);
    if (sourceCache.get(key) === entry) {
      entry.error = message;
      if (isImageLoadFailure(event)) entry.failure = event;
    }
    throw isImageLoadFailure(event) ? event : new Error(message);
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
  storage: TextureRowStorage,
  signal: AbortSignal
): Promise<ThreeTexture> {
  try {
    const texture = await scoped(url, slot, { policy, storage, signal });
    retainDecodedImage(texture);
    if (entry.cancelled || signal.aborted) {
      texture.dispose();
      throw abortReason(signal);
    }
    applySourceDefaults(texture, policy, storage);
    setEntryCompressedBytes(entry, compressedBytesOf(texture));
    setEntryDecodedBytes(entry, decodedCpuBytesOf(texture));
    if (sourceCache.get(key) === entry) entry.texture = texture;
    return texture;
  } catch (event) {
    if (entry.cancelled || signal.aborted) throw abortReason(signal);
    const message = `Failed to load texture for material "${materialId}": ${url}`;
    console.warn(message, event);
    if (sourceCache.get(key) === entry) {
      entry.error = message;
      if (isImageLoadFailure(event)) entry.failure = event;
    }
    throw isImageLoadFailure(event) ? event : new Error(message);
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
    retainDecodedImage(clone);
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

    // A requested colour map is required; a map-less set (a metal's structure
    // maps under a measured F0 factor) is textured by whatever it does carry.
    const colorMissing = textures.map !== undefined ? !maps.map : Object.keys(maps).length === 0;
    if (colorMissing && errors.length > 0) {
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
export function invalidateTextureSource(scopeId: string | null, url: string): void {
  const prefix = scopeId === null ? '' : `${scopeId}::`;
  const suffix = `::${url}`;
  for (const [key, entry] of [...sourceCache]) {
    if (!key.endsWith(suffix)) continue;
    if (prefix !== '') {
      if (!key.startsWith(prefix)) continue;
    } else if (!key.startsWith('srgb::') && !key.startsWith('raw::')) {
      // A null scope invalidates the un-scoped namespace only.
      continue;
    }
    removeSourceEntry(key, entry);
    entry.cancelled = true;
    entry.controller?.abort();
    entry.texture?.dispose();
  }
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

/**
 * Release every source and variant one scope owns.
 *
 * Route and release teardown must not leave source-cache bytes, decoded CPU
 * images or variant textures to a later budget eviction. This is the one
 * teardown operation both the authenticated project scope and the cold release
 * scope call; it aborts in-flight reads so a late completion cannot reinstall.
 */
export function releaseTextureScope(scopeId: string): void {
  const prefix = `${scopeId}::`;
  for (const [key, entry] of [...variantCache]) {
    if (!key.startsWith(prefix)) continue;
    for (const texture of Object.values(entry.maps)) texture?.dispose();
    variantCache.delete(key);
    if (entry.pendingDispose) pendingVariantDisposals = Math.max(0, pendingVariantDisposals - 1);
    countWork('texture:variant-dispose');
  }
  for (const [key, entry] of [...sourceCache]) {
    if (!key.startsWith(prefix)) continue;
    entry.cancelled = true;
    entry.controller?.abort();
    removeSourceEntry(key, entry);
    entry.texture?.dispose();
  }
  for (const key of [...materialLoadPromises.keys()]) {
    if (key.startsWith(prefix)) materialLoadPromises.delete(key);
  }
}

/** Test helper: clear in-memory caches (does not dispose GPU sources still referenced). */
export function resetTextureCachesForTests() {
  for (const entry of sourceCache.values()) {
    entry.cancelled = true;
    entry.controller?.abort();
    entry.cacheOwned = false;
  }
  for (const entry of variantCache.values()) {
    for (const texture of Object.values(entry.maps)) texture?.dispose();
  }
  variantCache.clear();
  pendingVariantDisposals = 0;
  flushScheduled = false;
  materialLoadPromises.clear();
  sourceCache.clear();
  liveCompressedBytes = 0;
  liveDecodedBytes = 0;
  peakCompressedBytes = 0;
  peakDecodedBytes = 0;
  decodedImageOwners.clear();
  closedDecodedImages = 0;
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
  scope?: TextureLoadScope | null,
  signal?: AbortSignal
): Promise<ThreeTexture> {
  return loadSource(url, slot, 'effective', scope ?? null, 'legacy', signal);
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

  // A requested colour map is required; a map-less set binds what it carries.
  const colorMissing = effective.slotUris.map !== undefined ? !maps.map : Object.keys(maps).length === 0;
  if (colorMissing) {
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
    retainDecodedImage(clone);
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
  scope?: TextureLoadScope | null,
  signal?: AbortSignal
): Promise<ThreeTexture> {
  return loadSource(uri, textureSlotForRole(role), 'finish', scope ?? null, 'top', signal);
}

/** The cache identity of one Finish source: roles with one decode policy share it. */
export function finishTextureKey(
  uri: string,
  role: 'color' | 'normal' | 'roughness' | 'metalness' | 'occlusion',
  scope?: TextureLoadScope | TextureScopeKey | null
): string {
  return sourceKey(scope ?? null, uri, texturePolicyForSlot(textureSlotForRole(role)), 'top');
}

/** The loaded Finish texture the source cache still owns under this key, if any. */
export function cachedFinishTexture(
  uri: string,
  role: 'color' | 'normal' | 'roughness' | 'metalness' | 'occlusion',
  scope?: TextureLoadScope | TextureScopeKey | null
): ThreeTexture | undefined {
  return sourceCache.get(finishTextureKey(uri, role, scope))?.texture;
}

/**
 * Evict one Finish source after its last view lease is gone.
 *
 * Finish views own the GPU residency of their top-first upload: the view cache
 * charges exact mip bytes and evicts unleased views oldest-first. Removing only
 * the Finish source key leaves the legacy upload and every other decode policy
 * for the same URI untouched. With `expected`, a source that has since replaced
 * that texture under the same key is left untouched too.
 *
 * @returns whether this call disposed a loaded texture.
 */
export function releaseFinishTexture(
  uri: string,
  role: 'color' | 'normal' | 'roughness' | 'metalness' | 'occlusion',
  scope?: TextureLoadScope | TextureScopeKey | null,
  expected?: ThreeTexture
): boolean {
  const key = finishTextureKey(uri, role, scope);
  const entry = sourceCache.get(key);
  if (entry === undefined) return false;
  if (expected !== undefined && entry.texture !== expected) return false;
  removeSourceEntry(key, entry);
  entry.cancelled = true;
  entry.controller?.abort();
  if (entry.texture === undefined) return false;
  entry.texture.dispose();
  return true;
}

/**
 * Hand one loaded Finish source to its still-leased view, without disposing it.
 *
 * Scope teardown (`releaseTextureScope`) disposes every source the scope still
 * caches. A Finish view that a live material is still sampling must not lose its
 * texture there: the view cache retires that entry and disposes the texture at
 * its final lease release. Detaching removes the source key (so nothing can join
 * or reinstall it, and live source bytes drop at teardown) and transfers the
 * single disposal duty to the view cache. With `expected`, a source that has
 * since replaced that texture under the same key stays with the cache.
 *
 * @returns whether a loaded texture was detached.
 */
export function detachFinishTexture(
  uri: string,
  role: 'color' | 'normal' | 'roughness' | 'metalness' | 'occlusion',
  scope?: TextureLoadScope | TextureScopeKey | null,
  expected?: ThreeTexture
): boolean {
  const key = finishTextureKey(uri, role, scope);
  const entry = sourceCache.get(key);
  if (entry === undefined || entry.texture === undefined) return false;
  if (expected !== undefined && entry.texture !== expected) return false;
  removeSourceEntry(key, entry);
  return true;
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
