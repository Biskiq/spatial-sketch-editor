/**
 * Layout Card facts and writable-field readings.
 *
 * A fact is a presentation reading of one authored subject; a writable fact is
 * offered only where a production planner owns the field. Both are pure reads
 * over the compiled geometry and the document, never an edit path.
 */
import { composeSpaceBoundary, readClosedWallCircle } from '@portfolio/layout-core/room';
import { faceArea, regionsOverSpace, type CompiledLayoutGeometry } from '@portfolio/layout-core/geometry';
import { deriveLayoutWallRole, isClosedWall, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { lookupIndexedObject, lookupIndexedOpening, lookupIndexedWall } from '@portfolio/layout-core/world';
import type { LayoutSubject } from './precision';
import { wallFrame } from './precision-frames';

/**
 * One read-only Card fact for a Layout subject. `fieldId` names the field the fact shows;
 * the Card drops it when the contributed writer edits that field, so each value appears once.
 */
export type LayoutFact = { readonly label: string; readonly value: string; readonly fieldId: string };

/**
 * Full typed values, never rounded display values. JavaScript's shortest
 * round-trip number formatting is the exact value that will be saved.
 */
export function formatMeters(value: number): string {
	return `${value} m`;
}

/**
 * The Card's count of open sides: **maximal runs** of consecutive virtual
 * edges around the composed boundary, never the raw virtual-edge array length.
 *
 * Erasing two adjacent outside Walls leaves two consecutive virtual edges but
 * one open side (SP-plan §5.1); gaps on opposite sides remain two. When the
 * boundary cannot compose, the raw edges are the only evidence left, so they
 * are counted individually rather than reporting a false single run.
 */
export function openSideRunCount(
	document: LayoutDocumentWallFirst,
	room: LayoutDocumentWallFirst['rooms'][number]
): number {
	const composed = composeSpaceBoundary(document, room);
	if (composed.kind === 'failed') return room.virtualEdges.length;
	const edges = composed.edges;
	let runs = 0;
	for (let index = 0; index < edges.length; index += 1) {
		if (edges[index]!.kind !== 'virtual') continue;
		const previous = edges[(index - 1 + edges.length) % edges.length]!;
		if (previous.kind !== 'virtual') runs += 1;
	}
	return runs;
}

/**
 * The Room Card's facts. Area is read from the compiled floor polygon, never
 * recomputed from the authored boundary; the kind word and the open-side count
 * are derived readings of one Space record.
 */
export function layoutRoomFacts(
	document: LayoutDocumentWallFirst,
	geometry: CompiledLayoutGeometry,
	roomId: string
): readonly LayoutFact[] {
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (room === undefined) return [];
	const compiled = geometry.rooms.find((candidate) => candidate.roomId === roomId);
	const openSides = openSideRunCount(document, room);
	const walls = room.boundary.length;
	// SP1's `overhead` is the only thing that decides a lid. An authored overhead
	// region never closes or opens a Space; it is named as a derived readout.
	const overlying = regionsOverSpace(geometry, roomId);
	const overheadRegion = overlying.find((region) => region.role === 'overhead');
	const overheadName =
		overheadRegion === undefined
			? null
			: (document.regions.find((region) => region.id === overheadRegion.regionId)?.name ??
				overheadRegion.regionId);
	return [
		{ label: 'Kind', value: openSides > 0 ? 'Open space' : 'Room', fieldId: 'kind' },
		{ label: 'Name', value: room.name ?? '(unnamed)', fieldId: 'name' },
		{
			label: 'Area',
			value: compiled === undefined ? '—' : `${faceArea({ polygon: compiled.floorPolygon }).toFixed(2)} m²`,
			fieldId: 'area'
		},
		{
			label: 'Overhead',
			value:
				room.overhead === 'open-to-sky'
					? overheadName === null
						? 'Open to sky'
						: `Open to sky · under ${overheadName}`
					: 'Closed',
			fieldId: 'overhead'
		},
		...(overlying.length === 0
			? []
			: [
					{
						label: 'Regions',
						value: overlying
							.map(
								(region) =>
									`${document.regions.find((candidate) => candidate.id === region.regionId)?.name ?? region.regionId} (${region.role === 'floor' ? 'floor' : 'overhead'})`
							)
							.join(' · '),
						fieldId: 'regions'
					} as const
				]),
		{
			label: 'Bounds',
			value: `${walls} ${walls === 1 ? 'Wall' : 'Walls'} · ${openSides} open ${openSides === 1 ? 'side' : 'sides'}`,
			fieldId: 'bounds'
		}
	];
}

/** Every settled writable/read-only fact the Dimensions instrument shows. */
export function layoutFacts(
	document: LayoutDocumentWallFirst,
	subject: LayoutSubject
): readonly LayoutFact[] {
	if (subject.kind === 'wall') {
		const wall = lookupIndexedWall(document, subject.id);
		if (wall === undefined) return [];
		const facts: LayoutFact[] = [
			{ label: 'Kind', value: 'Wall', fieldId: 'kind' },
			{ label: 'Name', value: wall.name ?? '(unnamed)', fieldId: 'name' },
			{ label: 'Height', value: formatMeters(wall.height), fieldId: 'height' },
			{ label: 'Thickness', value: formatMeters(wall.thickness), fieldId: 'thickness' }
		];
		if (isClosedWall(wall)) {
			const circle = readClosedWallCircle(document, wall.id);
			if (circle !== null) {
				facts.push(
					{ label: 'Shape', value: 'Circular (radius edit only; cannot bend)', fieldId: 'shape' },
					{ label: 'Radius', value: formatMeters(circle.radius), fieldId: 'radius' },
					{ label: 'Diameter', value: formatMeters(circle.radius * 2), fieldId: 'diameter' },
					{ label: 'Circumference', value: formatMeters(circle.radius * Math.PI * 2), fieldId: 'circumference' }
				);
			}
		}
		// Format 6 — the role is derived from Room boundary membership, shown
		// read-only because it follows geometry rather than a control.
		facts.push({
			label: 'Role',
			value: `${deriveLayoutWallRole(document, wall.id) ?? 'free-standing'} (derived)`,
			fieldId: 'role'
		});
		return facts;
	}
	if (subject.kind === 'opening') {
		const opening = lookupIndexedOpening(document, subject.id);
		if (opening === undefined) return [];
		return [
			{ label: 'Kind', value: opening.kind === 'door' ? 'Door' : 'Window', fieldId: 'kind' },
			{ label: 'Name', value: opening.name ?? '(unnamed)', fieldId: 'name' },
			{ label: 'Offset', value: formatMeters(opening.offset), fieldId: 'offset' },
			{ label: 'Width', value: formatMeters(opening.width), fieldId: 'width' },
			{ label: 'Height', value: formatMeters(opening.height), fieldId: 'height' },
			{ label: 'Sill', value: formatMeters(opening.sillHeight), fieldId: 'sillHeight' }
		];
	}
	if (subject.kind === 'region') {
		const region = document.regions.find((candidate) => candidate.id === subject.id);
		if (region === undefined) return [];
		let twice = 0;
		const points = region.footprint.points;
		for (let index = 0; index < points.length; index++) {
			const [x, z] = points[index]!;
			const [nx, nz] = points[(index + 1) % points.length]!;
			twice += x * nz - nx * z;
		}
		const world =
			region.role === 'overhead'
				? document.floor.elevation + region.elevation
				: document.floor.elevation + region.elevation;
		return [
			{
				label: 'Kind',
				value: region.role === 'overhead' ? 'Flat Roof' : 'Terrace',
				fieldId: 'regionKind'
			},
			{ label: 'Name', value: region.name ?? '(unnamed)', fieldId: 'name' },
			{ label: 'Area', value: `${(Math.abs(twice) / 2).toFixed(2)} m²`, fieldId: 'area' },
			{
				label: region.role === 'overhead' ? 'Underside (world)' : 'Top (world)',
				value: `${world.toFixed(3)} m`,
				fieldId: 'regionWorldElevation'
			}
		];
	}
	const object = lookupIndexedObject(document, subject.id);
	if (object === undefined) return [];
	return [
		{ label: 'Kind', value: object.kind, fieldId: 'kind' },
		{ label: 'Name', value: '(read-only identity)', fieldId: 'name' },
		{ label: 'Position', value: object.position.map(formatMeters).join(' · '), fieldId: 'position' },
		{ label: 'Dimensions', value: object.dimensions.map(formatMeters).join(' · '), fieldId: 'dimensions' }
	];
}

/**
 * The facts a Dimensions instrument offers for editing, in fixed semantic order.
 * A fact is writable only when a production planner owns it; everything else is
 * reported read-only with the reason, never as an inert control.
 */
export type LayoutWritableFact =
	| { readonly id: string; readonly label: string; readonly value: number; readonly unit: 'm' }
	| { readonly id: string; readonly label: string; readonly value: number; readonly unit: 'deg' }
	| { readonly id: string; readonly label: string; readonly value: string; readonly unit: 'text' };

export function layoutWritableFacts(
	document: LayoutDocumentWallFirst,
	subject: LayoutSubject
): readonly LayoutWritableFact[] {
	if (subject.kind === 'wall') {
		const wall = lookupIndexedWall(document, subject.id);
		if (wall === undefined) return [];
		// A closed Wall owns radius/diameter writes instead of straight-Wall
		// length/angle/coordinate solves. The values are exact metres read from the
		// persisted 16-span chain, never a remembered gesture.
		if (isClosedWall(wall)) {
			const circle = readClosedWallCircle(document, subject.id);
			const dimensions: LayoutWritableFact[] = [
				{ id: 'name', label: 'Name', value: wall.name ?? '', unit: 'text' },
				{ id: 'height', label: 'Height', value: wall.height, unit: 'm' },
				{ id: 'thickness', label: 'Thickness', value: wall.thickness, unit: 'm' }
			];
			if (circle !== null) {
				dimensions.push(
					{ id: 'radius', label: 'Radius', value: circle.radius, unit: 'm' },
					{ id: 'diameter', label: 'Diameter', value: circle.radius * 2, unit: 'm' }
				);
			}
			return dimensions;
		}
		const frame = wallFrame(document, subject.id);
		// A curved open Wall keeps every precision scalar edit and gains no length/angle/rigid
		// field: those are straight-Wall solves and offering them would be an
		// invitation the canonical planner has to refuse.
		if (frame === null) {
			return [
				{ id: 'name', label: 'Name', value: wall.name ?? '', unit: 'text' },
				{ id: 'height', label: 'Height', value: wall.height, unit: 'm' },
				{ id: 'thickness', label: 'Thickness', value: wall.thickness, unit: 'm' }
			];
		}
		return [
			{ id: 'name', label: 'Name', value: wall.name ?? '', unit: 'text' },
			{ id: 'height', label: 'Height', value: wall.height, unit: 'm' },
			{ id: 'thickness', label: 'Thickness', value: wall.thickness, unit: 'm' },
			{ id: 'length', label: 'Length', value: frame.length, unit: 'm' },
			{ id: 'angle', label: 'Angle', value: (frame.angleRadians * 180) / Math.PI, unit: 'deg' },
			{ id: 'deltaX', label: 'Move ΔX', value: 0, unit: 'm' },
			{ id: 'deltaZ', label: 'Move ΔZ', value: 0, unit: 'm' },
			// The non-pointer path for the same shared-Junction planner.
			{ id: 'startX', label: 'Start X', value: frame.start[0], unit: 'm' },
			{ id: 'startZ', label: 'Start Z', value: frame.start[1], unit: 'm' },
			{ id: 'endX', label: 'End X', value: frame.end[0], unit: 'm' },
			{ id: 'endZ', label: 'End Z', value: frame.end[1], unit: 'm' }
		];
	}
	if (subject.kind === 'opening') {
		const opening = lookupIndexedOpening(document, subject.id);
		if (opening === undefined) return [];
		return [
			{ id: 'name', label: 'Name', value: opening.name ?? '', unit: 'text' },
			{ id: 'offset', label: 'Offset', value: opening.offset, unit: 'm' },
			{ id: 'width', label: 'Width', value: opening.width, unit: 'm' },
			{ id: 'height', label: 'Height', value: opening.height, unit: 'm' },
			{ id: 'sillHeight', label: 'Sill', value: opening.sillHeight, unit: 'm' }
		];
	}
	return [];
}

/**
 * The fields the Card's Layout writer edits for one subject: every writable field except
 * the name, which the Card header's rename writer owns. A read-only fact on the same
 * subject with one of these `fieldId`s is shown by the writer and is not repeated.
 */
export function layoutCardFieldIds(
	document: LayoutDocumentWallFirst,
	subject: LayoutSubject
): readonly string[] {
	return layoutWritableFacts(document, subject)
		.map((field) => field.id)
		.filter((id) => id !== 'name');
}
