import { activeLayoutCompileSession } from '../../geometry/session';
import { compileWallFirstLayoutGeometry } from '../../geometry/compiler';
import { hasBlockingLayoutIssues } from '../../geometry/validation';
import { validateWallFirstOpeningSet } from '../../wall/opening-set';
import { validateWallFirstPortalRelations } from '../../wall/portals';
import { validateWallFirstTopology } from '../../topology/wall-first';
import { validateWallFirstLayoutDocument } from '../../wall/codec';
import type { LayoutIdCapture } from '../id-capture';
import { layoutWorkingLevelIssue } from '../id-capture';
import type { RoomCopyDroppedRelation } from '../../room/isolation';
import { isSupportedLayoutObject } from '../../room/isolation';
import type { LayoutDocumentWallFirst, LayoutObject } from '../../wall/types';
import type { LayoutSurfaceLineage } from '../surface-reference';
import type {
	DuplicateOperation,
	DuplicatePlan,
	LayoutObjectRepeatIntent,
	RoomCopyCorrespondence,
} from './contracts';
import { LAYOUT_DUPLICATE_MAX_COPIES } from './contracts';
import { allocateId, guardedDuplicatePlan, isValidCopyCount, reject } from './shared';

/**
 * Shared final gates for every duplicate/repeat batch: codec → canonical wall
 * topology (only when the batch introduces Walls) → whole-document opening set
 * → portal relations → canonical compile. One batch validates once — never per
 * copy.
 *
 * The topology step IS the canonical gate
 * (`validateWallFirstTopology`, the same function the precision planners
 * and the Room-move planner run), never a second, chord-exact crossing
 * rule owned by this module. The bar a duplicate batch holds is therefore the
 * bar every other commit holds, by construction rather than by a docstring
 * claiming a parity the local rule did not have (this doc used to make exactly
 * that claim, over a gate that could not see a sampled curve crossing — the
 * F-C1 ingress hole).
 *
 * What that bar is under the ratified policy (D-1/E, D-9):
 *   · spatial overlap between INDEPENDENT components is PERMITTED, so a clone
 *     placed across its source or across any other group COMMITS and joins
 *     nothing — separate ids, no adopted Junction, no split Wall (F1/F5);
 *   · a violation INSIDE one connected component stays refused, so a batch that
 *     introduces Walls into a document already carrying a same-component
 *     crossing is refused rather than admitted;
 *   · ingestion is separately governed and unchanged: the codec
 *     (`validateWallFirstLayoutDocument`) still carries NO topology rule, so a
 *     payload stays codec-valid exactly as before and topology remains a later,
 *     separate validation. Wiring the codec to geometry is NOT this change's
 *     business — F-C6 is a scope, not a licence to make the codec semantic.
 */
export function finalizeCandidate(
	candidate: LayoutDocumentWallFirst,
	operation: DuplicateOperation,
	created: {
		createdObjectIds?: readonly string[];
		createdOpeningIds?: readonly string[];
		createdJunctionIds?: readonly string[];
		createdWallIds?: readonly string[];
		createdRoomId?: string;
		surfaceLineage?: LayoutSurfaceLineage;
		droppedRoomRelations?: readonly RoomCopyDroppedRelation[];
		roomCopyCorrespondence?: RoomCopyCorrespondence;
	},
): DuplicatePlan {
	const structural = validateWallFirstLayoutDocument(candidate);
	if (!structural.success) {
		return reject(
			'invalid_candidate_document',
			`Candidate failed wall-first validation: ${structural.issues[0]?.message ?? 'unknown issue'}`,
			undefined,
			structural.issues,
		);
	}
	if ((created.createdWallIds?.length ?? 0) > 0) {
		// ONE rule, called from the ONE canonical authority (see the
		// doc above): no local crossing classifier, no second tolerance.
		//
		// `openingSet: 'defer'` keeps the Opening-set vocabulary canonical while
		// leaving its translation to the explicit gate below. Precision candidates
		// also defer that check; Room-move uses the validator's default options and
		// its existing downstream Opening-set gate. An Opening failure must not be
		// consumed as `topology_invalid` before duplicate planning can classify it.
		//
		// The step runs for batches that INTRODUCE Walls (the F-C1 surface). A
		// batch that creates no Wall — an object or Opening repeat — introduces no
		// Wall-pair relation at all, so its verdict cannot differ from the
		// document's existing one and the check is skipped.
		const topologyIssue = validateWallFirstTopology(structural.document, {
			openingSet: 'defer',
			closedContactWallIds: new Set(created.createdWallIds),
		});
		if (topologyIssue) {
			return reject(
				'topology_invalid',
				topologyIssue.message,
				topologyIssue.targetId ? [topologyIssue.targetId] : undefined,
				[topologyIssue],
			);
		}
	}
	const setIssues = validateWallFirstOpeningSet(structural.document);
	if (setIssues.length > 0) {
		const first = setIssues[0]!;
		return reject('opening_set_invalid', first.message, [first.openingId, first.wallId], setIssues);
	}
	const relationIssues = validateWallFirstPortalRelations(structural.document);
	if (relationIssues.length > 0) {
		const first = relationIssues[0]!;
		return reject('portal_relation_invalid', first.message, [first.openingId]);
	}
	// The bound authoring session, as every other Layout planner compiles.
	const compileSession = activeLayoutCompileSession();
	const compiled = compileSession
		? compileSession.compile(structural.document)
		: compileWallFirstLayoutGeometry(structural.document);
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return reject(
			'candidate_does_not_compile',
			`Candidate document does not compile: ${compiled.issues[0]?.message ?? 'unknown geometry issue'}`,
			undefined,
			compiled.issues,
		);
	}
	return {
		kind: 'success',
		document: structural.document,
		operation,
		createdObjectIds: created.createdObjectIds ?? [],
		createdOpeningIds: created.createdOpeningIds ?? [],
		createdJunctionIds: created.createdJunctionIds ?? [],
		createdWallIds: created.createdWallIds ?? [],
		surfaceLineage: created.surfaceLineage ?? [],
		...(created.createdRoomId !== undefined ? { createdRoomId: created.createdRoomId } : {}),
		...(created.droppedRoomRelations !== undefined
			? { droppedRoomRelations: created.droppedRoomRelations }
			: {}),
		...(created.roomCopyCorrespondence !== undefined
			? { roomCopyCorrespondence: created.roomCopyCorrespondence }
			: {}),
	};
}

