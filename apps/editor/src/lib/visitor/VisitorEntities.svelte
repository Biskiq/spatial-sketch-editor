<script lang="ts">
	import { T } from '@threlte/core';
	import type {
		SceneDocument,
		RuntimeScene,
		SceneEntity,
		SceneModelEntity,
		ScenePrimitiveEntity
	} from '$lib/content/scene';
	import {
		isSceneLightEntity,
		isSceneModelEntity,
		isScenePrimitiveEntity,
		modelEntityToPlacement
	} from '$lib/content/scene';
	import { resolveSceneMaterial } from '$lib/museum/materials/scene-instance-material';
	import type { TextureLoadScope } from '$lib/museum/materials/texture-cache';
	import type { LayoutRoomRegistry } from '@portfolio/project-model';
	import EntityLight from '$lib/museum/entities/EntityLight.svelte';
	import EntityPrimitive from '$lib/museum/entities/EntityPrimitive.svelte';

	let {
		scene,
		rooms,
		textureScope = null,
		modelUrls = null
	}: {
		scene: RuntimeScene;
		rooms: LayoutRoomRegistry;
		textureScope?: TextureLoadScope | null;
		/**
		 * Runtime-safe approved model bytes: model resource id → derivative URL. The
		 * editor and Preview resolve them; this renderer never learns how.
		 */
		modelUrls?: ReadonlyMap<string, string> | null;
	} = $props();

	/**
	 * The model renderer is a separate chunk, loaded only when a Scene has a model.
	 *
	 * It is the one route dependency that pulls a glTF loader and skeletal cloning;
	 * an enclosure-only Stage has no model to draw, so its first load never pays
	 * for those bytes. The fallback footprint is inside AssetModel and arrives with
	 * the chunk; while it loads, the rest of the Stage stays interactive.
	 */
	type AssetModelComponent = typeof import('$lib/museum/assets/AssetModel.svelte')['default'];
	let ModelComponent = $state<AssetModelComponent | null>(null);
	const hasModels = $derived(scene.entities.some(isSceneModelEntity));
	$effect(() => {
		if (!hasModels || ModelComponent !== null) return;
		let cancelled = false;
		void import('$lib/museum/assets/AssetModel.svelte').then((module) => {
			if (!cancelled) ModelComponent = module.default;
		});
		return () => {
			cancelled = true;
		};
	});

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
		entity: ScenePrimitiveEntity | SceneModelEntity
	): ReturnType<typeof resolveSceneMaterial> {
		return resolveSceneMaterial(
			{ materials: scene.materials, textures: scene.textures } as Pick<
				SceneDocument,
				'materials' | 'textures'
			>,
			{
				materialInstanceId: entity.materialInstanceId ?? null,
				fallbackCatalogueId: entity.kind === 'primitive' ? entity.materialId : 'paper-aged'
			}
		);
	}
</script>

{#each roomGroups as group (group.room?.id ?? '__world__')}
	<T.Group position={group.room?.position ?? [0, 0, 0]} rotation={group.room?.rotation ?? [0, 0, 0]}>
		{#each group.entities as entity (entity.id)}
			{#if isSceneModelEntity(entity)}
				{#if ModelComponent}
					<ModelComponent
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
			{:else if isSceneLightEntity(entity)}
				<T.Group position={entity.position} rotation={entity.rotation} scale={entity.scale ?? 1}>
					<EntityLight {entity} />
				</T.Group>
			{/if}
		{/each}
	</T.Group>
{/each}
