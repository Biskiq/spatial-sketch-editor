<script lang="ts">
	/**
	 * D8c.1 probe surface.
	 *
	 * The real product rendering path: `CanvasHost` (the one r187 WebGPU/WebGL2
	 * renderer), the Canvas's one material/geometry/light owner, the retained
	 * Layout shell and the retained Scene entity + light representations. Only
	 * the scenario is test-owned: two reference Worlds built through the real
	 * Layout planner, a model entity whose bytes are a probe GLB, and its
	 * ordinary Scene light.
	 */
	import { onMount } from 'svelte';
	import { T } from '@threlte/core';
	import type { PerspectiveCamera } from 'three';
	import {
		createEmptyUnitEnvelope,
		createEmptyUnitSceneDocument,
		prepareUnitRuntime,
		type UnitRuntimeReady
	} from '@portfolio/project-model/units';
	import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core/wall';
	import type { SceneEntity, SceneLightEntity } from '@portfolio/project-model/scene';
	import CanvasHost from '$lib/render/CanvasHost.svelte';
	import WorldEnvironment from '$lib/render/WorldEnvironment.svelte';
	import VisitorLayoutShell from '$lib/visitor/VisitorLayoutShell.svelte';
	import VisitorEntityGroups from '$lib/visitor/VisitorEntityGroups.svelte';
	import { provideRenderResources } from '$lib/render/resources/render-resources';
	import { sceneModelSupport } from '$lib/render/models/scene-model-support';
	import Reporter from './Reporter.svelte';
	import { cameraFor, LIGHT_COLOR, modelEntity, poses, readScenario } from './config';
	import { markFailed, markModelDrawn, probe } from './probe-state';

	const resources = provideRenderResources();
	const search = new URLSearchParams(window.location.search);
	const prepare = search.get('prepare') !== '0';
	const show = {
		environment: search.get('env') !== '0',
		layout: search.get('layout') !== '0',
		model: search.get('model') !== '0',
		context: search.get('context') !== '0'
	};
	const scenario = readScenario(search);
	const layout = poses(scenario);
	const camera = cameraFor(scenario, layout);
	const modelUrls = new Map([
		[
			`probe-${scenario.candidate.slug}`,
			`/probe-models/${scenario.candidate.slug}/probe-${scenario.emission}.glb`
		]
	]);
	probe.scenario = {
		candidate: scenario.candidate.id,
		world: scenario.world.id,
		emission: scenario.emission,
		state: scenario.state,
		view: scenario.view,
		anchor: scenario.anchor,
		light: scenario.light,
		anchorWorld: layout.anchor,
		bodyPosition: layout.bodyPosition,
		bodyRotation: layout.bodyRotation
	};

	let runtime = $state.raw<UnitRuntimeReady | null>(null);
	let failure = $state<string | null>(null);
	let backend = $state<string | null>(null);
	let cameraRef = $state<PerspectiveCamera | undefined>(undefined);

	function lightEntity(): SceneLightEntity {
		const base = {
			kind: 'light' as const,
			id: `probe-light-${scenario.candidate.id}`,
			name: `${scenario.candidate.label} emitter`,
			color: LIGHT_COLOR,
			intensity: scenario.light.intensity,
			range: scenario.light.range,
			castShadow: false,
			position: [layout.lightPosition[0], layout.lightPosition[1], layout.lightPosition[2]] as [
				number,
				number,
				number
			],
			rotation: [layout.lightRotation[0], layout.lightRotation[1], layout.lightRotation[2]] as [
				number,
				number,
				number
			]
		};
		if (scenario.light.kind === 'spot') {
			return {
				...base,
				light: 'spot',
				angle: scenario.light.angle ?? (25 * Math.PI) / 180,
				penumbra: scenario.light.penumbra ?? 0.5
			};
		}
		return { ...base, light: 'point' };
	}

	onMount(() => {
		if (!prepare) return;
		void (async () => {
			try {
				probe.status = 'preparing';
				const baseline = createEmptyWallFirstLayoutDocument();
				const planned = planWallChain({
					baseline,
					points: scenario.world.points,
					close: true,
					height: scenario.world.height,
					capture: { nonce: `d8c-${scenario.world.id}` },
					levelId: baseline.floor.id
				});
				if (planned.kind !== 'success') {
					throw new Error(`the ${scenario.world.label} World was refused: ${planned.rejection.code}`);
				}
				const scene = createEmptyUnitSceneDocument();
				const entities: SceneEntity[] = [
					...(show.context ? scenario.world.context : []),
					...(show.model ? [modelEntity(scenario, layout.bodyPosition, layout.bodyRotation)] : []),
					lightEntity()
				];
				const projectId = `d8c-probe-${scenario.candidate.id}-${scenario.world.id}`;
				const envelope = await createEmptyUnitEnvelope({
					id: projectId,
					name: `D8c probe ${scenario.candidate.label}`,
					acceptedRevision: { projectId, revisionId: 'd8c-probe-1' },
					layout: planned.document,
					scene: { ...scene, entities }
				});
				const prepared = prepareUnitRuntime(envelope);
				if (prepared.kind !== 'ready') {
					throw new Error(`runtime refused: ${prepared.issues[0]?.message ?? prepared.reason}`);
				}
				runtime = prepared;
				probe.status = 'rendering';
			} catch (error) {
				failure = error instanceof Error ? error.message : String(error);
				markFailed(failure);
			}
		})();
	});

	$effect(() => {
		if (cameraRef === undefined) return;
		cameraRef.position.set(camera.position[0], camera.position[1], camera.position[2]);
		cameraRef.lookAt(camera.target[0], camera.target[1], camera.target[2]);
		cameraRef.fov = camera.fov;
		cameraRef.updateProjectionMatrix();
	});

	onMount(() => () => resources.dispose());
