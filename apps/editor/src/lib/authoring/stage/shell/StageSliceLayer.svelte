<script lang="ts">
	/**
	 * The Stage's **Slice ink**: the yellow plane, the depth outline, and the caps.
	 *
	 * Everything here is editor ink on the overlay layer: never a pick root, never
	 * lit, never in a snapshot (the snapshot camera masks to the world layers). The
	 * cut itself is the store's clipping planes; this layer draws what the cut
	 * reveals — the section of the meshes actually drawn — so a door reads as a gap
	 * and a Wall reads as a filled section rather than a hollow shell.
	 *
	 * **The section is kept off the Sheet-drag frame.** A drag draws the plane (exact
	 * by construction — the cut is the GPU's planes) and the ghost, and assembles the
	 * section once the drag rests; the elapsed time is logged in development against
	 * §6's 4 ms budget. Measured on an eleven-Room fixture one assembly is ~30 ms, so
	 * assembling per frame would drop frames for the whole drag.
	 *
	 * The scheduling rule is `decideCapAssembly`, tested on its own. The two details
	 * that make it true in Svelte: the effect returns **no cleanup**, so a re-run
	 * cannot cancel the pending rAF or settle timer, and `assembled` is recorded only
	 * inside `rebuild()` — the state it names is the state on screen, not the state
	 * requested.
	 */
	import { T, useThrelte } from '@threlte/core';
	import {
		BufferGeometry,
		DoubleSide,
		Float32BufferAttribute,
		Group,
		LineBasicMaterial,
		LineSegments,
		Mesh,
		PlaneGeometry,
		Shape,
		ShapeGeometry,
		Vector2,
		Vector3,
		MeshBasicMaterial,
		type Material,
		type Object3D
	} from 'three';
	import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
	import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
	import { STAGE_OVERLAY_LAYER } from '../paper-plan';
	import {
		sectionMeshes,
		type CapAssemblyIssue,
		type SectionInput,
		type SectionLoop
	} from '../slice/mesh-plane-section';
	import { capFillsOf } from '../slice/slice-cap-shapes';
	import { SLICE_INK } from '../slice/slice-ink';
	import { decideCapAssembly, type CapAssemblyState } from '../slice/slice-cap-schedule';
	import { appendSectionEdges, type SectionEdgeSegment } from '../slice/slice-edges';
	import { reportCapIssues } from '../slice/slice-diagnostics';
	import type { ResolvedSlice } from '../slice/slice-cut';
	import { drawnMeshesOf } from './stage-selection-source';

	let {
		resolved = null,
		inputs = [],
		bounds = null,
		revision = 0,
		ghostSelection = null,
		selectedIdentity = null,
		width = 0,
		height = 0,
		onIssues
	}: {
		resolved: ResolvedSlice | null;
		/** The drawn Layout meshes, in world space, as the hit path sees them. */
		inputs: readonly SectionInput[];
		/** Layout ∪ Scene bounds; the plane and the depth outline span them. */
		bounds: {
			readonly min: readonly [number, number, number];
			readonly max: readonly [number, number, number];
		} | null;
		/** Bumped when the drawn geometry changes; the caps follow an edit. */
		revision?: string | number;
		/**
		 * The selected subject's rendered objects **when the Slice hides all of it**.
		 * A wholly hidden subject is drawn here as a ghost instead of vanishing: the
		 * Index can select it, and the creator must still see what they selected (§2.4,
		 * J12 step 3). Empty or null means nothing is ghosted.
		 */
		ghostSelection?: readonly Object3D[] | null;
		/** The selected Layout identity (`wall:w-1`), for its gold section edge. */
		selectedIdentity?: string | null;
		/** The viewport in CSS pixels: fat lines need it to size 2/3 px edges. */
		width?: number;
		height?: number;
		/** Extra observer for the assembly's issues; the dev report runs regardless. */
		onIssues?: (issues: readonly CapAssemblyIssue[]) => void;
	} = $props();

	const SLICE_PLANE_INK = SLICE_INK.plane;
	const SLICE_CAP_INK = SLICE_INK.cap;
	const SLICE_WARNING_INK = SLICE_INK.warning;
	/** The hover tone, at ghost opacity: a hidden subject is a silhouette, not a cap. */
	const SLICE_GHOST_INK = SLICE_INK.ghost;

	const { invalidate } = useThrelte();
	const root = new Group();
	root.name = 'StageSliceInk';
	/** The ghost lives apart from the section, so a reading move never removes it. */
	const ghostRoot = new Group();
	ghostRoot.name = 'StageSliceGhost';
	root.add(ghostRoot);

	type Inked = { readonly object: Object3D; readonly parent: Group; dispose(): void };
	/** The section's edges live apart: a selection change re-inks them without a section. */
	const edgeRoot = new Group();
	root.add(edgeRoot);
	let edgeInk: Inked[] = [];
	/** One independent segment per entry, so a style change never concatenates loops. */
	let edges: SectionEdgeSegment[] = [];
	let openEdges: number[] = [];
	/** The identity the current edge ink was drawn for. */
	let drawnIdentity: string | null = null;
	let inked: Inked[] = [];
	let ghosts: Inked[] = [];
	/** Materials shared by a group's cap meshes; disposed with the rest. */
	let shared: Material[] = [];
	/** The ghost's own material, owned by the ghost group rather than by a rebuild. */
	let ghostMaterials: Material[] = [];

	function drop(entries: Inked[]): void {
		for (const entry of entries) {
			entry.parent.remove(entry.object);
			entry.dispose();
		}
	}
	function clearEdges(): void {
		drop(edgeInk);
		edgeInk = [];
		edges = [];
		openEdges = [];
		drawnIdentity = null;
	}
	function releaseAll(): void {
		drop(inked);
		for (const material of shared) material.dispose();
		inked = [];
		shared = [];
		clearEdges();
	}
	function clearGhosts(): void {
		drop(ghosts);
		for (const material of ghostMaterials) material.dispose();
		ghosts = [];
		ghostMaterials = [];
	}

	function keep(object: Object3D, dispose: () => void, parent: Group = root): void {
		object.layers.set(STAGE_OVERLAY_LAYER);
		object.raycast = () => {};
		object.frustumCulled = false;
		parent.add(object);
		inked.push({ object, parent, dispose });
	}

	/** The plane's own quad, one per reading: the yellow sheet the creator reads. */
	function addPlane(y: number, tolerance: number): void {
		if (bounds === null) return;
		const planeWidth = Math.max(0.1, bounds.max[0] - bounds.min[0]);
		const depth = Math.max(0.1, bounds.max[2] - bounds.min[2]);
		const geometry = new PlaneGeometry(planeWidth + tolerance * 2, depth + tolerance * 2);
		const material = new MeshBasicMaterial({
			color: SLICE_PLANE_INK,
			transparent: true,
			opacity: SLICE_INK.planeOpacity,
			side: DoubleSide,
			depthWrite: false,
			toneMapped: false
		});
		const mesh = new Mesh(geometry, material);
		mesh.rotation.x = -Math.PI / 2;
		mesh.position.set(
			(bounds.min[0] + bounds.max[0]) / 2,
			y,
			(bounds.min[2] + bounds.max[2]) / 2
		);
		mesh.renderOrder = 1;
		keep(mesh, () => {
			geometry.dispose();
			material.dispose();
		});
	}

	/** A flat rectangle outline, for the finite depth's bound. */
	function addDepthOutline(y: number): void {
		if (bounds === null) return;
		const minX = bounds.min[0];
		const maxX = bounds.max[0];
		const minZ = bounds.min[2];
		const maxZ = bounds.max[2];
		const corners: Array<readonly [number, number]> = [
			[minX, minZ],
			[maxX, minZ],
			[maxX, maxZ],
			[minX, maxZ]
		];
		const positions: number[] = [];
		for (let index = 0; index < corners.length; index += 1) {
			const from = corners[index]!;
			const to = corners[(index + 1) % corners.length]!;
			positions.push(from[0], y, from[1], to[0], y, to[1]);
		}
		const geometry = new BufferGeometry();
		geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
		const material = new LineBasicMaterial({
			color: SLICE_PLANE_INK,
			transparent: true,
			opacity: 0.55,
			depthWrite: false,
			toneMapped: false
		});
		const lines = new LineSegments(geometry, material);
		lines.renderOrder = 2;
		keep(lines, () => {
			geometry.dispose();
			material.dispose();
		});
	}

	/** A closed path in the plane's own basis, for a hole. */
	function pathOfLoop(points: SectionLoop['points']): Shape {
		const path = new Shape();
		points.forEach(([u, v], index) => {
			if (index === 0) path.moveTo(u, v);
			else path.lineTo(u, v);
		});
		path.closePath();
		return path;
	}

	/**
	 * One filled cap per polygon, each with **its own** holes.
	 *
	 * The containment mapping is `loopsToPolygons`' job (`capFillsOf`): a hole belongs
	 * to the smallest outer that contains it. Adding every hole to every outer — which
	 * this used to do — gave two disjoint solids each other's holes, so a filled cap
	 * grew a void outside its own face and disagreed with the section's edges.
	 */
	function addCap(
		loops: readonly SectionLoop[],
		basis: { readonly u: readonly [number, number, number]; readonly v: readonly [number, number, number]; readonly normal: readonly [number, number, number] },
		y: number,
		originXZ: readonly [number, number]
	): void {
		const fills = capFillsOf(loops);
		if (fills.length === 0) return;
		const shapes: Shape[] = [];
		for (const fill of fills) {
			const shape = pathOfLoop(fill.outer as SectionLoop['points']);
			for (const hole of fill.holes) shape.holes.push(pathOfLoop(hole as SectionLoop['points']));
			shapes.push(shape);
		}
		const material = new MeshBasicMaterial({
			color: SLICE_CAP_INK,
			side: DoubleSide,
			depthWrite: false,
			toneMapped: false,
			polygonOffset: true,
			polygonOffsetFactor: -1,
			polygonOffsetUnits: -1
		});
		shared.push(material);
		for (const shape of shapes) {
			const geometry = new ShapeGeometry(shape);
			const mesh = new Mesh(geometry, material);
			mesh.matrixAutoUpdate = false;
			mesh.matrix
				.makeBasis(
					new Vector3(...basis.u),
					new Vector3(...basis.v),
					new Vector3(...basis.normal)
				)
				.setPosition(originXZ[0], y, originXZ[1]);
			mesh.renderOrder = 3;
			keep(mesh, () => geometry.dispose());
		}
	}

	/**
	 * Collect the section's edges as **independent segments**, each with its identity.
	 *
	 * They are deliberately not one polyline: `LineGeometry` (drawn by `Line2`) treats
	 * its input as connected, so two disconnected loops — two Walls across a gap — gain
	 * a diagonal between them. `LineSegmentsGeometry` takes independent pairs, which is
	 * what a section's outline is.
	 */
	function collectEdges(
		loops: readonly SectionLoop[],
		chains: readonly { readonly points: readonly (readonly [number, number])[] }[],
		basis: { readonly u: readonly [number, number, number]; readonly v: readonly [number, number, number] },
		y: number,
		originXZ: readonly [number, number]
	): void {
		// Append, never replace: the section has one group per independent solid (the
		// Wall structure union plus one per Layout object), and each one's outline —
		// and an open group's warning edges — must survive the next group.
		appendSectionEdges({ segments: edges, open: openEdges }, loops, chains, basis, y, originXZ);
	}

	/**
	 * Draw the cached segments: 2 px yellow, a selected identity's 3 px gold over them,
	 * an open chain in warning ink. Cost is the segments, not the section — a selection
	 * change re-inks the existing `edges` and never re-runs `sectionMeshes`.
	 */
	function drawEdges(): void {
		drop(edgeInk);
		edgeInk = [];
		drawnIdentity = selectedIdentity ?? null;
		const plain: number[] = [];
		const selected: number[] = [];
		for (const segment of edges) {
			(segment.identity === drawnIdentity ? selected : plain).push(...segment.positions);
		}
		const build = (positions: readonly number[], color: number, widthPx: number): void => {
			if (positions.length === 0) return;
			const geometry = new LineSegmentsGeometry();
			geometry.setPositions(positions as number[]);
			const material = new LineMaterial({
				color,
				linewidth: widthPx,
				depthWrite: false,
				toneMapped: false,
				resolution: new Vector2(Math.max(1, width), Math.max(1, height))
			});
			const line = new LineSegments2(geometry, material);
			line.renderOrder = 4;
			line.layers.set(STAGE_OVERLAY_LAYER);
			line.raycast = () => {};
			line.frustumCulled = false;
			edgeRoot.add(line);
			edgeInk.push({
				object: line,
				parent: edgeRoot,
				dispose: () => {
					geometry.dispose();
					material.dispose();
				}
			});
		};
		build(plain, SLICE_PLANE_INK, SLICE_INK.edgeWidth);
		build(selected, SLICE_INK.gold, SLICE_INK.selectedEdgeWidth);
		build(openEdges, SLICE_WARNING_INK, SLICE_INK.edgeWidth);
	}

	/**
	 * The ghost of a wholly hidden selected subject.
	 *
	 * The rendered geometry **by reference**, one flat material, no clipping: the
	 * whole point is that the planes would otherwise delete the selected thing from
	 * the frame entirely. Overlay layer, no raycast — the Index selects it, the
	 * pointer does not (§2.5 step 4).
	 */
	function addGhost(objects: readonly Object3D[]): void {
		const meshes = drawnMeshesOf(objects);
		if (meshes.length === 0) return;
		const material = new MeshBasicMaterial({
			color: SLICE_GHOST_INK,
			transparent: true,
			opacity: SLICE_INK.ghostOpacity,
			depthWrite: false,
			toneMapped: false
		});
		// Not `shared`: a section rebuild must never dispose the material the ghost is
		// still drawn with (the ghost outlives a drag by design).
		ghostMaterials.push(material);
		for (const source of meshes) {
			source.updateWorldMatrix(true, false);
			const mesh = new Mesh(source.geometry, material);
			mesh.matrixAutoUpdate = false;
			mesh.matrix.copy(source.matrixWorld);
			mesh.matrixWorldNeedsUpdate = true;
			mesh.renderOrder = 2;
			mesh.layers.set(STAGE_OVERLAY_LAYER);
			mesh.raycast = () => {};
			mesh.frustumCulled = false;
			ghostRoot.add(mesh);
			ghosts.push({ object: mesh, parent: ghostRoot, dispose: () => {} });
		}
	}

	/** What the ghost currently shows, so a no-op effect run redraws nothing. */
	let drawnGhostKey: string | null = null;
	function ghostKeyOf(): string | null {
		const selection = ghostSelection;
		if (selection === null || selection.length === 0) return null;
		// The revision is part of the key: an edit can move or re-shape the selected
		// object without changing its identity, and the ghost must follow it.
		return `${revision}:${selection.length}:${selection[0]?.id ?? ''}:${selection[0]?.uuid ?? ''}`;
	}
	function drawGhost(): void {
		clearGhosts();
		drawnGhostKey = ghostKeyOf();
		if (ghostSelection !== null && ghostSelection.length > 0) addGhost(ghostSelection);
	}

	/**
	 * How long the Sheet must be still before the section is assembled again.
	 *
	 * Measured, not guessed: on an eleven-Room fixture (44 Walls, 7,040 candidate
	 * triangles) one assembly costs ~30 ms here and the plan's budget is 4 ms, so
	 * assembling per animation frame would drop frames for the whole drag. The drag
	 * frame therefore draws only the plane — the cut itself is the GPU's planes and is
	 * already exact — and the caps return this long after the last change. `120 ms` is
	 * below the pause a person makes between two deliberate drags and above a
	 * double-click.
	 */
	const SETTLE_MILLISECONDS = 120;

	let pending = 0;
	/** The settle timer; `undefined` when the Sheet is at rest. */
	let settle: ReturnType<typeof setTimeout> | undefined;
	/** What is on screen; written only by `rebuild()`. */
	let assembled: CapAssemblyState | null = null;

	function cutKeyOf(reading: ResolvedSlice): string {
		return `${reading.cutY}:${reading.lowerY ?? 'floor'}`;
	}
	function geometryKeyOf(): string {
		return `${revision}:${inputs.length}`;
	}

	function rebuild(): void {
		releaseAll();
		const reading = resolved;
		if (reading === null) {
			assembled = null;
			invalidate();
			return;
		}
		const started = performance.now();
		const result = sectionMeshes(inputs, { normal: [0, -1, 0], constant: reading.cutY });
		addPlane(reading.cutY, 0.4);
		if (reading.lowerY !== null) addDepthOutline(reading.lowerY);
		const originXZ: readonly [number, number] = [result.basis.origin[0], result.basis.origin[2]];
		for (const group of result.groups) {
			addCap(group.loops, result.basis, reading.cutY, originXZ);
			collectEdges(group.loops, group.chains, result.basis, reading.cutY, originXZ);
		}
		drawEdges();
		if (ghostKeyOf() !== drawnGhostKey) drawGhost();
		// The state on screen, not the state requested: a cancelled timer used to leave
		// this naming a section that was never assembled.
		assembled = { geometryKey: geometryKeyOf(), cutKey: cutKeyOf(reading) };
		if (import.meta.env.DEV) {
			const elapsed = performance.now() - started;
			if (elapsed > 4) {
				console.debug(
					`slice: cap assembly took ${elapsed.toFixed(1)} ms over ${result.candidateTriangles} candidate triangles`
				);
			}
			// Reported here, not only through the optional callback: a Canvas that forgot
			// to pass one must not make an open group silent (§2.2).
			reportCapIssues(result.issues, revision);
		}
		onIssues?.(result.issues);
		// These objects are added and removed imperatively; ask for exactly one frame.
		invalidate();
	}

	function scheduleRebuild(): void {
		if (pending !== 0) return;
		pending = requestAnimationFrame(() => {
			pending = 0;
			rebuild();
		});
	}

	/**
	 * The reading moved and nothing else did: keep the plane exact, drop the section.
	 *
	 * The plane is one quad and the walls are clipped by the shared GPU planes, so the
	 * cut being *shown* costs nothing; what is expensive is the section. Drawing a
	 * stale section under a moved plane would be a lie, so the section is removed for
	 * the duration of the drag and assembled once when the Sheet rests. The ghost is
	 * **not** removed: it is cheap, and a selected hidden subject disappearing for the
	 * length of a drag is the failure §2.4 exists to prevent.
	 */
	function moveReadingOnly(reading: ResolvedSlice): void {
		releaseAll();
		addPlane(reading.cutY, 0.4);
		if (reading.lowerY !== null) addDepthOutline(reading.lowerY);
		if (ghostKeyOf() !== drawnGhostKey) drawGhost();
		invalidate();
	}

	function cancelTimers(): void {
		if (pending !== 0) {
			cancelAnimationFrame(pending);
			pending = 0;
		}
		if (settle !== undefined) {
			clearTimeout(settle);
			settle = undefined;
		}
	}

	$effect(() => {
		const reading = resolved;
		// Read the ghost so a classification flip redraws it; it is never part of the
		// section's key, because a ghost appearing mid-drag must not cost a rebuild.
		const ghostKey = ghostKeyOf();
		if (reading === null) {
			const hadInk = assembled !== null || inked.length > 0 || ghosts.length > 0;
			assembled = null;
			drawnGhostKey = null;
			cancelTimers();
			releaseAll();
			clearGhosts();
			if (hadInk) invalidate();
			return;
		}
		if (ghostKey !== drawnGhostKey) {
			drawGhost();
			invalidate();
		}
		// The gold follows the selection, and only the ink: no section is recomputed.
		const identity = selectedIdentity ?? null;
		if (identity !== drawnIdentity && edges.length > 0) {
			drawEdges();
			invalidate();
		}
		const next: CapAssemblyState = {
			geometryKey: geometryKeyOf(),
			cutKey: cutKeyOf(reading)
		};
		const decision = decideCapAssembly(assembled, next);
		if (decision === 'none' || decision === 'clear') return;
		if (decision === 'rebuild') {
			if (settle !== undefined) {
				clearTimeout(settle);
				settle = undefined;
			}
			scheduleRebuild();
			return;
		}
		// A moved reading: one frame per drag step, and no assembly on it. The plane is
		// exact on every frame anyway; the section waits for the Sheet to rest.
		moveReadingOnly(reading);
		if (settle !== undefined) clearTimeout(settle);
		settle = setTimeout(() => {
			settle = undefined;
			scheduleRebuild();
		}, SETTLE_MILLISECONDS);
		// No cleanup is returned on purpose: Svelte runs a cleanup before every re-run,
		// and cancelling the pending assembly there was how a drag ended with no caps.
	});

	$effect(() => () => {
		cancelTimers();
		assembled = null;
		drawnGhostKey = null;
		releaseAll();
		clearGhosts();
		invalidate();
	});
</script>

<T is={root} />
