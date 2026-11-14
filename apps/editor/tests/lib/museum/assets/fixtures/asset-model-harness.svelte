<script module lang="ts">
  import type { Group as RootGroup } from 'three';
  import type { EffectiveSceneMaterial } from '$lib/museum/materials/scene-instance-material';
  import type { RenderResources } from '$lib/render/resources/render-resources';
  import type { TextureLoadScope } from '$lib/render/resources/texture-store';

  export type ConsumerSpec = {
    readonly id: string;
    readonly url: string | null;
    readonly effective: EffectiveSceneMaterial | null;
    readonly scope: TextureLoadScope | null;
    readonly wireframe: boolean;
    readonly mounted: boolean;
  };

  export type AssetModelHandle = {
    /** The Canvas stores the consumers lease from. */
    resources: RenderResources;
    /** The parent every consumer's instance is attached under. */
    root: RootGroup;
    /** Change one consumer's props, or unmount it, by id. */
    update(id: string, patch: Partial<Omit<ConsumerSpec, 'id'>>): void;
  };
</script>

<script lang="ts">
  /**
   * Real `AssetModel` consumers under a real Threlte `<T>` tree (E8).
   *
   * The Canvas contexts are created with `@threlte/core`'s own factories, as the
   * material lifecycle harness does, so attachment and the disposal rule are the
   * library's. Only the GLB loader and the texture source are faked by the test.
   */
  import { untrack } from 'svelte';
  import { Group, Scene } from 'three';
  import {
    createDisposalContext,
    createParentContext,
    createParentObject3DContext,
    createSchedulerContext
  } from '@threlte/core';
  import AssetModel from '$lib/museum/assets/AssetModel.svelte';
  import { provideRenderResources } from '$lib/render/resources/render-resources';
  import type { AssetId } from '$lib/types/assets';

  let { consumers, handle }: { consumers: ConsumerSpec[]; handle: AssetModelHandle } = $props();

  const scene = new Scene();
  const root = new Group();
  scene.add(root);
  createSchedulerContext(() => ({ autoRender: false, renderMode: 'manual' }));
  createDisposalContext();
  createParentContext(() => root);
  createParentObject3DContext(() => root);
  const resources = provideRenderResources();

  let specs = $state(untrack(() => consumers));
  const driver = untrack(() => handle);
  driver.resources = resources;
  driver.root = root;
  driver.update = (id, patch) => {
    specs = specs.map((spec) => (spec.id === id ? { ...spec, ...patch } : spec));
  };
</script>

{#each specs as spec (spec.id)}
  {#if spec.mounted}
    <AssetModel
      assetId={'creator-model-harness' as AssetId}
      resolvedUrl={spec.url}
      effective={spec.effective}
      scope={spec.scope}
      wireframe={spec.wireframe}
      fallback="frame"
    />
  {/if}
{/each}
