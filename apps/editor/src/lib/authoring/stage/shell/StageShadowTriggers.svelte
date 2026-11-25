<script lang="ts">
	/**
	 * The Stage's shadow-map trigger wiring.
	 *
	 * Mounted **inside** the Stage's one canvas component, because it needs that
	 * renderer. It installs the invalidation controller on the renderer's shadow
	 * map and reports every input a shadow map depends on.
	 *
	 * The triggers are identities, not polls: a canonical compile installs a new
	 * `geometry` (a Wall or object edit, Undo/Redo, a replacement, a reading
	 * change), and an accepted Scene edit changes the caster content (a placement
	 * added, moved or removed, a light changed, an entity's transform or flags changed).
	 * Sky edits use the directional key. Reading these inputs in one effect
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
	 * Native forms use a narrower trigger: their renderer is lazy, and the Scene
	 * entity representation reports when a form is drawn (`onFormRendererReady`).
	 * The Stage increments `formRenderRevision` for that attached mesh; Scene identity still invalidates later additions,
	 * removals and geometry edits.
	 *
	 * Not triggers, deliberately: the camera (a shadow map renders from the
	 * light's shadow camera) and the ghost meshes (they draw with
	 * `depthWrite={false}` and never set `castShadow`).
	 */
	import { onDestroy } from 'svelte';
	import { useThrelte } from '@threlte/core';
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core/geometry';
	import type { RuntimeScene } from '@portfolio/project-model/scene';
	import { canonicalUnitJson } from '@portfolio/project-model/units';
	import type { StageLightPreview } from '../stage-light-preview.svelte';

	import { perfMarksEnabled } from '$lib/platform/perf-marks';
	import { createShadowInvalidation } from '$lib/render/shadow-invalidation';
	import { useRenderResources } from '$lib/render/resources/render-resources';
	import { useCanvasRendererState } from '$lib/render/renderer-context';

	let {
		sunKey = "off",
		geometry,
		scene,
		lightPreview = null,
		modelUrls = null,
		formRenderRevision
	}: {
		sunKey?: string;
		geometry: CompiledLayoutGeometry;
		scene: RuntimeScene;
		lightPreview?: StageLightPreview | null;
		modelUrls?: ReadonlyMap<string, string> | null;
		/** Changes when a lazy form renderer has attached its mesh to the scene. */
		formRenderRevision: number;
	} = $props();

	const { scene: threlteScene, invalidate } = useThrelte();
	const rendererState = useCanvasRendererState();
	const resources = useRenderResources();
	// This component only mounts inside a ready generation, so the real renderer
	// exists; the controller observes its render calls to count actual submissions.
	const renderer = rendererState.renderer;
	if (renderer === null) {
		throw new Error('StageShadowTriggers requires a ready renderer generation');
	}
	const shadows = createShadowInvalidation({
		renderer,
		scene: threlteScene,
		// The renderer's scheduler still renders on demand (Threlte's default), so
		// an invalidation asks for exactly one frame rather than starting a loop.
		requestFrame: invalidate
	});

	// Harness-only observation of the counter: the browser acceptance run reads
	// the same submissions the product counts, against real r187 shadow nodes.
	// It is absent from ordinary sessions, so no page gains a debug surface.
	type ShadowStatsGlobal = typeof globalThis & {
		__BISKIQ_SHADOW_STATS__?: () => ReturnType<typeof shadows.stats>;
	};
	if (perfMarksEnabled()) {
		(globalThis as ShadowStatsGlobal).__BISKIQ_SHADOW_STATS__ = () => shadows.stats();
		onDestroy(() => {
			delete (globalThis as ShadowStatsGlobal).__BISKIQ_SHADOW_STATS__;
		});
	}

	const casterSceneKey = $derived(canonicalUnitJson({
		entities: scene.entities,
		materials: scene.materials,
		textures: scene.textures,
		palette: scene.palette,
		treatment: scene.environment?.treatment,
		modelFootprints: [...(scene.modelFootprints ?? [])]
	}));
	const overrides = $derived(lightPreview?.overrides.size ? lightPreview.overrides : null);
	const sources = $derived([geometry, casterSceneKey, overrides, lightPreview?.candidate ?? null, modelUrls, formRenderRevision] as const);

	// The tuple is rebuilt whenever any upstream signal settles, including an
	// accepted Sky edit that leaves every caster input identical. Compare each
	// element so only a real caster change renders the maps.
	let previousSources: readonly unknown[] | null = null;
	$effect(() => {
		const current = sources;
		const changed = previousSources === null || current.some((value, index) => value !== previousSources![index]);
		previousSources = current;
		if (changed) shadows.invalidate();
	});

	// Compare the key itself: a parent re-render hands the same value again and
	// must not render a directional map that nothing changed.
	let previousSunKey: string | null = null;
	$effect(() => {
		if (previousSunKey === sunKey) return;
		previousSunKey = sunKey;
		shadows.invalidateSun();
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
