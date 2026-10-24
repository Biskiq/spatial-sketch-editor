<script lang="ts">
  import { untrack } from 'svelte';
  import { T } from '@threlte/core';
  import { useGltf, useMeshopt } from '@threlte/extras';
  import { Box3, type Object3D } from 'three';
  import { getAssetById } from '$lib/content/assets';
  import type {
    AssetId,
    AssetLoadStatus,
    AssetMetrics,
    FallbackKind
  } from '$lib/types/assets';
  import type { Vec3 } from '$lib/types/scene';
  import type { EffectiveSceneMaterial } from '$lib/museum/materials/scene-instance-material';
  import AssetFallback from './AssetFallback.svelte';
  import { fallbackDimensionsFor, fallbackKindFor } from './fallbacks';
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
    fallbackFootprint,
    /**
     * Approved creator-model bytes, resolved by whoever owns the project session.
     * The URL is runtime data: this component never knows how it was authorised.
     */
    resolvedUrl = null,
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
    /** Approved creator-model footprint (metres); sizes the generic fallback box. */
    fallbackFootprint?: { width: number; depth: number };
    /** A resolved approved derivative URL; null falls back to the catalogue asset. */
    resolvedUrl?: string | null;
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
  // A creator-model id is deliberately absent from the catalogue: it has no
  // production GLB in this build, so the approved footprint box is its render.
  const asset = $derived(getAssetById(assetId));
  // Placement fallback is authoritative. Manifest resolution is compatibility-only
  // for preview/renderer callers that do not provide a scene placement fallback.
  const fallbackKind = $derived(fallbackKindFor(fallback, asset));
  const fallbackDimensions = $derived(fallbackDimensionsFor(fallbackKind, fallbackFootprint));

  let instance = $state<Object3D>();
  let acquiredRemap = $state<RemapKey | null>(null);
  let rawBounds = $state<Box3>();
  let rawMetrics = $state<AssetMetrics>();
  /** Internal load flag — avoid writing `$bindable status` inside the loader effect. */
  let loadStatus = $state<AssetLoadStatus>('idle');

  // A resolved approved derivative wins over the catalogue file: a creator model
  // is not in the catalogue at all, and its bytes come from the project's own
  // approved revision. The catalogue path is unchanged when nothing is resolved.
  const loadUrl = $derived(
    resolvedUrl ??
      (asset?.productionFile !== undefined &&
      (asset.status === 'approved' || asset.status === 'testing')
        ? asset.productionFile
        : null)
  );

  // A creator model has no catalogue record, so its shadow flags come from the
  // renderer's defaults rather than from an asset entry that does not exist.
  const castShadow = $derived(asset?.castShadow ?? true);
  const receiveShadow = $derived(asset?.receiveShadow ?? true);

  $effect(() => {
    const shouldLoad = enabled && Boolean(loadUrl);
    const url = loadUrl;

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
        shadows && castShadow,
        shadows && receiveShadow
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
        console.warn(`[AssetModel] Failed to load ${assetId} from ${url}`, loadError);
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
    const factor = (asset?.defaultScale ?? 1) * scale;
    if (sourceMetrics) {
      return {
        ...sourceMetrics,
        dimensions: sourceMetrics.dimensions.map((value) => value * factor) as Vec3
      };
    }

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
        ? [0, -fallbackDimensions[1] / 2, 0]
        : [0, fallbackDimensions[1] / 2, 0]
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
    <T.Group rotation={asset?.defaultRotation ?? ZERO} scale={asset?.defaultScale ?? 1}>
      <AssetFallback
        kind={fallbackKind}
        dimensions={fallbackDimensions}
        {wireframe}
        castShadow={shadows && (asset?.castShadow ?? false)}
        receiveShadow={shadows && (asset?.receiveShadow ?? false)}
      />
      {#if showBounds}
        <T.Mesh position={fallbackBoundsPosition}>
          <T.BoxGeometry args={fallbackDimensions} />
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
    <T.Group rotation={asset?.defaultRotation ?? ZERO} scale={asset?.defaultScale ?? 1}>
      <T is={instance} />
      {#if showBounds && rawBounds}
        <T.Box3Helper args={[rawBounds, 0xd6b35f]} />
      {/if}
    </T.Group>
  {/if}
</T.Group>
