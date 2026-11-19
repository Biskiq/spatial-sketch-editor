<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
	import { resolveSceneSurfaceLook } from '$lib/render/layout/scene-surface-look';
	import type { SceneSurfaceLookResolver } from '$lib/render/layout/surface-look';
	import { neutralVisitorRoomPresentation } from './room-presentation';
	import { createRegionRepresentation } from '$lib/render/layout-region-representation';
	import { createWallRepresentation } from '$lib/render/layout-wall-representation';
	import { createObjectRepresentation } from '$lib/render/layout-object-representation';
	import { createRoomRepresentation } from '$lib/render/layout-room-representation';
	import { useRenderResources } from '$lib/render/resources/render-resources';
	import type { LayoutIdentityIndex } from '$lib/render/render-identity';
	import type { TextureLoadScope } from '$lib/render/resources/texture-store';
	import type { RuntimeScene, SceneTreatment } from '$lib/content/scene';
	import RoomPortal from '$lib/render/layout/RoomPortal.svelte';
	import GroundPlinth from '$lib/render/layout/GroundPlinth.svelte';

	let {
		geometry,
		scene = null,
		textureScope = null,
		treatment = undefined,
		plinth = true,
		doorFrames = true,
		hiddenWallIds = [],
		liftedRoomIds = [],
		cutawayWallIds = [],
		onIdentity
	}: {
		geometry: CompiledLayoutGeometry;
		scene?: RuntimeScene | null;
		textureScope?: TextureLoadScope | null;
		/** The World's resolve-time Treatment for default floors, ceilings and walls. */
		treatment?: SceneTreatment;
		/**
		 * The visitor's dark ground plinth. A host with its own ground surface (the
		 * editor Stage's mat) turns it off, so the two grounds never overlap.
		 */
		plinth?: boolean;
		doorFrames?: boolean;
		/** A display-only overlay (the unfold sheet) owns these Wall bodies. */
		hiddenWallIds?: readonly string[];
		/**
		 * A display-only session overlay: the Rooms whose generated lids a Lift
		 * reading has lifted. Never authored, never persisted, and never passed by
		 * Preview — its Canvas draws the same world as built.
		 */
		liftedRoomIds?: readonly string[];
		/**
		 * X2's display-only cutaway overlay: the Walls drawn through the cutaway twin
		 * material. Never authored, never persisted, and never passed by Preview — its
		 * Canvas draws the same world as built.
		 */
		cutawayWallIds?: readonly string[];
		/**
		 * Receives the shell's identity index once, on mount: id → the object that draws
		 * it. The host resolves picks and selection through it instead of searching the
		 * subtree by name. Returns the host's unregister function.
		 */
		onIdentity?: (index: LayoutIdentityIndex) => (() => void) | void;
	} = $props();

	const floorElevationById = $derived(
		new Map(geometry.floors.map((floor) => [floor.floorId, floor.elevation] as const))
	);

	/** A Floor datum only: a Wall's vertical extent is its own compiled `height`. */
	function roomElevation(floorId: string): number {
		return floorElevationById.get(floorId) ?? 0;
	}

	/**
	 * The Canvas's one resource owner.
	 *
	 * The Canvas host (`StageCanvas`, `VisitorPreviewSurface`) owns the stores;
	 * this shell and the Scene entities, its sibling, lease from the same ones.
	 * Walls, Layout objects and Rooms acquire from the one factory; no
	 * representation constructs a material.
	 */
	const resources = useRenderResources();
	const materials = resources.materials;
	const { invalidate } = useThrelte();
	const resolveSurfaceLook: SceneSurfaceLookResolver = (surface) =>
		scene === null ? null : resolveSceneSurfaceLook(scene, surface, treatment);

	/**
	 * The retained Wall representation: one imperative subtree for every compiled
	 * physical Wall, reconciled in place. It rebuilds only the Walls whose own
	 * `cacheKey` or whose Junction end geometry moved and releases a superseded
	 * buffer in the same update.
	 */
	const walls = createWallRepresentation(materials, undefined, null, null, () => invalidate(), resolveSurfaceLook);

	// Update and teardown are separate effects on purpose: Svelte runs a
	// returned cleanup before each re-run of the same effect, and `geometry`
	// changes identity on every compile, so a combined effect would dispose the
	// representation immediately before every update.
	$effect(() => {
		walls.update(geometry);
	});
	// Hiding is its own effect: a change of the hidden set must not re-run the
	// compile reconciliation, and a recompile must not re-walk the hidden set (the
	// representation remembers it and applies it to whatever it rebuilds).
	$effect(() => {
		walls.setHidden(new Set(hiddenWallIds));
	});
	// The cutaway is a material swap, not a visibility write: a cut Wall still
	// casts exactly the shadow it did as built, and a Whole/hold mask costs one
	// uniform write through the clip instead of a second swap.
	$effect(() => {
		if (walls.setCutaway(new Set(cutawayWallIds))) invalidate();
	});

	/**
	 * The retained Layout object representation: one mesh per
	 * compiled object, reconciled in place. The compiled object's own `cacheKey` is
	 * the retention proof.
	 */
	const objects = createObjectRepresentation(materials, resources.geometry);

	$effect(() => {
		objects.update(geometry);
	});

	/**
	 * The retained Room representation: one group per compiled Room, keyed
	 * by the Room's `cacheKey`, two triangulations and a shared floor buffer, and
	 * three materials for every Room. The shell mounts its root once — there is no
	 * per-Room component, geometry component or material component left.
	 */
	const rooms = createRoomRepresentation(materials, undefined, null, null, () => invalidate(), resolveSurfaceLook);
	const regions = createRegionRepresentation(materials);
	$effect(() => { if (regions.update(geometry)) invalidate(); });

	$effect(() => {
		rooms.update(geometry);
	});

	// A Treatment is a resolve-time choice: swapping it re-leases the default
	// surfaces, never rewrites the document. Both representations answer whether a
	// material moved so the on-demand Stage draws exactly one frame.
	$effect(() => {
		if (walls.setTreatment(treatment)) invalidate();
	});
	$effect(() => {
		if (walls.setScene(scene, textureScope)) invalidate();
	});
	$effect(() => {
		if (rooms.setTreatment(treatment)) invalidate();
	});
	$effect(() => {
		if (rooms.setScene(scene, textureScope)) invalidate();
	});

	/**
	 * A layer change on a retained mesh is not a Threlte prop change, and the Stage
	 * renders on demand, so a lift or a put-back must ask for its own frame or the
	 * lid stays drawn (or stays gone) until something unrelated does. The
	 * representation answers whether a mesh actually moved, so a repeated set and
	 * Preview's default empty one cost no frame.
	 */
	$effect(() => {
		if (rooms.setLifted(new Set(liftedRoomIds))) invalidate();
	});

	/** Every owned id → the object that draws it. Floors resolve through the Rooms. */
	const identity: LayoutIdentityIndex = {
		regionMeshes: regions.meshes,
		objectOf(kind, id) {
			if (kind === 'wall') return walls.objectOf(id);
			if (kind === 'region') return regions.objectOf(id);
			if (kind === 'object') return objects.objectOf(id);
			return rooms.objectOf(id);
		}
	};
	$effect(() => onIdentity?.(identity));

	// One teardown, in dependency order: representations release their buffers and
	// material leases. The Canvas host owns the stores and disposes whatever is
	// left; a release after that disposal is a no-op in both stores.
	$effect(
		() => () => {
			rooms.dispose();
			regions.dispose();
			walls.dispose();
			objects.dispose();
		}
	);

	/** A straight frame only fits a rectangular door; an arch keeps its bare reveal. */
	function isFramedDoor(opening: { kind: string; profile: string }): boolean {
		return doorFrames && opening.kind === 'door' && opening.profile === 'rectangular';
	}