export function cloneObject(object: LayoutObject): LayoutObject {
	return {
		...object,
		position: [...object.position] as typeof object.position,
		rotation: [...object.rotation] as typeof object.rotation,
		dimensions: [...object.dimensions] as typeof object.dimensions,
	};
}

/**
 * Shared supported-object predicate for the P23.4 duplicate paths. The one
 * implementation lives in `layout-room-isolation.ts` (P23.6a shares the whole
 * isolation policy, including this predicate, with the Room-move planner);
 * this alias keeps the duplicate-facing name for its callers.
 */
export const isSupportedDuplicateLayoutObject = isSupportedLayoutObject;

/**
 * Repeat one supported document-level Layout object: `count` copies at exact
 * `index × delta` positions from the original source. Document-level and
 * project/world-local ownership is unchanged; the optional semantic `roomId`
 * is preserved on each copy (P23.8 owns later remapping, never this
 * operation). Profile/read-only objects reject explicitly.
 */
export function planRepeatLayoutObject(
	document: LayoutDocumentWallFirst,
	intent: LayoutObjectRepeatIntent,
	capture: LayoutIdCapture,
	levelId: string,
): DuplicatePlan {
	const levelIssue = layoutWorkingLevelIssue(document, levelId);
	if (levelIssue !== null) return reject('invalid_value', levelIssue, [intent.objectId]);
	return guardedDuplicatePlan(() => planRepeatLayoutObjectInternal(document, intent, capture));
}

function planRepeatLayoutObjectInternal(
	document: LayoutDocumentWallFirst,
	intent: LayoutObjectRepeatIntent,
	capture: LayoutIdCapture,
): DuplicatePlan {
	const source = document.objects.find((candidate) => candidate.id === intent.objectId);
	if (!source) {
		return reject('unknown_object', `Unknown layout object '${intent.objectId}'`, [
			intent.objectId,
		]);
	}
	if (!isSupportedDuplicateLayoutObject(source)) {
		return reject(
			'profile_object_read_only',
			`Profile object '${intent.objectId}' is read-only and cannot be duplicated`,
			[intent.objectId],
		);
	}
	if (!isValidCopyCount(intent.count)) {
		return reject(
			'count_out_of_range',
			`Copy count must be an integer between 1 and ${LAYOUT_DUPLICATE_MAX_COPIES}`,
			[intent.objectId],
		);
	}
	const [dx, dz] = intent.delta;
	if (!Number.isFinite(dx) || !Number.isFinite(dz)) {
		return reject('invalid_value', 'Object repeat delta must be finite', [intent.objectId]);
	}

	// Pass 2: allocate every ID up front, then clone from the ORIGINAL source.
	const taken = new Set(document.objects.map((object) => object.id));
	const createdObjectIds: string[] = [];
	const copies: LayoutObject[] = [];
	for (let index = 1; index <= intent.count; index += 1) {
		const id = allocateId(taken, `${source.id}-copy-${index}`, capture);
		taken.add(id);
		createdObjectIds.push(id);
		copies.push({
			...cloneObject(source),
			id,
			position: [
				source.position[0] + index * dx,
				source.position[1],
				source.position[2] + index * dz,
			],
		});
	}
	const candidate: LayoutDocumentWallFirst = {
		...document,
		objects: [...document.objects, ...copies],
	};
	return finalizeCandidate(candidate, 'layout-object-repeat', { createdObjectIds });
}
