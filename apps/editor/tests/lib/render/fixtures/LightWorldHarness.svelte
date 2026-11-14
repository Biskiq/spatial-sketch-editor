<script module lang="ts">
	import type { Group as RootGroup, Scene as WorldScene } from 'three';
	import type { RuntimeScene } from '@portfolio/project-model';
	import type { SceneEnvironmentPreset } from '@portfolio/project-model/units';
	import type { RenderResources } from '$lib/render/resources/render-resources';

	export type LightBounds = {
		readonly min: readonly [number, number, number];
		readonly max: readonly [number, number, number];
	};

	export type LightWorldProps = {
		scene: RuntimeScene;
		preset: SceneEnvironmentPreset | null;
		bounds: LightBounds | null;
		shadowBounds: LightBounds | null;
		groundY: number;
		flatGround: boolean;
		includeLights: boolean;
	};

	export type LightWorldHandle = {
		resources: RenderResources;
		root: RootGroup;
		set(patch: Partial<LightWorldProps>): void;
	};
</script>

<script lang="ts">
	/**
	 * E10/R6 — the real VisitorEntityGroups and WorldEnvironment under a real
	 * Threlte `<T>` tree with the Canvas stores, so a test reads exactly the
	 * Light objects a Stage or Preview Canvas realizes. Only `useThrelte` (no
	 * WebGL Canvas) is faked; its `scene` is this harness's `world`.
	 */
	import { untrack } from 'svelte';
	import { Group } from 'three';
	import {
		createDisposalContext,
		createParentContext,
		createParentObject3DContext,
		createSchedulerContext
	} from '@threlte/core';
	import VisitorEntityGroups from '$lib/visitor/VisitorEntityGroups.svelte';
	import WorldEnvironment from '$lib/render/WorldEnvironment.svelte';
	import { provideRenderResources } from '$lib/render/resources/render-resources';

	let {
		world,
		handle,
		initial
	}: { world: WorldScene; handle: LightWorldHandle; initial: LightWorldProps } = $props();

	const root = new Group();
	untrack(() => world).add(root);
	createSchedulerContext(() => ({ autoRender: false, renderMode: 'manual' }));
	createDisposalContext();
	createParentContext(() => root);
	createParentObject3DContext(() => root);
	const resources = provideRenderResources();

	let current = $state.raw<LightWorldProps>(untrack(() => initial));
	const driver = untrack(() => handle);
	driver.resources = resources;
	driver.root = root;
	driver.set = (patch) => {
		current = { ...current, ...patch };
	};
</script>

<VisitorEntityGroups scene={current.scene} includeLights={current.includeLights} modelSupport={null} />
<WorldEnvironment
	preset={current.preset}
	bounds={current.bounds}
	shadowBounds={current.shadowBounds}
	groundY={current.groundY}
	flatGround={current.flatGround}
/>
