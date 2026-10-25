<script lang="ts">
	/**
	 * The Stage's shadow-map trigger wiring (T1.P02.S06 D.6 / H9).
	 *
	 * Mounted **inside** the Stage's one canvas component, because it needs that
	 * renderer. It installs the invalidation controller on the renderer's shadow
	 * map and reports every input a shadow map depends on.
	 *
	 * The three triggers are identities, not polls: a canonical compile installs a
	 * new `geometry` (a Wall or object edit, a placement through Scene resolution,
	 * Undo/Redo, a replacement, a reading change), Scene resolution installs a new
	 * `scene` (a placement added, moved or removed, a light changed, an entity's
	 * transform or flags changed) and `modelUrls` changes when approved model bytes
	 * arrive or are released. Reading them in one effect means a render at rest —
	 * an orbit, a hover, a selection — invalidates nothing, which is the saving.
	 *
	 * Not triggers, deliberately: the camera (a shadow map renders from the
	 * light's shadow camera) and the ghost meshes (they draw with
	 * `depthWrite={false}` and never set `castShadow`, so they cannot change a
	 * shadow map).
	 */
	import { useThrelte } from '@threlte/core';
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
	import type { RuntimeScene } from '@portfolio/project-model';

	import { createShadowInvalidation } from '$lib/render/shadow-invalidation';

	let {
		geometry,
		scene,
		modelUrls = null
	}: {
		geometry: CompiledLayoutGeometry;
		scene: RuntimeScene;
		modelUrls?: ReadonlyMap<string, string> | null;
	} = $props();

	const { renderer, invalidate } = useThrelte();
	const shadows = createShadowInvalidation({
		shadowMap: renderer.shadowMap,
		// The renderer's scheduler still renders on demand (Threlte's default), so
		// an invalidation asks for exactly one frame rather than starting a loop.
		requestFrame: invalidate,
		// A restored context has lost every shadow map; re-render them.
		canvas: renderer.domElement
	});

	const sources = $derived([geometry, scene, modelUrls] as const);

	$effect(() => {
		void sources;
		shadows.invalidate();
	});

	$effect(() => () => shadows.dispose());
</script>