</script>

<T.Group name="VisitorLayoutShell">
	{#if plinth}
		<GroundPlinth />
	{/if}
	<!--
		The retained Room subtree. Mounted once; `update` patches rooms inside it
		rather than the shell re-creating a component per Room.
	-->
	<T is={rooms.object3d} />
	<T is={regions.object3d} />
	<!--
		The retained physical-Wall subtree. It is one object for the shell's whole
		lifetime; `update` patches meshes inside it rather than the shell re-creating
		a component per Wall.
	-->
	<T is={walls.object3d} />
	{#each geometry.walls ?? [] as wall (wall.wallId)}
		{#each wall.openings.filter(isFramedDoor) as opening (opening.openingId)}
			<RoomPortal
				position={[opening.center.point[0], roomElevation(wall.floorId) + opening.sillHeight, opening.center.point[1]]}
				rotation={[0, opening.center.yaw, 0]}
				width={opening.width}
				height={opening.height}
				wallThickness={wall.thickness}
				color={neutralVisitorRoomPresentation.accentColor}
			/>
		{/each}
	{/each}
	<!--
		The retained Layout object subtree. It is one object
		for the shell's lifetime; `update` patches meshes inside it. The neutral
		object surface it uses matches the editor layoutBox tone `#e7e4dd` by value;
		the editor palette module stays outside the visitor closure.
	-->
	<T is={objects.object3d} />
</T.Group>
