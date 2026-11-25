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
		AlwaysStencilFunc,
		DoubleSide,
		EdgesGeometry,
		Group,
		Matrix4,
		Mesh,
		MeshBasicMaterial,
		NotEqualStencilFunc,
		ReplaceStencilOp,
		Vector3,
		type Material,
		type Object3D,
		type Plane
	} from 'three';
	import { Line2 } from 'three/addons/lines/webgpu/Line2.js';
	import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
	import { untrack } from 'svelte';
	import { Line2NodeMaterial } from 'three/webgpu';
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
	import { hasVisibleAncestor, type ScenePickSource } from '$lib/authoring/scene/scene-pick-source';
	import { compiledOpeningFaceLoops, openingLoopSegments } from '../../layout/opening-faces';
	import { useStageClip } from '../slice/stage-clip';
	import { selectionObjectsOf } from './stage-selection-source';
	import { STAGE_PAINT } from './stage-paint';
	import { renderIdentityOf } from '$lib/render/render-identity';
	import { sameReference, sameSubject, type StageSelectionEntry } from '../semantic-selection';
	import { STAGE_ERASE_INK } from '../stage-eraser';
	import {
		contourPolylines,
		mergeStraightEdgeRuns,
		visibleIdentityContour,
		visibleRimContour,
		wallSilhouetteHullScale,
		OUTLINE_DEPTH_BIAS
	} from './stage-outline';

	let {
		selection,
		hover,
		hoverTone = 'hover',
		proposals = [],
		geometry,
		scenePick,
		width = 1,
		height = 1,
		fade = 1,
		eye = [0, 10, 10],
		unclippedSelection = false,
		cutawayWallIds = []
	}: {
		selection: StageSelectionEntry | null;
		hover: StageSelectionEntry | null;
		/** The armed Eraser's winner reads as red dashes, never gold. */
		hoverTone?: 'hover' | 'erase' | 'paint';
		/**
		 * The other users a Finish Card edit reaches while *All* is chosen (U4):
		 * cobalt dashes, the same proposal ink Paint uses. Never the selection itself.
		 */
		proposals?: readonly StageSelectionEntry[];
		geometry: CompiledLayoutGeometry;
		scenePick: ScenePickSource;
		/**
		 * The selected subject is wholly hidden by the Slice and drawn as a ghost:
		 * its gold contour is the one contour the planes must not cut. Every other tone
		 * — hover, erase, and the rim ink of a visible subject — stays clipped, so ink
		 * never implies a body above the cut (§2.4).
		 */
		unclippedSelection?: boolean;
		/** Viewport CSS size; fat-line width is in CSS pixels at this resolution. */
		width?: number;
		height?: number;
		/** Hands off to Paper's own marks as the sheet arrives during a flip. */
		fade?: number;
		eye?: readonly [number, number, number];
		/**
		 * X2's effective cut set. Hover/rim ink of a cut Wall is drawn through
		 * `cutawayInk` so its contour matches the stub; selection ink never is,
		 * because a selected Wall is exempt from the cutaway (D9).
		 */
		cutawayWallIds?: readonly string[];
	} = $props();

	const GOLD = STAGE_PAINT.selection;
	const NEUTRAL = STAGE_PAINT.hover;
	const ERASE = Number.parseInt(STAGE_ERASE_INK.slice(1), 16);
	/** The cobalt of a proposal: what the next Paint release will change. */
	const PROPOSAL = STAGE_PAINT.proposal;
	/**
	 * Prototype switch, dev only. The shipped contour remains the default until
	 * the stencil reading is accepted; `?wallOutline=stencil` exercises the
	 * inverted-hull silhouette in the running Stage.
	 */
	const wallOutline =
		import.meta.env.DEV &&
		typeof window !== 'undefined' &&
		new URLSearchParams(window.location.search).get('wallOutline') === 'stencil'
			? 'stencil'
			: 'contour';
	const { invalidate } = useThrelte();
	/** The Canvas's one clip array, by reference: a Slice cuts this ink with its subject. */
	const stageClip = useStageClip();
	/**
	 * The planes a tone draws through, or `undefined` for "not clipped".
	 *
	 * The array is the Canvas's own, never a copy: a material created here must share
	 * the clip the world materials hold, so a moved plane moves this ink too.
	 */
	function clipFor(tone: 'selection' | 'hover' | 'erase' | 'paint' | 'rim'): Plane[] | undefined {
		if (stageClip === null) return undefined;
		if (tone === 'selection' && unclippedSelection) return undefined;
		return stageClip.planes as Plane[];
	}
	/**
	 * A clipped tone is cut by the drawn predicate too, not only the native planes: a
	 * drawn cut parks the planes at keep-all, so without this the gold contour would
	 * float over the part of its subject the cut removed (§2.4).
	 */
	function cutInk<M extends Material>(
		material: M,
		planes: Plane[] | undefined,
		tone: 'selection' | 'hover' | 'erase' | 'paint' | 'rim'
	): M {
		if (planes === undefined || stageClip === null) return material;
		// A cut Wall's hover/rim contour follows its stub; the selection contour is
		// whole because the selected Wall is exempt from the cutaway (D9).
		if (drawingCutawayWall && tone !== 'selection') return stageClip.cutawayInk(material);
		return stageClip.clipInk(material);
	}
	/** Set while drawing ink for a Wall that is in the effective cut set. */
	let drawingCutawayWall = false;

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

	/**
	 * Every rendered object the selected subject owns.
	 *
	 * Resolved by the shared `selectionObjectsOf`, the same resolver the Slice's
	 * ghost uses: one answer to "what draws this subject" keeps the gold contour and
	 * the ghost from disagreeing about which body is selected. A failed Wall is still
	 * readable as its failure surface, so the creator can see that the selected
	 * identity is the one the compiler refused.
	 */
	function sourceMeshes(entry: StageSelectionEntry): Source {
		const objects = selectionObjectsOf(scenePick, entry);
		return objects.length === 0 ? NO_SOURCE : { objects, dispose: () => {} };
	}

	function openingContour(openingId: string): number[] {
		for (const wall of geometry.walls) {
			const opening = wall.openings.find((candidate) => candidate.openingId === openingId);
			if (opening === undefined) continue;
			const elevation = geometry.floors.find((floor) => floor.floorId === wall.floorId)?.elevation ?? 0;
			return openingLoopSegments(compiledOpeningFaceLoops(wall, opening, elevation)).flat(2);
		}
		return [];
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

	/** The accepted mesh's triangles in world space, for silhouette ink. */
	function worldTriangles(mesh: Mesh): number[] {
		const matrix = matrixOf(mesh);
		const vertices = mesh.geometry.getAttribute('position');
		const index = mesh.geometry.index;
		const positions: number[] = [];
		for (let i = 0; i < (index?.count ?? vertices.count); i += 1) {
			const point = new Vector3().fromBufferAttribute(vertices, index ? index.getX(i) : i).applyMatrix4(matrix);
			positions.push(point.x, point.y, point.z);
		}
		return positions;
	}

	/**
	 * One stencil silhouette for a selected or hovered Wall.
	 *
	 * The accepted Wall body writes stencil 1 without colour or depth. A copy of
	 * the same geometry, expanded per axis about its own centre, draws the tone's
	 * shell wherever that mask is absent. The expansion grows the Wall's openings
	 * with the shell, so an aperture cannot be cap-filled by the outline. This is
	 * presentation over the accepted mesh, not a second wall model.
	 */
	function addStencilSilhouette(mesh: Mesh, tone: 'selection' | 'hover'): void {
		mesh.updateWorldMatrix(true, false);
		const geometry = mesh.geometry;
		if (geometry.boundingBox === null) geometry.computeBoundingBox();
		const box = geometry.boundingBox;
		if (box === null) return;
		const center = box.getCenter(new Vector3());
		const size = box.getSize(new Vector3());
		const scale = wallSilhouetteHullScale([size.x, size.y, size.z]);

		const pivot = new Group();
		pivot.name = 'StageWallStencilSilhouette';
		pivot.matrixAutoUpdate = false;
		pivot.matrix.copy(mesh.matrixWorld);
		pivot.matrixWorldNeedsUpdate = true;

		const silhouettePlanes = clipFor(tone);
		const maskMaterial = cutInk(new MeshBasicMaterial({
			fog: false,
			...(silhouettePlanes === undefined ? {} : { clippingPlanes: silhouettePlanes }),
			colorWrite: false,
			depthTest: false,
			depthWrite: false,
			side: DoubleSide,
			stencilWrite: true,
			stencilRef: 1,
			stencilFunc: AlwaysStencilFunc,
			stencilZPass: ReplaceStencilOp
		}), silhouettePlanes, tone);
		const mask = new Mesh(geometry, maskMaterial);
		mask.name = 'StageWallStencilMask';
		mask.frustumCulled = false;
		mask.renderOrder = 20;
		mask.layers.set(2);

		const outlineMaterial = cutInk(new MeshBasicMaterial({
			fog: false,
			...(silhouettePlanes === undefined ? {} : { clippingPlanes: silhouettePlanes }),
			color: tone === 'selection' ? GOLD : NEUTRAL,
			transparent: true,
			opacity: 1,
			// Selection is the identity overlay; hover is still a surface cue and
			// must not claim ink on geometry in front of it.
			depthTest: tone !== 'selection',
			depthWrite: false,
			toneMapped: false,
			side: DoubleSide,
			// `stencilWrite` gates the stencil *test* too: with it off, `NotEqual`
			// is ignored and the shell floods the Wall it is meant to sit behind.
			stencilWrite: true,
			stencilRef: 1,
			stencilFunc: NotEqualStencilFunc
		}), silhouettePlanes, tone);
		// p' = s(p - c) + c: the shell is scaled about the accepted mesh's own
		// centre, not the world origin.
		const scaleGroup = new Group();
		scaleGroup.position.copy(center);
		scaleGroup.scale.set(scale[0], scale[1], scale[2]);
		const shell = new Mesh(geometry, outlineMaterial);
		shell.name = 'StageWallStencilShell';
		shell.position.copy(center).multiplyScalar(-1);
		shell.frustumCulled = false;
		shell.renderOrder = 21;
		shell.layers.set(2);
		scaleGroup.add(shell);
		pivot.add(mask, scaleGroup);
		root.add(pivot);
		// The stencil mask hides every rim inside the silhouette. Add the
		// camera-facing top/bottom and aperture rims as depth-tested ink. Hover
		// keeps the same shape but takes the quieter leaf tone.
		addContour(
			visibleRimContour(worldTriangles(mesh), eye),
			'rim',
			tone === 'selection' ? GOLD : NEUTRAL
		);
		fades.push({ material: outlineMaterial, opacity: 1 });
		inked.push({
			object: pivot,
			dispose: () => {
				maskMaterial.dispose();
				outlineMaterial.dispose();
			}
		});
	}

	function addContour(
		contour: number[] | Float32Array,
		tone: 'selection' | 'hover' | 'erase' | 'paint' | 'rim',
		color?: number
	): void {
		if (contour.length === 0) return;
		// A polyline has one cap at each real end. The old segment renderer capped
		// every sampled span, which is what made a curved selection look striped.
		for (const points of contourPolylines(contour)) {
			const edgeGeometry = new LineGeometry();
			edgeGeometry.setPositions(points);
						const planes = clipFor(tone);
			const material = cutInk(new Line2NodeMaterial({
				fog: false,
				...(planes === undefined ? {} : { clippingPlanes: planes }),
				color: color ?? (tone === 'selection' || tone === 'rim' ? GOLD : tone === 'erase' ? ERASE : tone === 'paint' ? PROPOSAL : NEUTRAL),
				linewidth: tone === 'selection' ? 3 : 2.5,
				transparent: true,
				opacity: 1,
				toneMapped: false,
				// Selection is the identity overlay, not a surface: a derived Room
				// ceiling must not bite the gold rim out of a closed Wall. Hover and
				// erase stay depth-tested so they cannot imply hidden geometry.
				depthTest: tone !== 'selection',
				depthWrite: false,
				...OUTLINE_DEPTH_BIAS,
				...(tone === 'erase' || tone === 'paint' ? { dashed: true, dashSize: 0.12, gapSize: 0.08 } : {})
			}), planes, tone);
			const line = new Line2(edgeGeometry, material);
			if (tone === 'erase' || tone === 'paint') line.computeLineDistances();
			line.frustumCulled = false;
			line.renderOrder = tone === 'selection' ? 22 : tone === 'rim' ? 23 : tone === 'erase' || tone === 'paint' ? 24 : 19;
			line.layers.set(2);
			root.add(line);
			fades.push({ material, opacity: 1 });
			inked.push({ object: line, dispose: () => { edgeGeometry.dispose(); material.dispose(); } });
		}
	}

	function apply(
		entry: StageSelectionEntry | null,
		tone: 'selection' | 'hover' | 'erase' | 'paint'
	): void {
		if (entry === null) return;
		// Artwork is selected by its screen-space frame polygon and grips
		// (ArtworkResizeOverlay), not by mesh contour: a 3 px gold line on every
		// mesh edge hides thin frames and the image edge. Hover and erase still
		// trace the mesh, because those tones are about the surface under the
		// pointer, not about the Artwork's own identity.
		if (
			tone === 'selection' &&
			entry.reference.domain === 'scene' &&
			entry.reference.subject.kind === 'artwork'
		) {
			return;
		}
		// Mark a Wall that the cutaway removes above its stub: its hover/rim ink is
		// bound to the live top, so the contour stops where the Wall stops. The
		// selection tone is deliberately excluded — the selected Wall is exempt (D9).
		drawingCutawayWall =
			tone !== 'selection' &&
			entry.reference.domain === 'layout' &&
			entry.reference.subject.kind === 'wall' &&
			cutawayWallSet.has(entry.reference.subject.id);
		if (entry.reference.domain === 'layout' && entry.reference.subject.kind === 'opening') {
			addContour(openingContour(entry.reference.subject.id), tone);
			drawingCutawayWall = false;
			return;
		}
		const source = sourceMeshes(entry);
		try {
			const meshes = source.objects.flatMap(meshesUnder);
			const wall = entry.reference.domain === 'layout' && entry.reference.subject.kind === 'wall';
			if (
				wall &&
				(tone === 'selection' || tone === 'hover') &&
				wallOutline === 'stencil' &&
				meshes.length === 1 &&
				renderIdentityOf(meshes[0]!)?.kind === 'wall'
			) {
				addStencilSilhouette(meshes[0]!, tone);
				return;
			}
			const groups = wall ? [meshes] : meshes.map(mesh => [mesh]);
			for (const group of groups) {
				const positions: number[] = [];
				for (const mesh of group) {
					if (wall) {
						positions.push(...worldTriangles(mesh));
					} else {
						const edges = new EdgesGeometry(mesh.geometry, 30);
						edges.applyMatrix4(matrixOf(mesh));
						positions.push(...edges.getAttribute('position').array);
						edges.dispose();
					}
				}
				const contour = wall ? visibleIdentityContour(positions, eye) : mergeStraightEdgeRuns(positions);
				addContour(contour, tone);
			}

		} finally {
			source.dispose();
			drawingCutawayWall = false;
		}
	}

	function applyFade(amount: number): void {
		for (const entry of fades) entry.material.opacity = entry.opacity * amount;
	}

	function rebuild(): void {
		fades.length = 0;
		releaseAll();
		apply(selection, 'selection');
		for (const proposal of proposals) {
			if (selection !== null && sameSubject(proposal.reference, selection.reference)) continue;
			apply(proposal, 'paint');
		}
		// Hover is subordinate and never drawn for the selected subject itself. The
		// full canonical reference is the identity, not just its id.
		// The Eraser's winner is drawn even when it is the selection: it says what the
		// next click removes, which gold alone cannot.
		if (hover !== null && hoverTone === 'erase') apply(hover, 'erase');
		else if (hover !== null && hoverTone === 'paint') apply(hover, 'paint');
		else if (hover !== null && (selection === null || !sameReference(hover.reference, selection.reference))) {
			apply(hover, 'hover');
		}
		applyFade(untrack(() => fade));
		// These objects are added and removed imperatively, so Threlte cannot infer
		// that a selection or hover change needs a frame. Ask for exactly one.
		invalidate();
	}

	/** The effective cut set as a membership test; rebuilt with the effect run. */
	let cutawayWallSet: ReadonlySet<string> = new Set();

	$effect(() => {
		selection;
		hover;
		hoverTone;
		proposals;
		geometry;
		width;
		height;
		eye;
		unclippedSelection;
		cutawayWallSet = new Set(cutawayWallIds);
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
