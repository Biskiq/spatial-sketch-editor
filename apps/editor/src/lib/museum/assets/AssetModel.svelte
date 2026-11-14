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
   * Presentation is generational. Every arrival, style change and teardown starts a
   * new generation; a texture completion applies only while it is still the newest,
   * so a superseded look never mounts or restyles, and the newest look always gets
   * its own completion. A load that resolves after its host has moved on is rejected
   * by the arrival gate, so a replaced URL or an unmounted host never mounts a clone.
   *
   * The instance is mounted with `dispose={false}`: the store owns every material it
   * draws and the loader's cache owns the template geometry, so Threlte's disposal
   * registry must never free either.
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
    type ModelRealization,
    type ModelStyle
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

  /** An arrived template, as the load that produced it named it. Plain data, never reactive. */
  type Arrival = {
    readonly token: number;
    readonly url: string;
    readonly template: Object3D;
    readonly animationNames: string[];
  };
  /** The style one presentation applies, captured when the presentation starts. */
  type Presentation = {
    readonly key: string;
    readonly effective: EffectiveSceneMaterial | null;
    readonly scope: TextureLoadScope | null;
    readonly wireframe: boolean;
    readonly castShadow: boolean;
    readonly receiveShadow: boolean;
  };

  let arrival: Arrival | null = null;
  /** Bumped by every presentation, arrival and teardown: only the newest may apply. */
  let generation = 0;
  /** The style key the drawn instance shows now; showing the same key again is a no-op. */
  let shown: string | null = null;

  /**
   * Show a presentation on the arrived template. The first show mounts the instance;
   * later shows restyle it. A gate-closed arrival never shows.
   */
  function show(current: Arrival, look: Presentation, textured: boolean): void {
    if (!gate.accepts(current.token)) return;
    const surface =
      look.effective === null ? null : modelLookFor(look.effective, look.scope, textured);
    const style: ModelStyle = {
      look: surface,
      wireframe: look.wireframe,
      castShadow: look.castShadow,
      receiveShadow: look.receiveShadow
    };
    const key = `${look.key}|${textured}`;
    if (realization === null) {
      const next = realizeModel(current.template, {
        asset: current.url,
        store: resources.materials,
        ...style
      });
      const inspection = inspectModel(next.root, current.animationNames);
      realization = next;
      shown = key;
      instance = next.root;
      rawBounds = inspection.bounds;
      rawMetrics = inspection.metrics;
      loadStatus = 'ready';
      resources.casters.publish({ kind: 'arrived', entity });
      return;
    }
    if (shown === key) return;
    realization.restyle(style);
    shown = key;
  }

  /**
   * Present the current style on the arrived template. An unscoped look mounts at
   * once, untextured, and remaps when its textures resolve. A scoped look waits for
   * its textures before the first mount, so its mounted frame is already textured.
   * Every completion is checked against the generation it started under.
   */
  function present(): void {
    const current = arrival;
    if (current === null || !gate.accepts(current.token)) return;
    const look: Presentation = {
      key: styleKeyOf(),
      effective,
      scope,
      wireframe,
      castShadow: shadows && castShadow,
      receiveShadow: shadows && receiveShadow
    };
    generation += 1;
    const id = generation;
    const active = look.effective;
    if (active === null) {
      show(current, look, false);
      return;
    }
    if (look.scope === null) show(current, look, false);
    void loadEffectiveTextures(active, look.scope)
      .catch(() => undefined)
      .then((result) => {
        if (id !== generation) return;
        show(current, look, texturesReady(result));
      });
  }

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
      arrival = {
        token,
        url,
        template: gltf.scene,
        animationNames: gltf.animations.map((animation) => animation.name).filter(Boolean)
      };
      untrack(() => present());
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
      arrival = null;
      generation += 1;
      unsubscribeModel();
      unsubscribeError();
      if (realization !== null) {
        resources.casters.publish({ kind: 'released', entity });
        realization.release();
        realization = null;
      }
      shown = null;
      instance = undefined;
    };
  });

  // Every style input (look, wireframe, shadow flags) starts one presentation of the
  // arrived template. Reading the key tracks each input; the presentation itself is
  // untracked, so its own writes cannot re-run this effect.
  $effect(() => {
    void styleKeyOf();
    untrack(() => present());
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
      <T is={instance} dispose={false} />
      {#if showBounds && rawBounds}
        <T.Box3Helper args={[rawBounds, 0xd6b35f]} />
      {/if}
    </T.Group>
  {/if}
</T.Group>
