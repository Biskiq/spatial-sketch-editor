<script lang="ts">
	/**
	 * The Stage's **selection and hover ink in 3D**.
	 *
	 * Selection is one coherent identity contour: a gold edge outline with a
	 * translucent gold tint for the primary selection, and the same two
	 * mechanisms in a neutral tone for hover. It is built from the accepted render
	 * groups by source id — the same meshes the creator sees — never from a second
	 * evaluator or a second renderer.
	 *
	 * Two rules keep it honest:
	 *
	 * - **Never under a pick root.** This group is a child of the one Canvas, not
	 *   of `VisitorLayoutShell` or `SceneEntity:*`, so the recursive pick raycast
	 *   cannot reach a tint clone.
	 * - **The Stage overlay layer.** Every child is on layer 2, which the Stage
	 *   camera shows only when world meshes are drawn. Raycasting keeps its
	 *   default layer mask and never hits this ink.
	 *
	 * It deliberately does not own Paper ink: `StagePaper` re-strokes the selected
	 * fragment and footprint on vellum through `paper-marks`, where a mesh tint
	 * would be the wrong reading. The two are mounted exclusively: this layer on
	 * the mat, the Paper re-stroke while Paper is visible.
	 */
	import { T, useThrelte } from '@threlte/core';
	import {
		BoxGeometry,
		EdgesGeometry,
		Group,
		Matrix4,
		Mesh,
		MeshBasicMaterial,
		Vector2,
		type Object3D
	} from 'three';
	import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
	import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
	import { hasVisibleAncestor, type ScenePickSource } from '$lib/authoring/scene/scene-pick-source';
	import { PAPER_SELECTION_EDGE_INK } from '../paper-marks';
	import { sameReference, type StageSelectionEntry } from '../semantic-selection';
	import { STAGE_ERASE_INK } from '../stage-eraser';
	import { mergeStraightEdgeRuns, OUTLINE_DEPTH_BIAS } from './stage-outline';

	let {
		selection,
		hover,
		hoverTone = 'hover',
		geometry,
		scenePick,
		width = 1,
		height = 1
	}: {
		selection: StageSelectionEntry | null;
		hover: StageSelectionEntry | null;
		/** R217.S10: the armed Eraser's winner reads as red dashes, never gold. */
		hoverTone?: 'hover' | 'erase';
		geometry: CompiledLayoutGeometry;
		scenePick: ScenePickSource;
		/** Viewport CSS size; fat-line width is in CSS pixels at this resolution. */
		width?: number;
		height?: number;
	} = $props();

	const GOLD = 0xd4ad45;
	const SELECTION_EDGE = Number.parseInt(PAPER_SELECTION_EDGE_INK.slice(1), 16);
	const NEUTRAL = 0xf3f4ee;
	const ERASE = Number.parseInt(STAGE_ERASE_INK.slice(1), 16);
	const { invalidate } = useThrelte();

	const root = new Group();
	root.name = 'StageSelectionInk';

	type Inked = { readonly object: Object3D; readonly dispose: () => void };
	let inked: Inked[] = [];

	function releaseAll(): void {
		for (const entry of inked) {
			root.remove(entry.object);
			entry.dispose();
		}
		inked = [];
	}

	type Source = { readonly objects: Object3D[]; readonly dispose: () => void };
	const NO_SOURCE: Source = { objects: [], dispose: () => {} };

	/** Every rendered mesh the selected subject owns, or a synthetic Opening box. */
	function sourceMeshes(entry: StageSelectionEntry): Source {
		const id = entry.reference.subject.id;
		const domain = entry.reference.domain;
		if (domain === 'layout') {
			const layout = scenePick.layoutObject();
			if (layout === null) return NO_SOURCE;
			const kind = entry.reference.subject.kind;
			if (kind === 'wall') {
				// A failed Wall is still readable as its failure surface, so the creator
				// can see that the selected identity is the one the compiler refused.
				const wall =
					layout.getObjectByName(`VisitorPhysicalWall:${id}`) ??
					layout.getObjectByName(`VisitorPhysicalWallFailure:${id}`);
				return wall === undefined ? NO_SOURCE : { objects: [wall], dispose: () => {} };
			}
			if (kind === 'object') {
				const object = layout.getObjectByName(`VisitorLayoutObject:${id}`);
				return object === undefined ? NO_SOURCE : { objects: [object], dispose: () => {} };
			}
			if (kind === 'room') {
				const floor = layout.getObjectByName(`VisitorFloor:${id}`);
				return floor === undefined ? NO_SOURCE : { objects: [floor], dispose: () => {} };
			}
			if (kind === 'opening') return openingMesh(id);
			return NO_SOURCE;
		}
		const entity = scenePick.entityObject(id);
		return entity === null ? NO_SOURCE : { objects: [entity], dispose: () => {} };
	}

	/**
	 * An Opening is carved out of its host Wall, so there is no opening mesh to
	 * clone. Its evaluated opening box is the truthful source: the same compiled
	 * centre, width, height and sill the Wall mesh was built from.
	 */
	function openingMesh(openingId: string): Source {
		const wall = geometry.walls?.find((candidate) =>
			candidate.openings.some((opening) => opening.openingId === openingId)
		);
		const opening = wall?.openings.find((candidate) => candidate.openingId === openingId);
		if (wall === undefined || opening === undefined) return NO_SOURCE;
		const floor = geometry.floors.find((candidate) => candidate.floorId === wall.floorId);
		const elevation = floor?.elevation ?? 0;
		const box = new BoxGeometry(opening.width, opening.height, wall.thickness + 0.02);
		const material = new MeshBasicMaterial();
		const mesh = new Mesh(box, material);
		mesh.position.set(
			opening.center.point[0],
			elevation + opening.sillHeight + opening.height / 2,
			opening.center.point[1]
		);
		mesh.rotation.y = opening.center.yaw;
		mesh.updateMatrixWorld(true);
		return {
			objects: [mesh],
			dispose: () => {
				box.dispose();
				material.dispose();
			}
		};
	}

	/** An invisible node is not drawn, so it must not contribute a gold clone either. */
	function meshesUnder(object: Object3D): Mesh[] {
		const meshes: Mesh[] = [];
		object.traverse((node) => {
			if (node instanceof Mesh && node.geometry !== undefined && hasVisibleAncestor(node)) meshes.push(node);
		});
		return meshes;
	}

	function matrixOf(mesh: Mesh): Matrix4 {
		mesh.updateWorldMatrix(true, false);
		return mesh.matrixWorld.clone();
	}

	function apply(
		entry: StageSelectionEntry | null,
		tone: 'selection' | 'hover' | 'erase'
	): void {
		if (entry === null) return;
		const source = sourceMeshes(entry);
		try {
			for (const object of source.objects) {
				for (const mesh of meshesUnder(object)) {
				const matrix = matrixOf(mesh);
				// Fat lines are a real pair of passes: a dark halo under the gold/neutral
				// contour. `LineBasicMaterial` line width is a no-op on WebGL, so the
				// Stage uses the line addon it already ships with Three.
				const edges = new EdgesGeometry(mesh.geometry, 30);
				const positions = edges.getAttribute('position')?.array;
				if (positions === undefined) {
					edges.dispose();
					continue;
				}
				const edgeGeometry = new LineSegmentsGeometry();
				edgeGeometry.setPositions(mergeStraightEdgeRuns(positions));
				edges.dispose();
				const resolution = new Vector2(width, height);
				const haloMaterial = new LineMaterial({
					// Paper's two-tone contour: the forest halo swallows gold on the pale
					// ground, while this edge holds there and on the forest mat.
					color: tone === 'selection' ? SELECTION_EDGE : 0x152c26,
					linewidth: tone === 'selection' ? 5 : tone === 'erase' ? 4 : 3.5,
					transparent: true,
					opacity: 0.9,
					depthTest: true,
					depthWrite: false,
					...OUTLINE_DEPTH_BIAS,
					resolution
				});
				const lineMaterial = new LineMaterial({
					color: tone === 'selection' ? GOLD : tone === 'erase' ? ERASE : NEUTRAL,
					linewidth: tone === 'selection' ? 2.5 : tone === 'erase' ? 2.2 : 1.8,
					transparent: true,
					opacity: tone === 'hover' ? 0.6 : 1,
					depthTest: true,
					depthWrite: false,
					...OUTLINE_DEPTH_BIAS,
					resolution,
					// The erase treatment is dashed; dash lengths are world meters.
					...(tone === 'erase' ? { dashed: true, dashSize: 0.12, gapSize: 0.08 } : {})
				});
				const halo = new LineSegments2(edgeGeometry, haloMaterial);
				// Selection outranks hover when two subjects share an edge: the gold
				// identity must never be cut by a neighbouring neutral preview.
				const haloOrder = tone === 'selection' ? 21 : tone === 'erase' ? 23 : 18;
				const lineOrder = haloOrder + 1;
				halo.matrixAutoUpdate = false;
				halo.matrix.copy(matrix);
				halo.frustumCulled = false;
				halo.renderOrder = haloOrder;
				halo.layers.set(2);
				root.add(halo);
				const line = new LineSegments2(edgeGeometry, lineMaterial);
				if (tone === 'erase') line.computeLineDistances();
				line.matrixAutoUpdate = false;
				line.matrix.copy(matrix);
				line.frustumCulled = false;
				line.renderOrder = lineOrder;
				line.layers.set(2);
				root.add(line);
				inked.push({
					object: halo,
					dispose: () => {
						edgeGeometry.dispose();
						haloMaterial.dispose();
						lineMaterial.dispose();
					}
				});
				// The gold/neutral line shares the same geometry and is removed with the
				// halo; its own dispose is the shared one above.
				inked.push({ object: line, dispose: () => {} });
				if (tone !== 'selection') continue;
				const tintGeometry = mesh.geometry.clone();
				const tintMaterial = new MeshBasicMaterial({
					color: GOLD,
					transparent: true,
					opacity: 0.28,
					depthWrite: false,
					depthTest: true,
					polygonOffset: true,
					polygonOffsetFactor: -1,
					polygonOffsetUnits: -1
				});
				const tint = new Mesh(tintGeometry, tintMaterial);
				tint.matrixAutoUpdate = false;
				tint.matrix.copy(matrix);
				// Above hover's line (19), below the selection's own halo/contour.
				tint.renderOrder = 20;
				tint.layers.set(2);
				root.add(tint);
				inked.push({
					object: tint,
					dispose: () => {
						tintGeometry.dispose();
						tintMaterial.dispose();
					}
				});
				}
			}
		} finally {
			source.dispose();
		}
	}

	function rebuild(): void {
		releaseAll();
		apply(selection, 'selection');
		// Hover is subordinate and never drawn for the selected subject itself. The
		// full canonical reference is the identity, not just its id.
		// The Eraser's winner is drawn even when it is the selection: it says what the
		// next click removes, which gold alone cannot.
		if (hover !== null && hoverTone === 'erase') apply(hover, 'erase');
		else if (hover !== null && (selection === null || !sameReference(hover.reference, selection.reference))) {
			apply(hover, 'hover');
		}
		// These objects are added and removed imperatively, so Threlte cannot infer
		// that a selection or hover change needs a frame. Ask for exactly one.
		invalidate();
	}

	$effect(() => {
		selection;
		hover;
		hoverTone;
		geometry;
		width;
		height;
		rebuild();
		const stop = scenePick.onRenderRootsChanged(rebuild);
		return () => {
			stop();
			releaseAll();
			invalidate();
		};
	});

	$effect(() => () => {
		releaseAll();
		invalidate();
	});
</script>

<T is={root} />
