<script lang="ts">
	/**
	 * The Stage's **open-side ink**: one dashed line where a Wall side became a
	 * virtual boundary, so an open Space reads as open in Plan.
	 *
	 * Plan draws every open Space. Three dimensions draw only the selected Space:
	 * an unselected open side would read as another boundary in the model, and the
	 * virtual edge is not a selectable subject. The line is editor ink on the
	 * overlay layer, never a pick root and never part of a snapshot.
	 */
	import { T, useThrelte } from '@threlte/core';
	import { Group, Vector2, type Object3D } from 'three';
	import { Line2 } from 'three/examples/jsm/lines/Line2.js';
	import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
	import type { CompiledSpaceEdge } from '@portfolio/layout-core';
	import { STAGE_OVERLAY_LAYER } from '../paper-plan';
	import { OUTLINE_DEPTH_BIAS } from './stage-outline';
	import { STAGE_PAINT } from './stage-paint';

	type OpenSideInkSource = {
		readonly roomId: string;
		readonly elevation: number;
		readonly edges: readonly CompiledSpaceEdge[];
	};

	let {
		sources = [],
		selectedRoomId = null,
		width = 1,
		height = 1,
		reading = '3d'
	}: {
		sources?: readonly OpenSideInkSource[];
		selectedRoomId?: string | null;
		/** Viewport CSS size; a fat line's width is in CSS pixels at this resolution. */
		width?: number;
		height?: number;
		reading?: '3d' | 'plan' | 'transition';
	} = $props();

	const { invalidate } = useThrelte();
	const root = new Group();
	root.name = 'StageOpenSideInk';

	type Inked = { readonly object: Object3D; dispose(): void };
	let inked: Inked[] = [];

	function releaseAll(): void {
		for (const entry of inked) {
			root.remove(entry.object);
			entry.dispose();
		}
		inked = [];
	}

	function addEdge(source: OpenSideInkSource, edge: CompiledSpaceEdge): void {
		const geometry = new LineGeometry();
		// A hair above the floor so the line is not coincident with the face it
		// describes; the offset is ink, not a change to the compiled geometry.
		const y = source.elevation + 0.012;
		geometry.setPositions([edge.start[0], y, edge.start[1], edge.end[0], y, edge.end[1]]);
		const material = new LineMaterial({
			color: STAGE_PAINT.hover,
			linewidth: reading === 'plan' ? 1.6 : 2,
			dashed: true,
			dashSize: 0.16,
			gapSize: 0.12,
			transparent: true,
			opacity: 0.9,
			toneMapped: false,
			depthTest: true,
			depthWrite: false,
			...OUTLINE_DEPTH_BIAS,
			resolution: new Vector2(width, height)
		});
		const line = new Line2(geometry, material);
		line.computeLineDistances();
		line.renderOrder = 19;
		line.layers.set(STAGE_OVERLAY_LAYER);
		line.raycast = () => {};
		line.frustumCulled = false;
		root.add(line);
		inked.push({
			object: line,
			dispose: () => {
				geometry.dispose();
				material.dispose();
			}
		});
	}

	function rebuild(): void {
		releaseAll();
		const shown =
			reading === 'plan'
				? sources
				: sources.filter((source) => selectedRoomId !== null && source.roomId === selectedRoomId);
		for (const source of shown) {
			for (const edge of source.edges) addEdge(source, edge);
		}
		// These objects are added and removed imperatively, so Threlte cannot infer
		// that a Space change needs a frame. Ask for exactly one.
		invalidate();
	}

	$effect(() => {
		sources;
		selectedRoomId;
		width;
		height;
		reading;
		rebuild();
		return () => {
			releaseAll();
			invalidate();
		};
	});
</script>

<T is={root} />
