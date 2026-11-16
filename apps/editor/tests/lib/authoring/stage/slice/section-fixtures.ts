/**
 * SL1 cap-assembly fixtures: real Wall-builder output plus an independent area
 * oracle.
 *
 * The area oracle deliberately does not reuse the assembly's welding, splitting,
 * winding or stitching. It takes the raw oriented triangle sections, integrates
 * the nonzero-winding coverage over exact vertical slabs between every endpoint
 * and crossing, and returns the area of the union. A loop or stitch defect cannot
 * hide behind it.
 */
import {
	compileWallFirstLayoutGeometry,
	legJoinsByWall,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallOpening
} from '@portfolio/layout-core';
import {
	buildRoomWallMesh,
	buildStandaloneWallMesh,
	type IndexedWallMesh
} from '$lib/layout/wall-mesh-builder';
import type {
	SectionIdentity,
	SectionInput,
	SectionPlane
} from '$lib/authoring/stage/slice/mesh-plane-section';

export type FixtureWall = LayoutWall & { id: string };

export function wall(
	id: string,
	startJunctionId: string,
	endJunctionId: string,
	options: Partial<Pick<LayoutWall, 'thickness' | 'height'>> = {}
): LayoutWall {
	return {
		id,
		startJunctionId,
		endJunctionId,
		thickness: options.thickness ?? 0.2,
		height: options.height ?? 3,
		centerline: { kind: 'line' }
	} as LayoutWall;
}

export function document(
	junctions: ReadonlyArray<{ id: string; point: LayoutVec2 }>,
	walls: readonly LayoutWall[],
	openings: readonly LayoutWallOpening[] = []
): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: 7,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: junctions.map((junction) => ({ ...junction })),
		walls: [...walls],
		rooms: [],
		openings: [...openings],
		objects: []
	} as unknown as LayoutDocumentWallFirst;
}

export type StructureFixture = {
	readonly document: LayoutDocumentWallFirst;
	readonly geometry: CompiledLayoutGeometry;
	readonly meshes: readonly IndexedWallMesh[];
	readonly inputs: readonly SectionInput[];
};

export function structureFixture(source: LayoutDocumentWallFirst): StructureFixture {
	const compiled = compileWallFirstLayoutGeometry(source);
	if (compiled.issues.length > 0) {
		throw new Error(`fixture did not compile: ${compiled.issues.map((issue) => issue.message).join('; ')}`);
	}
	const joins = legJoinsByWall(compiled.geometry.junctions);
	const elevation = compiled.geometry.floors[0]?.elevation ?? 0;
	const meshes: IndexedWallMesh[] = [];
	const inputs: SectionInput[] = [];
	for (const compiledWall of compiled.geometry.walls) {
		const built = buildStandaloneWallMesh(
			compiledWall,
			elevation,
			joins.get(compiledWall.wallId) ?? null,
			{ classifySurface: () => 'wall' }
		);
		if (built.mesh === undefined) {
			throw new Error(
				`Wall ${compiledWall.wallId} did not build: ${built.issues.map((issue) => issue.message).join('; ')}`
			);
		}
		meshes.push(built.mesh);
		inputs.push(inputOf(built.mesh, { kind: 'wall', id: compiledWall.wallId }, 'structure'));
	}
	return { document: source, geometry: compiled.geometry, meshes, inputs };
}

/**
 * The room-level builder's forced-bevel mesh, with its bridges. The Stage's
 * per-Wall builder keeps sharp bevel corners open by design (the solid matrix
 * pins that limit); the room loop's bridge closes them, which is the valid
 * bevel-with-bridge input the cap must assemble.
 */
