<script lang="ts">
	/**
	 * The asset inspector's one model, drawn by the retained Scene model handler.
	 *
	 * The bench is a QA view of the same path the Stage and the visitor draw: one
	 * `SceneModelItem` from `describeSceneModel`, realized on this Canvas's stores by
	 * `scene-model-representation` with the statically imported model support. It
	 * reports the handler's load status and inspection back to the page. Bounds are
	 * line helpers over the drawn instance (or the fallback box) in the asset's frame.
	 */
	import { T, useThrelte } from '@threlte/core';
	import { Box3, Vector3 } from 'three';
	import { getAssetById } from '$lib/content/assets';
	import type { AssetId, AssetLoadStatus, AssetMetrics } from '$lib/types/assets';
	import type { Vec3 } from '$lib/types/scene';
	import { useRenderResources } from '$lib/render/resources/render-resources';
	import { describeSceneModel } from '$lib/render/scene-render-description';
	import {
		createSceneModelRepresentation,
		type SceneModelState
	} from '$lib/render/scene-model-representation';
	import { sceneModelSupport } from '$lib/render/models/scene-model-support';

	let {
		assetId,
		rotation,
		scale,
		visible,
		wireframe,
		shadows,
		showBounds,
		status = $bindable<AssetLoadStatus>('idle'),
		metrics = $bindable<AssetMetrics | undefined>(),
		error = $bindable<string | undefined>()
	}: {
		assetId: AssetId;
		rotation: Vec3;
		scale: number;
		visible: boolean;
		wireframe: boolean;
		shadows: boolean;
		showBounds: boolean;
		status?: AssetLoadStatus;
		metrics?: AssetMetrics;
		error?: string;
	} = $props();

	const ID = 'dev-asset';
	const resources = useRenderResources();
	const { invalidate } = useThrelte();
	let shown = $state.raw<SceneModelState | null>(null);
	const models = createSceneModelRepresentation({
		store: resources.materials,
		geometry: resources.geometry,
		casters: resources.casters,
		onDrawn: () => invalidate(),
		onState: (_id, next) => {
			shown = next;
		}
	});

	const item = $derived(
		describeSceneModel({
			id: ID,
			assetId,
			position: [0, 0, 0],
			rotation,
			scale,
			look: null,
			wireframe,
			shadows,
			visible
		})
	);

	$effect(() => {
		models.update([item], { support: sceneModelSupport, urls: null, scope: null });
		invalidate();
	});
	$effect(() => () => models.dispose());

	const asset = $derived(getAssetById(assetId));

	$effect(() => {
		const current = shown;
		status = current?.status ?? 'idle';
		error = current?.status === 'failed' ? current.error : undefined;
		const factor = (asset?.defaultScale ?? 1) * scale;
		const drawn = current?.status === 'ready' ? current.metrics : undefined;
		metrics = drawn
			? { ...drawn, dimensions: drawn.dimensions.map((value: number) => value * factor) as Vec3 }
			: {
					dimensions: item.fallback.dimensions.map((value) => value * scale) as Vec3,
					meshCount: 0,
					materialCount: 0,
					triangleCount: 0,
					animationNames: []
				};
	});

	/** The fallback box, offset as the fallback body sits on its origin. */
	const bounds = $derived.by((): Box3 => {
		if (shown?.status === 'ready' && shown.bounds) return shown.bounds;
		const [w, h, d] = item.fallback.dimensions;
		const kind = item.fallback.kind;
		const centre = new Vector3(0, kind === 'frame' ? 0 : kind === 'chandelier' ? -h / 2 : h / 2, 0);
		return new Box3().setFromCenterAndSize(centre, new Vector3(w, h, d));
	});
</script>

<T is={models.object3d} />

{#if showBounds && visible}
	<T.Group {rotation} {scale}>
		<T.Group rotation={[...item.presentation.rotation]} scale={item.presentation.scale}>
			<T.Box3Helper args={[bounds, 0xd6b35f]} />
		</T.Group>
	</T.Group>
{/if}
