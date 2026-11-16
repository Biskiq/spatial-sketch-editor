<script lang="ts">
	/**
	 * The Stage's **Lift ink**: a dashed outline where each lifted overhead sits,
	 * and a translucent ghost for the selected one.
	 *
	 * The overhead itself is gone from the view and from rays, so the outline is
	 * what the creator aims at and what says where the lid was. It is editor ink on
	 * the Stage overlay layer: never a pick root, never lit, never on a snapshot.
	 *
	 * **Neutral tone only.** Gold is selection and the selection layer already draws
	 * the Room's own gold contour; the lift outline is a *place*, not an identity, so
	 * it uses the neutral hover tone. The ghost is the same tone at low opacity: it
	 * says "this is the overhead you have selected, still editable through its Room"
	 * without claiming a second selection model.
	 *
	 * It draws nothing in Plan, where the outline coincides with the Room boundary
	 * Paper already draws.
	 */
	import { T, useThrelte } from '@threlte/core';
	import {
		DoubleSide,
		Group,
		Mesh,
		MeshBasicMaterial,
		Shape,
		ShapeGeometry,
		Vector2,
		type Object3D
	} from 'three';
	import { Line2 } from 'three/examples/jsm/lines/Line2.js';
	import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
	import type { OverheadSource } from '@portfolio/layout-core';
	import { LIFT_OUTLINE_DROP_METERS } from '../lift-ink';
	import { STAGE_OVERLAY_LAYER } from '../paper-plan';
	import { OUTLINE_DEPTH_BIAS } from './stage-outline';
	import { STAGE_PAINT } from './stage-paint';

	let {
		sources = [],
		selectedRoomId = null,
		hoveredRoomId = null,
		width = 1,
		height = 1,
		reading = '3d'
	}: {
		sources: readonly OverheadSource[];
		/** The selected Room's id, when the selection is a Room; a lift is selected through it. */
		selectedRoomId?: string | null;
		/** The hovered Room's id, on the same terms. */
		hoveredRoomId?: string | null;
		/** Viewport CSS size; a fat line's width is in CSS pixels at this resolution. */
		width?: number;
		height?: number;
		/**
		 * The reading being drawn. Plan draws its own boundary, so Lift ink is hidden
		 * there; a flip keeps the ink until Plan is the rendered reading.
		 */
		reading?: '3d' | 'plan' | 'transition';
	} = $props();

	const { invalidate } = useThrelte();
	const root = new Group();
	root.name = 'StageLiftInk';

	type Inked = { readonly object: Object3D; dispose(): void };
	let inked: Inked[] = [];

	function releaseAll(): void {
		for (const entry of inked) {
			root.remove(entry.object);
			entry.dispose();
		}
		inked = [];
	}

	/** The ring in the lid's own shape space, so the ghost lands exactly where the lid was. */
	function shapeOf(outline: OverheadSource['outline']): Shape {
		const shape = new Shape();
		const first = outline[0];
		if (first === undefined) return shape;
		shape.moveTo(first[0], first[1]);
		for (const [x, z] of outline.slice(1)) shape.lineTo(x, z);
		shape.closePath();
		return shape;
	}

	function addOutline(source: OverheadSource): void {
		const loop = [...source.outline, source.outline[0]!];
		const geometry = new LineGeometry();
		geometry.setPositions(
			loop.flatMap(([x, z]) => [x, source.elevation - LIFT_OUTLINE_DROP_METERS, z])
		);
		const hovered = hoveredRoomId !== null && hoveredRoomId === source.subject.id;
		const material = new LineMaterial({
			color: STAGE_PAINT.hover,
			linewidth: hovered ? 3 : 2,
			dashed: true,
			dashSize: 0.12,
			gapSize: 0.08,
			transparent: true,
			opacity: hovered ? 1 : 0.9,
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

	function addGhost(source: OverheadSource): void {
		const geometry = new ShapeGeometry(shapeOf(source.outline));
		const material = new MeshBasicMaterial({
			color: STAGE_PAINT.hover,
			transparent: true,
			opacity: 0.18,
			side: DoubleSide,
			depthWrite: false,
			depthTest: true,
			toneMapped: false
		});
		const ghost = new Mesh(geometry, material);
		ghost.name = `StageLiftGhost:${source.subject.id}`;
		// The lid's own placement: the same rotation and elevation the representation
		// uses, so the ghost is a true ghost of that overhead and not a second surface.
		ghost.position.set(0, source.elevation, 0);
		ghost.rotation.set(Math.PI / 2, 0, 0);
		ghost.renderOrder = 18;
		ghost.layers.set(STAGE_OVERLAY_LAYER);
		ghost.raycast = () => {};
		ghost.frustumCulled = false;
		root.add(ghost);
		inked.push({
			object: ghost,
			dispose: () => {
				geometry.dispose();
				material.dispose();
			}
		});
	}

	function rebuild(): void {
		releaseAll();
		if (reading !== 'plan') {
			for (const source of sources) {
				addOutline(source);
				if (selectedRoomId !== null && selectedRoomId === source.subject.id) addGhost(source);
			}
		}
		// These objects are added and removed imperatively, so Threlte cannot infer
		// that a lift or a selection change needs a frame. Ask for exactly one.
		invalidate();
	}

	$effect(() => {
		sources;
		selectedRoomId;
		hoveredRoomId;
		width;
		height;
		reading;
		rebuild();
		return () => {
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
