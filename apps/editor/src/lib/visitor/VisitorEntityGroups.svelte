<script lang="ts">
	/**
	 * Scene entities grouped by Room, shared by the editor Stage and the visitor.
	 *
	 * The model renderer is a prop rather than an import: the public preview keeps
	 * its static `AssetModel` (unchanged first-load graph), while the editor Stage
	 * supplies a lazily loaded one. Geometry, material resolution and grouping have
	 * exactly one implementation, so editor and visitor cannot drift.
	 */
	import { T } from '@threlte/core';
	import type {
		SceneDocument,
		RuntimeScene,
		SceneEntity,
		SceneFormEntity,
		SceneModelEntity,
		ScenePrimitiveEntity
	} from '$lib/content/scene';
	import {
		isSceneFormEntity,
		isSceneLightEntity,
		isSceneModelEntity,
		isScenePrimitiveEntity
	} from '$lib/content/scene';
	import { resolveSceneMaterial } from '$lib/museum/materials/scene-instance-material';
	import type { TextureLoadScope } from '$lib/museum/materials/texture-cache';
	import type { LayoutRoomRegistry } from '@portfolio/project-model';
	import EntityLight from '$lib/museum/entities/EntityLight.svelte';
	import EntityPrimitive from '$lib/museum/entities/EntityPrimitive.svelte';

	type AssetModelComponent = typeof import('$lib/museum/assets/AssetModel.svelte')['default'];
	type EntityFormComponent = typeof import('$lib/museum/entities/EntityForm.svelte')['default'];

	let {
		scene,
		rooms,
		textureScope = null,
		modelUrls = null,
		onFormRendererReady,
		Model
	}: {
		scene: RuntimeScene;
		rooms: LayoutRoomRegistry;
		textureScope?: TextureLoadScope | null;
		/** Runtime-safe approved model bytes: model resource id → derivative URL. */
		modelUrls?: ReadonlyMap<string, string> | null;
		/** Optional Stage-only notification after a lazy form mesh has mounted. */
		onFormRendererReady?: () => void;
		/** The model renderer; `null` until a lazy host has fetched it. */
		Model: AssetModelComponent | null;
	} = $props();

	const roomGroups = $derived.by(() => {
		const entitiesByRoom = new Map<string | undefined, SceneEntity[]>();
		for (const entity of scene.entities) {
			const entities = entitiesByRoom.get(entity.roomId) ?? [];
			entities.push(entity);
			entitiesByRoom.set(entity.roomId, entities);
		}
		return [...entitiesByRoom].map(([roomId, entities]) => {
			// P23.0b: absent roomId is the world-local identity frame — entities
			// are already project/world space and render without a room transform.
			if (roomId === undefined) return { room: null, entities };
			let room;
			try {
				room = rooms.getRequired(roomId);
			} catch {
				return null;
			}
			return { room, entities };
		}).filter((group) => group !== null) as Array<{
			room: ReturnType<LayoutRoomRegistry['getRequired']> | null;
			entities: SceneEntity[];
		}>;
	});

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
	 * The form renderer is fetched only once a document actually carries a form,
	 * so a project without forms never downloads the kernel or its adapter. A
	 * failed fetch retries a bounded number of times instead of leaving an
	 * admitted form permanently invisible.
	 */
	let FormComponent = $state<EntityFormComponent | null>(null);
	const hasForms = $derived(scene.entities.some(isSceneFormEntity));
	$effect(() => {
		if (FormComponent !== null || !hasForms) return;
		let cancelled = false;
		let attempt = 0;
		let timer: ReturnType<typeof setTimeout> | null = null;
		const load = (): void => {
			void import('$lib/museum/entities/EntityForm.svelte')
				.then((module) => {
					if (!cancelled) FormComponent = module.default;
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
</script>

{#each roomGroups as group (group.room?.id ?? '__world__')}
	<T.Group position={group.room?.position ?? [0, 0, 0]} rotation={group.room?.rotation ?? [0, 0, 0]}>
		{#each group.entities as entity (entity.id)}
			{#if isSceneModelEntity(entity)}
				{#if Model}
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
				{/if}
			{:else if isScenePrimitiveEntity(entity)}
				<T.Group position={entity.position} rotation={entity.rotation} scale={entity.scale ?? 1}>
					<EntityPrimitive {entity} effective={entityEffective(entity)} scope={textureScope} />
				</T.Group>
			{:else if isSceneFormEntity(entity)}
				{#if FormComponent}
					<T.Group position={entity.position} rotation={entity.rotation}>
						<FormComponent
							{entity}
							effective={entityEffective(entity)}
							scope={textureScope}
							onMounted={onFormRendererReady}
						/>
					</T.Group>
				{/if}
			{:else if isSceneLightEntity(entity)}
				<T.Group position={entity.position} rotation={entity.rotation} scale={entity.scale ?? 1}>
					<EntityLight {entity} />
				</T.Group>
			{/if}
		{/each}
	</T.Group>
{/each}
