import type { LayoutDocumentIssue } from '../issue';
import type { OpeningSetIssue } from '../../wall/opening-set';
import type { LayoutIdCapture } from '../id-capture';
import { LayoutIdCollisionError, layoutCapturedId } from '../id-capture';
import type { DuplicatePlan, DuplicateRejectionCode } from './contracts';
import { LAYOUT_DUPLICATE_MAX_COPIES } from './contracts';

/** Captured id from a seed; occupancy is only the refusal check. */
export function allocateId(
	taken: ReadonlySet<string>,
	seed: string,
	capture: LayoutIdCapture,
): string {
	const id = layoutCapturedId(capture, seed);
	if (taken.has(id)) throw new LayoutIdCollisionError(id);
	return id;
}

/** Run one duplicate plan, translating a captured-id collision into its own refusal. */
export function guardedDuplicatePlan(run: () => DuplicatePlan): DuplicatePlan {
	try {
		return run();
	} catch (error) {
		if (error instanceof LayoutIdCollisionError) {
			return reject('captured_id_in_use', error.message, [error.id]);
		}
		throw error;
	}
}

export function reject(
	code: DuplicateRejectionCode,
	message: string,
	targetIds?: readonly string[],
	issues?: readonly (LayoutDocumentIssue | OpeningSetIssue)[],
): DuplicatePlan {
	return {
		kind: 'rejected',
		rejection: {
			code,
			message,
			...(targetIds ? { targetIds } : {}),
			...(issues ? { issues } : {}),
		},
	};
}

/** Is `count` a valid copy count (integer, `1..50`)? */
export function isValidCopyCount(count: number): boolean {
	return Number.isInteger(count) && count >= 1 && count <= LAYOUT_DUPLICATE_MAX_COPIES;
}
