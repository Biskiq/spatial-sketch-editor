<script module lang="ts">
	import type { Group as RootGroup } from 'three';
	import type { RuntimeScene } from '@portfolio/project-model';
	import type { ArtworkScope } from '$lib/render/artwork/artwork-scope';
	import type { RenderResources } from '$lib/render/resources/render-resources';

	export type WorldHarnessHandle = {
		resources: RenderResources;
		root: RootGroup;
		set(patch: { scene?: RuntimeScene; artworkScope?: ArtworkScope | null; environment?: boolean; flatGround?: boolean }): void;
	};
</script>

<script lang="ts">
	/**
	 * E9 — the real VisitorEntityGroups, WorldEnvironment and GroundPlinth under a
	 * real Threlte `<T>` tree with the Canvas stores. Only `useThrelte` (no WebGL
	 * Canvas) and the artwork scope are faked by the test.
	 */
	import { untrack } from 'svelte';
	import { Group, Scene } from 'three';
	import {
		createDisposalContext,
		createParentContext,
		createParentObject3DContext,
		createSchedulerContext
	} from '@threlte/core';
	import VisitorEntityGroups from '$lib/visitor/VisitorEntityGroups.svelte';
	import WorldEnvironment from '$lib/render/WorldEnvironment.svelte';
	import GroundPlinth from '$lib/museum/layout/GroundPlinth.svelte';
	import { provideRenderResources } from '$lib/render/resources/render-resources';

	let { scene: initial, artworkScope: initialScope, handle, onArtworkError, onFormRendererReady }: {
		scene: RuntimeScene;
		artworkScope: ArtworkScope | null;
		handle: WorldHarnessHandle;
		onArtworkError?: (message: string) => void;
		onFormRendererReady?: () => void;
	} = $props();

	const world = new Scene();
	const root = new Group();
	world.add(root);
	createSchedulerContext(() => ({ autoRender: false, renderMode: 'manual' }));
	createDisposalContext();
	createParentContext(() => root);
	createParentObject3DContext(() => root);
	const resources = provideRenderResources();

	let scene = $state.raw(untrack(() => initial));
	let artworkScope = $state.raw(untrack(() => initialScope));
	let environment = $state(true);
	let flatGround = $state(false);
	const driver = untrack(() => handle);
	driver.resources = resources;
	driver.root = root;
	driver.set = (patch) => {
		if (patch.scene !== undefined) scene = patch.scene;
		if (patch.artworkScope !== undefined) artworkScope = patch.artworkScope;
		if (patch.environment !== undefined) environment = patch.environment;
		if (patch.flatGround !== undefined) flatGround = patch.flatGround;
	};
</script>

<VisitorEntityGroups {scene} {artworkScope} {onArtworkError} {onFormRendererReady} Model={null} />
{#if environment}
	<WorldEnvironment preset="daylight" {flatGround} />
	<GroundPlinth />
{/if}
