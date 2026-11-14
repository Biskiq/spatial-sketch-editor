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

  let lease = $state<MaterialLease | null>(null);

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

    lease?.release();
    lease = resources.materials.acquire(base);

    if (mode === 'off' || !def.textures || Object.keys(def.textures).length === 0) {
      status = 'fallback';
      return () => {
        cancelled = true;
        lease?.release();
        lease = null;
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
      const untextured = lease;
      lease = resources.materials.acquire({ ...base, textures: bound }, maps);
      // Another surface with this tint keeps the untextured instance alive.
      untextured?.release();
      status = 'ready';
    });

    return () => {
      cancelled = true;
      lease?.release();
      lease = null;
      if (variant) {
        releaseMaterialVariant(variant.id, variant.rx, variant.ry, variant.rot, activeScope);
        variant = null;
      }
    };
  });
</script>

{#if lease}
  <!-- Attaches the shared instance; `T` sets the parent mesh's material. -->
  <T is={lease.material} />
{/if}
