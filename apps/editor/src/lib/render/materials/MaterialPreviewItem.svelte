<script lang="ts">
  import { T } from '@threlte/core';
  import CatalogueMaterial from '$lib/render/materials/CatalogueMaterial.svelte';
  import type { MaterialId, MaterialLoadStatus, Vec2 } from '$lib/types/materials';

  let {
    materialId,
    kind,
    surfaceSize,
    position,
    textures = 'auto' as 'auto' | 'off',
    status = $bindable<MaterialLoadStatus>('idle')
  }: {
    materialId: MaterialId;
    kind: 'wall' | 'floor' | 'brass' | 'box' | 'curtain' | 'paper';
    surfaceSize: Vec2;
    position: [number, number, number];
    textures?: 'auto' | 'off';
    status?: MaterialLoadStatus;
  } = $props();
</script>

{#if kind === 'floor'}
  <T.Mesh {position} rotation={[-Math.PI / 2, 0, 0]}>
    <T.PlaneGeometry args={surfaceSize} />
    <CatalogueMaterial {materialId} {surfaceSize} {textures} bind:status />
  </T.Mesh>
{:else if kind === 'brass'}
  <T.Mesh {position}>
    <T.CylinderGeometry args={[0.28, 0.28, 1.2, 32]} />
    <CatalogueMaterial {materialId} {surfaceSize} {textures} bind:status />
  </T.Mesh>
{:else if kind === 'box'}
  <T.Mesh {position}>
    <T.BoxGeometry args={[1.4, 0.25, 1.4]} />
    <CatalogueMaterial {materialId} {surfaceSize} {textures} bind:status />
  </T.Mesh>
{:else}
  <T.Mesh {position}>
    <T.PlaneGeometry args={surfaceSize} />
    <CatalogueMaterial {materialId} {surfaceSize} {textures} bind:status />
  </T.Mesh>
{/if}
