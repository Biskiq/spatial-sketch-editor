import type { SceneEntity, Vec3 } from '@portfolio/project-model/scene';
import type {
	StageAdapterContext,
	StageCandidatePreview,
} from '$lib/authoring/stage/stage-adapter-host';
import { lightForward } from '../../look/light-aim';
import { artworkLightRectangle } from '../../look/light-recipes';

/** Free members carry their own shape at the rigid planner's proposed pose. */
export function groupFreeMemberPreview(
	member: SceneEntity,
	context: StageAdapterContext,
): StageCandidatePreview | null {
	const segments: [Vec3, Vec3][] = [];
	if (member.kind === 'artwork') {
		const { corners } = artworkLightRectangle(member);
		for (const [index, point] of corners.entries()) {
			segments.push([point, corners[(index + 1) % corners.length]!]);
		}
	} else if (member.kind === 'light') {
		const [x, y, z] = member.position;
		const size = 0.09;
		segments.push(
			[
				[x - size, y, z],
				[x + size, y, z],
			],
			[
				[x, y, z - size],
				[x, y, z + size],
			],
		);
		if (member.light === 'spot') {
			const [dx, dy, dz] = lightForward(member.rotation);
			segments.push([member.position, [x + dx, y + dy, z + dz]]);
		}
	} else {
		return null;
	}
	const plan = context.evaluation.renderedReading === 'plan';
	const projected = segments.map(([a, b]): [Vec3, Vec3] =>
		plan
			? [
					[a[0], context.snapshot.domain.datumMeters, a[2]],
					[b[0], context.snapshot.domain.datumMeters, b[2]],
				]
			: [a, b],
	);
	return { id: member.id, role: 'subject', polygons: [], segments: projected, labels: [] };
}
