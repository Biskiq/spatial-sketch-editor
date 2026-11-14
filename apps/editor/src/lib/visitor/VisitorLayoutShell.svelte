<script lang="ts">
	import { T } from '@threlte/core';
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
	import { neutralVisitorRoomPresentation } from './room-presentation';
	import { createWallRepresentation } from '$lib/render/layout-wall-representation';
	import { createObjectRepresentation } from '$lib/render/layout-object-representation';
	import { createRoomRepresentation } from '$lib/render/layout-room-representation';
	import { createMaterialStore } from '$lib/render/resources/material-store';
	import type { LayoutIdentityIndex } from '$lib/render/render-identity';
	import type { TextureLoadScope } from '$lib/render/resources/texture-store';
	import RoomPortal from '$lib/museum/layout/RoomPortal.svelte';
	import GroundPlinth from '$lib/museum/layout/GroundPlinth.svelte';

	let {
		geometry,
		textureScope = null,
		plinth = true,
		doorFrames = true,
		hiddenWallIds = [],
		onIdentity
	}: {
		geometry: CompiledLayoutGeometry;
		textureScope?: TextureLoadScope | null;
		/**
		 * The visitor's dark ground plinth. A host with its own ground surface (the
		 * editor Stage's mat) turns it off, so the two grounds never overlap.
		 */
		plinth?: boolean;
		doorFrames?: boolean;
		/** A display-only overlay (the unfold sheet) owns these Wall bodies. */
		hiddenWallIds?: readonly string[];
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
	 * One resource owner for this Canvas subtree (E6/R2a).
	 *
	 * WebGL objects cannot be shared across contexts, so the store lives with the
	 * shell: walls, Layout objects and Rooms all acquire their surfaces from it,
	 * equal descriptors share one instance, and the shell disposes it after the
	 * representations that lease from it. No representation constructs a material.
	 */
	const materials = createMaterialStore();

	/**
	 * The retained Wall representation: one imperative subtree for every compiled
	 * physical Wall, reconciled in place. It rebuilds only the Walls whose own
	 * `cacheKey` or whose Junction end geometry moved and releases a superseded
	 * buffer in the same update.
	 */
	const walls = createWallRepresentation(materials);

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

	/**
	 * The retained Layout object representation (T1.P02.S06 D.3 / H4): one mesh per
	 * compiled object, reconciled in place. The compiled object's own `cacheKey` is
	 * the retention proof.
	 */
	const objects = createObjectRepresentation(materials);

	$effect(() => {
		objects.update(geometry);
	});

	/**
	 * The retained Room representation (E6/R3): one group per compiled Room, keyed
	 * by the Room's `cacheKey`, two triangulations and a shared floor buffer, and
	 * three materials for every Room. The shell mounts its root once — there is no
	 * per-Room component, geometry component or material component left.
	 */
	const rooms = createRoomRepresentation(materials);

	$effect(() => {
		rooms.update(geometry);
	});

	/** Every owned id → the object that draws it. Floors resolve through the Rooms. */
	const identity: LayoutIdentityIndex = {
		objectOf(kind, id) {
			if (kind === 'wall') return walls.objectOf(id);
			if (kind === 'object') return objects.objectOf(id);
			return rooms.objectOf(id);
		}
	};
	$effect(() => onIdentity?.(identity));

	// One teardown, in dependency order: representations release their buffers and
	// material leases first, then the store disposes whatever is left.
	$effect(
		() => () => {
			rooms.dispose();
			walls.dispose();
			objects.dispose();
			materials.dispose();
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
		The retained Layout object subtree (T1.P02.S06 D.3 / H4). It is one object
		for the shell's lifetime; `update` patches meshes inside it. The neutral
		object surface it uses matches the editor layoutBox tone `#e7e4dd` by value;
		the editor palette module stays outside the visitor closure.
	-->
	<T is={objects.object3d} />
</T.Group>
