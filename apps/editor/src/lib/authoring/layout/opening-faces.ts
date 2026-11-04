import { type CompiledOpening, type CompiledPhysicalWall,
	type LayoutVec2, type LayoutWallOpening } from '@portfolio/layout-core';

type Vec3 = [number, number, number];

export function wallPointAtDistance(
	wall: CompiledPhysicalWall,
	distance: number
): { readonly point: LayoutVec2; readonly tangent: LayoutVec2 } | null {
	const samples = wall.samples;
	if (samples.length === 0) return null;
	if (distance <= samples[0]!.distance) {
		const sample = samples[0]!;
		return {
			point: [sample.point[0] + sample.tangent[0] * (distance - sample.distance), sample.point[1] + sample.tangent[1] * (distance - sample.distance)],
			tangent: sample.tangent
		};
	}
	for (let index = 1; index < samples.length; index += 1) {
		const before = samples[index - 1]!;
		const after = samples[index]!;
		if (distance > after.distance) continue;
		const span = after.distance - before.distance;
		const amount = span > 0 ? (distance - before.distance) / span : 0;
		const tangent: LayoutVec2 = [
			before.tangent[0] + (after.tangent[0] - before.tangent[0]) * amount,
			before.tangent[1] + (after.tangent[1] - before.tangent[1]) * amount
		];
		const magnitude = Math.hypot(tangent[0], tangent[1]) || 1;
		return {
			point: [before.point[0] + (after.point[0] - before.point[0]) * amount, before.point[1] + (after.point[1] - before.point[1]) * amount],
			tangent: [tangent[0] / magnitude, tangent[1] / magnitude]
		};
	}
	const sample = samples.at(-1)!;
	return {
		point: [sample.point[0] + sample.tangent[0] * (distance - sample.distance), sample.point[1] + sample.tangent[1] * (distance - sample.distance)],
		tangent: sample.tangent
	};
}

export function openingFaceLoops(
	wall: CompiledPhysicalWall,
	values: Pick<LayoutWallOpening, 'offset' | 'width' | 'sillHeight'>,
	datumMeters: number,
	topBoundary: readonly LayoutVec2[]
): Vec3[][] {
	const localOutline: LayoutVec2[] = [[0, 0], [values.width, 0], ...[...topBoundary].reverse()];
	const faces: Vec3[][] = [];
	for (const side of [-1, 1]) {
		const points = localOutline.map(([x, y]) => {
			const location = wallPointAtDistance(wall, values.offset + x);
			if (location === null) return null;
			const normal: LayoutVec2 = [-location.tangent[1], location.tangent[0]];
			return [
				location.point[0] + normal[0] * wall.thickness * side / 2,
				datumMeters + values.sillHeight + y,
				location.point[1] + normal[1] * wall.thickness * side / 2
			] as Vec3;
		});
		if (points.some((point) => point === null)) continue;
		faces.push(points as Vec3[]);
	}
	return faces;
}

export function compiledOpeningFaceLoops(
	wall: CompiledPhysicalWall,
	opening: CompiledOpening,
	datumMeters: number
): Vec3[][] {
	return openingFaceLoops(wall, opening, datumMeters,
		opening.profileShape?.topBoundary ?? [[0, opening.height], [opening.width, opening.height]]);
}

export function openingLoopSegments(faces: readonly Vec3[][]): [Vec3, Vec3][] {
	return faces.flatMap((face) =>
		face.map((point, index) => [point, face[(index + 1) % face.length]!]));
}
