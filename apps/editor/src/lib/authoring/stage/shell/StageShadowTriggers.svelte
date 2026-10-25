<script lang="ts">
	/**
	 * The Stage's shadow-map trigger wiring (T1.P02.S06 D.6 / H9).
	 *
	 * Mounted **inside** the Stage's one canvas component, because it needs that
	 * renderer. It installs the invalidation controller on the renderer's shadow
	 * map and reports every input a shadow map depends on.
	 *
	 * The triggers are identities, not polls: a canonical compile installs a new
	 * `geometry` (a Wall or object edit, Undo/Redo, a replacement, a reading
	 * change), Scene resolution installs a new `scene` (a placement added, moved or
	 * removed, a light changed, an entity's transform or flags changed), and the
	 * Room registry installs new placement transforms. Reading them in one effect
	 * means a render at rest — an orbit, a hover, a selection — invalidates
	 * nothing, which is the saving.
	 *
	 * One caster is not covered by an identity: a resolved creator model parses
	 * after its URL arrives, so its meshes are added, and later disposed, without
	 * `modelUrls`, `scene` or `geometry` changing. That arrival is not observable
	 * at this boundary, so a Scene that carries a model entity keeps today's
	 * per-frame updates (`setAlwaysUpdate`) — the plan's rule for a trigger whose
	 * exact invalidation cannot be established. Grid documents carry no
	 * placements, so the ordinary Stage keeps the saving.
	 *
	 * Not triggers, deliberately: the camera (a shadow map renders from the
	 * light's shadow camera) and the ghost meshes (they draw with
	 * `depthWrite={false}` and never set `castShadow`).
	 */
	import { useThrelte } from '@threlte/core';
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
	import type { LayoutRoomRegistry, RuntimeScene } from '@portfolio/project-model';

	import { isSceneModelEntity } from '$lib/content/scene';
	import { createShadowInvalidation } from '$lib/render/shadow-invalidation';

	let {
		geometry,
		scene,
		rooms,
		modelUrls = null
	}: {
		geometry: CompiledLayoutGeometry;
		scene: RuntimeScene;
		rooms: LayoutRoomRegistry;
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

	const sources = $derived([geometry, scene, rooms, modelUrls] as const);
	/** A model entity's meshes arrive asynchronously; keep per-frame updates for it. */
	const asynchronousCaster = $derived(scene.entities.some(isSceneModelEntity));

	$effect(() => {
		void sources;
		shadows.invalidate();
	});

	$effect(() => {
		shadows.setAlwaysUpdate(asynchronousCaster);
	});

	$effect(() => () => shadows.dispose());
</script>
