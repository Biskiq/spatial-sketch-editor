/**
 * X2's caps: the horizontal paper at `stubTopY` and the vertical seam faces that
 * close a cut Wall against an uncut Junction neighbour.
 *
 * The assembly is SL1's own pipeline, not a second one: the cut Walls' retained
 * mesh buffers (the same triangles the GPU draws, bridges and keels included) plus
 * the derived seam quads are welded, split, netted and unioned by `sectionMeshes`,
 * and `capFillsOf` turns the loops into fillable polygons. A group that does not
 * balance is a **cap failure**, never a silently open stub: its Walls leave the
 * effective cut set (D12) and the issue is reported.
 *
 * Cost is bounded by the plan (§11): chains are a function of (mesh identity,
 * geometry revision, stub height), so a stationary Camera and an unchanged cut set
 * rebuild nothing, and a cut-set change re-runs only the affected components.
 */
import type { CompiledJunction, CompiledPhysicalWall } from '@portfolio/layout-core';
import {
	sectionMeshes,
	type CapAssemblyIssue,
	type SectionBasis,
	type SectionInput,
	type SectionLoop
} from '../slice/mesh-plane-section';
import { cutawaySeams, type CutawaySeam } from '$lib/layout/wall-cutaway-seams';

export type CutawayComponent = {
	readonly group: string;
	readonly wallIds: readonly string[];
	readonly loops: readonly SectionLoop[];
	readonly basis: SectionBasis;
	readonly seams: readonly CutawaySeam[];
};

export type CutawayCapAssembly = {
	readonly components: readonly CutawayComponent[];
	readonly issues: readonly CapAssemblyIssue[];
	/** Walls whose component failed to close; they must stay whole. */
	readonly failedWallIds: ReadonlySet<string>;
	readonly candidateTriangles: number;
};

/** The drawn identity a Wall mesh carries (`renderIdentityOf` → `wall:<id>`). */
function wallIdOfIdentity(identity: string): string | null {
	return identity.startsWith('wall:') ? identity.slice('wall:'.length) : null;
}

/** Connected components of the cut set through shared Junctions. */
function componentsOf(
	junctions: readonly CompiledJunction[],
	cut: ReadonlySet<string>
): Map<string, string[]> {
	const parent = new Map<string, string>();
	for (const wallId of cut) parent.set(wallId, wallId);
	const find = (id: string): string => {
		let root = id;
		while (parent.get(root) !== root) root = parent.get(root)!;
		let current = id;
		while (parent.get(current) !== root) {
			const next = parent.get(current)!;
			parent.set(current, root);
			current = next;
		}
		return root;
	};
	const union = (a: string, b: string): void => {
		const rootA = find(a);
		const rootB = find(b);
		if (rootA !== rootB) parent.set(rootB, rootA);
	};
	for (const junction of junctions) {
		const cutLegs = junction.resolution.joins.filter((join) => cut.has(join.wallId));
		for (let index = 1; index < cutLegs.length; index += 1) {
			union(cutLegs[0]!.wallId, cutLegs[index]!.wallId);
		}
	}
	const byRoot = new Map<string, string[]>();
	for (const wallId of cut) {
		const root = find(wallId);
		const list = byRoot.get(root);
		if (list === undefined) byRoot.set(root, [wallId]);
		else list.push(wallId);
	}
	return byRoot;
}

/**
 * Merge contiguous collinear seams of one Wall into one segment before sectioning.
 *
 * At a T/X branch the cut end is covered by two neighbours and arrives as two
 * abutting halves. The section net wants the end edge as one segment; a vertex in
 * the middle of the Wall's own end edge is not in its mesh, so it would remain
 * unmatched. Drawing still uses the original per-neighbour faces.
 */
