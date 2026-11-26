import type {
	CompiledOpening,
	CompiledRoom,
	CompiledWall,
	CompiledWallSection,
} from '@portfolio/layout-core/geometry';
import { LAYOUT_GEOMETRY_EPSILON } from '@portfolio/layout-core/geometry';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type {
	ClipSample,
	Corner,
	Face,
	FacePick,
	ResolvedEndClip,
	ResolvedFaceSuppression,
	V3,
} from './wall-mesh-types';
import {
	clamp,
	clipSectionSamples,
	cornerPoint,
	lintelBandIntersectionDistances,
	lintelProfileKnotDistances,
	sampleAt,
	sectionBottomAt,
	segmentBands,
	wallOpensAtEnd,
	wallOpensAtStart,
} from './wall-mesh-geometry';
import { quadNormal } from './wall-mesh-geometry';
import { pushBandFace, quad, vertex } from './wall-mesh-emit';

export function buildSectionFaces(
	room: CompiledRoom,
	wall: CompiledWall,
	section: CompiledWallSection,
	half: number,
	cornerStart: Corner,
	cornerEnd: Corner,
	roomBreakpoints: readonly number[],
	endClip?: ResolvedEndClip,
	suppressions: readonly ResolvedFaceSuppression[] = [],
	attribution = false,
): Face[] {
	// A trimmed end shortens the Wall's own material: the section span
	// starts (or stops) at the resolved clip distance, never at the Junction
	// plane, so the Wall's body cannot occupy the Junction material's volume.
	const spanStart = Math.max(section.startDistance, endClip?.start ?? 0);
	const spanEnd = Math.min(section.endDistance, endClip?.end ?? Infinity);
	if (spanEnd - spanStart <= LAYOUT_GEOMETRY_EPSILON) return [];
	// Interfaces split the section at their own interval edges so a covered strip
	// is a whole face, never a half-covered quad.
	const interfaceDistances: number[] = [];
	for (const suppression of suppressions) {
		if (
			suppression.fromDistance > section.startDistance &&
			suppression.fromDistance < section.endDistance
		) {
			interfaceDistances.push(suppression.fromDistance);
		}
		if (
			suppression.toDistance > section.startDistance &&
			suppression.toDistance < section.endDistance
		) {
			interfaceDistances.push(suppression.toDistance);
		}
	}
	// Lintel bottoms follow the arch profile, so merge its topBoundary knots into
	// the clip: the underside and front-face bottom edge tessellate at profile
	// resolution instead of the (coarser) wall-sample spacing, and the pointed
	// apex lands exactly on a knot rather than vanishing between samples.
	const clip = clipSectionSamples(wall.samples, spanStart, spanEnd, [
		...lintelProfileKnotDistances(section),
		...lintelBandIntersectionDistances(section, roomBreakpoints),
		...interfaceDistances,
	]);
	if (clip.length < 2) return [];
	const faces: Face[] = [];
	const isLintel = section.kind === 'lintel';
	const topY = section.topY;
	const floorElevation = room.floorElevation;

	// pick identity for every face this section emits. A lintel splits
	// into band/top ('lintel') and underside ('arch-reveal') surfaces; the sill
	// strip (side + openingId) is the opening's 'sill'; a plain side section is
	// the wall's 'side'. Lintels always carry an openingId from the compiler,
	// but a defensively-missing one falls back to wall 'lintel' so no face is
	// ever left untagged.
	const sectionPick: FacePick = isLintel
		? section.openingId
			? { kind: 'opening', openingId: section.openingId, surface: 'lintel' }
			: { kind: 'wall', surface: 'lintel' }
		: section.openingId
			? { kind: 'opening', openingId: section.openingId, surface: 'sill' }
			: { kind: 'wall', surface: 'side' };
	const frontSectionPick: FacePick = { ...sectionPick, paintSide: 'left' };
	const backSectionPick: FacePick = { ...sectionPick, paintSide: 'right' };
	const undersidePick: FacePick = isLintel
		? section.openingId
			? { kind: 'opening', openingId: section.openingId, surface: 'arch-reveal' }
			: { kind: 'wall', surface: 'lintel' }
		: sectionPick;

	for (let index = 1; index < clip.length; index += 1) {
		// (attribution is applied to the completed faces below)
		const a = clip[index - 1]!;
		const b = clip[index]!;
		const bottomA = sectionBottomAt(section, a.distance);
		const bottomB = sectionBottomAt(section, b.distance);

		const frontA = cornerPoint(a, half, cornerStart, cornerEnd);
		const frontB = cornerPoint(b, half, cornerStart, cornerEnd);
		const backA = cornerPoint(a, -half, cornerStart, cornerEnd);
		const backB = cornerPoint(b, -half, cornerStart, cornerEnd);

		const yTop = floorElevation + topY;
		const yBottomA = floorElevation + bottomA;
		const yBottomB = floorElevation + bottomB;

		const nA = a.normal;
		const nB = b.normal;

		// Front/back faces (+normal / −normal), wound so the geometric normal
		// agrees with the stored normal (FrontSide-safe). Split into vertical
		// bands at the room-wide breakpoints so coincident edges stay welded.
		const bands = segmentBands(bottomA, bottomB, topY, roomBreakpoints);
		for (let k = 1; k < bands.length; k += 1) {
			const lo = bands[k - 1]!;
			const hi = bands[k]!;
			const yLoA = clamp(bottomA, lo, hi);
			const yLoB = clamp(bottomB, lo, hi);
			// A sloped (arch) bottom spans the band even when only one endpoint is
			// below `hi`; skip only when BOTH clamped bottoms reach the band top.
			if (hi - Math.min(yLoA, yLoB) <= LAYOUT_GEOMETRY_EPSILON) continue;
			const yLoAWorld = floorElevation + yLoA;
			const yLoBWorld = floorElevation + yLoB;
			const yHiWorld = floorElevation + hi;
			// A resolved internal interface means the corrected region is
			// interior to the Junction material, so the Wall's own face is omitted
			// there. Both offset faces are tested by their own outward normal.
			const frontOmitted = faceOmitted(suppressions, nA, a.distance, b.distance, lo, hi);
			const backOmitted = faceOmitted(
				suppressions,
				[-nA[0], -nA[1]],
				a.distance,
				b.distance,
				lo,
				hi,
			);
			if (frontOmitted && backOmitted) continue;
			if (!frontOmitted)
				pushBandFace(
					faces,
					vertex(frontA[0], yHiWorld, frontA[1], nA[0], 0, nA[1], a.distance, hi),
					vertex(frontA[0], yLoAWorld, frontA[1], nA[0], 0, nA[1], a.distance, yLoA),
					vertex(frontB[0], yLoBWorld, frontB[1], nB[0], 0, nB[1], b.distance, yLoB),
					vertex(frontB[0], yHiWorld, frontB[1], nB[0], 0, nB[1], b.distance, hi),
					frontSectionPick,
				);
			if (!backOmitted)
				pushBandFace(
					faces,
					vertex(backB[0], yHiWorld, backB[1], -nB[0], 0, -nB[1], b.distance, hi),
					vertex(backB[0], yLoBWorld, backB[1], -nB[0], 0, -nB[1], b.distance, yLoB),
					vertex(backA[0], yLoAWorld, backA[1], -nA[0], 0, -nA[1], a.distance, yLoA),
					vertex(backA[0], yHiWorld, backA[1], -nA[0], 0, -nA[1], a.distance, hi),
					backSectionPick,
				);
		}

		// Top face (at topY, +Y).
		faces.push(
			quad(
				vertex(frontA[0], yTop, frontA[1], 0, 1, 0, a.distance, wall.thickness),
				vertex(frontB[0], yTop, frontB[1], 0, 1, 0, b.distance, wall.thickness),
				vertex(backB[0], yTop, backB[1], 0, 1, 0, b.distance, 0),
				vertex(backA[0], yTop, backA[1], 0, 1, 0, a.distance, 0),
				sectionPick,
			),
		);

		// Bottom face: floor for side sections, arch underside for lintels. The
		// normal comes from the quad's own geometry so sloped arch undersides
		// tilt with the profile instead of always facing straight down (−Y).
		if (isLintel || bottomA <= LAYOUT_GEOMETRY_EPSILON) {
			const p0: V3 = [backA[0], yBottomA, backA[1]];
			const p1: V3 = [backB[0], yBottomB, backB[1]];
			const p2: V3 = [frontB[0], yBottomB, frontB[1]];
			const p3: V3 = [frontA[0], yBottomA, frontA[1]];
			const undersideNormal = quadNormal(p0, p1, p2);
			faces.push(
				quad(
					vertex(
						p0[0],
						p0[1],
						p0[2],
						undersideNormal[0],
						undersideNormal[1],
						undersideNormal[2],
						a.distance,
						0,
					),
					vertex(
						p1[0],
						p1[1],
						p1[2],
						undersideNormal[0],
						undersideNormal[1],
						undersideNormal[2],
						b.distance,
						0,
					),
					vertex(
						p2[0],
						p2[1],
						p2[2],
						undersideNormal[0],
						undersideNormal[1],
						undersideNormal[2],
						b.distance,
						wall.thickness,
					),
					vertex(
						p3[0],
						p3[1],
						p3[2],
						undersideNormal[0],
						undersideNormal[1],
						undersideNormal[2],
						a.distance,
						wall.thickness,
					),
					undersidePick,
				),
			);
		}
	}
	if (attribution) {
		for (const face of faces) {
			for (const vertex of face.verts) {
				if (vertex.a) continue;
				// The emitter wrote the exact source station into `u` for every
				// section vertex (side bands, top and bottom/underside). Use that
				// station directly; projecting an offset point back onto a curved
				// polyline would shift it by the curvature. The signed lateral is
				// measured against the sample normal at that station.
				const sample = sampleAt(wall.samples, vertex.u);
				vertex.a = [
					vertex.u,
					(vertex.p[0] - sample.point[0]) * sample.normal[0] +
						(vertex.p[2] - sample.point[1]) * sample.normal[1],
					vertex.p[1] - room.floorElevation,
				];
			}
		}
	}
	return faces;
}

