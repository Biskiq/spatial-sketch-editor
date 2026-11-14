<script module lang="ts">
  import type { Mesh } from 'three';
  import type { RenderResources } from '$lib/render/resources/render-resources';
  import type { TextureLoadScope } from '$lib/render/resources/texture-store';
  import type { MaterialId, MaterialTextureMode, Vec2 } from '$lib/types/materials';

  export type SurfaceSpec = {
    materialId: MaterialId;
    surfaceSize: Vec2;
    tint?: string;
    textures?: MaterialTextureMode;
    scope?: TextureLoadScope | null;
  };

  export type MaterialLifecycleHandle = {
    /** The Canvas stores the surfaces lease from; the test reads their counts. */
    resources: RenderResources;
    /** The mesh each surface is mounted on, by index. */
    meshes: Mesh[];
    setSurface(index: number, spec: SurfaceSpec): void;
    unmountSurface(index: number): void;
  };
</script>

<script lang="ts">
  /**
   * A real Threlte context for mounted material-lifecycle regressions.
   *
   * `MuseumMaterial` renders a real `<T is={material} dispose={false} />`, so a
   * faithful mount needs the contexts a Canvas normally provides: a scheduler, a
   * disposal registry, and a parent object. They are created here with
   * `@threlte/core`'s own factories — no mocked `T`, no renderer and no WebGL —
   * so attachment, property application and Threlte's disposal rule are the
   * library's, not a stand-in.
   *
   * Each surface is one `<T.Mesh>`; the test reaches the mesh to read the
   * material actually attached. Visibility is a reactive switch so one consumer
   * can unmount while the other stays mounted.
   */
  import { untrack } from 'svelte';
  import { Group, Scene } from 'three';
  import {
    createDisposalContext,
    createParentContext,
    createParentObject3DContext,
    createSchedulerContext,
    T
  } from '@threlte/core';
  import MuseumMaterial from '$lib/museum/materials/MuseumMaterial.svelte';
  import { provideRenderResources } from '$lib/render/resources/render-resources';

  let { surfaces, handle }: { surfaces: SurfaceSpec[]; handle: MaterialLifecycleHandle } = $props();

  const scene = new Scene();
  const root = new Group();
  scene.add(root);
  createSchedulerContext(() => ({ autoRender: false, renderMode: 'manual' }));
  createDisposalContext();
  createParentContext(() => root);
  createParentObject3DContext(() => root);
  const resources = provideRenderResources();

  // Initial props are read once; the handle's functions are the only way the
  // test changes them afterwards.
  let specs = $state(untrack(() => surfaces));
  let visible = $state(untrack(() => surfaces.map(() => true)));
  const meshes: Mesh[] = [];
  const driver = untrack(() => handle);

  driver.resources = resources;
  driver.meshes = meshes;
  driver.setSurface = (index, spec) => {
    specs[index] = spec;
  };
  driver.unmountSurface = (index) => {
    visible[index] = false;
  };
</script>

{#each specs as spec, index (index)}
  {#if visible[index]}
    <T.Mesh
      oncreate={(mesh) => {
        meshes[index] = mesh;
      }}
    >
      <MuseumMaterial {...spec} />
    </T.Mesh>
  {/if}
{/each}
