import {
	artworkFrameBorderMeters,
	type ArtworkFrame,
	type SceneArtworkEntity,
	type SceneEntity,
	type Vec3
} from '@portfolio/project-model';

export const ARTWORK_EYE_LINE_METERS = 1.5;
export const ARTWORK_HANG_SNAP_METERS = 0.06;
export const ARTWORK_HANG_REACH_METERS = 5;
export const ARTWORK_HANG_PLANE_TOLERANCE_METERS = 0.15;
const PARALLEL_DOT = 0.995;

export type ArtworkHangCandidate = Pick<SceneArtworkEntity, 'position' | 'rotation' | 'widthMeters' | 'frame'> & {
	readonly id: string;
};

export type ArtworkHangGuide = {
	readonly id: string;
	readonly kind: 'eye' | 'neighbour';
	readonly subjectId?: string;
	readonly y: number;
	readonly start: Vec3;
	readonly end: Vec3;
	readonly label: string;
};

export type ArtworkHangSnap = {
	readonly position: Vec3;
	readonly guideId: string | null;
};

function yawOnly(rotation: Vec3): boolean {
	return Math.abs(rotation[0]) < 1e-6 && Math.abs(rotation[2]) < 1e-6;
}

function tangent(yaw: number): readonly [number, number] {
	return [Math.cos(yaw), -Math.sin(yaw)];
}

function forward(yaw: number): readonly [number, number] {
	return [Math.sin(yaw), Math.cos(yaw)];
}

function outerWidth(candidate: Pick<SceneArtworkEntity, 'widthMeters' | 'frame'>): number {
	return candidate.widthMeters + 2 * artworkFrameBorderMeters(candidate.frame);
}

function halfLength(widthMeters: number): number {
	return Math.max(0.5, widthMeters / 2 + 0.35);
}

/**
 * Eye-line and neighbouring Artwork centre guides, in world space. The guide
 * lies in the Artwork's own vertical plane: A1 stores no wall host, so A2 infers
 * adjacency from pose and never queries or writes Layout.
 */
export function artworkHangingGuides(
	scene: { readonly entities: readonly SceneEntity[] },
	candidate: ArtworkHangCandidate,
	datumMeters: number
): readonly ArtworkHangGuide[] {
	if (!yawOnly(candidate.rotation)) return [];
	const [tx, tz] = tangent(candidate.rotation[1]);
	const [fx, fz] = forward(candidate.rotation[1]);
	const eyeY = datumMeters + ARTWORK_EYE_LINE_METERS;
	const eyeHalf = halfLength(outerWidth(candidate));
	const guides: ArtworkHangGuide[] = [{
		id: 'artwork-eye-line',
		kind: 'eye',
		y: eyeY,
		start: [candidate.position[0] - tx * eyeHalf, eyeY, candidate.position[2] - tz * eyeHalf],
		end: [candidate.position[0] + tx * eyeHalf, eyeY, candidate.position[2] + tz * eyeHalf],
		label: 'Eye line 1.50 m'
	}];

	const neighbours: { guide: ArtworkHangGuide; distance: number }[] = [];
	for (const entity of scene.entities) {
		if (entity.kind !== 'artwork' || entity.id === candidate.id) continue;
		if (!yawOnly(entity.rotation)) continue;
		const dx = entity.position[0] - candidate.position[0];
		const dz = entity.position[2] - candidate.position[2];
		if (Math.abs(dx * fx + dz * fz) > ARTWORK_HANG_PLANE_TOLERANCE_METERS) continue;
		const [nfx, nfz] = forward(entity.rotation[1]);
		if (fx * nfx + fz * nfz < PARALLEL_DOT) continue;
		const lateral = dx * tx + dz * tz;
		if (Math.abs(lateral) > ARTWORK_HANG_REACH_METERS) continue;
		const [ntx, ntz] = tangent(entity.rotation[1]);
		const half = halfLength(outerWidth(entity));
		neighbours.push({
			distance: Math.abs(lateral),
			guide: {
				id: `artwork-neighbour-${entity.id}`,
				kind: 'neighbour',
				subjectId: entity.id,
				y: entity.position[1],
				start: [entity.position[0] - ntx * half, entity.position[1], entity.position[2] - ntz * half],
				end: [entity.position[0] + ntx * half, entity.position[1], entity.position[2] + ntz * half],
				label: `${entity.name} · ${(entity.position[1] * 100).toFixed(0)} cm`
			}
		});
	}
	neighbours.sort((a, b) => a.distance - b.distance || (a.guide.subjectId ?? '').localeCompare(b.guide.subjectId ?? ''));
	guides.push(...neighbours.slice(0, 4).map((entry) => entry.guide));
	return guides;
}

/** Snap the candidate's centre Y to the nearest guide; ties keep the eye line. */
export function snapArtworkHeight(
	position: Vec3,
	guides: readonly ArtworkHangGuide[],
	toleranceMeters = ARTWORK_HANG_SNAP_METERS
): ArtworkHangSnap {
	let best: { guide: ArtworkHangGuide; distance: number } | null = null;
	for (const guide of guides) {
		const distance = Math.abs(position[1] - guide.y);
		if (distance > toleranceMeters) continue;
		if (best === null || distance < best.distance) best = { guide, distance };
	}
	if (best === null) return { position, guideId: null };
	return { position: [position[0], best.guide.y, position[2]], guideId: best.guide.id };
}

export function activeArtworkHangGuide(
	guides: readonly ArtworkHangGuide[],
	centreY: number
): string | null {
	return guides.find((guide) => Math.abs(guide.y - centreY) < 1e-6)?.id ?? null;
}
