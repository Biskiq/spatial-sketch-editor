<script lang="ts">
  import { T } from '@threlte/core';
  import StoreMaterial from '$lib/render/resources/StoreMaterial.svelte';
  import type { StandardMaterialDescriptor } from '$lib/render/resources/material-descriptor';

  /** The plinth's one look; metalness 0 is the constructor default it always had. */
  const PLINTH: StandardMaterialDescriptor = { kind: 'standard', color: '#0e0d11', roughness: 0.92, metalness: 0 };
</script>

<T.Mesh name="MuseumGroundPlinth" position={[0, -0.08, 0]}>
  <T.CylinderGeometry args={[22, 22, 0.05, 96]} />
  <StoreMaterial descriptor={PLINTH} />
</T.Mesh>
