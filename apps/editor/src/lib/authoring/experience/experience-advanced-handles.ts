import { projectWorld, type ViewportEvaluation } from '@portfolio/camera-core/viewport';
import type { StagePoint } from './experience-camera-mesh';
import type { ExperienceFrustum, ExperienceMark } from './experience-marks';
import type { AuthoredViewPose, ViewEditKind } from './experience-view-edit';

export type AdvancedHandle = {
	id: string;
	kind: ViewEditKind;
	at: StagePoint;
	glyph: 'move' | 'curved' | 'hex' | 'two' | 'corner';
	angle?: number;
	stem?: StagePoint;
	apex?: StagePoint;
	side?: -1 | 1;
};

/**
 * Project the pointer handles for the selected View without crossing into the
 * overlay: Move at the camera foot, aim opposite the lens, lift above the mark,
 * then the frustum's tilt edge and lens corners. Handles outside the viewport,
 * overlapping each other twice over, or sitting on another View's target are
 * dropped; the held handle is admitted first so a drag survives the provisional
 * framing.
 */
export function experienceAdvancedHandles(input: {
	advanced: boolean;
	showMarkers: boolean;
	pose: AuthoredViewPose | null;
	marks: readonly ExperienceMark[];
	frustums: readonly ExperienceFrustum[];
	selectedId: string | null;
	plan: boolean;
	showFrustums: boolean;
	evaluation: ViewportEvaluation;
	datum: number;
	hitRadius: number;
	handleOffset: number;
	heldHandleId: string | null;
}): AdvancedHandle[] {
	const {
		advanced,
		showMarkers,
		pose,
		marks,
		frustums,
		selectedId,
		plan,
		showFrustums,
		evaluation,
		datum,
		hitRadius,
		handleOffset,
		heldHandleId,
	} = input;
	if (!advanced || !showMarkers || pose === null) return [];
	const mark = marks.find((item) => item.viewId === selectedId && item.kind !== 'turn');
	if (!mark) return [];
	const candidates: AdvancedHandle[] = [];
	if (plan) {
		const wedge = showFrustums ? frustums.find((item) => item.viewId === selectedId) : undefined;
		if (wedge) {
			candidates.push(
				{
					id: 'lens-left',
					kind: 'lens',
					at: wedge.left,
					glyph: 'corner',
					apex: wedge.eye,
					side: -1,
				},
				{
					id: 'lens-right',
					kind: 'lens',
					at: wedge.right,
					glyph: 'corner',
					apex: wedge.eye,
					side: 1,
				},
			);
		}
	} else if (mark.camera) {
		const foot = mark.camera.floor;
		if (foot) {
			candidates.push({ id: 'move', kind: 'move', at: foot, glyph: 'move' });
			const floorAim = projectWorld(
				[pose.target[0], datum, pose.target[2]],
				evaluation,
				evaluation.token,
			);
			const direction =
				floorAim.kind === 'projected'
					? [
							floorAim.css[0] - evaluation.rect.left - foot[0],
							floorAim.css[1] - evaluation.rect.top - foot[1],
						]
					: [0, 0];
			const span = Math.hypot(direction[0]!, direction[1]!);
			if (span > 1) {
				candidates.push({
					id: 'turn',
					kind: 'turn',
					glyph: 'curved',
					at: [
						foot[0] - (direction[0]! * handleOffset) / span,
						foot[1] - (direction[1]! * handleOffset) / span,
					],
					angle: (Math.atan2(direction[1]!, direction[0]!) * 180) / Math.PI - 90,
				});
			}
		}
		const top = projectWorld(
			[pose.eye[0], pose.eye[1] + 1, pose.eye[2]],
			evaluation,
			evaluation.token,
		);
		if (top.kind === 'projected') {
			const dx = top.css[0] - evaluation.rect.left - mark.css[0];
			const dy = top.css[1] - evaluation.rect.top - mark.css[1];
			const span = Math.hypot(dx, dy);
			if (span > 1) {
				// The height stem sits beside the camera so the knob clears its name.
				const axis: StagePoint = [dx / span, dy / span];
				const across: StagePoint = [-axis[1]!, axis[0]!];
				const apex = mark.camera.frustum?.apex;
				const lensSide =
					apex && (apex[0] - mark.css[0]) * across[0]! + (apex[1] - mark.css[1]) * across[1]! > 0
						? -1
						: 1;
				const offset = (hitRadius + 12) * lensSide;
				const stem: StagePoint = [
					mark.css[0] + offset * across[0]!,
					mark.css[1] + offset * across[1]!,
				];
				candidates.push({
					id: 'lift',
					kind: 'lift',
					glyph: 'hex',
					stem,
					at: [stem[0]! + handleOffset * 0.7 * axis[0]!, stem[1]! + handleOffset * 0.7 * axis[1]!],
				});
			}
		}
		const wire = showFrustums ? mark.camera.frustum : null;
		if (wire) {
			const [left, right] = wire.corners;
			const topEdge: StagePoint = [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2];
			candidates.push({
				id: 'tilt',
				kind: 'tilt',
				glyph: 'two',
				angle: 90,
				stem: topEdge,
				at: [topEdge[0], topEdge[1] - (hitRadius + 11)],
			});
			wire.corners.forEach((at, index) => {
				candidates.push({
					id: `lens-${index}`,
					kind: 'lens',
					at,
					glyph: 'corner',
					side: index < 2 ? 1 : -1,
				});
			});
		}
	}

	const admitted: AdvancedHandle[] = [];
	// Keep the held mark first as the provisional framing changes.
	const held = candidates.find((handle) => handle.id === heldHandleId);
	for (const handle of held ? [held, ...candidates.filter((item) => item !== held)] : candidates) {
		const [x, y] = handle.at;
		if (
			x < hitRadius ||
			y < hitRadius ||
			x > evaluation.rect.width - hitRadius ||
			y > evaluation.rect.height - hitRadius
		) {
			continue;
		}
		if (admitted.some((other) => Math.hypot(other.at[0] - x, other.at[1] - y) < hitRadius * 2))
			continue;
		if (
			marks.some(
				(other) =>
					other.kind !== 'turn' &&
					other.viewId !== selectedId &&
					Math.hypot(other.css[0] - x, other.css[1] - y) < 22 + hitRadius,
			)
		) {
			continue;
		}
		admitted.push(handle);
	}
	return admitted;
}