</script>

<section class="probe">
			<CanvasHost
			surface="preview"
			renderMode="always"
			onBackend={(value, generation) => {
				backend = value;
				probe.backend = value;
				probe.generation = generation;
			}}
		>
		{#snippet children()}
			<T.PerspectiveCamera bind:ref={cameraRef} makeDefault fov={camera.fov} near={0.05} far={200} />
			{#if runtime}
				{#if show.environment}
					<WorldEnvironment sky={scenario.world.sky} bounds={runtime.geometry.bounds ?? null} groundY={0} />
				{/if}
				{#if show.layout}
					<VisitorLayoutShell
						geometry={runtime.geometry}
						scene={null}
						plinth={false}
						doorFrames={false}
					/>
				{/if}
				<VisitorEntityGroups
					scene={runtime.runtimeScene}
					modelSupport={sceneModelSupport}
					{modelUrls}
					includeLights={scenario.state === 'on'}
					onModelDrawn={markModelDrawn}
					onArtworkError={(message) => markFailed(message)}
				/>
				<Reporter />
			{/if}
		{/snippet}
	</CanvasHost>
	<div class="hud">
		<strong>{scenario.candidate.label}</strong>
		<span>{scenario.world.label} · {scenario.state} · {scenario.emission} · {scenario.view}</span>
		<span>{backend ?? 'backend pending'}</span>
	</div>
	{#if failure}
		<div class="booting"><p>{failure}</p></div>
	{/if}
</section>

<style>
	.probe {
		position: relative;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
		background: #9a9c96;
	}
	.hud {
		position: absolute;
		top: 10px;
		left: 10px;
		display: grid;
		gap: 1px;
		padding: 8px 11px;
		border-radius: 7px;
		background: rgb(255 255 255 / 82%);
		color: #11291f;
		font: 500 12px/1.35 system-ui, sans-serif;
	}
	.booting {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		color: #11291f;
		font: 500 13px/1.4 system-ui, sans-serif;
	}
</style>
