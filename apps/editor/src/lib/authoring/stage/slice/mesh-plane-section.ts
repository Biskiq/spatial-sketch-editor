/**
 * A plane section of what is **actually drawn**, assembled into cap polygons.
 *
 * The Slice's cap cannot come from Plan's wall bands (they approximate the 3D
 * miters at a Junction, `cutWallBandsOf`), from a stencil pass (the stencil is
 * already spent on Paper and selection) or from a second analytic Wall model.
 * It comes from the rendered Wall meshes themselves: exactly the surfaces the
 * creator sees, so the cap is exact by construction and extends to any future
 * mesh.
 *
 * Endpoint welding alone cannot close the section. At a T Junction the stem's
 * side faces end at points that lie on, not at the ends of, the through Wall's
 * split face; at X/Y Junctions keel and bridge faces meet several Walls; two
 * coincident faces can run in opposite directions; and overlapping-not-joined
 * Walls cross each other. Per-Wall meshes are open at their Junction ends by
 * design. The assembly therefore works on a **group's union** in seven fixed
 * steps: groups, section offset, oriented segments, weld, split, net
 * multiplicity, and nonzero-winding union with Paper's stitching rule.
 *
 * Pure — typed arrays in, plain geometry out. No Svelte, no scene, no renderer.
 */

export type SectionIdentity = {
	readonly kind: string;
	readonly id: string;
};

/** One rendered mesh to section. Positions are world-space unless a matrix is given. */
export type SectionInput = {
	readonly identity: SectionIdentity;
	/**
	 * Meshes that form one closed solid assemble together. All Wall-owned meshes
	 * of a Layout share one structure group; each Layout object is its own group,
	 * so a plinth flush against a Wall never cancels the Wall's boundary.
	 */
	readonly group: string;
	readonly positions: ArrayLike<number>;
	readonly index?: ArrayLike<number> | null;
	/** Column-major 4×4 world matrix; absent means the positions are already world-space. */
	readonly matrixWorld?: ArrayLike<number> | null;
};

/** A horizontal plane, in the sign convention the GPU uses: kept iff `n·p + c ≥ 0`. */
export type SectionPlane = {
	readonly normal: readonly [number, number, number];
	readonly constant: number;
};

/**
 * Two section endpoints closer than this are one vertex.
 *
 * The builder's shared Junction vertices agree to floating round-off (~1e-11), and
 * distinct features (an Opening jamb beside a face) can legitimately sit a few
 * hundredths of a millimetre apart. The plan's 5e-5 was too coarse for those
 * features: it merged them and shifted the assembled area by 4e-6 m², past the
 * catalogue's 1e-6 m² budget. Ten micrometres still absorbs every round-off and
 * stays an order of magnitude under the section offset.
 */
export const SECTION_WELD_TOLERANCE_METERS = 1e-5;
/**
 * The section is taken this far below the cut while the GPU clips exactly at the
 * cut. Sheet ticks snap to found surfaces, so a cut exactly on a horizontal face
 * is the common case; the offset leaves every triangle either straddling the
 * plane or not, never coplanar or vertex-on-plane. The cap is drawn at the cut.
 */
export const SECTION_PLANE_OFFSET_METERS = 1e-4;

/** The cap section plane for a cut at `cutY`: horizontal, `y ≤ cutY - 1e-4` kept. */
export function capSectionPlane(cutY: number): SectionPlane {
	return {
		normal: [0, -1, 0],
		constant: cutY - SECTION_PLANE_OFFSET_METERS
	};
}

export type SectionPoint = {
	/** Plan X, metres. */
	readonly u: number;
	/** Plan Z, metres. */
	readonly v: number;
};

export type SectionEdge = {
	readonly identity: SectionIdentity;
};

export type SectionLoop = {
	/** Outer rings are counter-clockwise, holes clockwise; the last point closes to the first. */
	readonly points: readonly SectionPoint[];
	/** `edges[i]` is the identity of `points[i] → points[i + 1]`. */
	readonly edges: readonly SectionEdge[];
	readonly hole: boolean;
	/** For a hole, the index of its smallest containing outer; `-1` for an outer. */
	readonly outerIndex: number;
};

export type SectionChain = {
	readonly points: readonly SectionPoint[];
	readonly edges: readonly SectionEdge[];
};

