<script lang="ts">
  import { T } from '@threlte/core';
  import { Shape, type BufferGeometry, type Material } from 'three';
  import type { LayoutVec2 } from '$lib/layout/layout-types';
  import type { CompiledLayoutGeometry, LayoutBounds3 } from '$lib/layout/layout-geometry-types';
  import type { VisitorRoomPresentation } from '$lib/visitor/room-presentation';
  import { neutralVisitorRoomPresentation } from '$lib/visitor/room-presentation';
  import { buildRoomWallMesh, buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';
  import { toWallBufferGeometry } from '$lib/render/wall-geometry-adapter';
  import { createVisitorWallMaterialFactory } from './wall-material-factory';
  import MuseumMaterial from '../materials/MuseumMaterial.svelte';
  import RoomPortal from './RoomPortal.svelte';

  let {
    geometry,
    presentation,
    excludedRoomIds = []
  }: {
    geometry: CompiledLayoutGeometry;
    presentation: Readonly<Record<string, VisitorRoomPresentation>>;
    excludedRoomIds?: readonly string[];
  } = $props();

  function polygonShape(points: readonly LayoutVec2[], invertZ = true): Shape {
    const shape = new Shape();
    const first = points[0];
    if (!first) return shape;
    const mapZ = (point: LayoutVec2) => invertZ ? -point[1] : point[1];
    shape.moveTo(first[0], mapZ(first));
    for (const point of points.slice(1)) shape.lineTo(point[0], mapZ(point));
    shape.closePath();
    return shape;
  }

  function roomPresentation(roomId: string) {
    return presentation[roomId] ?? neutralVisitorRoomPresentation;
  }

  type AdaptedRoom =
    | {
        roomId: string;
        ok: true;
        geometry: BufferGeometry;
        materials: Material[];
        dispose: () => void;
      }
    | { roomId: string; ok: false; bounds: LayoutBounds3 };

  type AdaptedWall =
    | {
        wallId: string;
        ok: true;
        geometry: BufferGeometry;
        materials: Material[];
        dispose: () => void;
      }
    | { wallId: string; ok: false; bounds: LayoutBounds3 };

  let adaptedRooms = $state<AdaptedRoom[]>([]);
  let adaptedWalls = $state<AdaptedWall[]>([]);
  let floorElevationById = $state<ReadonlyMap<string, number>>(new Map());

  // Build one watertight room wall mesh per room, reusing materials per tint.
  // Bespoke rooms are filtered BEFORE `buildRoomWallMesh` (not just hidden by
  // the template), so the build cost and the scene match the topology
  // estimator's exclusion semantics. Wall-first canonical rooms carry no
  // Room-owned wall detail (their Walls render below), so they build no room
  // mesh at all — never a fabricated failure surface. Rebuilds when
  // `geometry`/`presentation`/`excludedRoomIds` change; the cleanup disposes the
  // previous generation's geometry and the per-run material cache.
  $effect(() => {
    const materials = createVisitorWallMaterialFactory((roomId) => roomPresentation(roomId).color);
    const built: AdaptedRoom[] = geometry.rooms.flatMap((room) => {
      if (excludedRoomIds.includes(room.roomId)) return [];
      if (room.walls.length === 0) return [];
      const result = buildRoomWallMesh(room, { classifySurface: () => 'wall' });
      if (!result.mesh) {
        return [{ roomId: room.roomId, ok: false, bounds: room.bounds3 } as AdaptedRoom];
      }
      const adapted = toWallBufferGeometry(result.mesh, materials.factory);
      return [{ roomId: room.roomId, ok: true, ...adapted } as AdaptedRoom];
    });
    // P23.6H — canonical physical Walls (wall-first only; empty for legacy).
    // Each Wall's own compiled `height` decides its vertical extent, so this
    // shell matches the editor 3D preview, the visitor shell and the
    // standalone museum app by construction.
    const elevations = new Map(
      geometry.floors.map((floor) => [floor.floorId, floor.elevation] as const)
    );
    const walls: AdaptedWall[] = [];
    for (const wall of geometry.walls ?? []) {
      const floorElevation = elevations.get(wall.floorId) ?? 0;
      const result = buildStandaloneWallMesh(wall, floorElevation, { classifySurface: () => 'wall' });
      if (!result.mesh) {
        walls.push({ wallId: wall.wallId, ok: false, bounds: wall.bounds3 });
        continue;
      }
      const adapted = toWallBufferGeometry(result.mesh, materials.factory);
      walls.push({ wallId: wall.wallId, ok: true, ...adapted });
    }
    adaptedRooms = built;
    adaptedWalls = walls;
    floorElevationById = elevations;
    return () => {
      for (const room of built) if (room.ok) room.dispose();
      for (const wall of walls) if (wall.ok) wall.dispose();
      materials.dispose();
    };
  });

  function adaptedFor(roomId: string): AdaptedRoom | undefined {
    return adaptedRooms.find((room) => room.roomId === roomId);
  }

  function failureBox(bounds: LayoutBounds3) {
    return {
      position: [
        (bounds.min[0] + bounds.max[0]) / 2,
        (bounds.min[1] + bounds.max[1]) / 2,
        (bounds.min[2] + bounds.max[2]) / 2
      ] as [number, number, number],
      size: [
        bounds.max[0] - bounds.min[0],
        bounds.max[1] - bounds.min[1],
        bounds.max[2] - bounds.min[2]
      ] as [number, number, number]
    };
  }
</script>

<T.Group name="LayoutMuseumShell">
  {#each geometry.rooms as room (room.roomId)}
    {#if !excludedRoomIds.includes(room.roomId)}
      {@const colors = roomPresentation(room.roomId)}
      {@const adapted = adaptedFor(room.roomId)}
      <T.Group name={`LayoutRoom:${room.roomId}`}>
        <T.Mesh
          name={`LayoutFloor:${room.roomId}`}
          position={[0, room.floorElevation, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <T.ShapeGeometry args={[polygonShape(room.floorPolygon)]} />
          <MuseumMaterial materialId="wood-walnut" surfaceSize={[8, 8]} tint={colors.color} />
        </T.Mesh>
        <T.Mesh
          name={`LayoutCeiling:${room.roomId}`}
          position={[0, room.ceilingElevation, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <T.ShapeGeometry args={[polygonShape(room.ceilingPolygon, false)]} />
          <MuseumMaterial materialId="plaster-warm" surfaceSize={[8, 8]} tint="#111018" textures="off" />
        </T.Mesh>

        {#if adapted?.ok}
          <T.Mesh
            name={`LayoutWall:${room.roomId}`}
            geometry={adapted.geometry}
            material={adapted.materials}
            castShadow
            receiveShadow
          />
        {:else if adapted?.ok === false}
          <!-- Explicit failure surface: a room whose mesh fails to build is
               never silently omitted. -->
          <T.Mesh
            name={`LayoutWallFailure:${room.roomId}`}
            position={failureBox(adapted.bounds).position}
          >
            <T.BoxGeometry args={failureBox(adapted.bounds).size} />
            <T.MeshBasicMaterial color="#ff2fd4" wireframe />
          </T.Mesh>
        {/if}

        {#each room.walls as wall (wall.segmentId)}
          {#each wall.openings.filter((opening) => opening.kind === 'door') as opening (opening.openingId)}
            <RoomPortal
              position={[opening.center.point[0], room.floorElevation, opening.center.point[1]]}
              rotation={[0, opening.center.yaw, 0]}
              width={opening.width}
              height={opening.height}
              color={colors.accentColor}
            />
          {/each}
        {/each}
      </T.Group>
    {/if}
  {/each}
  {#each geometry.walls ?? [] as wall (wall.wallId)}
    {@const adaptedWall = adaptedWalls.find((candidate) => candidate.wallId === wall.wallId)}
    {#if adaptedWall?.ok}
      <T.Mesh
        name={`LayoutPhysicalWall:${wall.wallId}`}
        geometry={adaptedWall.geometry}
        material={adaptedWall.materials}
        castShadow
        receiveShadow
      />
    {:else if adaptedWall && !adaptedWall.ok}
      <T.Mesh
        name={`LayoutPhysicalWallFailure:${wall.wallId}`}
        position={failureBox(adaptedWall.bounds).position}
      >
        <T.BoxGeometry args={failureBox(adaptedWall.bounds).size} />
        <T.MeshBasicMaterial color="#ff2fd4" wireframe />
      </T.Mesh>
    {/if}
    {#each wall.openings.filter((opening) => opening.kind === 'door') as opening (opening.openingId)}
      <RoomPortal
        position={[opening.center.point[0], floorElevationById.get(wall.floorId) ?? 0, opening.center.point[1]]}
        rotation={[0, opening.center.yaw, 0]}
        width={opening.width}
        height={opening.height}
        color={neutralVisitorRoomPresentation.accentColor}
      />
    {/each}
  {/each}
</T.Group>
