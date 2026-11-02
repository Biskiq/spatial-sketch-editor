<script lang="ts">
	/**
	 * The Stage's **selection and hover ink in 3D**.
	 *
	 * Selection is one coherent gold identity contour; hover uses leaf ink.
	 * A Wall silhouette suppresses visible-face creases and internal render seams. It is built from the accepted render
	 * groups by source id — the same meshes the creator sees — never from a second
	 * evaluator or a second renderer.
	 *
	 * Two rules keep it honest:
	 *
	 * - **Never under a pick root.** This group is a child of the one Canvas, not
	 *   of `VisitorLayoutShell` or `SceneEntity:*`, so the recursive pick raycast
	 *   cannot reach presentation ink.
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
		Vector3,
		type Object3D
	} from 'three';
	import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
	import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
	import { untrack } from 'svelte';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
	import { hasVisibleAncestor, type ScenePickSource } from '$lib/authoring/scene/scene-pick-source';
	import { STAGE_PAINT } from './stage-paint';
	import { sameReference, type StageSelectionEntry } from '../semantic-selection';
	import { STAGE_ERASE_INK } from '../stage-eraser';
	import { mergeStraightEdgeRuns, visibleIdentityContour, OUTLINE_DEPTH_BIAS } from './stage-outline';

	let {
		selection,
		hover,
		hoverTone = 'hover',
		geometry,
		scenePick,
		width = 1,
		height = 1,
		fade = 1,
		eye = [0, 10, 10]
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
		/** Hands off to Paper's own marks as the sheet arrives during a flip. */
		fade?: number;
		eye?: readonly [number, number, number];
	} = $props();

	const GOLD = STAGE_PAINT.selection;
	const NEUTRAL = STAGE_PAINT.hover;
	const ERASE = Number.parseInt(STAGE_ERASE_INK.slice(1), 16);
	const { invalidate } = useThrelte();

	const root = new Group();
	root.name = 'StageSelectionInk';

	type Inked = { readonly object: Object3D; readonly dispose: () => void };
	let inked: Inked[] = [];
	/** Each drawn material at its own opacity, so a flip can fade it without a rebuild. */
	const fades: { readonly material: { opacity: number }; readonly opacity: number;
	}[] = [];

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
			const meshes = source.objects.flatMap(meshesUnder);
			const wall = entry.reference.domain === 'layout' && entry.reference.subject.kind === 'wall';
			const groups = wall ? [meshes] : meshes.map(mesh => [mesh]);
			for (const group of groups) {
				const positions: number[] = [];
				for (const mesh of group) {
					const matrix = matrixOf(mesh);
					if (wall) {
						const vertices = mesh.geometry.getAttribute('position');
						const index = mesh.geometry.index;
						for (let i = 0; i < (index?.count ?? vertices.count); i++) {
							const point = new Vector3().fromBufferAttribute(vertices, index ? index.getX(i) : i).applyMatrix4(matrix);
							positions.push(point.x, point.y, point.z);
						}
					} else {
						const edges = new EdgesGeometry(mesh.geometry, 30);
						edges.applyMatrix4(matrix);
						positions.push(...edges.getAttribute('position').array);
						edges.dispose();
					}
				}
				const contour = wall ? visibleIdentityContour(positions, eye) : mergeStraightEdgeRuns(positions);
				if (contour.length === 0) continue;
				const edgeGeometry = new LineSegmentsGeometry();
				edgeGeometry.setPositions(contour);
				const material = new LineMaterial({
					color: tone === 'selection' ? GOLD : tone === 'erase' ? ERASE : NEUTRAL,
					linewidth: tone === 'selection' ? 3 : 2.5,
					transparent: true,
					opacity: 1,
					toneMapped: false,
					depthTest: true,
					depthWrite: false,
					...OUTLINE_DEPTH_BIAS,
					resolution: new Vector2(width, height),
					...(tone === 'erase' ? { dashed: true, dashSize: 0.12, gapSize: 0.08 } : {})
				});
				const line = new LineSegments2(edgeGeometry, material);
				if (tone === 'erase') line.computeLineDistances();
				line.frustumCulled = false;
				line.renderOrder = tone === 'selection' ? 22 : tone === 'erase' ? 24 : 19;
				line.layers.set(2);
				root.add(line);
				fades.push({ material, opacity: 1 });
				inked.push({ object: line, dispose: () => { edgeGeometry.dispose(); material.dispose(); } });
			}

		} finally {
			source.dispose();
		}
	}

	function applyFade(amount: number): void {
		for (const entry of fades) entry.material.opacity = entry.opacity * amount;
	}

	function rebuild(): void {
		fades.length = 0;
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
		applyFade(untrack(() => fade));
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
		eye;
		rebuild();
		const stop = scenePick.onRenderRootsChanged(rebuild);
		return () => {
			stop();
			releaseAll();
			invalidate();
		};
	});

	$effect(() => {
		applyFade(fade);
		invalidate();
	});

	$effect(() => () => {
		releaseAll();
		invalidate();
	});
</script>

<T is={root} />