/** A group whose net boundary does not balance: the input was genuinely open. */
export type CapAssemblyIssue = {
	readonly group: string;
	readonly identity: SectionIdentity | null;
	readonly unmatchedVertices: number;
};

export type SectionResult = {
	readonly loops: readonly SectionLoop[];
	readonly openChains: readonly SectionChain[];
	readonly issues: readonly CapAssemblyIssue[];
};

export type SectionOptions = {
	readonly weldToleranceMeters?: number;
};

type Vertex = { readonly x: number; readonly z: number };

type Segment = {
	readonly a: number;
	readonly b: number;
	readonly identity: SectionIdentity;
};

type NetEdge = {
	readonly a: number;
	readonly b: number;
	readonly net: number;
	readonly identity: SectionIdentity;
};

type DirectedEdge = {
	readonly from: number;
	readonly to: number;
	readonly identity: SectionIdentity;
};

const EPSILON = 1e-12;

function worldPointAt(
	positions: ArrayLike<number>,
	vertex: number,
	matrix: ArrayLike<number> | null | undefined,
	out: [number, number, number]
): boolean {
	const offset = vertex * 3;
	if (offset + 2 >= positions.length) return false;
	const x = positions[offset]!;
	const y = positions[offset + 1]!;
	const z = positions[offset + 2]!;
	if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;
	if (matrix === null || matrix === undefined || matrix.length < 16) {
		out[0] = x;
		out[1] = y;
		out[2] = z;
		return true;
	}
	out[0] = matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!;
	out[1] = matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!;
	out[2] = matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!;
	return true;
}

function indexAt(index: ArrayLike<number> | null | undefined, offset: number): number {
	return index === null || index === undefined ? offset : Number(index[offset]);
}

/**
 * Section `inputs` at `plane` and assemble each group's union boundary.
 *
 * Groups are independent: the structure group (every Wall-owned mesh) and each
 * Layout object answer separately. The result is simple, non-overlapping
 * polygons — counter-clockwise outers with clockwise holes assigned to the
 * smallest containing outer — plus any open chains and the issues that explain
 * them.
 */
export function sectionMeshes(
	inputs: readonly SectionInput[],
	plane: SectionPlane,
	options: SectionOptions = {}
): SectionResult {
	const tolerance = options.weldToleranceMeters ?? SECTION_WELD_TOLERANCE_METERS;
	const byGroup = new Map<string, SectionInput[]>();
	for (const input of inputs) {
		const list = byGroup.get(input.group);
		if (list === undefined) byGroup.set(input.group, [input]);
		else list.push(input);
	}

	const loops: SectionLoop[] = [];
	const openChains: SectionChain[] = [];
	const issues: CapAssemblyIssue[] = [];

	for (const [group, groupInputs] of byGroup) {
		const assembled = assembleGroup(group, groupInputs, plane, tolerance);
		loops.push(...assembled.loops);
		openChains.push(...assembled.openChains);
		issues.push(...assembled.issues);
	}

	return { loops, openChains, issues };
}

