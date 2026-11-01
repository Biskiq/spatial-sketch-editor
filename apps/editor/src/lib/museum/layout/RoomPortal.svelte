<script lang="ts">
  import { T } from '@threlte/core';
  import type { MaterialId } from '$lib/types/materials';
  import type { Vec3 } from '$lib/types/scene';
  import MuseumMaterial from '../materials/MuseumMaterial.svelte';
  import { doorFrameBoxes } from './door-frame';

  let {
    position,
    rotation = [0, 0, 0] as Vec3,
    width,
    height,
    wallThickness,
    color = '#d6b35f',
    materialId = 'brass-aged' as MaterialId
  }: {
    position: Vec3;
    rotation?: Vec3;
    width: number;
    height: number;
    wallThickness: number;
    color?: string;
    materialId?: MaterialId;
  } = $props();

  const boxes = $derived(doorFrameBoxes({ width, height, wallThickness }));
</script>

<T.Group {position} {rotation}>
  {#each boxes as box}
    <T.Mesh position={[...box.center]}>
      <T.BoxGeometry args={[...box.size]} />
      <MuseumMaterial
        {materialId}
        surfaceSize={[Math.max(box.size[0], box.size[2]), box.size[1]]}
        tint={color}
      />
    </T.Mesh>
  {/each}
</T.Group>
