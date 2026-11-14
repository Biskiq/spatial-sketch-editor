<script lang="ts">
  /**
   * One approved model in the Scene, on the Canvas's stores (E8/R5 + R2c).
   *
   * This component is the per-entity host: it owns the GLB subscription, the
   * fallback (a Svelte tree) and the entity root's transform. Everything about a
   * drawn instance lives in `$lib/render/models/model-realization`: the clone of
   * the template, its store leases and its texture variant. The host publishes
   * caster events on the Canvas's channel, so the shadow owner invalidates once per
   * arrival and once per release, not every frame (G4).
   *
   * A load that resolves after its host has moved on is rejected by the arrival
   * gate: a replaced URL, a replaced look or an unmounted host never mounts a clone.
   */
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
  import { inspectModel } from './model-utils';
  import {
    createArrivalGate,
    modelLookFor,
    nextModelEntityId,
    realizeModel,
    texturesReady,
    type ModelRealization
  } from '$lib/render/models/model-realization';
  import { useRenderResources } from '$lib/render/resources/render-resources';
  import { loadEffectiveTextures, type TextureLoadScope } from '$lib/render/resources/texture-store';

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

  const resources = useRenderResources();
  const loader = useGltf({ meshoptDecoder: useMeshopt() });
  const entity = `model-host:${nextModelEntityId()}`;
  const gate = createArrivalGate();
  // A creator model id is deliberately absent from the catalogue: it has no
  // production GLB in this build, so the approved footprint box is its render.
  const asset = $derived(getAssetById(assetId));
  // Placement fallback is authoritative. Manifest resolution is compatibility-only
  // for preview/renderer callers that do not provide a scene placement fallback.
  const fallbackKind = $derived(fallbackKindFor(fallback, asset));
  const fallbackDimensions = $derived(fallbackDimensionsFor(fallbackKind, fallbackFootprint));

  let instance = $state<Object3D>();
  /** The drawn instance this host owns; a raw value, never proxied. */
  let realization = $state.raw<ModelRealization | null>(null);
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

  /** The style a drawn instance is in: the look's identity and the shadow flags. */
  function styleKeyOf(): string {
    return [
      effective?.variantSeed ?? '-',
      effective?.color ?? '-',
      effective?.roughness ?? '-',
      effective?.metalness ?? '-',
      scope?.scopeId ?? '-',
      wireframe,
      shadows && castShadow,
      shadows && receiveShadow
    ].join('|');
  }
  let applied: { readonly realization: ModelRealization; readonly key: string } | null = null;

  // The load and its arrival. A new URL or a disabled host closes the previous
  // gate, and that teardown releases the instance the previous load mounted.
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

    const token = gate.begin();
    loadStatus = 'loading';

    const resource = loader.load(url);
    const unsubscribeModel = resource.subscribe((gltf) => {
      if (!gltf || !gate.accepts(token)) return;
      const template = gltf.scene;
      const animationNames = gltf.animations.map((animation) => animation.name).filter(Boolean);
      const mount = (textured: boolean): void => {
        // Textures resolve asynchronously: only the arrival that is still current mounts.
        if (!gate.accepts(token)) return;
        const active = effective;
        const next = realizeModel(template, {
          asset: url,
          store: resources.materials,
          look: active === null ? null : modelLookFor(active, scope, textured),
          wireframe,
          castShadow: shadows && castShadow,
          receiveShadow: shadows && receiveShadow
        });
        const inspection = inspectModel(next.root, animationNames);
        realization = next;
        applied = { realization: next, key: styleKeyOf() };
        instance = next.root;
        rawBounds = inspection.bounds;
        rawMetrics = inspection.metrics;
        loadStatus = 'ready';
        resources.casters.publish({ kind: 'arrived', entity });
      };
      if (effective === null) {
        mount(false);
        return;
      }
      // The textures resolve before the first mount, so the mounted frame is already
      // textured. A failed load mounts the untextured look, as the GLB's own did.
      void loadEffectiveTextures(effective, scope)
        .catch(() => undefined)
        .then((result) => mount(texturesReady(result)));
    });
    const unsubscribeError = resource.error.subscribe((loadError) => {
      if (!loadError || !gate.accepts(token)) return;
      loadStatus = 'failed';
      untrack(() => {
        error = loadError.message;
      });
      if (import.meta.env.DEV) {
        console.warn(`[AssetModel] Failed to load ${assetId} from ${url}`, loadError);
      }
    });

    return () => {
      gate.close();
      unsubscribeModel();
      unsubscribeError();
      if (realization !== null) {
        resources.casters.publish({ kind: 'released', entity });
        realization.release();
        realization = null;
      }
      instance = undefined;
    };
  });

  // Re-style the drawn instance when its look, wireframe or shadow flags change.
  // The arrival already styled it with the same key, so that case does nothing.
  let latestKey = '';
  $effect(() => {
    const current = realization;
    if (current === null) return;
    const key = styleKeyOf();
    if (applied !== null && applied.realization === current && applied.key === key) return;
    const activeEffective = effective;
    const activeScope = scope;
    const flags = {
      wireframe,
      castShadow: shadows && castShadow,
      receiveShadow: shadows && receiveShadow
    };
    latestKey = key;
    const restyle = (textured: boolean): void => {
      // A newer style, or a released instance, supersedes this one: never apply it.
      if (realization !== current || latestKey !== key) return;
      current.restyle({
        look: activeEffective === null ? null : modelLookFor(activeEffective, activeScope, textured),
        ...flags
      });
      applied = { realization: current, key };
    };
    if (activeEffective === null) {
      restyle(false);
      return;
    }
    void loadEffectiveTextures(activeEffective, activeScope)
      .catch(() => undefined)
      .then((result) => restyle(texturesReady(result)));
  });

  // A caster that stays mounted but changes what it draws (visibility or the shadow
  // switch) is a caster change the shadow owner must observe.
  let drawnFlags: string | null = null;
  $effect(() => {
    const flags = `${visible}|${shadows}`;
    if (drawnFlags !== null && drawnFlags !== flags && realization !== null) {
      resources.casters.publish({ kind: 'changed', entity });
    }
    drawnFlags = flags;
  });

  // Mirror internal status to bindable for /dev/assets without feedback loops.
  $effect(() => {
    const next = loadStatus;
    untrack(() => {
      status = next;
      if (next !== 'failed') error = undefined;
    });
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