function assembleGroup(
	group: string,
	inputs: readonly SectionInput[],
	plane: SectionPlane,
	tolerance: number
): SectionResult {
	// --- steps 3–4: oriented segments, welded endpoints -----------------------
	const vertices: Vertex[] = [];
	const vertexCells = new Map<string, number[]>();
	const cellKey = (x: number, z: number): string =>
		`${Math.floor(x / tolerance)},${Math.floor(z / tolerance)}`;

	function weld(x: number, z: number): number {
		const cx = Math.floor(x / tolerance);
		const cz = Math.floor(z / tolerance);
		for (let dx = -1; dx <= 1; dx += 1) {
			for (let dz = -1; dz <= 1; dz += 1) {
				const cell = vertexCells.get(`${cx + dx},${cz + dz}`);
				if (cell === undefined) continue;
				for (const id of cell) {
					const vertex = vertices[id]!;
					if (Math.hypot(vertex.x - x, vertex.z - z) <= tolerance) return id;
				}
			}
		}
		const id = vertices.length;
		vertices.push({ x, z });
		const key = cellKey(x, z);
		const cell = vertexCells.get(key);
		if (cell === undefined) vertexCells.set(key, [id]);
		else cell.push(id);
		return id;
	}

	const segments: Segment[] = [];
	const point: [number, number, number] = [0, 0, 0];
	const planeNormal = plane.normal;
	const nx = planeNormal[0];
	const ny = planeNormal[1];
	const nz = planeNormal[2];

	for (const input of inputs) {
		const index = input.index;
		const total = index !== null && index !== undefined ? index.length : Math.floor(input.positions.length / 3);
		for (let offset = 0; offset + 2 < total; offset += 3) {
			const ia = indexAt(index, offset);
			const ib = indexAt(index, offset + 1);
			const ic = indexAt(index, offset + 2);
			const a: [number, number, number] = [0, 0, 0];
			const b: [number, number, number] = [0, 0, 0];
			const c: [number, number, number] = [0, 0, 0];
			if (!worldPointAt(input.positions, ia, input.matrixWorld, a)) continue;
			if (!worldPointAt(input.positions, ib, input.matrixWorld, b)) continue;
			if (!worldPointAt(input.positions, ic, input.matrixWorld, c)) continue;
			const da = nx * a[0] + ny * a[1] + nz * a[2] + plane.constant;
			const db = nx * b[0] + ny * b[1] + nz * b[2] + plane.constant;
			const dc = nx * c[0] + ny * c[1] + nz * c[2] + plane.constant;
			// A triply-signed triangle straddles the plane; any zero or same-sign
			// triangle contributes no section area.
			if (!((da > 0 && db < 0) || (da < 0 && db > 0) || (db > 0 && dc < 0) || (db < 0 && dc > 0) || (dc > 0 && da < 0) || (dc < 0 && da > 0))) {
				continue;
			}
			const crossings: Array<[number, number, number]> = [];
			const addCrossing = (
				p: [number, number, number],
				q: [number, number, number],
				dp: number,
				dq: number
			): void => {
				if (!((dp > 0 && dq < 0) || (dp < 0 && dq > 0))) return;
				const t = dp / (dp - dq);
				crossings.push([
					p[0] + (q[0] - p[0]) * t,
					p[1] + (q[1] - p[1]) * t,
					p[2] + (q[2] - p[2]) * t
				]);
			};
			addCrossing(a, b, da, db);
			addCrossing(b, c, db, dc);
			addCrossing(c, a, dc, da);
			if (crossings.length !== 2) continue;

			// The section direction that puts the solid on its left, seen from
			// above: `planeNormal × triangleNormal`, projected to the plan.
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
			if (Math.abs(dirX) + Math.abs(dirZ) < EPSILON) continue;

			const first = crossings[0]!;
			const second = crossings[1]!;
			const along = (second[0] - first[0]) * dirX + (second[2] - first[2]) * dirZ;
			if (Math.abs(along) < EPSILON) continue;
			const start = along > 0 ? first : second;
			const end = along > 0 ? second : first;
			const idA = weld(start[0], start[2]);
			const idB = weld(end[0], end[2]);
			if (idA === idB) continue;
			segments.push({ a: idA, b: idB, identity: input.identity });
		}
	}

	if (segments.length === 0) return { loops: [], openChains: [], issues: [] };

	// --- step 5: split at T-vertices and proper crossings ---------------------
	const splitPoints = new Map<number, Map<number, number>>();
	function addSplit(segmentIndex: number, t: number): void {
		if (!(t > 1e-9 && t < 1 - 1e-9)) return;
		let list = splitPoints.get(segmentIndex);
		if (list === undefined) {
			list = new Map();
			splitPoints.set(segmentIndex, list);
		}
		// One split per parameter, whatever discovered it.
		for (const known of list.keys()) {
			if (Math.abs(known - t) <= 1e-9) return;
		}
		list.set(t, t);
	}

	// Vertex grid for T-vertices. A coarser cell than the weld tolerance keeps the
	// scan bounded; each candidate is still tested against the exact tolerance.
	const vertexGridCell = Math.max(0.5, tolerance * 1000);
	const vertexGrid = new Map<string, number[]>();
	function gridKey(x: number, z: number): string {
		return `${Math.floor(x / vertexGridCell)},${Math.floor(z / vertexGridCell)}`;
	}
	vertices.forEach((vertex, id) => {
		const key = gridKey(vertex.x, vertex.z);
		const cell = vertexGrid.get(key);
		if (cell === undefined) vertexGrid.set(key, [id]);
		else cell.push(id);
	});

	const segmentGridCell = Math.max(0.5, vertexGridCell);
	const segmentGrid = new Map<string, number[]>();
	function segmentCells(ax: number, az: number, bx: number, bz: number): string[] {
		const minX = Math.floor(Math.min(ax, bx) / segmentGridCell);
		const maxX = Math.floor(Math.max(ax, bx) / segmentGridCell);
		const minZ = Math.floor(Math.min(az, bz) / segmentGridCell);
		const maxZ = Math.floor(Math.max(az, bz) / segmentGridCell);
		const keys: string[] = [];
		for (let cx = minX; cx <= maxX; cx += 1) {
			for (let cz = minZ; cz <= maxZ; cz += 1) keys.push(`${cx},${cz}`);
		}
		return keys;
	}
	segments.forEach((segment, segmentIndex) => {
		const a = vertices[segment.a]!;
		const b = vertices[segment.b]!;
		for (const key of segmentCells(a.x, a.z, b.x, b.z)) {
			const cell = segmentGrid.get(key);
			if (cell === undefined) segmentGrid.set(key, [segmentIndex]);
			else cell.push(segmentIndex);
		}
	});

	// T-vertices: a welded vertex lying in a segment's interior.
	segments.forEach((segment, segmentIndex) => {
		const a = vertices[segment.a]!;
		const b = vertices[segment.b]!;
		const dx = b.x - a.x;
		const dz = b.z - a.z;
		const lengthSq = dx * dx + dz * dz;
		if (lengthSq <= EPSILON) return;
		const seen = new Set<number>();
		const minX = Math.floor((Math.min(a.x, b.x) - tolerance) / vertexGridCell);
		const maxX = Math.floor((Math.max(a.x, b.x) + tolerance) / vertexGridCell);
		const minZ = Math.floor((Math.min(a.z, b.z) - tolerance) / vertexGridCell);
		const maxZ = Math.floor((Math.max(a.z, b.z) + tolerance) / vertexGridCell);
		for (let cx = minX; cx <= maxX; cx += 1) {
			for (let cz = minZ; cz <= maxZ; cz += 1) {
				const cell = vertexGrid.get(`${cx},${cz}`);
				if (cell === undefined) continue;
				for (const id of cell) {
					if (id === segment.a || id === segment.b || seen.has(id)) continue;
					seen.add(id);
					const vertex = vertices[id]!;
					const t = ((vertex.x - a.x) * dx + (vertex.z - a.z) * dz) / lengthSq;
					if (!(t > 1e-9 && t < 1 - 1e-9)) continue;
					const px = a.x + dx * t;
					const pz = a.z + dz * t;
					if (Math.hypot(vertex.x - px, vertex.z - pz) <= tolerance) addSplit(segmentIndex, t);
				}
			}
		}
	});

	// Proper crossings between two segments of the same group.
	const tested = new Set<string>();
	segments.forEach((first, firstIndex) => {
		const a = vertices[first.a]!;
		const b = vertices[first.b]!;
		const candidates = new Set<number>();
		for (const key of segmentCells(a.x, a.z, b.x, b.z)) {
			const cell = segmentGrid.get(key);
			if (cell === undefined) continue;
			for (const index of cell) if (index !== firstIndex) candidates.add(index);
		}
		for (const secondIndex of candidates) {
			const pairKey = firstIndex < secondIndex ? `${firstIndex}:${secondIndex}` : `${secondIndex}:${firstIndex}`;
			if (tested.has(pairKey)) continue;
			tested.add(pairKey);
			const second = segments[secondIndex]!;
			const c = vertices[second.a]!;
			const d = vertices[second.b]!;
			const rX = b.x - a.x;
			const rZ = b.z - a.z;
			const sX = d.x - c.x;
			const sZ = d.z - c.z;
			const denominator = rX * sZ - rZ * sX;
			if (Math.abs(denominator) < EPSILON) continue;
			const qpx = c.x - a.x;
			const qpz = c.z - a.z;
			const t = (qpx * sZ - qpz * sX) / denominator;
			const u = (qpx * rZ - qpz * rX) / denominator;
			if (!(t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9)) continue;
			addSplit(firstIndex, t);
			addSplit(secondIndex, u);
		}
	});

	// Rebuild segments with every split point welded to one vertex.
	const splitSegments: Segment[] = [];
	segments.forEach((segment, segmentIndex) => {
		const a = vertices[segment.a]!;
		const b = vertices[segment.b]!;
		const params: Array<{ t: number; id: number }> = [];
		const splits = splitPoints.get(segmentIndex);
		if (splits !== undefined) {
			for (const t of [...splits.keys()].sort((left, right) => left - right)) {
				const x = a.x + (b.x - a.x) * t;
				const z = a.z + (b.z - a.z) * t;
				params.push({ t, id: weld(x, z) });
			}
		}
		let previousId = segment.a;
		for (const entry of params) {
			if (entry.id !== previousId) {
				splitSegments.push({ a: previousId, b: entry.id, identity: segment.identity });
				previousId = entry.id;
			}
		}
		if (segment.b !== previousId) {
			splitSegments.push({ a: previousId, b: segment.b, identity: segment.identity });
		}
	});

	// --- step 6: net multiplicity --------------------------------------------
	const netMap = new Map<string, NetEdge>();
	const identityCounts = new Map<string, Map<string, { identity: SectionIdentity; signed: number }>>();
	function identityKey(identity: SectionIdentity): string {
		return `${identity.kind}\u0000${identity.id}`;
	}
	for (const segment of splitSegments) {
		const forward = segment.a < segment.b;
		const low = forward ? segment.a : segment.b;
		const high = forward ? segment.b : segment.a;
		const key = `${low}:${high}`;
		const signed = forward ? 1 : -1;
		const existing = netMap.get(key);
		if (existing === undefined) {
			netMap.set(key, { a: low, b: high, net: signed, identity: segment.identity });
		} else {
			netMap.set(key, { ...existing, net: existing.net + signed });
		}
		let counts = identityCounts.get(key);
		if (counts === undefined) {
			counts = new Map();
			identityCounts.set(key, counts);
		}
		const identityId = identityKey(segment.identity);
		const entry = counts.get(identityId);
		if (entry === undefined) counts.set(identityId, { identity: segment.identity, signed });
		else entry.signed += signed;
	}

	const netEdges: NetEdge[] = [];
	for (const [key, edge] of netMap) {
		if (edge.net === 0) continue;
		// The kept edge's identity is the one with the largest positive count on
		// the solid side; ties break deterministically by kind then id.
		const counts = identityCounts.get(key) ?? new Map();
		let best: { identity: SectionIdentity; signed: number } | null = null;
		const wantedSign = Math.sign(edge.net);
		for (const entry of counts.values()) {
			const contribution = entry.signed * wantedSign;
			if (contribution <= 0) continue;
			if (
				best === null ||
				contribution > best.signed ||
				(contribution === best.signed &&
					`${entry.identity.kind}:${entry.identity.id}` < `${best.identity.kind}:${best.identity.id}`)
			) {
				best = { identity: entry.identity, signed: contribution };
			}
		}
		const identity = best?.identity ?? edge.identity;
		netEdges.push({ a: edge.a, b: edge.b, net: edge.net, identity });
	}

	// --- step 7: nonzero-winding union boundary ------------------------------
	// Directed edges with multiplicity for the winding probes.
	const directed: DirectedEdge[] = [];
	for (const edge of netEdges) {
		const direction = edge.net > 0 ? { from: edge.a, to: edge.b } : { from: edge.b, to: edge.a };
		const repeat = Math.abs(edge.net);
		for (let index = 0; index < repeat; index += 1) {
			directed.push({ ...direction, identity: edge.identity });
		}
	}
	const windingGrid = buildWindingGrid(vertices, directed);

	const windingAt = (x: number, z: number): number =>
		windingNumber(vertices, directed, windingGrid, x, z);

	const kept: DirectedEdge[] = [];
	for (const edge of netEdges) {
		const a = vertices[edge.a]!;
		const b = vertices[edge.b]!;
		const dx = b.x - a.x;
		const dz = b.z - a.z;
		const length = Math.hypot(dx, dz);
		if (length <= EPSILON) continue;
		const direction = edge.net > 0 ? { from: edge.a, to: edge.b } : { from: edge.b, to: edge.a };
		const start = vertices[direction.from]!;
		const end = vertices[direction.to]!;
		const ex = end.x - start.x;
		const ez = end.z - start.z;
		const exLength = Math.hypot(ex, ez);
		const midX = (start.x + end.x) / 2;
		const midZ = (start.z + end.z) / 2;
		// The left normal of `(dx, dz)` in the plan `(x, z)` frame is `(-dz, dx)`.
		const leftX = -ez / exLength;
		const leftZ = ex / exLength;
		const offset = 1e-6;
		const right = windingAt(midX - leftX * offset, midZ - leftZ * offset);
		const left = windingAt(midX + leftX * offset, midZ + leftZ * offset);
		const rightInside = right !== 0;
		const leftInside = left !== 0;
		if (rightInside === leftInside) continue;
		if (leftInside) kept.push({ from: direction.from, to: direction.to, identity: edge.identity });
		else kept.push({ from: direction.to, to: direction.from, identity: edge.identity });
	}

	// **Validity is checked on the union boundary, not on the raw net edges.**
	// The builder deliberately leaves an interface face on one side of a T (the
	// stem's end is interior to the through Wall's material), so the raw surface
	// set can carry an unpaired internal diaphragm. That diaphragm has winding on
	// both sides and is dropped by step 7; it is not an open solid. A genuinely
	// open input leaves its boundary unmatched *after* the union, which is the
	// defect this check must report.
	const balance = new Map<number, number>();
	for (const edge of kept) {
		balance.set(edge.from, (balance.get(edge.from) ?? 0) + 1);
		balance.set(edge.to, (balance.get(edge.to) ?? 0) - 1);
	}
	let unmatched = 0;
	for (const value of balance.values()) if (Math.abs(value) > 1e-9) unmatched += 1;
	const issues: CapAssemblyIssue[] = [];
	if (unmatched > 0) {
		issues.push({
			group,
			identity: inputs[0]?.identity ?? null,
			unmatchedVertices: unmatched
		});
	}

	// Paper's stitch: at a touching point, turn clockwise from the way back.
	const outgoing = new Map<number, number[]>();
	kept.forEach((edge, index) => {
		const list = outgoing.get(edge.from);
		if (list === undefined) outgoing.set(edge.from, [index]);
		else list.push(index);
	});

	function nextEdge(incomingIndex: number): number | null {
		const incoming = kept[incomingIndex]!;
		const vertex = vertices[incoming.to]!;
		const previous = vertices[incoming.from]!;
		const back = Math.atan2(previous.z - vertex.z, previous.x - vertex.x);
		let best: number | null = null;
		let bestTurn = Infinity;
		for (const candidate of outgoing.get(incoming.to) ?? []) {
			const edge = kept[candidate]!;
			const target = vertices[edge.to]!;
			const forward = Math.atan2(target.z - vertex.z, target.x - vertex.x);
			let turn = (back - forward) % (Math.PI * 2);
			if (turn < 0) turn += Math.PI * 2;
			if (turn <= 1e-12) turn = Math.PI * 2;
			if (turn < bestTurn) {
				best = candidate;
				bestTurn = turn;
			}
		}
		return best;
	}

	const used = new Array<boolean>(kept.length).fill(false);
	const loops: SectionLoop[] = [];
	const openChains: SectionChain[] = [];
	for (let first = 0; first < kept.length; first += 1) {
		if (used[first]) continue;
		const pointList: SectionPoint[] = [];
		const edgeList: SectionEdge[] = [];
		let current = first;
		let closed = false;
		for (;;) {
			if (used[current]) break;
			used[current] = true;
			const edge = kept[current]!;
			pointList.push({ u: vertices[edge.from]!.x, v: vertices[edge.from]!.z });
			edgeList.push({ identity: edge.identity });
			const next = nextEdge(current);
			if (next === null) break;
			if (next === first) {
				closed = true;
				break;
			}
			current = next;
		}
		if (closed && pointList.length >= 3) {
			loops.push({ points: pointList, edges: edgeList, hole: false, outerIndex: -1 });
		} else if (pointList.length >= 2) {
			// The final chain edge ends where the walk stopped.
			const last = kept[current]!;
			pointList.push({ u: vertices[last.to]!.x, v: vertices[last.to]!.z });
			openChains.push({ points: pointList, edges: edgeList });
		}
	}

	// Outer rings are counter-clockwise, holes clockwise; each hole belongs to
	// the smallest outer that contains it.
	const classified: SectionLoop[] = loops.map((loop) => {
		const area = signedArea(loop.points);
		return area >= 0
			? loop
			: { ...loop, hole: true };
	});
	const outers = classified.filter((loop) => !loop.hole);
	const holes = classified.filter((loop) => loop.hole);
	const withParents: SectionLoop[] = outers.map((loop) => ({ ...loop, outerIndex: -1 }));
	for (const hole of holes) {
		const probe = midpointOf(hole.points);
		let parent = -1;
		let parentArea = Infinity;
		outers.forEach((outer, index) => {
			const area = Math.abs(signedArea(outer.points));
			if (area < parentArea && pointInRing(probe, outer.points)) {
				parent = index;
				parentArea = area;
			}
		});
		withParents.push({ ...hole, outerIndex: parent });
	}

	return { loops: withParents, openChains, issues };
}

