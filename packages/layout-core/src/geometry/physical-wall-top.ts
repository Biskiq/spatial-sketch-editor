/**
 * The physical Wall's authored top, derived once for the compiler.
 *
 * A level top produces no profile and no key part, which is what keeps a level
 * Wall's compiled record, cache key and sections byte-identical to the
 * pre-format-11 compiler. A profiled top carries its profile (above the Floor
 * datum), its peak, its cache-key part and sections whose `topY` is the maximum
 * over each span, so every existing bound stays conservative while the mesh
 * reads the true edge per vertex.
 */
import type { CompiledWallSection, CompilerOpening, LayoutGeometryIssue } from './types';
import type { SampleableSegment, SampledSegment } from './curve';
import type { LayoutWall, LayoutWallTop, WallTopProfile } from '../wall/types';
import {
	compiledWallTopPeak,
	compiledWallTopProfile,
	wallTopIssues,
	wallTopRange,
} from '../wall/wall-top';
import { splitSampledWallAroundOpenings } from './openings';

export type PhysicalWallTopCompilation = {
	/** Top issues in the shared compiler-issue shape, tagged with the Wall. */
	issues: LayoutGeometryIssue[];
	/** Present only for a non-level top. */
	profile?: WallTopProfile;
	/** `height` plus the maximum rise; the Wall's physical vertical extent. */
	wallTop: number;
	/** The authored top only when it is non-level, for cache-key identity. */
	keyPart: [] | [LayoutWallTop];
	sections: CompiledWallSection[];
};

export function compilePhysicalWallTop(
	wall: LayoutWall,
	sampled: SampledSegment,
	segment: SampleableSegment,
	openings: readonly CompilerOpening[],
	floorElevation: number,
): PhysicalWallTopCompilation {
	const issues: LayoutGeometryIssue[] = wallTopIssues(wall, sampled.length, `walls.${wall.id}`).map(
		(issue) => ({
			path: issue.path,
			code: issue.code,
			message: issue.message,
			targetId: wall.id,
		}),
	);
	const profile = compiledWallTopProfile(wall, sampled.length);
	const peak = profile ? compiledWallTopPeak(profile, wall.height) : wall.height;
	const topMax = (start: number, end: number): number =>
		wallTopRange(wall, start, end, sampled.length).max;
	const sections = splitSampledWallAroundOpenings(
		sampled,
		segment,
		openings,
		wall.height,
		profile ? topMax : undefined,
	);
	return {
		issues,
		...(profile ? { profile } : {}),
		wallTop: floorElevation + peak,
		keyPart: wall.top.kind === 'level' ? [] : [wall.top],
		sections,
	};
}