export function roomBevelInputs(source: LayoutDocumentWallFirst): readonly SectionInput[] {
	const compiled = compileWallFirstLayoutGeometry(source);
	if (compiled.issues.length > 0) {
		throw new Error(`fixture did not compile: ${compiled.issues.map((issue) => issue.message).join('; ')}`);
	}
	const room = compiled.geometry.rooms[0];
	const roomSource = source.rooms.find((candidate) => candidate.id === room?.roomId);
	if (!room || !roomSource) throw new Error('fixture compiled to no bounded Room');
	// The same assembly the Room-level shell path uses: each physical Wall is
	// taken verbatim, named by the boundary segment it plays.
	const walls = roomSource.boundary.map((ref) => {
		const wall = compiled.geometry.walls.find((candidate) => candidate.wallId === ref.wallId);
		if (!wall) throw new Error(`Room ${room.roomId} references uncompiled Wall ${ref.wallId}`);
		return { ...wall, segmentId: wall.wallId };
	});
	const built = buildRoomWallMesh({ ...room, walls }, { miterLimit: 1, assertWinding: true });
	if (built.mesh === undefined) {
		throw new Error(`bevel Room did not build: ${built.issues.map((issue) => issue.message).join('; ')}`);
	}
	return [inputOf(built.mesh, { kind: 'wall', id: room.roomId }, 'structure')];
}

export function inputOf(
	mesh: IndexedWallMesh,
	identity: SectionIdentity,
	group: string
): SectionInput {
	return {
		identity,
		group,
		positions: mesh.positions,
		index: mesh.indices
	};
}

/** A hand-built axis-aligned box, for the cases the Wall builder does not make. */
export function boxInput(
	min: readonly [number, number, number],
	max: readonly [number, number, number],
	identity: SectionIdentity,
	group: string,
	reverse = false
): SectionInput {
	const [x0, y0, z0] = min;
	const [x1, y1, z1] = max;
	const positions = new Float32Array([
		x0, y0, z0,
		x1, y0, z0,
		x1, y0, z1,
		x0, y0, z1,
		x0, y1, z0,
		x1, y1, z0,
		x1, y1, z1,
		x0, y1, z1
	]);
	const triangles = [
		0, 2, 1, 0, 3, 2,
		4, 5, 6, 4, 6, 7,
		0, 1, 5, 0, 5, 4,
		1, 2, 6, 1, 6, 5,
		2, 3, 7, 2, 7, 6,
		3, 0, 4, 3, 4, 7
	];
	const index = new Uint32Array(reverse ? reverseTriangles(triangles) : triangles);
	return { identity, group, positions, index };
}

function reverseTriangles(triangles: readonly number[]): number[] {
	const reversed: number[] = [];
	for (let offset = 0; offset < triangles.length; offset += 3) {
		reversed.push(triangles[offset]!, triangles[offset + 2]!, triangles[offset + 1]!);
	}
	return reversed;
}

/** A box missing one side: a deliberately open input whose section is a U chain. */
export function openBoxInput(
	min: readonly [number, number, number],
	max: readonly [number, number, number],
	identity: SectionIdentity,
	group: string
): SectionInput {
	const box = boxInput(min, max, identity, group);
	// Drop the two triangles of the x = min face.
	const index = new Uint32Array([
		0, 2, 1, 0, 3, 2,
		4, 5, 6, 4, 6, 7,
		0, 1, 5, 0, 5, 4,
		1, 2, 6, 1, 6, 5,
		2, 3, 7, 2, 7, 6
	]);
	return { ...box, index };
}

