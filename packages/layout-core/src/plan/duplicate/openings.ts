import type { LayoutIdCapture } from '../id-capture';
import { layoutWorkingLevelIssue } from '../id-capture';
import type { LayoutDocumentWallFirst, LayoutWallOpening } from '../../wall/types';
import type { DuplicatePlan, WallOpeningRepeatIntent } from './contracts';
import { LAYOUT_DUPLICATE_MAX_COPIES } from './contracts';
import { finalizeCandidate } from './objects';
import { allocateId, guardedDuplicatePlan, isValidCopyCount, reject } from './shared';

/**
 * Repeat one Wall-hosted Opening along its current canonical Wall:
 * `newOffset = source.offset + i × spacing` from the ORIGINAL source.
 * Kind/width/height/sill/profile are preserved; the host stays the same Wall;
 * the complete final opening set on the Wall validates as one batch.
 */
export function planRepeatWallOpening(
	document: LayoutDocumentWallFirst,
	intent: WallOpeningRepeatIntent,
	capture: LayoutIdCapture,
	levelId: string
): DuplicatePlan {
	const levelIssue = layoutWorkingLevelIssue(document, levelId);
	if (levelIssue !== null) return reject('invalid_value', levelIssue, [intent.openingId]);
	return guardedDuplicatePlan(() => planRepeatWallOpeningInternal(document, intent, capture));
}


function planRepeatWallOpeningInternal(
	document: LayoutDocumentWallFirst,
	intent: WallOpeningRepeatIntent,
	capture: LayoutIdCapture
): DuplicatePlan {
	const source = document.openings.find((candidate) => candidate.id === intent.openingId);
	if (!source) {
		return reject('unknown_opening', `Unknown Opening '${intent.openingId}'`, [intent.openingId]);
	}
	if (!isValidCopyCount(intent.count)) {
		return reject(
			'count_out_of_range',
			`Copy count must be an integer between 1 and ${LAYOUT_DUPLICATE_MAX_COPIES}`,
			[intent.openingId]
		);
	}
	if (!Number.isFinite(intent.spacing)) {
		return reject('invalid_value', 'Opening repeat spacing must be finite', [intent.openingId]);
	}
	if (!document.walls.some((wall) => wall.id === source.wallId)) {
		return reject('invalid_reference', `Opening '${source.id}' has an unresolved hosting Wall`, [
			source.id,
			source.wallId
		]);
	}

	// Pass 2: allocate every ID up front, then clone from the ORIGINAL source.
	const taken = new Set(document.openings.map((opening) => opening.id));
	const createdOpeningIds: string[] = [];
	const copies: LayoutWallOpening[] = [];
	for (let index = 1; index <= intent.count; index += 1) {
		const id = allocateId(taken, `${source.id}-copy-${index}`, capture);
		taken.add(id);
		createdOpeningIds.push(id);
		copies.push({
			...source,
			id,
			offset: source.offset + index * intent.spacing,
			// A portal relation is preserved only because the copy stays on the
			// same hosting Wall with the same adjacent Rooms; the shared portal
			// gate below re-proves the new-schema contract for every copy.
			...(source.connectsRoomIds
				? { connectsRoomIds: [...source.connectsRoomIds] as [string, string] }
				: {})
		});
	}
	const candidate: LayoutDocumentWallFirst = {
		...document,
		openings: [...document.openings, ...copies]
	};
	return finalizeCandidate(candidate, 'wall-opening-repeat', { createdOpeningIds });
}
