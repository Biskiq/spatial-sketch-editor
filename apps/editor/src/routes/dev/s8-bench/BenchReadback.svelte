<script lang="ts">
	import type { Material } from 'three';
	import { useCanvasRendererState } from '$lib/render/renderer-context';
	import {
		createInspectionScene,
		renderInspectionFrame
	} from '$lib/render/materials/inspection';
	import type { InspectionGeometryKind } from '$lib/render/materials/inspection-geometry';
	import type { InspectionRig } from '$lib/render/materials/inspection-lighting';

	let {
		material,
		kind,
		rig
	}: {
		material: Material | null;
		kind: InspectionGeometryKind;
		rig: InspectionRig;
	} = $props();

	// This component lives inside CanvasHost, so it reads the observed renderer
	// rather than constructing a second one. That is the same path a product
	// consumer uses for a fixed thumbnail.
	const rendererState = useCanvasRendererState();
	let status = $state('idle');

	async function capture(): Promise<void> {
		const renderer = rendererState.renderer;
		if (renderer === null) {
			status = 'renderer not ready';
			return;
		}
		if (material === null) {
			status = 'material not ready';
			return;
		}
		status = 'drawing';
		const inspection = createInspectionScene({ renderer, material, kind, rig });
		try {
			const frame = await renderInspectionFrame({
				renderer,
				scene: inspection.scene,
				camera: inspection.camera,
				size: 192
			});
			status =
				frame === null
					? 'refused'
					: `${frame.backend} ${frame.width}x${frame.height}`;
		} finally {
			inspection.dispose();
		}
	}
</script>

<button type="button" onclick={capture} disabled={material === null}>Readback 192</button>
<span class="status">{status}</span>

<style>
	button {
		margin: 0.25rem 0.25rem 0 0;
		padding: 0.35rem 0.55rem;
		border: 1px solid #3a3a44;
		background: #1c1c24;
		color: inherit;
		border-radius: 4px;
		cursor: pointer;
	}
	button:disabled {
		cursor: default;
		opacity: 0.55;
	}
	.status {
		margin-left: 0.4rem;
		color: #a99f90;
		font-size: 0.8rem;
	}
</style>