/** A vertical quad; used for the open and coincident-face cases. */
export function quadInput(
	yLow: number,
	yHigh: number,
	identity: SectionIdentity,
	group: string,
	reverse = false
): SectionInput {
	const positions = new Float32Array([0, yLow, 0, 4, yLow, 0, 4, yHigh, 0, 0, yHigh, 0]);
	const index = new Uint32Array(reverse ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
	return { identity, group, positions, index };
}

type Segment2 = { readonly ax: number; readonly az: number; readonly bx: number; readonly bz: number };

/** The raw oriented triangle sections of every input, with no welding at all. */
function rawSegments(inputs: readonly SectionInput[], plane: SectionPlane): Segment2[] {
	const segments: Segment2[] = [];
	const [nx, ny, nz] = plane.normal;
	const point = (input: SectionInput, vertex: number): [number, number, number] | null => {
		const offset = vertex * 3;
		if (offset + 2 >= input.positions.length) return null;
		let x = input.positions[offset]!;
		let y = input.positions[offset + 1]!;
		let z = input.positions[offset + 2]!;
		const matrix = input.matrixWorld;
		if (matrix !== undefined && matrix !== null && matrix.length >= 16) {
			const tx = matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!;
			const ty = matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!;
			const tz = matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!;
			x = tx;
			y = ty;
			z = tz;
		}
		return [x, y, z];
	};
	const vertexIndex = (input: SectionInput, offset: number): number =>
		input.index === undefined || input.index === null ? offset : Number(input.index[offset]);
	for (const input of inputs) {
		const total = input.index === undefined || input.index === null ? Math.floor(input.positions.length / 3) : input.index.length;
		for (let offset = 0; offset + 2 < total; offset += 3) {
			const a = point(input, vertexIndex(input, offset));
			const b = point(input, vertexIndex(input, offset + 1));
			const c = point(input, vertexIndex(input, offset + 2));
			if (a === null || b === null || c === null) continue;
			const da = nx * a[0] + ny * a[1] + nz * a[2] + plane.constant;
			const db = nx * b[0] + ny * b[1] + nz * b[2] + plane.constant;
			const dc = nx * c[0] + ny * c[1] + nz * c[2] + plane.constant;
			const crossings: Array<[number, number, number]> = [];
			const add = (p: [number, number, number], q: [number, number, number], dp: number, dq: number): void => {
				if (!((dp > 0 && dq < 0) || (dp < 0 && dq > 0))) return;
				const t = dp / (dp - dq);
				crossings.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
			};
			add(a, b, da, db);
			add(b, c, db, dc);
			add(c, a, dc, da);
			if (crossings.length !== 2) continue;
			const ux = b[0] - a[0];
			const uy = b[1] - a[1];
			const uz = b[2] - a[2];
			const vx = c[0] - a[0];
			const vy = c[1] - a[1];
			const vz = c[2] - a[2];
			const tnx = uy * vz - uz * vy;
			const tny = uz * vx - ux * vz;
			const tnz = ux * vy - uy * vx;
			const dirX = ny * tnz - nz * tny;
			const dirZ = nx * tny - ny * tnx;
			let first = crossings[0]!;
			let second = crossings[1]!;
			if ((second[0] - first[0]) * dirX + (second[2] - first[2]) * dirZ < 0) {
				first = crossings[1]!;
				second = crossings[0]!;
			}
			segments.push({ ax: first[0], az: first[2], bx: second[0], bz: second[2] });
		}
	}
	return segments;
}

/** Winding number of the raw directed segments about a plan point. */
function windingAt(segments: readonly Segment2[], x: number, z: number): number {
	let winding = 0;
	for (const segment of segments) {
		const side = (segment.bx - segment.ax) * (z - segment.az) - (x - segment.ax) * (segment.bz - segment.az);
		if (segment.az <= z) {
			if (segment.bz > z && side > 0) winding += 1;
		} else if (segment.bz <= z && side < 0) {
			winding -= 1;
		}
	}
	return winding;
}

/** Total length of the interior intervals of one vertical scanline. */
function insideLengthAt(segments: readonly Segment2[], x: number): number {
	const crossings: number[] = [];
	for (const segment of segments) {
		const minX = Math.min(segment.ax, segment.bx);
		const maxX = Math.max(segment.ax, segment.bx);
		if (x < minX - 1e-12 || x > maxX + 1e-12) continue;
		const dx = segment.bx - segment.ax;
		if (Math.abs(dx) < 1e-12) continue;
		const t = (x - segment.ax) / dx;
		if (t < -1e-12 || t > 1 + 1e-12) continue;
		crossings.push(segment.az + (segment.bz - segment.az) * t);
	}
	crossings.sort((a, b) => a - b);
	let total = 0;
	for (let index = 0; index + 1 < crossings.length; index += 1) {
		const low = crossings[index]!;
		const high = crossings[index + 1]!;
		if (!(high > low)) continue;
		if (windingAt(segments, x, (low + high) / 2) !== 0) total += high - low;
	}
	return total;
}

/**
 * The area of the union of the inputs' solids at `plane`, independently of the
 * assembly: exact per vertical slab, because every boundary y is linear in x and
 * no boundary crosses inside a slab.
 */
export function unionArea(inputs: readonly SectionInput[], plane: SectionPlane): number {
	const segments = rawSegments(inputs, plane);
	if (segments.length === 0) return 0;
	const critical = new Set<number>();
	for (const segment of segments) {
		critical.add(segment.ax);
		critical.add(segment.bx);
	}
	// Every proper crossing is a slab boundary too.
	for (let first = 0; first < segments.length; first += 1) {
		const a = segments[first]!;
		for (let second = first + 1; second < segments.length; second += 1) {
			const b = segments[second]!;
			const rX = a.bx - a.ax;
			const rZ = a.bz - a.az;
			const sX = b.bx - b.ax;
			const sZ = b.bz - b.az;
			const denominator = rX * sZ - rZ * sX;
			if (Math.abs(denominator) < 1e-12) continue;
			const qpx = b.ax - a.ax;
			const qpz = b.az - a.az;
			const t = (qpx * sZ - qpz * sX) / denominator;
			const u = (qpx * rZ - qpz * rX) / denominator;
			if (!(t >= 0 && t <= 1 && u >= 0 && u <= 1)) continue;
			critical.add(a.ax + rX * t);
		}
	}
	const xs = [...critical].sort((a, b) => a - b);
	let total = 0;
	for (let index = 0; index + 1 < xs.length; index += 1) {
		const low = xs[index]!;
		const high = xs[index + 1]!;
		const width = high - low;
		if (!(width > 1e-9)) continue;
		// The inside length is linear in x inside a slab (no crossings), so the
		// trapezoid rule on two interior samples is exact.
		const left = insideLengthAt(segments, low + width * 0.25);
		const right = insideLengthAt(segments, low + width * 0.75);
		total += ((left + right) / 2) * width;
	}
	return total;
}

/** The signed area of every assembled loop: outers positive, holes negative. */
export function assemblyArea(loops: readonly { readonly points: readonly { readonly u: number; readonly v: number }[] }[]): number {
	let total = 0;
	for (const loop of loops) {
		let twice = 0;
		for (let index = 0; index < loop.points.length; index += 1) {
			const a = loop.points[index]!;
			const b = loop.points[(index + 1) % loop.points.length]!;
			twice += a.u * b.v - b.u * a.v;
		}
		total += twice / 2;
	}
	return total;
}

function orientation(a: { u: number; v: number }, b: { u: number; v: number }, c: { u: number; v: number }): number {
	return (b.u - a.u) * (c.v - a.v) - (b.v - a.v) * (c.u - a.u);
}

function segmentsCross(
	a1: { u: number; v: number },
	a2: { u: number; v: number },
	b1: { u: number; v: number },
	b2: { u: number; v: number }
): boolean {
	const d1 = orientation(b1, b2, a1);
	const d2 = orientation(b1, b2, a2);
	const d3 = orientation(a1, a2, b1);
	const d4 = orientation(a1, a2, b2);
	return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) &&
		((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9));
}

/** No two non-adjacent edges of a loop cross. */
export function loopIsSimple(points: readonly { readonly u: number; readonly v: number }[]): boolean {
	const count = points.length;
	for (let first = 0; first < count; first += 1) {
		const firstNext = (first + 1) % count;
		for (let second = first + 2; second < count; second += 1) {
			const secondNext = (second + 1) % count;
			if (first === secondNext || firstNext === second) continue;
			if (
				segmentsCross(
					points[first]!,
					points[firstNext]!,
					points[second]!,
					points[secondNext]!
				)
			) {
				return false;
			}
		}
	}
	return true;
}
