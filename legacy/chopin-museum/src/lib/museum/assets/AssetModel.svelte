<script lang="ts">
  import { untrack } from 'svelte';
  import { T } from '@threlte/core';
  import { useGltf, useMeshopt } from '@threlte/extras';
  import { Box3, type Object3D } from 'three';
  import { getAsset, resolveAssetFallback } from '$lib/content/assets';
  import type {
    AssetId,
    AssetLoadStatus,
    AssetMetrics,
    FallbackKind
  } from '$lib/types/assets';
  import type { Vec3 } from '$lib/types/scene';
  import type { EffectiveSceneMaterial } from '$lib/museum/materials/scene-instance-material';
  import AssetFallback from './AssetFallback.svelte';
  import { assetFallbackDimensions } from './fallbacks';
  import {
    cloneModelScene,
    disposeModelInstance,
    inspectModel,
    setModelWireframe
  } from './model-utils';
  import {
    remapModelMaterials,
    releaseModelMaterialRemap,
    type RemapKey
  } from './instance-material-remap';
  import { loadEffectiveTextures, type TextureLoadScope } from '$lib/museum/materials/texture-cache';

  const ZERO: Vec3 = [0, 0, 0];

  let {
    assetId,
    effective = null as EffectiveSceneMaterial | null,
    scope = null,
    position = ZERO,
    rotation = ZERO,
    scale = 1,
    fallback,
    enabled = true,
    visible = true,
    wireframe = false,
    shadows = true,
    showBounds = false,
    /** When true, AssetModel is already under an outer transform (editor placement root). */
    localTransform = false,
    status = $bindable<AssetLoadStatus>('idle'),
    metrics = $bindable<AssetMetrics | undefined>(),
    error = $bindable<string | undefined>()
  }: {
    assetId: AssetId;
    /** Phase 5.3 — resolved material to remap onto every GLTF mesh; null skips remap. */
    effective?: EffectiveSceneMaterial | null;
    /** P22.1 — release scope for texture-override loads; null keeps the global loader. */
    scope?: TextureLoadScope | null;
    position?: Vec3;
    rotation?: Vec3;
    scale?: number;
    fallback?: FallbackKind;
    enabled?: boolean;
    visible?: boolean;
    wireframe?: boolean;
    shadows?: boolean;
    showBounds?: boolean;
    localTransform?: boolean;
    status?: AssetLoadStatus;
    metrics?: AssetMetrics;
    error?: string;
  } = $props();

  const loader = useGltf({ meshoptDecoder: useMeshopt() });
  const asset = $derived(getAsset(assetId));
  // Placement fallback is authoritative. Manifest resolution is compatibility-only
  // for preview/renderer callers that do not provide a scene placement fallback.
  const fallbackKind = $derived(fallback ?? resolveAssetFallback(asset));

  let instance = $state<Object3D>();
  let acquiredRemap = $state<RemapKey | null>(null);
  let rawBounds = $state<Box3>();
  let rawMetrics = $state<AssetMetrics>();
  /** Internal load flag — avoid writing `$bindable status` inside the loader effect. */
  let loadStatus = $state<AssetLoadStatus>('idle');

  $effect(() => {
    const shouldLoad =
      enabled &&
      Boolean(asset.productionFile) &&
      (asset.status === 'approved' || asset.status === 'testing');
    const url = asset.productionFile;

    if (!shouldLoad || !url) {
      instance = undefined;
      rawBounds = undefined;
      rawMetrics = undefined;
      loadStatus = 'fallback';
      return;
    }

    let cancelled = false;
    let ownedInstance: Object3D | undefined;
    loadStatus = 'loading';

    const resource = loader.load(url);
    const unsubscribeModel = resource.subscribe((gltf) => {
      if (!gltf || cancelled) return;
      const activeEffective = effective;
      const activeScope = scope;
      ownedInstance = cloneModelScene(
        gltf.scene,
        shadows && asset.castShadow,
        shadows && asset.receiveShadow
      );
      if (activeEffective) {
        // Drop any prior remap before re-applying to the new instance.
        if (acquiredRemap) {
          releaseModelMaterialRemap(acquiredRemap, activeScope);
          acquiredRemap = null;
        }
        if (activeScope) {
          // Scoped cold path: wait for the release resolver before the first
          // remap, so the mounted frame is already textured — one acquire,
          // no transient mapless variant. Mount, inspection publish and the
          // ready status all ride the same gate below; the tail after this
          // block is the unscoped editor path only.
          const animNames = gltf.animations.map((animation) => animation.name).filter(Boolean);
          void loadEffectiveTextures(activeEffective, activeScope)
            .catch(() => undefined)
            .then(() => {
              if (cancelled) return;
              if (!ownedInstance) return;
              acquiredRemap = remapModelMaterials(ownedInstance, activeEffective, [1, 1], activeScope).acquiredKey;
              const inspection = inspectModel(ownedInstance, animNames);
              instance = ownedInstance;
              rawBounds = inspection.bounds;
              rawMetrics = inspection.metrics;
              loadStatus = 'ready';
            });
          return;
        }
        acquiredRemap = remapModelMaterials(ownedInstance, activeEffective, [1, 1], activeScope).acquiredKey;
      }
      const inspection = inspectModel(
        ownedInstance,
        gltf.animations.map((animation) => animation.name).filter(Boolean)
      );
      instance = ownedInstance;
      rawBounds = inspection.bounds;
      rawMetrics = inspection.metrics;
      loadStatus = 'ready';
    });
    const unsubscribeError = resource.error.subscribe((loadError) => {
      if (!loadError || cancelled) return;
      loadStatus = 'failed';
      untrack(() => {
        error = loadError.message;
      });
      if (import.meta.env.DEV) {
        console.warn(`[AssetModel] Failed to load ${asset.id} from ${url}`, loadError);
      }
    });

    return () => {
      cancelled = true;
      unsubscribeModel();
      unsubscribeError();
      if (ownedInstance) disposeModelInstance(ownedInstance);
      if (instance === ownedInstance) instance = undefined;
      if (acquiredRemap) {
        releaseModelMaterialRemap(acquiredRemap, scope);
        acquiredRemap = null;
      }
    };
  });

  // Mirror internal status to bindable for /dev/assets without feedback loops.
  $effect(() => {
    const next = loadStatus;
    untrack(() => {
      status = next;
      if (next !== 'failed') error = undefined;
    });
  });

  $effect(() => {
    if (instance) setModelWireframe(instance, wireframe);
  });

  const computedMetrics = $derived.by((): AssetMetrics => {
    const sourceMetrics = rawMetrics;
    const factor = asset.defaultScale * scale;
    if (sourceMetrics) {
      return {
        ...sourceMetrics,
        dimensions: sourceMetrics.dimensions.map((value) => value * factor) as Vec3
      };
    }

    const fallbackDimensions = assetFallbackDimensions[fallbackKind];
    return {
      dimensions: fallbackDimensions.map((value) => value * scale) as Vec3,
      meshCount: 0,
      materialCount: 0,
      triangleCount: 0,
      animationNames: []
    };
  });

  $effect(() => {
    const next = computedMetrics;
    untrack(() => {
      metrics = next;
    });
  });

  const fallbackBoundsPosition = $derived<Vec3>(
    fallbackKind === 'frame'
      ? ZERO
      : fallbackKind === 'chandelier'
        ? [0, -assetFallbackDimensions[fallbackKind][1] / 2, 0]
        : [0, assetFallbackDimensions[fallbackKind][1] / 2, 0]
  );

  // Re-apply the remap whenever the effective material changes after the GLTF
  // instance has already loaded.
  $effect(() => {
    const seed = effective?.variantSeed;
    const activeEffective = effective;
    const activeScope = scope;
    const mounted = instance;
    if (!mounted || !activeEffective || seed === undefined) return;
    if (acquiredRemap && acquiredRemap.seed === seed && (acquiredRemap.scopeId ?? null) === (activeScope?.scopeId ?? null)) return;
    if (acquiredRemap) {
      releaseModelMaterialRemap(acquiredRemap, activeScope);
      acquiredRemap = null;
    }
    if (activeScope) {
      // Scoped path: remap once after the release resolver lands so the
      // swapped frame is already textured. The previous scoped variant was
      // released above; a failed load keeps the GLB's own materials.
      let cancelled = false;
      void loadEffectiveTextures(activeEffective, activeScope)
        .catch(() => undefined)
        .then(() => {
          if (cancelled) return;
          if (instance !== mounted) return;
          if (acquiredRemap) releaseModelMaterialRemap(acquiredRemap, activeScope);
          acquiredRemap = remapModelMaterials(mounted, activeEffective, [1, 1], activeScope).acquiredKey;
        });
      return () => {
        cancelled = true;
      };
    }
    acquiredRemap = remapModelMaterials(mounted, activeEffective, [1, 1], activeScope).acquiredKey;
    return () => {
      if (acquiredRemap) {
        releaseModelMaterialRemap(acquiredRemap, activeScope);
        acquiredRemap = null;
      }
    };
  });

  const rootPosition = $derived(localTransform ? ZERO : position);
  const rootRotation = $derived(localTransform ? ZERO : rotation);
  const rootScale = $derived(localTransform ? 1 : scale);
</script>

<T.Group position={rootPosition} rotation={rootRotation} scale={rootScale} {visible}>
  {#if loadStatus !== 'ready'}
    <T.Group rotation={asset.defaultRotation ?? ZERO} scale={asset.defaultScale}>
      <AssetFallback
        kind={fallbackKind}
        {wireframe}
        castShadow={shadows && asset.castShadow}
        receiveShadow={shadows && asset.receiveShadow}
      />
      {#if showBounds}
        <T.Mesh position={fallbackBoundsPosition}>
          <T.BoxGeometry args={assetFallbackDimensions[fallbackKind]} />
          <T.MeshBasicMaterial
            color="#d6b35f"
            wireframe
            transparent
            opacity={0.8}
            depthTest={false}
          />
        </T.Mesh>
      {/if}
    </T.Group>
  {/if}

  {#if instance}
    <T.Group rotation={asset.defaultRotation ?? ZERO} scale={asset.defaultScale}>
      <T is={instance} />
      {#if showBounds && rawBounds}
        <T.Box3Helper args={[rawBounds, 0xd6b35f]} />
      {/if}
    </T.Group>
  {/if}
</T.Group>
