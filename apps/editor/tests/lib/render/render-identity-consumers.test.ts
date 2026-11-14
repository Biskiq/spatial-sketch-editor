/**
 * E1/R1 — every consumer resolves rendered objects through owned identity.
 *
 * The pick source classifies a hit by the identity tag, the Stage selection layer
 * finds a selected Layout item through the shell's `objectOf` index, and the shell
 * hides Walls with one `setHidden` call. None of them may read a debug name.
 * Scene entities keep their world frame: the entity root is a direct child of the
 * world root with no transform of its own.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene } from 'three';
import { parse } from 'svelte/compiler';
import type { RuntimeScene } from '@portfolio/project-model';
import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import { tagRenderIdentity, type LayoutIdentityIndex } from '$lib/render/render-identity';
import { EDITOR_SRC } from '../../helpers/import-closure';

const read = (relative: string) => readFileSync(path.join(EDITOR_SRC, relative), 'utf8');
const SCENE = { entities: [] } as unknown as RuntimeScene;
const DOWN = { origin: [0, 5, 0], direction: [0, -1, 0] } as never;

function floorMesh(name: string): Mesh {
	const mesh = new Mesh(new BoxGeometry(10, 0.2, 10), new MeshBasicMaterial());
	mesh.name = name;
	return mesh;
}

function pickKind(mesh: Mesh): string | undefined {
	const pick = createScenePickSource();
	pick.setSource(SCENE);
	const root = new Group();
	root.add(mesh);
	new Scene().add(root);
	pick.registerLayout(root);
	return pick.pick(DOWN, SCENE)?.kind;
}

describe('pick source classifies by identity, not name', () => {
	it('reads a tagged floor as a floor whatever it is called', () => {
		expect(pickKind(tagRenderIdentity(floorMesh('anything'), 'floor', 'r1'))).toBe('floor');
	});

	it('does not read a floor-looking name as a floor', () => {
		expect(pickKind(floorMesh('VisitorFloor:r1'))).toBe('layout');
		expect(pickKind(tagRenderIdentity(floorMesh('VisitorFloor:r1'), 'object', 'o1'))).toBe('layout');
	});
});

describe('the selection layer resolves through the registered index', () => {
	it('has no object until the shell registers its index, then resolves and unregisters', () => {
		const pick = createScenePickSource();
		const found = new Mesh();
		const index: LayoutIdentityIndex = { objectOf: (kind, id) => (kind === 'wall' && id === 'w1' ? found : null) };
		expect(pick.layoutObjectOf('wall', 'w1')).toBeNull();
		const unregister = pick.registerLayoutIdentity(index);
		expect(pick.layoutObjectOf('wall', 'w1')).toBe(found);
		expect(pick.layoutObjectOf('wall', 'w2')).toBeNull();
		expect(pick.layoutObjectOf('object', 'w1')).toBeNull();
		unregister();
		expect(pick.layoutObjectOf('wall', 'w1')).toBeNull();
	});

	it('notifies render observers after the index arrives, never synchronously inside registration', async () => {
		const pick = createScenePickSource();
		let notified = 0;
		pick.onRenderRootsChanged(() => { notified += 1; });
		const unregister = pick.registerLayoutIdentity({ objectOf: () => null });
		// The shell registers from a mount effect: a synchronous observer that
		// writes state would re-run that effect until Svelte aborts it.
		expect(notified).toBe(0);
		await Promise.resolve();
		expect(notified).toBe(1);
		unregister();
		expect(notified).toBe(2);
	});

	it('the layer and the pick source read no name', () => {
		const layer = read('lib/authoring/stage/shell/StageSelectionLayer.svelte');
		expect(layer).toContain("scenePick.layoutObjectOf('wall'");
		expect(layer).toContain("scenePick.layoutObjectOf('object'");
		expect(layer).toContain("scenePick.layoutObjectOf('floor'");
		expect(layer).toContain("renderIdentityOf(meshes[0]!)?.kind === 'wall'");
		expect(layer).not.toContain('getObjectByName');
		expect(layer).not.toMatch(/\.name\.startsWith/);
		expect(read('lib/authoring/scene/scene-pick-source.ts')).not.toMatch(/\.name\.startsWith/);
	});
});

describe('the Layout shell owns visibility and identity', () => {
	const shell = read('lib/visitor/VisitorLayoutShell.svelte');

	it('hides Walls with one setHidden call and never searches by name', () => {
		expect(shell).toContain('walls.setHidden(new Set(hiddenWallIds))');
		expect(shell).not.toContain('getObjectByName');
		expect(shell).not.toMatch(/geometry\.walls\)\s*\{[^}]*visible/);
	});

	it('tags floors by identity and exposes one index over walls, objects and floors', () => {
		// E6/R3: the floors moved into the retained Room representation, which tags
		// each floor mesh and owns the id → object index; the shell composes it.
		expect(read('lib/render/layout-room-representation.ts')).toContain("tagRenderIdentity(floor, 'floor', room.roomId)");
		expect(shell).toContain('walls.objectOf(id)');
		expect(shell).toContain('objects.objectOf(id)');
		expect(shell).toContain('rooms.objectOf(id)');
		expect(shell).not.toContain('floors.get(id)');
		expect(shell).toContain('onIdentity?.(identity)');
	});

	it('the Stage hands the shell the pick source index, and Preview hands it nothing', () => {
		expect(read('lib/authoring/stage/shell/StageCanvas.svelte')).toContain('onIdentity={scenePick.registerLayoutIdentity}');
		expect(read('lib/visitor/VisitorPreviewSurface.svelte')).not.toContain('onIdentity');
	});
});

describe('Scene entities keep their world frame', () => {
	it('mounts the retained root once and never wraps the entity list in a group', () => {
		const source = read('lib/visitor/VisitorEntityGroups.svelte');
		const ast = parse(source, { modern: true });
		const nodes = ast.fragment.nodes.filter((node) => node.type !== 'Text' && node.type !== 'Comment');
		// E7/R4: the primitive/Form root is mounted once, then the remaining
		// component families dispatch per entity. No wrapping group either way.
		expect(nodes.map((node) => node.type)).toEqual(['Component', 'EachBlock']);
		expect(source).toContain('<T is={entities.object3d} />');
		const each = nodes[1] as unknown as {
			expression: { type: string; object: { name: string }; property: { name: string } };
			body: { nodes: Array<{ type: string }> };
		};
		expect(`${each.expression.object.name}.${each.expression.property.name}`).toBe('scene.entities');
		// One family dispatch (`if model / else if artwork / else if light`).
		expect(each.body.nodes.filter((node) => node.type !== 'Text').map((node) => node.type)).toEqual(['IfBlock']);
		// A model root stays transform-free: its body applies its own placement.
		expect(source).toContain('oncreate={(root) => onEntityRoot?.(entity.id, root)}');
	});

	it('the retained root is transform-free and an item root carries only the authored transform', () => {
		const representation = read('lib/render/scene-entity-representation.ts');
		expect(representation).toContain("object3d.name = 'SceneEntities'");
		// The retained root is never moved, rotated or scaled: entity placement is
		// the item's own transform, exactly the world frame the accepted Scene has.
		expect(representation).not.toMatch(/object3d\.(position|rotation|scale)\.set/);
		expect(representation).toContain('group.position.set(...item.transform.position)');
		expect(representation).toContain('group.rotation.set(...item.transform.rotation)');
		expect(representation).toContain('group.scale.set(...item.transform.scale)');
	});
});
