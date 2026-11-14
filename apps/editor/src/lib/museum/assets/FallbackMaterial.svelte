<script lang="ts">
  /**
   * One fallback-body surface.
   *
   * E7/R2b — both branches now go through `MuseumMaterial`, which acquires its
   * material from the Canvas store. The wireframe branch used to construct a
   * `MeshStandardMaterial` directly; its descriptor carries `wireframe`, and the
   * fallback colour, roughness and metalness are the same catalogue values, so
   * the drawn result is unchanged.
   */
  import MuseumMaterial from '$lib/museum/materials/MuseumMaterial.svelte';
  import type { MaterialId, Vec2 } from '$lib/types/materials';

  let {
    materialId,
    surfaceSize,
    tint,
    wireframe = false
  }: {
    materialId: MaterialId;
    surfaceSize: Vec2;
    tint?: string;
    wireframe?: boolean;
  } = $props();
</script>

<MuseumMaterial {materialId} {surfaceSize} {tint} {wireframe} textures="off" />