/**
 * Is this offset face region interior to the resolved Junction material? The
 * interface carries the face's own outward normal, so no `front`/`back`
 * convention can drift between the resolver and the builder.
 */
export function faceOmitted(
	suppressions: readonly ResolvedFaceSuppression[],
	normal: LayoutVec2,
	startDistance: number,
	endDistance: number,
	lo: number,
	hi: number,
): boolean {
	for (const suppression of suppressions) {
		if (suppression.normal[0] * normal[0] + suppression.normal[1] * normal[1] < 0.9) continue;
		if (startDistance < suppression.fromDistance - LAYOUT_GEOMETRY_EPSILON) continue;
		if (endDistance > suppression.toDistance + LAYOUT_GEOMETRY_EPSILON) continue;
		const covered = suppression.bands.some(
			(band) =>
				lo >= band.bottomY - LAYOUT_GEOMETRY_EPSILON && hi <= band.topY + LAYOUT_GEOMETRY_EPSILON,
		);
		if (covered) return true;
	}
	return false;
}

export function buildRevealFaces(
	room: CompiledRoom,
	wall: CompiledWall,
	prevWall: CompiledWall,
	nextWall: CompiledWall,
	opening: CompiledOpening,
	half: number,
	wallHeight: number,
	roomBreakpoints: readonly number[],
	cornerStart: Corner,
	cornerEnd: Corner,
	endClip?: ResolvedEndClip,
	attribution = false,
): Face[] {
	const floorElevation = room.floorElevation;
	// The jamb face ends where the arch spring begins: for rectangular openings
	// the spring is the full height; for rounded/pointed it is `height - rise`.
	const springHeight = opening.profileShape
		? opening.profileShape.height - opening.profileShape.rise
		: opening.height;
	const revealBottom = opening.sillHeight;
	const revealTop = Math.min(opening.sillHeight + springHeight, wallHeight);
	if (revealTop <= revealBottom + LAYOUT_GEOMETRY_EPSILON) return [];

	const faces: Face[] = [];
	const bands = segmentBands(revealBottom, revealBottom, revealTop, roomBreakpoints);
	const sides: Array<{ distance: number; sign: number }> = [
		{ distance: Math.max(opening.offset, endClip?.start ?? 0), sign: 1 },
		{ distance: Math.min(opening.offset + opening.width, endClip?.end ?? Infinity), sign: -1 },
	];
	// Jambs at the wall's endpoints use the same profile-aware corner
	// coordinates as the sections: a mitered corner shares the apex with the
	// adjacent wall, a beveled corner resolves to this wall's own offset point
	// (which then welds into the bevel bridge). Two endpoint cases emit no
	// jamb: at a beveled corner the wall's end plane is interior to the corner
	// void (the door void merges with it, and the bridge caps close the rest);
	// and at a mitered end where the NEXT wall also opens at its start, both
	// reveals would emit the same corner-plane jamb.
	const length = wall.samples.at(-1)!.distance;
	for (const side of sides) {
		const atStart = side.distance <= LAYOUT_GEOMETRY_EPSILON;
		const atEnd = side.distance >= length - LAYOUT_GEOMETRY_EPSILON;
		const corner = atStart ? cornerStart : atEnd ? cornerEnd : null;
		if (corner) {
			// At a beveled corner the wall's end plane is interior to the corner
			// void: the door void merges with it, and the bridge's caps close the
			// rest, so the flat jamb face (and its un-weldable rim) is skipped.
			const beveled = corner.front.kind === 'bevel' || corner.back.kind === 'bevel';
			if (beveled) continue;
			// Both-open miter: the previous wall (opening ends here) and this wall
			// (opening starts here) would each emit a corner-plane jamb at a
			// mitered corner. Both jambs are interior to the merged opening void,
			// so suppress both; the profile-difference reveal (if the two openings
			// differ) is emitted once by the corner bridge instead.
			if (atEnd && wallOpensAtStart(nextWall)) continue;
			if (atStart && wallOpensAtEnd(prevWall)) continue;
		}
		// A trimmed (Junction-clipped) end has no jamb of its own: the resolved
		// Junction material closes that end, so a jamb that the clip moved off its
		// authored position would double-paint the resolved region.
		if (
			side.sign > 0
				? opening.offset < (endClip?.start ?? 0) - LAYOUT_GEOMETRY_EPSILON
				: opening.offset + opening.width > (endClip?.end ?? length) + LAYOUT_GEOMETRY_EPSILON
		)
			continue;
		if (
			side.sign > 0
				? endClip?.freeStart && side.distance <= LAYOUT_GEOMETRY_EPSILON
				: endClip?.freeEnd && side.distance >= length - LAYOUT_GEOMETRY_EPSILON
		)
			continue;
		const sample = sampleAt(wall.samples, side.distance);
		const clip: ClipSample = {
			...sample,
			corner:
				side.distance <= LAYOUT_GEOMETRY_EPSILON
					? 'start'
					: side.distance >= length - LAYOUT_GEOMETRY_EPSILON
						? 'end'
						: null,
		};
		const tx = side.sign * sample.tangent[0];
		const tz = side.sign * sample.tangent[1];
		const front = cornerPoint(clip, half, cornerStart, cornerEnd);
		const back = cornerPoint(clip, -half, cornerStart, cornerEnd);
		for (let k = 1; k < bands.length; k += 1) {
			const lo = bands[k - 1]!;
			const hi = bands[k]!;
			const yLo = floorElevation + lo;
			const yHi = floorElevation + hi;
			const frontTop = vertex(front[0], yHi, front[1], tx, 0, tz, wall.thickness, hi);
			const backTop = vertex(back[0], yHi, back[1], tx, 0, tz, 0, hi);
			const backBottom = vertex(back[0], yLo, back[1], tx, 0, tz, 0, lo);
			const frontBottom = vertex(front[0], yLo, front[1], tx, 0, tz, wall.thickness, lo);
			if (attribution) {
				frontTop.a = [side.distance, half, hi];
				backTop.a = [side.distance, -half, hi];
				backBottom.a = [side.distance, -half, lo];
				frontBottom.a = [side.distance, half, lo];
			}
			// Winding must agree with the stored normal `sign * tangent`. The
			// opening-end jamb (−sign) is already front→back→back-bottom→front-bottom;
			// the opening-start jamb (+sign) needs the opposite order.
			const jambPick: FacePick = { kind: 'opening', openingId: opening.openingId, surface: 'jamb' };
			faces.push(
				side.sign > 0
					? quad(frontTop, frontBottom, backBottom, backTop, jambPick)
					: quad(frontTop, backTop, backBottom, frontBottom, jambPick),
			);
		}
	}
	return faces;
}