function signedArea(points: readonly SectionPoint[]): number {
	let twice = 0;
	for (let index = 0; index < points.length; index += 1) {
		const a = points[index]!;
		const b = points[(index + 1) % points.length]!;
		twice += a.u * b.v - b.u * a.v;
	}
	return twice / 2;
}

function midpointOf(points: readonly SectionPoint[]): SectionPoint {
	const a = points[0]!;
	const b = points[1] ?? points[0]!;
	return { u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 };
}

function pointInRing(point: SectionPoint, ring: readonly SectionPoint[]): boolean {
	let inside = false;
	for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
		const current = ring[index]!;
		const prior = ring[previous]!;
		const crosses =
			(current.v > point.v) !== (prior.v > point.v) &&
			point.u <
				((prior.u - current.u) * (point.v - current.v)) / (prior.v - current.v) + current.u;
		if (crosses) inside = !inside;
	}
	return inside;
}

/** A y-strip bucket of the directed edges, so a winding probe scans one strip. */
type WindingGrid = {
	readonly cell: number;
	readonly buckets: Map<number, number[]>;
};

function buildWindingGrid(vertices: readonly Vertex[], edges: readonly DirectedEdge[]): WindingGrid {
	let minZ = Infinity;
	let maxZ = -Infinity;
	for (const edge of edges) {
		minZ = Math.min(minZ, vertices[edge.from]!.z, vertices[edge.to]!.z);
		maxZ = Math.max(maxZ, vertices[edge.from]!.z, vertices[edge.to]!.z);
	}
	const cell = Math.max(0.25, (maxZ - minZ) / Math.max(1, Math.sqrt(edges.length)));
	const buckets = new Map<number, number[]>();
	edges.forEach((edge, index) => {
		const a = vertices[edge.from]!;
		const b = vertices[edge.to]!;
		const low = Math.floor(Math.min(a.z, b.z) / cell);
		const high = Math.floor(Math.max(a.z, b.z) / cell);
		for (let strip = low; strip <= high; strip += 1) {
			const bucket = buckets.get(strip);
			if (bucket === undefined) buckets.set(strip, [index]);
			else bucket.push(index);
		}
	});
	return { cell, buckets };
}

/**
 * The nonzero winding number of the directed section edges about a plan point.
 * A horizontal +U ray; edges are visited only from their own y-strip.
 */
function windingNumber(
	vertices: readonly Vertex[],
	edges: readonly DirectedEdge[],
	grid: WindingGrid,
	x: number,
	z: number
): number {
	const bucket = grid.buckets.get(Math.floor(z / grid.cell));
	if (bucket === undefined) return 0;
	let winding = 0;
	for (const index of bucket) {
		const edge = edges[index]!;
		const a = vertices[edge.from]!;
		const b = vertices[edge.to]!;
		const side = (b.x - a.x) * (z - a.z) - (x - a.x) * (b.z - a.z);
		if (a.z <= z) {
			if (b.z > z && side > 0) winding += 1;
		} else if (b.z <= z && side < 0) {
			winding -= 1;
		}
	}
	return winding;
}
