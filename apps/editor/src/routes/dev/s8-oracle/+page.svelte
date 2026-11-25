<script lang="ts">
	/**
	 * T2.S8 PR B — the product-canvas appearance oracle.
	 *
	 * This route draws fixed cases through the **product** render path
	 * (`describeSceneRender` + `createSceneEntityRepresentation` + the Canvas
	 * stores) with a fixed camera, fixed lights and no editor chrome. It exists so
	 * PR B can capture the pre-change pixels before replacing the resolver or the
	 * sampling path, and compare the same cases afterwards.
	 *
	 * Every case is deterministic: no clock, no camera control, no random ids. The
	 * page reports `data-s8-oracle-ready` only after every texture and model lease
	 * has settled, so a screenshot never races an arrival.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { T } from '@threlte/core';
	import CanvasHost from '$lib/render/CanvasHost.svelte';
	import { provideRenderResources } from '$lib/render/resources/render-resources';
	import { describeSceneRender } from '$lib/render/scene-render-description';
	type SceneRenderDescription = ReturnType<typeof describeSceneRender>;
	import { createSceneEntityRepresentation } from '$lib/render/scene-entity-representation';
	import { sceneFormSupport } from '$lib/render/scene-form-support';
	import { sceneModelSupport } from '$lib/render/models/scene-model-support';
	import type { RuntimeScene, SceneEntity, SceneMaterialInstance, SceneTextureAsset } from '$lib/content/scene';
	import OracleMount from './OracleMount.svelte';

	const SWATCH: SceneTextureAsset = {
		id: 'oracle-swatch',
		name: 'S8 Swatch',
		uri: '/s8-fixtures/swatch-rgba.png'
	};

	const WOOD_SHARED: SceneMaterialInstance = {
		id: 'oracle-shared',
		name: 'S8 Shared Wood',
		base: { catalogue: 'wood-walnut' },
		overrides: {
			maps: { color: { image: { textureId: 'oracle-swatch' } } },
			mapping: {
				kind: 'target',
				metric: { tileMeters: [0.8, 1.6], rotation: 0.42, offset: [0.25, 0.5] }
			}
		}
	};

	function primitive(id: string, x: number, options: {
		width?: number;
		height?: number;
		materialId?: string;
		instanceId?: string;
	}): SceneEntity {
		return {
			id,
			name: id,
			kind: 'primitive',
			primitive: 'plane',
			position: [x, 0.9, 0],
			rotation: [0, 0, 0],
			dimensions: { width: options.width ?? 1.6, height: options.height ?? 1.6 },
			materialId: (options.materialId ?? 'plaster-warm') as never,
			...(options.instanceId === undefined ? {} : { materialInstanceId: options.instanceId }),
			castShadow: false,
			receiveShadow: false
		} as SceneEntity;
	}

	function form(id: string, x: number): SceneEntity {
		return {
			id,
			name: id,
			kind: 'form',
			position: [x, 0.9, 0],
			rotation: [0, 0, 0],
			materialId: 'wood-walnut' as never,
			materialInstanceId: 'oracle-shared',
			form: {
				generator: {
					kind: 'extrude',
					plane: 'plan',
					outline: [
						{ key: 1, u: -0.6, v: -0.6, smooth: false },
						{ key: 2, u: 0.6, v: -0.6, smooth: false },
						{ key: 3, u: 0.6, v: 0.6, smooth: false },
						{ key: 4, u: -0.6, v: 0.6, smooth: false }
					],
					extent: 0.18
				},
				scale: [1, 1, 1],
				nextKey: 5
			},
			castShadow: false,
			receiveShadow: false
		};
	}

	function model(id: string, x: number): SceneEntity {
		return {
			id,
			name: id,
			kind: 'model',
			position: [x, 0.9, 0],
			rotation: [0, 0, 0],
			scale: 1.4,
			assetId: 's8-oracle-model' as never,
			fallback: 'generic',
			materialId: 'wood-walnut' as never,
			materialInstanceId: 'oracle-shared'
		} as SceneEntity;
	}

	type OracleCase = 'catalogue' | 's4' | 'shared' | 'treatment-natural' | 'treatment-clay' | 'treatment-flat';

	const ORACLE_CASES: readonly OracleCase[] = [
		'catalogue',
		's4',
		'shared',
		'treatment-natural',
		'treatment-clay',
		'treatment-flat'
	];

	function caseId(): OracleCase {
		const requested = page.url.searchParams.get('case') ?? 'catalogue';
		return (ORACLE_CASES as readonly string[]).includes(requested) ? (requested as OracleCase) : 'catalogue';
	}

	function oracleScene(id: OracleCase): RuntimeScene {
		const materials: SceneMaterialInstance[] = [WOOD_SHARED];
		let entities: SceneEntity[] = [];
		if (id === 'catalogue') {
			const ids = ['plaster-warm', 'wood-walnut', 'brass-aged', 'marble-light', 'velvet-dark', 'paper-aged'];
			entities = ids.map((materialId, index) => primitive(`catalogue-${materialId}`, -3.75 + index * 1.5, { materialId }));
		} else if (id === 's4') {
			materials.push(
				{
					id: 'oracle-palette',
					name: 'S8 Palette',
					base: { catalogue: 'plaster-warm' },
					overrides: { color: { slot: 'oracle-walnut' } }
				},
				{
					id: 'oracle-zero',
					name: 'S8 Zero',
					base: { catalogue: 'wood-walnut' },
					overrides: { roughness: 0, metalness: 0 }
				}
			);
			entities = [
				primitive('s4-image', -2.4, { instanceId: 'oracle-shared' }),
				primitive('s4-palette', 0, { instanceId: 'oracle-palette' }),
				primitive('s4-zero', 2.4, { instanceId: 'oracle-zero' })
			];
		} else if (id === 'shared') {
			entities = [form('shared-form', -1.5), model('shared-model', 1.5)];
		} else {
			entities = [primitive('treatment-image', -1.4, { instanceId: 'oracle-shared' })];
		}
		const treatment =
			id === 'treatment-clay' ? 'clay' : id === 'treatment-flat' ? 'flat-colour' : undefined;
		return {
			textures: [SWATCH],
			materials,
			entities,
			objects: [],
			palette: [{ id: 'oracle-walnut', name: 'Walnut', color: '#5a3a22' }],
			...(treatment === undefined ? {} : { environment: { treatment } })
		};
	}

	const resources = provideRenderResources();
	onDestroy(() => resources.dispose());
	const label = caseId();
	const description: SceneRenderDescription = describeSceneRender(oracleScene(label), sceneFormSupport);
	const representation = createSceneEntityRepresentation({
		store: resources.materials,
		geometry: resources.geometry,
		modelSupport: () => sceneModelSupport,
		modelUrls: () => new Map([['s8-oracle-model', '/s8-oracle/two-uv-glb.glb']])
	});
	representation.update(description);

	let ready = $state(false);
	onMount(() => {
		void representation.idle().then(async () => {
			// One settled frame after every lease: no arrival can land behind the shot.
			await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
			ready = true;
			document.documentElement.dataset.s8OracleReady = 'true';
			document.documentElement.dataset.s8OracleCase = label;
		});
	});
	onDestroy(() => representation.dispose());

</script>

<svelte:head>
	<title>S8 Oracle — {label}</title>
</svelte:head>

<main
	data-s8-oracle={label}
	data-s8-oracle-ready={ready ? 'true' : 'false'}
	data-s8-oracle-items={description.items.map((item) => item.id).join(',')}
	data-s8-oracle-models={description.models.map((item) => item.id).join(',')}
>
	<div class="viewport">
		<CanvasHost surface="preview" renderMode="always" placeholder="#121218">
			{#snippet children()}
				<T.PerspectiveCamera
					makeDefault
					position={[0, 1.15, label === 'shared' ? 6.4 : 12.4]}
					fov={35}
					onCreate={(camera: import('three').PerspectiveCamera) => camera.lookAt(0, 0.95, 0)}
				/>
				<T.AmbientLight intensity={0.42} />
				<T.HemisphereLight args={['#f0e6d4', '#1a1814', 0.5]} />
				<T.DirectionalLight position={[3.4, 5.2, 4.2]} intensity={1.35} color="#fff4e5" />
				<T.DirectionalLight position={[-3.2, 2.2, -2.4]} intensity={0.45} color="#d9e6ff" />
				<T.Color attach="background" args={['#121218']} />
				{#if ready}
					<OracleMount object={representation.object3d} />
				{/if}
			{/snippet}
		</CanvasHost>
	</div>
</main>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		background: #121218;
	}
	main {
		display: grid;
		place-items: center;
		width: 100vw;
		height: 100vh;
	}
	.viewport {
		width: 512px;
		height: 512px;
	}
</style>
