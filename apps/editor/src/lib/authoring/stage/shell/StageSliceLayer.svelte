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
	 * The assembly is coalesced to one per animation frame during a Sheet drag, and
	 * timed in development against §6's 4 ms / 50 k-triangle budget: over budget is a
	 * log, never a dropped step.
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
		Vector3,
		MeshBasicMaterial,
		type Material,
		type Object3D
	} from 'three';
	import { STAGE_OVERLAY_LAYER } from '../paper-plan';
	import {
		sectionMeshes,
		type CapAssemblyIssue,
		type SectionInput,
		type SectionLoop
	} from '../slice/mesh-plane-section';
	import type { ResolvedSlice } from '../slice/slice-cut';

	let {
		resolved = null,
		inputs = [],
		bounds = null,
		revision = 0,
		onIssues
	}: {
		resolved: ResolvedSlice | null;
		/** The drawn meshes, in world space, as the hit path sees them. */
		inputs: readonly SectionInput[];
		/** Layout ∪ Scene bounds; the plane and the depth outline span them. */
		bounds: {
			readonly min: readonly [number, number, number];
			readonly max: readonly [number, number, number];
		} | null;
		/** Bumped when the drawn geometry changes; the caps follow an edit. */
		revision?: string | number;
		onIssues?: (issues: readonly CapAssemblyIssue[]) => void;
	} = $props();

	const SLICE_PLANE_INK = 0xe8c14a;
	const SLICE_CAP_INK = 0xf0e7d2;
	const SLICE_WARNING_INK = 0xc2643f;

	const { invalidate } = useThrelte();
	const root = new Group();
	root.name = 'StageSliceInk';

	type Inked = { readonly object: Object3D; dispose(): void };
	let inked: Inked[] = [];
	/** Materials shared by a group's cap meshes; disposed with the rest. */
	let shared: Material[] = [];

	function releaseAll(): void {
		for (const entry of inked) {
			root.remove(entry.object);
			entry.dispose();
		}
		for (const material of shared) material.dispose();
		inked = [];
		shared = [];
	}

	function keep(object: Object3D, dispose: () => void): void {
		object.layers.set(STAGE_OVERLAY_LAYER);
		object.raycast = () => {};
		object.frustumCulled = false;
		root.add(object);
		inked.push({ object, dispose });
	}

	/** The plane's own quad, one per reading: the yellow sheet the creator reads. */
	function addPlane(y: number, tolerance: number): void {
		if (bounds === null) return;
		const width = Math.max(0.1, bounds.max[0] - bounds.min[0]);
		const depth = Math.max(0.1, bounds.max[2] - bounds.min[2]);
		const geometry = new PlaneGeometry(width + tolerance * 2, depth + tolerance * 2);
		const material = new MeshBasicMaterial({
			color: SLICE_PLANE_INK,
			transparent: true,
			opacity: 0.1,
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

	function shapeOfLoop(loop: SectionLoop): Shape {
		const shape = new Shape();
		loop.points.forEach(([u, v], index) => {
			if (index === 0) shape.moveTo(u, v);
			else shape.lineTo(u, v);
		});
		shape.closePath();
		return shape;
	}

	/** One filled cap per group, with its holes, in the plane's own basis. */
	function addCap(
		loops: readonly SectionLoop[],
		basis: { readonly u: readonly [number, number, number]; readonly v: readonly [number, number, number]; readonly normal: readonly [number, number, number] },
		y: number,
		originXZ: readonly [number, number]
	): void {
		const outer = loops.filter((loop) => loop.role === 'outer');
		if (outer.length === 0) return;
		const shapes: Shape[] = [];
		for (const loop of outer) {
			const shape = shapeOfLoop(loop);
			for (const hole of loops.filter((candidate) => candidate.role === 'hole')) {
				const path = new Shape();
				hole.points.forEach(([u, v], index) => {
					if (index === 0) path.moveTo(u, v);
					else path.lineTo(u, v);
				});
				path.closePath();
				shape.holes.push(path);
			}
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

	/** The section's own edge: yellow for a closed loop, warning ink for an open one. */
	function addSectionLines(
		loops: readonly SectionLoop[],
		chains: readonly { readonly points: readonly (readonly [number, number])[] }[],
		basis: { readonly u: readonly [number, number, number]; readonly v: readonly [number, number, number] },
		y: number,
		originXZ: readonly [number, number]
	): void {
		const world = ([u, v]: readonly [number, number]): [number, number, number] => [
			originXZ[0] + u * basis.u[0] + v * basis.v[0],
			y,
			originXZ[1] + u * basis.u[2] + v * basis.v[2]
		];
		const closed: number[] = [];
		for (const loop of loops) {
			loop.points.forEach((point, index) => {
				const next = loop.points[(index + 1) % loop.points.length]!;
				closed.push(...world(point), ...world(next));
			});
		}
		const open: number[] = [];
		for (const chain of chains) {
			for (let index = 0; index + 1 < chain.points.length; index += 1) {
				open.push(...world(chain.points[index]!), ...world(chain.points[index + 1]!));
			}
		}
		const build = (positions: number[], color: number): void => {
			if (positions.length === 0) return;
			const geometry = new BufferGeometry();
			geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
			const material = new LineBasicMaterial({ color, depthWrite: false, toneMapped: false });
			const lines = new LineSegments(geometry, material);
			lines.renderOrder = 4;
			keep(lines, () => {
				geometry.dispose();
				material.dispose();
			});
		};
		build(closed, SLICE_PLANE_INK);
		build(open, SLICE_WARNING_INK);
	}

	let pending = 0;
	let lastKey = '';

	function rebuild(): void {
		releaseAll();
		const reading = resolved;
		if (reading === null) {
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
			addSectionLines(group.loops, group.chains, result.basis, reading.cutY, originXZ);
		}
		if (import.meta.env.DEV) {
			const elapsed = performance.now() - started;
			if (elapsed > 4) {
				console.debug(
					`slice: cap assembly took ${elapsed.toFixed(1)} ms over ${result.candidateTriangles} candidate triangles`
				);
			}
		}
		onIssues?.(result.issues);
		// These objects are added and removed imperatively; ask for exactly one frame.
		invalidate();
	}

	$effect(() => {
		// One assembly per animation frame, however many times a Sheet drag bumps these.
		const key = `${resolved === null ? 'none' : `${resolved.cutY}:${resolved.lowerY ?? 'floor'}`}:${revision}:${inputs.length}`;
		if (key !== lastKey) {
			lastKey = key;
			if (pending !== 0) return;
			pending = requestAnimationFrame(() => {
				pending = 0;
				rebuild();
			});
		}
		return () => {
			if (pending !== 0) {
				cancelAnimationFrame(pending);
				pending = 0;
			}
		};
	});

	$effect(() => () => {
		if (pending !== 0) cancelAnimationFrame(pending);
		pending = 0;
		releaseAll();
		invalidate();
	});
</script>

<T is={root} />