function mergeSectionSeams(seams: readonly CutawaySeam[]): CutawaySeam[] {
	const groups = new Map<string, CutawaySeam[]>();
	for (const seam of seams) {
		const dx = seam.to[0] - seam.from[0];
		const dz = seam.to[1] - seam.from[1];
		const length = Math.hypot(dx, dz);
		if (!(length > 1e-9)) continue;
		const ux = dx / length;
		const uz = dz / length;
		// A line key independent of direction: normal and signed offset, quantized.
		const nx = -uz;
		const nz = ux;
		const offset = Math.round((nx * seam.from[0] + nz * seam.from[1]) / 1e-5);
		const direction = Math.abs(ux) > Math.abs(uz) ? `${Math.sign(ux)}` : `z${Math.sign(uz)}`;
		const key = `${seam.wallId}|${seam.bottomY.toFixed(4)}|${seam.topY.toFixed(4)}|${direction}|${offset}`;
		const list = groups.get(key);
		if (list === undefined) groups.set(key, [seam]);
		else list.push(seam);
	}
	const merged: CutawaySeam[] = [];
	for (const group of groups.values()) {
		const first = group[0]!;
		const dx = first.to[0] - first.from[0];
		const dz = first.to[1] - first.from[1];
		const length = Math.hypot(dx, dz);
		const ux = dx / length;
		const uz = dz / length;
		const origin = first.from;
		const intervals = group
			.map((seam) => {
				const a = (seam.from[0] - origin[0]) * ux + (seam.from[1] - origin[1]) * uz;
				const b = (seam.to[0] - origin[0]) * ux + (seam.to[1] - origin[1]) * uz;
				return [Math.min(a, b), Math.max(a, b)] as const;
			})
			.sort((left, right) => left[0] - right[0]);
		let start = intervals[0]![0];
		let end = intervals[0]![1];
		const flush = (): void => {
			if (end - start <= 1e-6) return;
			merged.push({
				...first,
				from: [origin[0] + ux * start, origin[1] + uz * start],
				to: [origin[0] + ux * end, origin[1] + uz * end]
			});
		};
		for (let index = 1; index < intervals.length; index += 1) {
			const [a, b] = intervals[index]!;
			if (a <= end + 1e-6) {
				end = Math.max(end, b);
				continue;
			}
			flush();
			start = a;
			end = b;
		}
		flush();
	}
	return merged;
}

/**
 * One seam's two triangles, world-space, with the outward winding §3.5 requires.
 *
 * The quad starts at `bottomY` (1 cm below the stub, inside the solid union) and
 * runs to `topY`, so the horizontal section crosses it and the cap closes.
 */
function seamTriangles(seams: readonly CutawaySeam[]): number[] {
	const positions: number[] = [];
	const push = (point: readonly [number, number, number]): void => {
		positions.push(point[0], point[1], point[2]);
	};
	for (const seam of seams) {
		const fromBottom: [number, number, number] = [seam.from[0], seam.bottomY, seam.from[1]];
		const toBottom: [number, number, number] = [seam.to[0], seam.bottomY, seam.to[1]];
		const toTop: [number, number, number] = [seam.to[0], seam.topY, seam.to[1]];
		const fromTop: [number, number, number] = [seam.from[0], seam.topY, seam.from[1]];
		push(fromBottom);
		push(toBottom);
		push(toTop);
		push(fromBottom);
		push(toTop);
		push(fromTop);
	}
	return positions;
}

/**
 * Assemble the caps for one effective cut set.
 *
 * Returns the fillable components for drawing and, when a component does not
 * balance, the Walls that must be treated as whole. Nothing here writes session
 * state: the caller owns the failure mask and the clip's live top.
 */
