<script lang="ts">
	/**
	 * C3 checkpoint 5 — the developed Wall sheet on the Stage.
	 *
	 * The sheet is the working representation while a Wall is unfolded. The
	 * canonical Wall is still the only geometry authority; it is hidden by its
	 * own representation and re-drawn here as a subdued dashed as-built line.
	 * The sheet is unlit vellum so triangle shading cannot imply a wrong surface,
	 * and its contour comes from the displayed topology, never a second model.
	 */
	import { T, useThrelte } from '@threlte/core';
	import {
		BufferAttribute,
		BufferGeometry,
		DoubleSide,
		Group,
		LineBasicMaterial,
		LineDashedMaterial,
		LineSegments,
		Mesh,
		MeshBasicMaterial
	} from 'three';
	import {
		developmentPointAtStationFromBuffers,
		type CompiledLayoutGeometry,
		type WallDevelopmentMesh
	} from '@portfolio/layout-core';

	import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
	import {
		buildWallUnfoldDisplay,
		evaluateWallUnfoldDisplay,
		type WallUnfoldDisplay
	} from '$lib/layout/wall-unfold-pick';

	let {
		geometry,
		datumMeters,
		selected = false
	}: { geometry: CompiledLayoutGeometry; datumMeters: number; selected?: boolean } = $props();

	const { invalidate } = useThrelte();
	const root = new Group();
	root.name = 'StageWallDevelopment';
	root.renderOrder = 2;
	root.visible = false;

	const sheetGeometry = new BufferGeometry();
	const sheetMaterial = new MeshBasicMaterial({
		color: 0xe9dfca,
		side: DoubleSide,
		toneMapped: false,
		polygonOffset: true,
		polygonOffsetFactor: -1,
		polygonOffsetUnits: -1
	});
	const sheet = new Mesh(sheetGeometry, sheetMaterial);
	sheet.name = 'StageWallDevelopmentSheet';
	root.add(sheet);

	const gridGeometry = new BufferGeometry();
	const gridMaterial = new LineBasicMaterial({
		color: 0xb6a783,
		toneMapped: false,
		// A quiet elevation grid on the developed face, in the same wall-grid
		// language as the canonical body. It never implies surface shading.
		transparent: true,
		opacity: 0.28,
		depthTest: false,
		depthWrite: false
	});
	const grid = new LineSegments(gridGeometry, gridMaterial);
	grid.name = 'StageWallDevelopmentGrid';
	grid.frustumCulled = false;
	grid.renderOrder = 1;
	root.add(grid);

	const contourGeometry = new BufferGeometry();
	const contourMaterial = new LineBasicMaterial({
		color: 0x4d4a43,
		toneMapped: false,
		// The sheet is the working surface and stands alone; its contour must stay
		// legible even when a line lies exactly on the same depth as the fill.
		depthTest: false,
		depthWrite: false,
		transparent: true,
		opacity: 0.95,
	});
	const contour = new LineSegments(contourGeometry, contourMaterial);
	contour.name = 'StageWallDevelopmentContour';
	contour.frustumCulled = false;
	contour.renderOrder = 2;
	root.add(contour);

	const referenceGeometry = new BufferGeometry();
	const referenceMaterial = new LineDashedMaterial({
		color: 0x777b72,
		toneMapped: false,
		dashSize: 0.18,
		gapSize: 0.13,
		transparent: true,
		opacity: 0.65,
		depthWrite: false
	});
	const reference = new LineSegments(referenceGeometry, referenceMaterial);
	reference.name = 'StageWallDevelopmentAsBuilt';
	reference.frustumCulled = false;
	root.add(reference);

	let display: WallUnfoldDisplay | null = null;
	let displayWallId: string | null = null;
	let displayCutStation: number | null = null;
	let topologyEdges: readonly (readonly [number, number])[] = [];
	let wallHeight = 0;
	let wallThickness = 0;
	let openingCount = 0;

	function boundaryEdges(mesh: WallDevelopmentMesh): [number, number][] {
		const edges = new Map<string, { a: number; b: number; count: number; faces: Set<string> }>();
		const keyOf = (index: number): string => {
			const vertex = mesh.vertices[index]!;
			const round = (value: number): number => Math.round(value * 1e6) / 1e6;
			return `${round(vertex.sheet)},${round(vertex.lateral)},${round(vertex.height)}`;
		};
		const add = (a: number, b: number, face: string): void => {
			// Adjacent developed cells own duplicate vertices at their shared seam.
			// Keying by position, not vertex index, lets that seam cancel as interior
			// ink instead of reappearing as a tick at every sample.
			const aKey = keyOf(a);
			const bKey = keyOf(b);
			const key = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
			const entry = edges.get(key);
			if (entry === undefined) edges.set(key, { a, b, count: 1, faces: new Set([face]) });
			else {
				entry.count += 1;
				entry.faces.add(face);
			}
		};
		for (const triangle of mesh.triangles) {
			const [a, b, c] = triangle.indices;
			add(a, b, triangle.face);
			add(b, c, triangle.face);
			add(c, a, triangle.face);
		}
		return [...edges.values()]
			.filter((edge) => edge.count === 1 || edge.faces.size > 1)
			.map((edge) => [edge.a, edge.b]);
	}

	function buildReference(wallId: string): void {
		const wall = geometry.walls.find((candidate) => candidate.wallId === wallId);
		if (wall === undefined) return;
		const positions: number[] = [];
		const closed = wall.samples.length > 2 &&
			Math.hypot(
				wall.samples[0]!.point[0] - wall.samples.at(-1)!.point[0],
				wall.samples[0]!.point[1] - wall.samples.at(-1)!.point[1]
			) < 1e-4;
		const sampleCount = wall.samples.length;
		const edgeCount = closed ? sampleCount : sampleCount - 1;
		// The floor centreline and its top counterpart read together as one honest
		// as-built Wall. The top line stays visible above the unfolded sheet.
		for (const height of [datumMeters + 0.03, datumMeters + wall.height + 0.24]) {
			for (let index = 0; index < edgeCount; index += 1) {
				const start = wall.samples[index]!;
				const end = wall.samples[(index + 1) % sampleCount]!;
				positions.push(start.point[0], height, start.point[1], end.point[0], height, end.point[1]);
			}
		}
		referenceGeometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
		referenceGeometry.computeBoundingSphere();
		reference.computeLineDistances();
	}

	function wrapStation(station: number, length: number, closed: boolean): number {
		if (!closed) return Math.min(length, Math.max(0, station));
		const wrapped = station % length;
		return wrapped < 0 ? wrapped + length : wrapped;
	}

	$effect(() => {
		const state = wallUnfold.state;
		const wall = state === null ? undefined : geometry.walls.find((candidate) => candidate.wallId === state.wallId);
		if (state === null || wall === undefined) {
			root.visible = false;
			invalidate();
			return;
		}
		if (display === null || displayWallId !== wall.wallId || displayCutStation !== state.cutStation) {
			display = buildWallUnfoldDisplay(wall, state, { floorY: datumMeters });
			displayWallId = wall.wallId;
			displayCutStation = state.cutStation;
			if (display === null) {
				root.visible = false;
				invalidate();
				return;
			}
			topologyEdges = boundaryEdges(display.mesh);
			wallHeight = wall.height;
			wallThickness = wall.thickness;
			openingCount = wall.openings.length;
			buildReference(wall.wallId);
			const pairCount = topologyEdges.length + openingCount * 4;
			contourGeometry.setAttribute('position', new BufferAttribute(new Float32Array(pairCount * 6), 3));
		}
		if (display === null) return;
		const mapped = evaluateWallUnfoldDisplay(display, state);
		const position = sheetGeometry.getAttribute('position');
		if (position === undefined || position.array.length !== mapped.positions.length) {
			sheetGeometry.setAttribute('position', new BufferAttribute(mapped.positions, 3));
		} else {
			(position.array as Float32Array).set(mapped.positions);
			position.needsUpdate = true;
		}
		const index: number[] = [];
		for (const triangle of display.mesh.triangles) index.push(...triangle.indices);
		const existingIndex = sheetGeometry.getIndex();
		if (existingIndex === null || existingIndex.count !== index.length) sheetGeometry.setIndex(index);
		else {
			(existingIndex.array as Uint16Array | Uint32Array).set(index);
			existingIndex.needsUpdate = true;
		}
		sheetGeometry.computeBoundingSphere();

		const gridPositions: number[] = [];
		const gridLateral = state.side * (wallThickness / 2 + 0.002);
		const gridPointAt = (station: number, height: number): [number, number, number] => {
			const atStation = developmentPointAtStationFromBuffers(
				display!.development,
				display!.buffers,
				wrapStation(station, display!.development.length, display!.development.closed)
			);
			return [
				atStation.point[0] + atStation.normal[0] * gridLateral,
				datumMeters + height,
				atStation.point[1] + atStation.normal[1] * gridLateral
			];
		};
		const gridStep = 0.5;
		for (let station = gridStep; station < display.development.length - 1e-6; station += gridStep) {
			const bottom = gridPointAt(station, 0.02);
			const top = gridPointAt(station, wallHeight - 0.02);
			gridPositions.push(...bottom, ...top);
		}
		for (let height = 1; height < wallHeight - 0.05; height += 1) {
			for (let station = 0; station < display.development.length - 1e-6; station += gridStep) {
				const next = Math.min(display.development.length, station + gridStep);
				if (next - station <= 1e-6) continue;
				gridPositions.push(...gridPointAt(station, height), ...gridPointAt(next, height));
			}
		}
		const gridAttribute = gridGeometry.getAttribute('position');
		if (gridAttribute === undefined || gridAttribute.array.length !== gridPositions.length) {
			gridGeometry.setAttribute('position', new BufferAttribute(new Float32Array(gridPositions), 3));
		} else {
			(gridAttribute.array as Float32Array).set(gridPositions);
			gridAttribute.needsUpdate = true;
		}
		gridGeometry.computeBoundingSphere();

		const contourPosition = contourGeometry.getAttribute('position') as BufferAttribute | undefined;
		if (contourPosition !== undefined) {
			const values = contourPosition.array as Float32Array;
			let at = 0;
			for (const [a, b] of topologyEdges) {
				values[at++] = mapped.positions[a * 3]!;
				values[at++] = mapped.positions[a * 3 + 1]!;
				values[at++] = mapped.positions[a * 3 + 2]!;
				values[at++] = mapped.positions[b * 3]!;
				values[at++] = mapped.positions[b * 3 + 1]!;
				values[at++] = mapped.positions[b * 3 + 2]!;
			}
				const half = (wallThickness / 2) * (state.side === 1 ? 1 : -1);
			const pointAt = (station: number, lateral: number, height: number): [number, number, number] => {
				const atStation = developmentPointAtStationFromBuffers(
					display!.development,
					display!.buffers,
					wrapStation(station, display!.development.length, display!.development.closed)
				);
				return [
					atStation.point[0] + atStation.normal[0] * lateral,
					datumMeters + height,
					atStation.point[1] + atStation.normal[1] * lateral
				];
			};
			for (const band of display.openingBands) {
				const sill = band.sillHeight;
				const head = band.headHeight;
				const edges: [[number, number, number], [number, number, number]][] = [
					[pointAt(band.stationStart, -half, sill), pointAt(band.stationEnd, -half, sill)],
					[pointAt(band.stationStart, -half, head), pointAt(band.stationEnd, -half, head)],
					[pointAt(band.stationStart, -half, sill), pointAt(band.stationStart, -half, head)],
					[pointAt(band.stationEnd, -half, sill), pointAt(band.stationEnd, -half, head)]
				];
				for (const [from, to] of edges) {
					values[at++] = from[0]; values[at++] = from[1]; values[at++] = from[2];
					values[at++] = to[0]; values[at++] = to[1]; values[at++] = to[2];
				}
			}
			contourPosition.needsUpdate = true;
			contourGeometry.computeBoundingSphere();
		}

		contourMaterial.color.set(selected ? 0xb9932f : 0x4d4a43);
		sheetMaterial.color.set(selected ? 0xefe4c8 : 0xe9dfca);
		root.visible = true;
		invalidate();
	});

	$effect(() => () => {
		sheetGeometry.dispose();
		sheetMaterial.dispose();
		contourGeometry.dispose();
		contourMaterial.dispose();
		gridGeometry.dispose();
		gridMaterial.dispose();
		referenceGeometry.dispose();
		referenceMaterial.dispose();
	});
</script>

<T is={root} />
