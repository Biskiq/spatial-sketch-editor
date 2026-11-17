/**
 * The cap: a plane section of what is actually drawn.
 *
 * Pure typed-array maths — no Three, no Svelte, no editor state — so the whole
 * assembly can be exercised over real builder output in a unit lane. The Stage
 * feeds it the **rendered** meshes it already owns (found by identity tag, exactly
 * as the selection layer finds its contours) and draws the loops it returns.
 *
 * ## Why the assembly is not "chain the per-mesh segments"
 *
 * Endpoint welding alone does not close a contour:
 *
 * - at a **T Junction** the stem's side faces end at points that lie on (not at
 *   the ends of) the through-Wall's split face;
 * - at **X and Y Junctions** keel faces meet several Walls;
 * - two coincident faces can run in opposite directions;
 * - overlapping, not-joined Walls cross each other.
 *
 * Per-Wall meshes are also open at their Junction ends by design. The assembly
 * therefore works on the **group's union** in seven fixed steps:
 *
 * 1. **Groups.** One structure group for every Wall-owned mesh (Walls, bridges and
 *    keels are together the closed solid the builder resolved), one group per
 *    Layout object. A plinth flush against a Wall therefore never cancels the
 *    Wall's boundary.
 * 2. **Section offset.** The caller offsets the plane by 0.1 mm toward the solid
 *    (see `SectionPlane.sectionOffsetMeters`) so a cut exactly on a horizontal
 *    face — the common case, because Sheet ticks snap to sills, heads and Wall
 *    tops — makes every triangle either straddle or not, with no coplanar or
 *    vertex-on-plane degeneracy.
 * 3. **Oriented segments.** Each straddling triangle yields one segment, oriented
 *    so the solid is on its left in the plane's own 2D frame.
 * 4. **Weld** endpoints in a spatial hash with tolerance τ.
 * 5. **Split** every segment at every welded vertex lying within τ of its interior
 *    (T-vertices) and at every proper crossing with another segment of the group.
 * 6. **Net multiplicity.** Merge equal undirected edges, summing `+1`/`−1`. Net
 *    zero (two coincident opposite faces) is dropped; net `±k` is kept.
 * 7. **Union boundary.** For each net edge compute the nonzero winding on its right
 *    by a horizontal probe against the group's net edges, bucketed by v-strip; the
 *    winding on its left is right + net. Keep the edge iff exactly one side is
 *    zero, then stitch with Paper's rule (at a touching point turn clockwise from
 *    the way back). Counter-clockwise loops are outers, clockwise loops are holes.
 *
 * **Validity is checked, not assumed.** Before step 7 every vertex must balance
 * (net in = net out). A closed input always balances after steps 4–6; an imbalance
 * means the input was genuinely open, and is reported as a `CapAssemblyIssue`
 * rather than hidden behind a fallback. The caller draws the edges it has and
 * reports the issue loudly.
 */

export type SectionPoint = readonly [number, number];

export type SectionVec3 = readonly [number, number, number];

/**
 * The plane to section, with the kept half-space stated once: a point is kept iff
 * `normal · p + constant ≥ 0`.
 *
 * `sectionOffsetMeters` moves the plane **into the kept half-space** by that
 * distance before straddling is tested; the returned loops are still in the drawn
 * plane's frame (the caller draws at the GPU plane, 0.1 mm above the section).
 * Three's own clipping keeps `normal · p + constant ≥ 0`, so one sign convention
 * is shared with the GPU planes.
 */
export type SectionPlane = {
	readonly normal: SectionVec3;
	readonly constant: number;
	readonly sectionOffsetMeters?: number;
};

export type SectionInput = {
	/** The identity the drawn edge attributes to (e.g. `wall:w-1`). */
	readonly identity: string;
	/** The assembly group; defaults to the identity. Walls share `'structure'`. */
	readonly group?: string;
	/** Local-space XYZ positions. */
	readonly positions: ArrayLike<number>;
	/** Optional triangle indices into `positions`. */
	readonly index?: ArrayLike<number> | null;
	/** Optional world matrix (16, column-major, Three's `.elements`). */
	readonly matrix?: ArrayLike<number> | null;
	/** Optional world AABB, for the broad phase. */
	readonly bounds?: { readonly min: SectionVec3; readonly max: SectionVec3 } | null;
};