export function assembleCutawayCaps(input: {
	readonly cut: ReadonlySet<string>;
	readonly stubTopY: number | null;
	readonly junctions: readonly CompiledJunction[];
	readonly walls: readonly CompiledPhysicalWall[];
	readonly floors: readonly { readonly floorId: string; readonly elevation: number }[];
	readonly sources: readonly SectionInput[];
}): CutawayCapAssembly {
	if (input.stubTopY === null || input.cut.size === 0) {
		return { components: [], issues: [], failedWallIds: new Set(), candidateTriangles: 0 };
	}
	const stubTopY = input.stubTopY;
	const elevationByFloor = new Map(input.floors.map((floor) => [floor.floorId, floor.elevation]));
	const elevationOfWall = (wallId: string): number => {
		const wall = input.walls.find((candidate) => candidate.wallId === wallId);
		return wall === undefined ? 0 : (elevationByFloor.get(wall.floorId) ?? 0);
	};
	const sourceByWall = new Map<string, SectionInput>();
	for (const source of input.sources) {
		const wallId = wallIdOfIdentity(source.identity);
		if (wallId !== null) sourceByWall.set(wallId, source);
	}

	const components: CutawayComponent[] = [];
	const issues: CapAssemblyIssue[] = [];
	const failedWallIds = new Set<string>();
	let candidateTriangles = 0;

	/** Each Wall's trim at the Junctions it touches (0 for an untrimmed core leg). */
	const trimByWall = new Map<string, number>();
	for (const junction of input.junctions) {
		for (const join of junction.resolution.joins) {
			trimByWall.set(join.wallId, Math.max(trimByWall.get(join.wallId) ?? 0, join.clipDistance ?? 0));
		}
	}

	function buildComponent(group: string, members: ReadonlySet<string>) {
		// Seams follow the **attempted** cut set: a leg dropped to whole in a
		// retry becomes the neighbour its former partner closes against.
		const seamResult = cutawaySeams({
			junctions: input.junctions,
			walls: input.walls,
			cut: members,
			stubTopY,
			elevationOfWall
		});
		const sources: SectionInput[] = [];
		for (const wallId of members) {
			const source = sourceByWall.get(wallId);
			if (source === undefined) continue;
			sources.push({
				identity: source.identity,
				group,
				positions: source.positions,
				index: source.index,
				matrix: source.matrix
			});
		}
		const seams = seamResult.seams.filter((seam) => members.has(seam.wallId));
		// Only faces across the cut Wall's end close its stub; a face that runs along
		// its side is exposed neighbour paper and would add an interior section edge.
		const seamPositions = seamTriangles(mergeSectionSeams(seams.filter((seam) => seam.closesStub)));
		if (seamPositions.length > 0) {
			sources.push({ identity: `cutaway-seam:${group}`, group, positions: seamPositions });
		}
		if (sources.length === 0) return null;
		const result = sectionMeshes(sources, { normal: [0, -1, 0], constant: stubTopY });
		return { result, groupResult: result.groups[0], seams };
	}

	for (const [root, wallIds] of componentsOf(input.junctions, input.cut)) {
		const group = `cutaway:${root}`;
		let active = new Set(wallIds);
		let attempt = buildComponent(group, active);
		let dropped: string[] = [];
		if (attempt?.groupResult?.issue !== null && attempt?.groupResult !== undefined) {
			// A T/X where two legs at the same Junction are both cut can leave the
			// section's collinear edges partially overlapping: the branch's end is
			// a sub-segment of the through Wall's side, and `sectionMeshes` does not
			// split that T-junction. Keep the trimmed branch (the near Wall) cut and
			// close the core legs at that junction to whole; their body then gives
			// the branch a seam face, so the stub is closed rather than open.
			const core = wallIds.filter((wallId) => (trimByWall.get(wallId) ?? 0) === 0);
			const trimmed = wallIds.filter((wallId) => (trimByWall.get(wallId) ?? 0) > 0);
			const candidates: string[][] = [core, trimmed];
			for (const drop of candidates) {
				if (drop.length === 0 || drop.length >= active.size) continue;
				const retry = new Set(wallIds.filter((wallId) => !drop.includes(wallId)));
				const retried = buildComponent(group, retry);
				if (retried !== null && retried.groupResult !== undefined && retried.groupResult.issue === null) {
					active = retry;
					attempt = retried;
					dropped = drop;
					break;
				}
			}
		}
		if (attempt === null || attempt === undefined || attempt.groupResult === undefined) {
			for (const wallId of wallIds) failedWallIds.add(wallId);
			continue;
		}
		const { result, groupResult, seams } = attempt;
		candidateTriangles += result.candidateTriangles;
		if (groupResult.issue !== null) {
			// D12: the offending component stays whole. Never an open stub.
			for (const wallId of wallIds) failedWallIds.add(wallId);
			issues.push(groupResult.issue);
			continue;
		}
		for (const wallId of dropped) failedWallIds.add(wallId);
		components.push({
			group,
			wallIds: [...active],
			loops: groupResult.loops,
			basis: result.basis,
			seams
		});
	}
	return { components, issues, failedWallIds, candidateTriangles };
}

/** A component's seam free edges: two verticals and the top, bottom omitted. */
export function seamEdgePositions(seams: readonly CutawaySeam[], stubTopY: number): number[] {
	const positions: number[] = [];
	for (const seam of seams) {
		const bottom = Math.max(seam.bottomY, stubTopY);
		positions.push(
			seam.from[0], bottom, seam.from[1], seam.from[0], seam.topY, seam.from[1],
			seam.to[0], bottom, seam.to[1], seam.to[0], seam.topY, seam.to[1],
			seam.from[0], seam.topY, seam.from[1], seam.to[0], seam.topY, seam.to[1]
		);
	}
	return positions;
}
