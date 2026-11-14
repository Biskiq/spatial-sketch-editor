<script lang="ts">
	/**
	 * Scene entities in the world frame, shared by the editor Stage and the visitor.
	 *
	 * A Scene is world-local: every entity position is already project/world space,
	 * so entities render directly under the world root with no frame transform.
	 *
	 * E7 moved primitives and Forms onto the retained representation (mounted once
	 * as `entities.object3d`, patched by item key). Models, artwork and lights keep
	 * their existing components until their own packets install handlers; exactly
	 * one of the two paths draws any given entity, so nothing renders twice.
	 *
	 * The model renderer is a prop rather than an import: the public preview keeps
	 * its static `AssetModel` (unchanged first-load graph), while the editor Stage
	 * supplies a lazily loaded one. Geometry and material resolution have exactly
	 * one implementation, so editor and visitor cannot drift.
	 */
	import type { Object3D } from 'three';
	import { T } from '@threlte/core';
	import type {
		RuntimeScene,
		SceneDocument,
		SceneFormEntity,
		SceneModelEntity,
		ScenePrimitiveEntity
	} from '$lib/content/scene';
	import {
		isSceneFormEntity,
		isSceneLightEntity,
		isSceneModelEntity
	} from '$lib/content/scene';
	import { resolveSceneMaterial } from '$lib/museum/materials/scene-instance-material';
	import type { TextureLoadScope } from '$lib/render/resources/texture-store';
	import { useRenderResources } from '$lib/render/resources/render-resources';
	import { createSceneEntityRepresentation } from '$lib/render/scene-entity-representation';
	import {
		describeSceneRender,
		type SceneFormSupport
	} from '$lib/render/scene-render-description';
	import EntityArtwork from '$lib/museum/entities/EntityArtwork.svelte';
	import type { ArtworkScope } from '$lib/render/artwork/artwork-scope';
	import EntityLight from '$lib/museum/entities/EntityLight.svelte';

	type AssetModelComponent = typeof import('$lib/museum/assets/AssetModel.svelte')['default'];

	let {
		scene,
		textureScope = null,
		artworkScope = null,
		onArtworkError,
		modelUrls = null,
		onFormRendererReady,
		onEntityRoot,
		/** Paper is an editor-only reading: it never draws authored Scene lights. */
		includeLights = true,
		Model
	}: {
		scene: RuntimeScene;
		textureScope?: TextureLoadScope | null;
		artworkScope?: ArtworkScope | null;
		onArtworkError?: (message: string) => void;
		/** Runtime-safe approved model bytes: model resource id → derivative URL. */
		modelUrls?: ReadonlyMap<string, string> | null;
		/** Optional Stage-only notification after a Form body has been built. */
		onFormRendererReady?: () => void;
		/** Optional renderer lifecycle observer; no authoring behavior lives here. */
		onEntityRoot?: (id: string, root: Object3D) => (() => void) | void;
		/** The model renderer; `null` until a lazy host has fetched it. */
		Model: AssetModelComponent | null;
		includeLights?: boolean;
	} = $props();

	function entityEffective(
		entity: ScenePrimitiveEntity | SceneModelEntity | SceneFormEntity
	): ReturnType<typeof resolveSceneMaterial> {
		return resolveSceneMaterial(
			{ materials: scene.materials, textures: scene.textures } as Pick<
				SceneDocument,
				'materials' | 'textures'
			>,
			{
				materialInstanceId: entity.materialInstanceId ?? null,
				fallbackCatalogueId:
					entity.kind === 'primitive' || entity.kind === 'form' ? entity.materialId : 'paper-aged'
			}
		);
	}

	/**
	 * The retained primitive/Form subtree (E7/R4): one root for the shell's whole
	 * lifetime, one group and mesh per drawable entity, patched by content key.
	 * Materials and geometry are leases on this Canvas's stores.
	 */
	const resources = useRenderResources();
	const entities = createSceneEntityRepresentation({
		store: resources.materials,
		geometry: resources.geometry,
		scope: () => textureScope,
		onRoot: (id, root) => onEntityRoot?.(id, root)
	});

	/**
	 * The Form kernel is fetched only once a document carries a form, so a project
	 * without forms never downloads the evaluator or its adapter. Until it arrives
	 * the description omits form items — the same visibility the lazy component
	 * mount had — and the next update builds them.
	 */
	let formSupport = $state<SceneFormSupport | null>(null);
	const hasForms = $derived(scene.entities.some(isSceneFormEntity));
	$effect(() => {
		if (formSupport !== null || !hasForms) return;
		let cancelled = false;
		let attempt = 0;
		let timer: ReturnType<typeof setTimeout> | null = null;
		const load = (): void => {
			void import('$lib/render/scene-form-support')
				.then((module) => {
					if (!cancelled) formSupport = module.sceneFormSupport;
				})
				.catch(() => {
					attempt += 1;
					if (!cancelled && attempt < 3) timer = setTimeout(load, 2_000);
				});
		};
		load();
		return () => {
			cancelled = true;
			if (timer !== null) clearTimeout(timer);
		};
	});

	/**
	 * One update per description identity. `describeSceneRender` memoises by the
	 * retained `RuntimeScene`, so an edit that does not touch Scene hands back the
	 * same description and the representation does nothing.
	 */
	$effect(() => {
		const description = describeSceneRender(scene, formSupport);
		const stats = entities.update(description);
		if (stats.forms > 0) onFormRendererReady?.();
	});

	$effect(() => () => entities.dispose());
</script>

<!-- The retained primitive/Form root: mounted once, patched in place. -->
<T is={entities.object3d} />

{#each scene.entities as entity (entity.id)}
	{#if isSceneModelEntity(entity)}
		{#if Model}
			<!-- Transform-free root: the model body applies its own placement. -->
			<T.Group name={`SceneEntity:${entity.id}`} oncreate={(root) => onEntityRoot?.(entity.id, root)}>
				<Model
					assetId={entity.assetId}
					position={entity.position}
					rotation={entity.rotation}
					scale={entity.scale ?? 1}
					fallback={entity.fallback}
					fallbackFootprint={scene.modelFootprints?.get(entity.assetId)}
					resolvedUrl={modelUrls?.get(entity.assetId) ?? null}
					effective={entity.materialInstanceId ? entityEffective(entity) : null}
					scope={textureScope}
				/>
			</T.Group>
		{/if}
	{:else if entity.kind === 'artwork'}
		<EntityArtwork {entity} scope={artworkScope} onError={onArtworkError} onReady={onFormRendererReady} />
	{:else if includeLights && isSceneLightEntity(entity)}
		<T.Group position={entity.position} rotation={entity.rotation} scale={entity.scale ?? 1}>
			<EntityLight {entity} />
		</T.Group>
	{/if}
{/each}