export type SectionLoop = {
	/** Counter-clockwise loops are outers, clockwise loops are holes. */
	readonly role: 'outer' | 'hole';
	/** Plane-local metres, in the basis `SectionResult` returns. */
	readonly points: readonly SectionPoint[];
	/** One identity per edge: edge `i` runs `points[i] → points[i+1]`. */
	readonly edgeIdentities: readonly string[];
	readonly signedArea: number;
};

export type SectionChain = {
	readonly points: readonly SectionPoint[];
	readonly edgeIdentities: readonly string[];
};

/** A group that did not balance: its input was open. */
export type CapAssemblyIssue = {
	readonly group: string;
	readonly identity: string;
	readonly unmatchedVertices: number;
};

export type SectionGroupResult = {
	readonly group: string;
	readonly loops: readonly SectionLoop[];
	readonly chains: readonly SectionChain[];
	readonly issue: CapAssemblyIssue | null;
	/** Every identity that contributed a drawn edge or fill to this group. */
	readonly identities: readonly string[];
};

/** The plane's frame: `world = origin + u * U + v * V`, and `(U, V, normal)` is right-handed. */
export type SectionBasis = {
	readonly normal: SectionVec3;
	readonly origin: SectionVec3;
	readonly u: SectionVec3;
	readonly v: SectionVec3;
};

export type SectionResult = {
	readonly groups: readonly SectionGroupResult[];
	readonly issues: readonly CapAssemblyIssue[];
	readonly basis: SectionBasis;
	/** How many triangles the broad phase and straddle test considered. */
	readonly candidateTriangles: number;
};

export type SectionOptions = {
	/** Weld tolerance in metres. Half the section offset, by default. */
	readonly weldToleranceMeters?: number;
	/** Hard cap on triangles read, for a bounded worst case. */
	readonly maxCandidateTriangles?: number;
};

/** The default weld tolerance: half the 0.1 mm section offset. */
export const SECTION_WELD_TOLERANCE_METERS = 5e-5;
/** The default offset toward the solid. */
export const SECTION_OFFSET_METERS = 1e-4;

type Vec3 = [number, number, number];

function dot(a: SectionVec3, b: SectionVec3): number {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: SectionVec3, b: SectionVec3): Vec3 {
	return [
		a[1] * b[2] - a[2] * b[1],
		a[2] * b[0] - a[0] * b[2],
		a[0] * b[1] - a[1] * b[0]
	];
}

function normalize(v: SectionVec3): Vec3 {
	const length = Math.hypot(v[0], v[1], v[2]);
	return length > 0 ? [v[0] / length, v[1] / length, v[2] / length] : [0, 1, 0];
}

/** An orthonormal basis with `U × V = normal`. */
function basisOf(normal: SectionVec3, constant: number): SectionBasis {
	const n = normalize(normal);
	const helper: SectionVec3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
	const u = normalize(cross(helper, n));
	const v = cross(n, u);
	const d = -constant;
	const origin: Vec3 = [n[0] * d, n[1] * d, n[2] * d];
	return { normal: n, origin, u, v };
}

const GEOMETRY_EPSILON = 1e-9;
/** How many split passes a group may take before it is reported as unruly. */
const SPLIT_PASS_LIMIT = 4;

/** A spatial hash of the group's welded 2D vertices. */
class Welder {
	readonly points: SectionPoint[] = [];
	readonly #cells = new Map<string, number[]>();
	readonly #cell: number;

	constructor(cell: number) {
		this.#cell = cell;
	}

