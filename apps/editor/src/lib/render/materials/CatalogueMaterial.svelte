<script lang="ts">
  /**
   * One catalogue surface, acquired from the Canvas material store.
   *
   * R2b's remaining surface migration: this component used to construct a
   * `MeshStandardMaterial` per mount, so 196 door portals with one look held 196
   * materials and every re-mount paid a construction and a GPU upload. It now
   * acquires by canonical descriptor key, and equal looks share one instance.
   *
   * The texture variant keeps its existing identity (material id × repeat ×
   * rotation, scope-namespaced) and its reference count. Its release is deferred
   * by the texture store, so a re-mount inside one update never deletes the bytes
   * the next mount asks for. While the maps load, the untextured descriptor is
   * drawn — exactly what `<T.MeshStandardMaterial>` rendered before its maps
   * arrived.
   *
   * Two lifecycle rules are load-bearing:
   *
   * - **Ownership is untracked.** The effect reads only descriptor inputs; the
   *   lease it holds lives in a plain variable, and the reactive `lease` is a
   *   publication for the template. If the effect read the published state it
   *   would track it, and publishing a lease would re-run the effect forever.
   * - **Threlte never disposes the instance.** `dispose={false}` keeps the shared
   *   material out of Threlte's disposal registry: the reference-counted store is
   *   the only disposal authority, so one consumer unmounting cannot free a
   *   material another consumer still draws.
   */
  import { T } from '@threlte/core';
  import { useRenderResources } from '$lib/render/resources/render-resources';
  import type { MaterialLease } from '$lib/render/resources/material-store';
  import {
    MATERIAL_TEXTURE_SLOTS,
    type MaterialTextureKeys,
    type StandardMaterialDescriptor
  } from '$lib/render/resources/material-descriptor';
  import { computeTextureRepeat, getMaterial } from '$lib/content/materials';
  import type {
    MaterialId,
    MaterialLoadStatus,
    MaterialTextureMode,
    Vec2
  } from '$lib/types/materials';
  import {
    acquireMaterialVariant,
    loadMaterialTextures,
    materialTextureVariantKey,
    releaseMaterialVariant,
    type LoadedTextureMaps,
    type TextureLoadScope
  } from '$lib/render/resources/texture-store';

  let {
    materialId,
    surfaceSize,
    receiveLighting = true,
    textures = 'auto' as MaterialTextureMode,
    tint,
    wireframe = false,
    repeat: repeatOverride,
    rotation = 0,
    scope = null,
    status = $bindable<MaterialLoadStatus>('idle')
  }: {
    materialId: MaterialId;
    surfaceSize: Vec2;
    receiveLighting?: boolean;
    textures?: MaterialTextureMode;
    tint?: string;
    wireframe?: boolean;
    repeat?: Vec2;
    rotation?: number;
    scope?: TextureLoadScope | null;
    status?: MaterialLoadStatus;
  } = $props();

  const resources = useRenderResources();
  const definition = $derived(getMaterial(materialId));
  const tileSize = $derived<[number, number]>(definition.defaultTileSizeMeters ?? [1, 1]);
  const computedRepeat = $derived(
    repeatOverride ?? computeTextureRepeat(surfaceSize, tileSize)
  );
  const color = $derived(tint ?? definition.fallbackColor);

  /**
   * The lease this component owns, as plain (untracked) state.
   *
   * The effect must not read this: ownership changes inside the effect, and a
   * reactive read would make the effect depend on its own writes. `lease` below
   * is the template's view of the same value, written only.
   */
  let owned: MaterialLease | null = null;
  let lease = $state<MaterialLease | null>(null);

  /** Hand the template a new view. Never read `lease` from the effect. */
  function publish(next: MaterialLease | null): void {
    owned = next;
    lease = next;
  }

  /** Give this component's claim back; the store disposes at the last lease. */
  function releaseOwned(): void {
    const current = owned;
    owned = null;
    lease = null;
    current?.release();
  }

  /** The variant key per bound slot: the material key records texture identity. */
  function boundTextures(maps: LoadedTextureMaps, key: string): MaterialTextureKeys | null {
    const textures: Partial<Record<(typeof MATERIAL_TEXTURE_SLOTS)[number], string>> = {};
    let bound = false;
    for (const slot of MATERIAL_TEXTURE_SLOTS) {
      if (maps[slot] === undefined) continue;
      textures[slot] = key;
      bound = true;
    }
    return bound ? textures : null;
  }

  $effect(() => {
    // Tracked inputs: the resolved descriptor and its keyed lookup parameters.
    const def = definition;
    const [rx, ry] = computedRepeat;
    const rot = rotation;
    const mode = textures;
    const activeScope = scope;
    const base: StandardMaterialDescriptor = {
      kind: 'standard',
      color: color,
      roughness: def.roughness,
      metalness: def.metalness,
      toneMapped: receiveLighting,
      ...(wireframe ? { wireframe: true } : {})
    };
    let cancelled = false;
    let variant: { id: string; rx: number; ry: number; rot: number } | null = null;

    // Untracked ownership: release the previous run's claim, take this run's.
    releaseOwned();
    publish(resources.materials.acquire(base));

    if (mode === 'off' || !def.textures || Object.keys(def.textures).length === 0) {
      status = 'fallback';
      return () => {
        cancelled = true;
        releaseOwned();
      };
    }

    status = 'loading';

    loadMaterialTextures(def, activeScope).then((result) => {
      if (cancelled) return;

      if (result.status !== 'ready' || !result.maps.map) {
        status = 'failed';
        return;
      }

      const maps = acquireMaterialVariant(def, result.maps, rx, ry, rot, activeScope);
      const bound = boundTextures(maps, materialTextureVariantKey(def.id, rx, ry, rot, activeScope));
      if (bound === null) {
        releaseMaterialVariant(def.id, rx, ry, rot, activeScope);
        status = 'failed';
        return;
      }
      variant = { id: def.id, rx, ry, rot };
      const untextured = owned;
      publish(resources.materials.acquire({ ...base, textures: bound }, maps));
      // Another surface with this tint keeps the untextured instance alive.
      untextured?.release();
      status = 'ready';
    });

    return () => {
      cancelled = true;
      releaseOwned();
      if (variant) {
        releaseMaterialVariant(variant.id, variant.rx, variant.ry, variant.rot, activeScope);
        variant = null;
      }
    };
  });
</script>

{#if lease}
  <!--
    Attaches the shared instance; `T` sets the parent mesh's material.
    `dispose={false}` is required: Threlte's disposal context would otherwise
    call `dispose()` on this store-owned instance on unmount, freeing a material
    other consumers still lease. The store is the only disposal authority.
  -->
  <T is={lease.material} dispose={false} />
{/if}
