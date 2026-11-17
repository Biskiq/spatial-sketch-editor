<script lang="ts">
	/**
	 * X2's cutaway ink and its one live uniform writer.
	 *
	 * It owns two things and nothing else:
	 *
	 * - **The live top.** `stageClip.setCutawayTop(stubTopY)` is the whole cut: the
	 *   twin materials are already leased, and Whole/held/Plan write `null` here, so
	 *   a toggle costs one uniform write and never a material swap or a compile.
	 * - **The caps.** The horizontal paper at the stub and the vertical seam faces
	 *   are assembled from the drawn Wall meshes through SL1's `sectionMeshes`
	 *   pipeline only when the effective cut set, the stub height or the geometry
	 *   revision changes. They are overlay ink: never lit, never a pick root, never
	 *   in a snapshot.
	 *
	 * A component that cannot balance is not drawn and is reported: the Walls it
	 * names leave the effective set through `onFailure` (D12), so nothing ever
	 * renders an open stub.
	 */
	import { onDestroy } from 'svelte';
	import { T, useThrelte } from '@threlte/core';
	import {
		BufferGeometry,
		DoubleSide,
		Float32BufferAttribute,
		Group,
		Mesh,
		MeshBasicMaterial,
		Shape,
		ShapeGeometry,
		Vector2,
		Vector3,
		type Material,
		type Object3D
	} from 'three';
	import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
	import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
	import { countWork, type CompiledJunction, type CompiledPhysicalWall } from '@portfolio/layout-core';
	import { STAGE_OVERLAY_LAYER } from '../paper-plan';
	import { SLICE_INK } from '../slice/slice-ink';
	import { STAGE_PAINT } from '../shell/stage-paint';
	import { useStageClip } from '../slice/stage-clip';
	import { capFillsOf } from '../slice/slice-cap-shapes';
	import { appendSectionEdgesWorld, type SectionEdgeSegment } from '../slice/slice-edges';
	import { reportCapIssues } from '../slice/slice-diagnostics';
	import type { CapAssemblyIssue, SectionInput, SectionLoop } from '../slice/mesh-plane-section';
	import { assembleCutawayCaps, seamEdgePositions } from './cutaway-caps';

	let {
		wallIds = [],
		stubTopY = null,
		junctions = [],
		walls = [],
		floors = [],
		inputs = [],
		revision = 0,
		sliceCutY = null,
		width = 1,
		height = 1,
		onFailure,
		onIssues
	}: {
		/** The effective cut set, already masked by Whole/hold/selection/Plan. */
		readonly wallIds?: readonly string[];
		/** The horizontal stub height, or null when nothing is cut. */
		readonly stubTopY?: number | null;
		readonly junctions?: readonly CompiledJunction[];
		readonly walls?: readonly CompiledPhysicalWall[];
		readonly floors?: readonly { readonly floorId: string; readonly elevation: number }[];
		/** The drawn Layout meshes, as the Slice caps read them. */
		readonly inputs?: readonly SectionInput[];
		/** Bumped by a Layout or renderer rebuild; caps follow an edit. */
		readonly revision?: string | number;
		/** A Level cut at or below the stub makes the cutaway cap invisible. */
		readonly sliceCutY?: number | null;
		/** Viewport CSS size; fat-line width is in CSS pixels at this resolution. */
		readonly width?: number;
		readonly height?: number;
		/** Walls whose cap component failed; the host closes them to whole (D12). */
		readonly onFailure?: (wallIds: readonly string[]) => void;
		/** Extra observer for the assembly's issues; the dev report runs regardless. */
		readonly onIssues?: (issues: readonly CapAssemblyIssue[]) => void;
	} = $props();

	const { invalidate } = useThrelte();
	const stageClip = useStageClip();
	const root = new Group();
	root.name = 'StageCutawayInk';

	type Inked = { readonly object: Object3D; dispose(): void };
	let inked: Inked[] = [];
	let ownMaterials: Material[] = [];
	let builtKey: string | null = null;

	function release(): void {
		for (const entry of inked) {
			root.remove(entry.object);
			entry.dispose();
		}
		inked = [];
		for (const material of ownMaterials) material.dispose();
		ownMaterials = [];
	}

	function keep(object: Object3D, dispose: () => void): void {
		object.layers.set(STAGE_OVERLAY_LAYER);
		object.raycast = () => {};
		object.frustumCulled = false;
		root.add(object);
		inked.push({ object, dispose });
	}

	function pathOfLoop(points: SectionLoop['points']): Shape {
		const path = new Shape();
		points.forEach(([u, v], index) => {
			if (index === 0) path.moveTo(u, v);
			else path.lineTo(u, v);
		});
		path.closePath();
		return path;
	}

	/** One filled paper cap per polygon, each with its own holes. */
	function addCaps(loops: readonly SectionLoop[], basis: { readonly u: readonly number[]; readonly v: readonly number[]; readonly normal: readonly number[]; readonly origin: readonly number[] }): void {
		const fills = capFillsOf(loops);
		if (fills.length === 0) return;
		const material = new MeshBasicMaterial({
			color: SLICE_INK.cap,
			side: DoubleSide,
			depthWrite: false,
			toneMapped: false,
			polygonOffset: true,
			polygonOffsetFactor: -1,
			polygonOffsetUnits: -1
		});
		stageClip?.clipInk(material);
		ownMaterials.push(material);
		for (const fill of fills) {
			const shape = pathOfLoop(fill.outer as SectionLoop['points']);
			for (const hole of fill.holes) shape.holes.push(pathOfLoop(hole as SectionLoop['points']));
			const geometry = new ShapeGeometry(shape);
			const mesh = new Mesh(geometry, material);
			mesh.matrixAutoUpdate = false;
			mesh.matrix
				.makeBasis(new Vector3(...(basis.u as [number, number, number])), new Vector3(...(basis.v as [number, number, number])), new Vector3(...(basis.normal as [number, number, number])))
				.setPosition(basis.origin[0]!, basis.origin[1]!, basis.origin[2]!);
			mesh.renderOrder = 3;
			keep(mesh, () => geometry.dispose());
		}
	}

	/** The seam faces as filled paper quads, starting exactly at the stub plane. */
	function addSeams(seams: readonly { readonly from: readonly [number, number]; readonly to: readonly [number, number]; readonly bottomY: number; readonly topY: number }[], top: number): void {
		if (seams.length === 0) return;
		const positions: number[] = [];
		for (const seam of seams) {
			const bottom = Math.max(seam.bottomY, top);
			if (!(seam.topY > bottom + 1e-9)) continue;
			const fromBottom: [number, number, number] = [seam.from[0], bottom, seam.from[1]];
			const toBottom: [number, number, number] = [seam.to[0], bottom, seam.to[1]];
			const toTop: [number, number, number] = [seam.to[0], seam.topY, seam.to[1]];
			const fromTop: [number, number, number] = [seam.from[0], seam.topY, seam.from[1]];
			positions.push(...fromBottom, ...toBottom, ...toTop, ...fromBottom, ...toTop, ...fromTop);
		}
		if (positions.length === 0) return;
		const geometry = new BufferGeometry();
		geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
		const material = new MeshBasicMaterial({
			color: SLICE_INK.cap,
			side: DoubleSide,
			depthWrite: false,
			toneMapped: false,
			polygonOffset: true,
			polygonOffsetFactor: -1,
			polygonOffsetUnits: -1
		});
		stageClip?.clipInk(material);
		ownMaterials.push(material);
		const mesh = new Mesh(geometry, material);
		mesh.renderOrder = 3;
		keep(mesh, () => geometry.dispose());
	}

	/** The cap outline and the seam free edges: ink, 2 px, never Slice yellow. */
	function addInk(segments: readonly SectionEdgeSegment[], seamPositions: readonly number[], width: number, height: number): void {
		const positions: number[] = [];
		for (const segment of segments) positions.push(...segment.positions);
		positions.push(...seamPositions);
		if (positions.length === 0) return;
		const geometry = new LineSegmentsGeometry();
		geometry.setPositions(positions);
		const material = new LineMaterial({
			color: STAGE_PAINT.ink,
			linewidth: SLICE_INK.edgeWidth,
			depthWrite: false,
			toneMapped: false,
			resolution: new Vector2(Math.max(1, width), Math.max(1, height))
		});
		stageClip?.clipInk(material);
		ownMaterials.push(material);
		const line = new LineSegments2(geometry, material);
		line.renderOrder = 4;
		line.layers.set(STAGE_OVERLAY_LAYER);
		line.raycast = () => {};
		line.frustumCulled = false;
		keep(line, () => geometry.dispose());
	}

	function signatureOf(
		ids: readonly string[],
		top: number | null,
		revisionKey: string | number,
		levelCutY: number | null
	): string {
		return `${[...ids].sort().join(',')}|${top ?? 'none'}|${revisionKey}|${levelCutY ?? 'none'}`;
	}

	function rebuild(): void {
		const top = stubTopY;
		const signature = signatureOf(wallIds, top, revision, sliceCutY);
		if (signature === builtKey) return;
		release();
		builtKey = signature;
		if (top === null || wallIds.length === 0) {
			stageClip?.setCutawayTop(null);
			invalidate();
			return;
		}
		// A Level Slice at or below the stub removes the cap entirely; the cut
		// itself is visually inert there, so no paper is drawn above the cut.
		const capsVisible = sliceCutY === null || sliceCutY > top + 1e-6;
		const started = performance.now();
		countWork('cutaway:cap-assembly');
		const assembly = assembleCutawayCaps({
			cut: new Set(wallIds),
			stubTopY: top,
			junctions,
			walls,
			floors,
			sources: inputs
		});
		if (assembly.failedWallIds.size > 0) {
			// Nothing may render an open stub: park the whole cut while the host
			// narrows the effective set. The next props rebuild re-applies the top.
			stageClip?.setCutawayTop(null);
			onFailure?.([...assembly.failedWallIds]);
		} else {
			stageClip?.setCutawayTop(top);
		}
		if (capsVisible && assembly.components.length > 0) {
			const edges: SectionEdgeSegment[] = [];
			for (const component of assembly.components) {
				addCaps(component.loops, component.basis);
				appendSectionEdgesWorld({ segments: edges, open: [] }, component.loops, [], component.basis);
				addSeams(component.seams, top);
			}
			addInk(edges, seamEdgePositions(assembly.components.flatMap((component) => component.seams), top), width, height);
		}
		if (import.meta.env.DEV) {
			const elapsed = performance.now() - started;
			if (elapsed > 4) {
				console.debug(
					`cutaway: cap assembly took ${elapsed.toFixed(1)} ms over ${assembly.candidateTriangles} candidate triangles`
				);
			}
			reportCapIssues(assembly.issues, `cutaway:${revision}`);
		}
		onIssues?.(assembly.issues);
		invalidate();
	}

	$effect(() => {
		// Read every input the assembly consumes so a change re-runs it.
		wallIds;
		stubTopY;
		revision;
		sliceCutY;
		inputs;
		rebuild();
	});

	onDestroy(() => {
		stageClip?.setCutawayTop(null);
		release();
		builtKey = null;
	});
</script>

<T is={root} />