	#key(cx: number, cz: number): string {
		return `${cx},${cz}`;
	}

	add(point: SectionPoint): number {
		const cx = Math.floor(point[0] / this.#cell);
		const cz = Math.floor(point[1] / this.#cell);
		for (let ix = cx - 1; ix <= cx + 1; ix += 1) {
			for (let iz = cz - 1; iz <= cz + 1; iz += 1) {
				for (const id of this.#cells.get(this.#key(ix, iz)) ?? []) {
					const known = this.points[id]!;
					if (Math.hypot(known[0] - point[0], known[1] - point[1]) <= this.#cell) return id;
				}
			}
		}
		const id = this.points.length;
		this.points.push(point);
		const key = this.#key(cx, cz);
		const cell = this.#cells.get(key);
		if (cell === undefined) this.#cells.set(key, [id]);
		else cell.push(id);
		return id;
	}
}

/** One oriented section segment, endpoints welded. */
type Segment = {
	a: number;
	b: number;
	identity: string;
};

type NetEdge = {
	a: number;
	b: number;
	/** Signed multiplicity along a → b. */
	net: number;
	/** The identity with the largest contribution on its solid side. */
	identity: string;
};

function signedArea(points: readonly SectionPoint[]): number {
	let twice = 0;
	for (let index = 0; index < points.length; index += 1) {
		const a = points[index]!;
		const b = points[(index + 1) % points.length]!;
		twice += a[0] * b[1] - a[1] * b[0];
	}
	return twice / 2;
}

function pointInPolygon2(point: SectionPoint, ring: readonly SectionPoint[]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const a = ring[i]!;
		const b = ring[j]!;
		const crosses =
			a[1] > point[1] !== b[1] > point[1] &&
			point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
		if (crosses) inside = !inside;
	}
	return inside;
}

/** Classic winding number of `point` against directed weighted edges. */
class WindingIndex {
	readonly #points: readonly SectionPoint[];
	readonly #edges: readonly NetEdge[];
	readonly #strips: number[][];
	readonly #minV: number;
	readonly #stripHeight: number;

	constructor(points: readonly SectionPoint[], edges: readonly NetEdge[]) {
		this.#points = points;
		this.#edges = edges;
		let minV = Infinity;
		let maxV = -Infinity;
		for (const point of points) {
			if (point[1] < minV) minV = point[1];
			if (point[1] > maxV) maxV = point[1];
		}
		if (!(minV <= maxV)) {
			minV = 0;
			maxV = 0;
		}
		const stripCount = Math.max(1, Math.min(128, Math.ceil(Math.sqrt(Math.max(1, edges.length)))));
		this.#minV = minV;
		this.#stripHeight = Math.max(1e-6, (maxV - minV) / stripCount);
		this.#strips = Array.from({ length: stripCount + 1 }, () => []);
		edges.forEach((edge, index) => {
			const a = points[edge.a]!;
			const b = points[edge.b]!;
			const first = this.#stripOf(Math.min(a[1], b[1]));
			const last = this.#stripOf(Math.max(a[1], b[1]));
			for (let strip = first; strip <= last; strip += 1) this.#strips[strip]!.push(index);
		});
	}

	#stripOf(v: number): number {
		const raw = Math.floor((v - this.#minV) / this.#stripHeight);
		return Math.max(0, Math.min(this.#strips.length - 1, raw));
	}

	at(point: SectionPoint): number {
		let winding = 0;
		for (const index of this.#strips[this.#stripOf(point[1])] ?? []) {
			const edge = this.#edges[index]!;
			const a = this.#points[edge.a]!;
			const b = this.#points[edge.b]!;
			const weight = Math.abs(edge.net);
			const left = (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
			if (a[1] <= point[1]) {
				if (b[1] > point[1] && left > 0) winding += weight;
			} else if (b[1] <= point[1] && left < 0) {
				winding -= weight;
			}
		}
		return winding;
	}
}

/** Transform one local position by an optional column-major matrix. */
function worldPoint(
	x: number,
	y: number,
	z: number,
	matrix: ArrayLike<number> | null | undefined
): Vec3 {
	if (matrix == null) return [x, y, z];
	const e = matrix;
	return [
		e[0]! * x + e[4]! * y + e[8]! * z + e[12]!,
		e[1]! * x + e[5]! * y + e[9]! * z + e[13]!,
		e[2]! * x + e[6]! * y + e[10]! * z + e[14]!
	];
}

type LocalTriangle = {
	/** Plane-local (u, v) per vertex. */
	readonly local: readonly [SectionPoint, SectionPoint, SectionPoint];
	/** Signed distance per vertex: kept iff ≥ 0. */
	readonly distance: readonly [number, number, number];
	/** The triangle's outward geometric normal, in world space. */
	readonly normal: SectionVec3;
};

export function sectionMeshes(
	inputs: readonly SectionInput[],
	plane: SectionPlane,
	options: SectionOptions = {}
): SectionResult {
	const offset = plane.sectionOffsetMeters ?? SECTION_OFFSET_METERS;
	// Moving the plane into the kept half-space means lowering the constant.
	const constant = plane.constant - offset;
	const basis = basisOf(plane.normal, constant);
	const weld = options.weldToleranceMeters ?? Math.max(SECTION_WELD_TOLERANCE_METERS, offset / 2);
	const maxTriangles = options.maxCandidateTriangles ?? Number.POSITIVE_INFINITY;

	// Step 1 — groups, in first-appearance order.
	const order: string[] = [];
	const byGroup = new Map<string, SectionInput[]>();
	for (const input of inputs) {
		const group = input.group ?? input.identity;
		const list = byGroup.get(group);
		if (list === undefined) {
			byGroup.set(group, [input]);
			order.push(group);
		} else list.push(input);
	}

	let candidateTriangles = 0;
	const groups: SectionGroupResult[] = [];
	const issues: CapAssemblyIssue[] = [];

	for (const group of order) {
		const members = byGroup.get(group)!;
		const welder = new Welder(weld);
		const segments: Segment[] = [];
		const identities: string[] = [];

		for (const input of members) {
			if (candidateTriangles >= maxTriangles) break;
			// Broad phase: a mesh whose whole world box is on one side of the plane
			// contributes nothing to the section.
			if (input.bounds != null) {
				const { min, max } = input.bounds;
				let lowest = Infinity;
				let highest = -Infinity;
				for (let corner = 0; corner < 8; corner += 1) {
					const point: Vec3 = [
						corner & 1 ? max[0] : min[0],
						corner & 2 ? max[1] : min[1],
						corner & 4 ? max[2] : min[2]
					];
					const distance = dot(basis.normal, point) + constant;
					if (distance < lowest) lowest = distance;
					if (distance > highest) highest = distance;
				}
				if (lowest >= 0 || highest < 0) continue;
			}
			const positions = input.positions;
			const index = input.index ?? null;
			const count = Math.floor((index == null ? positions.length / 3 : index.length) / 3);
			identities.push(input.identity);
			for (let triangle = 0; triangle < count; triangle += 1) {
				if (candidateTriangles >= maxTriangles) break;
				candidateTriangles += 1;
				const ia = index == null ? triangle * 3 : index[triangle * 3]!;
				const ib = index == null ? triangle * 3 + 1 : index[triangle * 3 + 1]!;
				const ic = index == null ? triangle * 3 + 2 : index[triangle * 3 + 2]!;
				// Written out rather than mapped: this loop runs over every candidate
				// triangle of every group, and three throwaway arrays per triangle were a
				// fifth of the assembly's time (profiled on the eleven-Room fixture).
				const w0 = worldPoint(positions[ia * 3]!, positions[ia * 3 + 1]!, positions[ia * 3 + 2]!, input.matrix);
				const w1 = worldPoint(positions[ib * 3]!, positions[ib * 3 + 1]!, positions[ib * 3 + 2]!, input.matrix);
				const w2 = worldPoint(positions[ic * 3]!, positions[ic * 3 + 1]!, positions[ic * 3 + 2]!, input.matrix);
				const l0: SectionPoint = [dot(w0, basis.u), dot(w0, basis.v)];
				const l1: SectionPoint = [dot(w1, basis.u), dot(w1, basis.v)];
				const l2: SectionPoint = [dot(w2, basis.u), dot(w2, basis.v)];
				const d0 = dot(basis.normal, w0) + constant;
				const d1 = dot(basis.normal, w1) + constant;
				const d2 = dot(basis.normal, w2) + constant;
				const min = Math.min(d0, d1, d2);
				const max = Math.max(d0, d1, d2);
				// Wholly kept or wholly discarded: no crossing, no section.
				if (min >= 0 || max < 0) continue;
				const edge1: Vec3 = [w1[0] - w0[0], w1[1] - w0[1], w1[2] - w0[2]];
				const edge2: Vec3 = [w2[0] - w0[0], w2[1] - w0[1], w2[2] - w0[2]];
				const normal = cross(edge1, edge2);
				if (Math.hypot(normal[0], normal[1], normal[2]) <= GEOMETRY_EPSILON) continue;
				// Solid on the left: direction = n × t, in the right-handed (u, v, n) frame.
				const direction = cross(basis.normal, normalize(normal));
				const localDirection: SectionPoint = [dot(direction, basis.u), dot(direction, basis.v)];

				const crossings: SectionPoint[] = [];
				for (let edge = 0; edge < 3; edge += 1) {
					const first = edge;
					const second = (edge + 1) % 3;
					const dFirst = edge === 0 ? d0 : edge === 1 ? d1 : d2;
					const dSecond = edge === 0 ? d1 : edge === 1 ? d2 : d0;
					if (dFirst >= 0 && dSecond >= 0) continue;
					if (dFirst < 0 && dSecond < 0) continue;
					const t = dFirst / (dFirst - dSecond);
					if (!Number.isFinite(t)) continue;
					const a = edge === 0 ? l0 : edge === 1 ? l1 : l2;
					const b = edge === 0 ? l1 : edge === 1 ? l2 : l0;
					crossings.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
				}
				if (crossings.length !== 2) continue;
				let [start, end] = crossings as [SectionPoint, SectionPoint];
				if (Math.hypot(end[0] - start[0], end[1] - start[1]) <= GEOMETRY_EPSILON) continue;
				const along =
					(end[0] - start[0]) * localDirection[0] + (end[1] - start[1]) * localDirection[1];
				if (along < 0) [start, end] = [end, start];
				const a = welder.add(start);
				const b = welder.add(end);
				if (a === b) continue;
				segments.push({ a, b, identity: input.identity });
			}
		}

		groups.push(assembleGroup(group, welder, segments, identities, weld));
	}

	for (const group of groups) if (group.issue !== null) issues.push(group.issue);
	return { groups, issues, basis, candidateTriangles };
}

/** Steps 5–7 for one group. */
function assembleGroup(
	group: string,
	welder: Welder,
	segments: Segment[],
	identities: string[],
	tolerance: number
): SectionGroupResult {
	const points = welder.points;
	// Step 5 — split at welded vertices on a segment's interior (T-vertices) and at
	// proper crossings. Both create new welded vertices, and a point created by one
	// can lie on a third segment's interior (three faces meeting at a door jamb, a
	// keel point, a corner), so the pass repeats until it adds nothing.
	let split: readonly Segment[] = segments;
	for (let pass = 0; pass < SPLIT_PASS_LIMIT; pass += 1) {
		const next = splitPass(split, points, welder, tolerance);
		split = next.segments;
		if (!next.added) break;
	}

	// Step 6 — net multiplicity per undirected edge.
	type Net = { a: number; b: number; net: number; contributions: Map<string, number> };
	const nets = new Map<string, Net>();
	for (const segment of split) {
		if (segment.a === segment.b) continue;
		const forward = segment.a < segment.b;
		const a = forward ? segment.a : segment.b;
		const b = forward ? segment.b : segment.a;
		const edgeKey = `${a}:${b}`;
		let net = nets.get(edgeKey);
		if (net === undefined) {
			net = { a, b, net: 0, contributions: new Map() };
			nets.set(edgeKey, net);
		}
		net.net += forward ? 1 : -1;
		net.contributions.set(segment.identity, (net.contributions.get(segment.identity) ?? 0) + (forward ? 1 : -1));
	}
	const keptNets: NetEdge[] = [];
	for (const net of nets.values()) {
		if (net.net === 0) continue;
		let identity = '';
		let best = -Infinity;
		for (const [candidate, contribution] of net.contributions) {
			if (Math.abs(contribution) > best) {
				best = Math.abs(contribution);
				identity = candidate;
			}
		}
		keptNets.push({
			a: net.net > 0 ? net.a : net.b,
			b: net.net > 0 ? net.b : net.a,
			net: net.net,
			identity
		});
	}

	// Balance: net in must equal net out at every vertex, or the input was open.
	const balance = new Map<number, number>();
	for (const edge of keptNets) {
		const weight = Math.abs(edge.net);
		balance.set(edge.a, (balance.get(edge.a) ?? 0) + weight);
		balance.set(edge.b, (balance.get(edge.b) ?? 0) - weight);
	}
	let unmatched = 0;
	for (const value of balance.values()) if (value !== 0) unmatched += 1;
	if (unmatched > 0) {
		// Draw what there is (open chains), and say so: never silent, never throws.
		const chains = openChains(points, keptNets);
		return {
			group,
			loops: [],
			chains,
			issue: { group, identity: identities[0] ?? group, unmatchedVertices: unmatched },
			identities: [...new Set(identities)]
		};
	}

	// Step 7 — union boundary, then loops.
	const winding = new WindingIndex(points, keptNets);
	const boundary: NetEdge[] = [];
	for (const edge of keptNets) {
		const a = points[edge.a]!;
		const b = points[edge.b]!;
		const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
		if (!(length > 0)) continue;
		const dx = (b[0] - a[0]) / length;
		const dz = (b[1] - a[1]) / length;
		const probeOffset = Math.min(Math.max(10 * tolerance, length * 0.01), length * 0.25);
		// Right of a → b is (dz, -dx).
		const probe: SectionPoint = [
			(a[0] + b[0]) / 2 + dz * probeOffset,
			(a[1] + b[1]) / 2 - dx * probeOffset
		];
		const right = winding.at(probe);
		// The emitted direction is the majority direction, so crossing it from right
		// to left adds its multiplicity — the sign of `net` is bookkeeping only.
		const left = right + Math.abs(edge.net);
		if (right !== 0 && left !== 0) continue;
		if (right === 0) boundary.push(edge);
		else boundary.push({ ...edge, a: edge.b, b: edge.a, net: -edge.net });
	}

	const loops = stitch(points, boundary);
	if (keptNets.length > 0 && boundary.length === 0) {
		// The winding probe is offset by ~10 weld tolerances, so a feature narrower
		// than that (a cut within a millimetre of an arch apex) resolves to nothing.
		// Draw nothing rather than something wrong, and say so.
		return {
			group,
			loops: [],
			chains: [],
			issue: { group, identity: identities[0] ?? group, unmatchedVertices: 0 },
			identities: [...new Set(identities)]
		};
	}
	if (boundary.length > 0 && loops.length === 0) {
		return {
			group,
			loops: [],
			chains: openChains(points, boundary),
			issue: { group, identity: identities[0] ?? group, unmatchedVertices: boundary.length },
			identities: [...new Set(boundary.map((edge) => edge.identity))]
		};
	}
	return {
		group,
		loops: loops.sort((a, b) => (a.role === b.role ? 0 : a.role === 'outer' ? -1 : 1)),
		chains: [],
		issue: null,
		identities: [...new Set(boundary.map((edge) => edge.identity))]
	};
}

/**
 * One split pass over a group's segments: T-vertices first, then proper crossings.
 * Returns the split set and whether it split anything, so the caller can repeat.
 */
function splitPass(
	segments: readonly Segment[],
	points: readonly SectionPoint[],
	welder: Welder,
	tolerance: number
): { segments: readonly Segment[]; added: boolean } {
	if (segments.length === 0) return { segments: [], added: false };
	const extra: number[][] = segments.map(() => []);
	// The grid is a broad phase, not the weld tolerance: a 2 cm cell made a 6 m Wall
	// span 300 cells, and nearly all of the split pass was map churn. A quarter-metre
	// cell still covers every endpoint/crossing (bounds are expanded by tolerance),
	// while cutting the cell count by an order of magnitude.
	const cell = Math.max(0.25, tolerance * 8);
	const key = (x: number, z: number): string => `${x},${z}`;
	const cellsOfSegment = (segment: Segment): [number, number, number, number] => {
		const a = points[segment.a]!;
		const b = points[segment.b]!;
		return [
			Math.floor((Math.min(a[0], b[0]) - tolerance) / cell),
			Math.floor((Math.max(a[0], b[0]) + tolerance) / cell),
			Math.floor((Math.min(a[1], b[1]) - tolerance) / cell),
			Math.floor((Math.max(a[1], b[1]) + tolerance) / cell)
		];
	};
	// One cell span per segment, reused by the grid and by the T-vertex walk (it was
	// computed twice per segment per split pass).
	const segmentBounds = segments.map(cellsOfSegment);
	const segmentCells = new Map<string, number[]>();
	segments.forEach((segment, index) => {
		const [x0, x1, z0, z1] = segmentBounds[index]!;
		for (let x = x0; x <= x1; x += 1) {
			for (let z = z0; z <= z1; z += 1) {
				const cellKey = key(x, z);
				const list = segmentCells.get(cellKey);
				if (list === undefined) segmentCells.set(cellKey, [index]);
				else list.push(index);
			}
		}
	});

	// T-vertices: a welded vertex that is an endpoint of some segment, lying on
	// another segment's interior.
	const endpointIds = new Set<number>();
	for (const segment of segments) {
		endpointIds.add(segment.a);
		endpointIds.add(segment.b);
	}
	let anyExtra = false;
	const pointCells = new Map<string, number[]>();
	for (const id of endpointIds) {
		const point = points[id]!;
		const cellKey = key(Math.floor(point[0] / cell), Math.floor(point[1] / cell));
		const list = pointCells.get(cellKey);
		if (list === undefined) pointCells.set(cellKey, [id]);
		else list.push(id);
	}
	segments.forEach((segment, index) => {
		const [x0, x1, z0, z1] = segmentBounds[index]!;
		const seen = new Set<number>();
		for (let x = x0; x <= x1; x += 1) {
			for (let z = z0; z <= z1; z += 1) {
				for (const id of pointCells.get(key(x, z)) ?? []) {
					if (seen.has(id)) continue;
					seen.add(id);
					if (id === segment.a || id === segment.b) continue;
					const amount = amountAlong(segment, id, points, tolerance);
					if (amount === null || amount <= 0 || amount >= 1) continue;
					extra[index]!.push(amount);
					anyExtra = true;
				}
			}
		}
	});

	// Proper crossings, cell by cell: no all-pairs pass.
	const tested = new Set<string>();
	for (const list of segmentCells.values()) {
		for (let i = 0; i < list.length; i += 1) {
			for (let j = i + 1; j < list.length; j += 1) {
				const first = list[i]!;
				const second = list[j]!;
				const pairKey = first < second ? `${first}:${second}` : `${second}:${first}`;
				if (tested.has(pairKey)) continue;
				tested.add(pairKey);
				const crossing = properCrossing(segments[first]!, segments[second]!, points);
				if (crossing === null) continue;
				extra[first]!.push(crossing.first);
				extra[second]!.push(crossing.second);
				anyExtra = true;
			}
		}
	}
	// The common case is a group whose section already meets at existing vertices:
	// no T-vertex or crossing was found. Every segment and endpoint was welded on
	// construction, so returning the input avoids re-welding the whole group.
	if (!anyExtra) return { segments, added: false };

	let added = false;
	const next: Segment[] = [];
	segments.forEach((segment, index) => {
		const amounts = [...new Set([...extra[index]!, 0, 1].filter((amount) => amount >= 0 && amount <= 1))];
		amounts.sort((a, b) => a - b);
		if (amounts.length > 2) added = true;
		let previous = welder.add(points[segment.a]!);
		for (const amount of amounts) {
			if (amount === 0) continue;
			const a = points[segment.a]!;
			const b = points[segment.b]!;
			const at: SectionPoint = [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
			const id = amount >= 1 ? welder.add(points[segment.b]!) : welder.add(at);
			if (id !== previous) next.push({ a: previous, b: id, identity: segment.identity });
			previous = id;
		}
	});
	return { segments: next, added };
}

/** Where on `segment` the welded vertex `id` sits, or null when it is not on it. */
function amountAlong(
	segment: Segment,
	id: number,
	points: readonly SectionPoint[],
	tolerance: number
): number | null {
	const a = points[segment.a]!;
	const b = points[segment.b]!;
	const point = points[id]!;
	const dx = b[0] - a[0];
	const dz = b[1] - a[1];
	const lengthSquared = dx * dx + dz * dz;
	if (!(lengthSquared > 0)) return null;
	const amount = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / lengthSquared;
	if (!Number.isFinite(amount)) return null;
	const nearest: SectionPoint = [a[0] + dx * amount, a[1] + dz * amount];
	const distance = Math.hypot(nearest[0] - point[0], nearest[1] - point[1]);
	// The vertex must actually lie on the segment, within the weld tolerance.
	return distance <= Math.max(tolerance, Math.hypot(dx, dz) * 1e-6) ? amount : null;
}

function properCrossing(
	first: Segment,
	second: Segment,
	points: readonly SectionPoint[]
): { first: number; second: number } | null {
	if (first.a === second.a || first.a === second.b || first.b === second.a || first.b === second.b) {
		return null;
	}
	const p = points[first.a]!;
	const q = points[first.b]!;
	const r = points[second.a]!;
	const s = points[second.b]!;
	const denominator = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
	if (Math.abs(denominator) <= 1e-12) return null;
	const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / denominator;
	const u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / denominator;
	if (!(t > 0 && t < 1 && u > 0 && u < 1)) return null;
	return { first: t, second: u };
}

/** Stitch directed edges into loops, turning clockwise from the way back at a branch. */
function stitch(points: readonly SectionPoint[], edges: readonly NetEdge[]): SectionLoop[] {
	const outgoing = new Map<number, number[]>();
	edges.forEach((edge, index) => {
		const list = outgoing.get(edge.a);
		if (list === undefined) outgoing.set(edge.a, [index]);
		else list.push(index);
	});
	const used = edges.map(() => false);
	const loops: SectionLoop[] = [];
	for (let first = 0; first < edges.length; first += 1) {
		if (used[first]) continue;
		const ids: number[] = [];
		const identities: string[] = [];
		let current = first;
		let closed = false;
		for (let guard = 0; guard <= edges.length; guard += 1) {
			used[current] = true;
			const edge: NetEdge = edges[current]!;
			ids.push(edge.a);
			identities.push(edge.identity);
			// The closing edge is `first` and it is already used, so it must stay a
			// candidate: filtering it out is what leaves every ring unclosed.
			const candidates = (outgoing.get(edge.b) ?? []).filter(
				(index) => index === first || !used[index]
			);
			const next = chooseNext(edge, candidates, edges, points);
			if (next === null) break;
			if (next === first) {
				closed = true;
				break;
			}
			current = next;
		}
		if (!closed || ids.length < 3) continue;
		const ring = ids.map((id) => points[id]!);
		const area = signedArea(ring);
		loops.push({
			role: area > 0 ? 'outer' : 'hole',
			points: ring,
			edgeIdentities: identities,
			signedArea: area
		});
	}
	return loops;
}

function chooseNext(
	from: NetEdge,
	candidates: readonly number[],
	edges: readonly NetEdge[],
	points: readonly SectionPoint[]
): number | null {
	if (candidates.length === 0) return null;
	if (candidates.length === 1) return candidates[0]!;
	const vertex = points[from.b]!;
	const back = Math.atan2(points[from.a]![1] - vertex[1], points[from.a]![0] - vertex[0]);
	let best: number | null = null;
	let bestTurn = Infinity;
	for (const candidate of candidates) {
		const target = points[edges[candidate]!.b]!;
		const forward = Math.atan2(target[1] - vertex[1], target[0] - vertex[0]);
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

/** Walk edges into maximal open chains (an imbalanced group still draws). */
function openChains(points: readonly SectionPoint[], edges: readonly NetEdge[]): SectionChain[] {
	const chains: SectionChain[] = [];
	const used = edges.map(() => false);
	const outgoing = new Map<number, number[]>();
	edges.forEach((edge, index) => {
		const list = outgoing.get(edge.a);
		if (list === undefined) outgoing.set(edge.a, [index]);
		else list.push(index);
	});
	for (let first = 0; first < edges.length; first += 1) {
		if (used[first]) continue;
		const ids: number[] = [];
		const identities: string[] = [];
		let current: number | null = first;
		while (current !== null) {
			used[current] = true;
			const edge: NetEdge = edges[current]!;
			if (ids.length === 0) ids.push(edge.a);
			ids.push(edge.b);
			identities.push(edge.identity);
			const next: number | undefined = (outgoing.get(edge.b) ?? []).find((index) => !used[index]);
			current = next ?? null;
		}
		if (ids.length >= 2) {
			chains.push({
				points: ids.map((id) => points[id]!),
				edgeIdentities: identities
			});
		}
	}
	return chains;
}

/** Fill polygons from loops: each outer with the holes that lie inside it. */
export function loopsToPolygons(loops: readonly SectionLoop[]): readonly {
	readonly outer: readonly SectionPoint[];
	readonly holes: readonly (readonly SectionPoint[])[];
}[] {
	const outers = loops.filter((loop) => loop.role === 'outer');
	const holes = loops.filter((loop) => loop.role === 'hole');
	const parents = outers.map(() => [] as SectionPoint[][]);
	for (const hole of holes) {
		// A point on the hole's own boundary is strictly inside the outer that
		// contains it, which is all the containment question asks.
		const probe: SectionPoint = hole.points[0]!;
		let parent = -1;
		let bestArea = Infinity;
		outers.forEach((outer, index) => {
			const area = Math.abs(outer.signedArea);
			if (area < bestArea && pointInPolygon2(probe, outer.points)) {
				parent = index;
				bestArea = area;
			}
		});
		if (parent >= 0) parents[parent]!.push(hole.points as unknown as SectionPoint[]);
	}
	return outers.map((outer, index) => ({
		outer: outer.points,
		holes: parents[index]!
	}));
}
