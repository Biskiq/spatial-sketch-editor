<script lang="ts">
	/**
	 * The Stage's shadow-map trigger wiring (T1.P02.S06 D.6 / H9, revised by E8/G4).
	 *
	 * Mounted **inside** the Stage's one canvas component, because it needs that
	 * renderer. It installs the invalidation controller on the renderer's shadow
	 * map and reports every input a shadow map depends on.
	 *
	 * The triggers are identities, not polls: a canonical compile installs a new
	 * `geometry` (a Wall or object edit, Undo/Redo, a replacement, a reading
	 * change), Scene resolution installs a new `scene` (a placement added, moved or
	 * removed, a light changed, an entity's transform or flags changed). Reading them in one effect
	 * means a render at rest, an orbit, a hover or a selection invalidates nothing.
	 *
	 * Two caster facts are not identities, so they arrive on the Canvas's caster
	 * channel instead:
	 *
	 * - a model's **arrival** and **release**: its GLB parses after its URL is known,
	 *   so its meshes are added, and later removed, without `modelUrls`, `scene` or
	 *   `geometry` changing. The channel reports each one, and each invalidates once;
	 * - a **playing animation**: a moving caster needs a fresh map every frame, so the
	 *   controller renders per frame only while the channel counts one. A model that
	 *   is not animating is static, and a static Scene renders its maps once.
	 *
	 * Native forms use a narrower trigger: their renderer is lazy, but the shared
	 * EntityForm reports from `onMount`. The Stage increments `formRenderRevision`
	 * for that attached mesh; Scene identity still invalidates later additions,
	 * removals and geometry edits.
	 *
	 * Not triggers, deliberately: the camera (a shadow map renders from the
	 * light's shadow camera) and the ghost meshes (they draw with
	 * `depthWrite={false}` and never set `castShadow`).
	 */
	import { useThrelte } from '@threlte/core';
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
	import type { RuntimeScene } from '@portfolio/project-model';

	import { createShadowInvalidation } from '$lib/render/shadow-invalidation';
	import { useRenderResources } from '$lib/render/resources/render-resources';

	let {
		geometry,
		scene,
		modelUrls = null,
		formRenderRevision
	}: {
		geometry: CompiledLayoutGeometry;
		scene: RuntimeScene;
		modelUrls?: ReadonlyMap<string, string> | null;
		/** Changes when a lazy form renderer has attached its mesh to the scene. */
		formRenderRevision: number;
	} = $props();

	const { renderer, invalidate } = useThrelte();
	const resources = useRenderResources();
	const shadows = createShadowInvalidation({
		shadowMap: renderer.shadowMap,
		// The renderer's scheduler still renders on demand (Threlte's default), so
		// an invalidation asks for exactly one frame rather than starting a loop.
		requestFrame: invalidate,
		// A restored context has lost every shadow map; re-render them.
		canvas: renderer.domElement
	});

	const sources = $derived([geometry, scene, modelUrls, formRenderRevision] as const);

	$effect(() => {
		void sources;
		shadows.invalidate();
	});

	// The caster channel: an arrival, a release or a drawn-state change is one
	// invalidation; an animation starting or stopping switches per-frame updates.
	$effect(() => {
		shadows.setAlwaysUpdate(resources.casters.playing() > 0);
		return resources.casters.subscribe((event) => {
			// Every event re-reads the playing count, so a released moving caster
			// ends the per-frame rule without waiting for its own stop event.
			shadows.setAlwaysUpdate(resources.casters.playing() > 0);
			if (event.kind !== 'animating') shadows.invalidate();
		});
	});

	$effect(() => () => shadows.dispose());
</script>
