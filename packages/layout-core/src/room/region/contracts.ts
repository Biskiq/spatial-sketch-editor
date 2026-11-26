import type { LayoutVec2 } from '../../geometry/coordinates';
import type { LayoutGeometryIssue } from '../../geometry/types';
import type { LayoutDocumentIssue } from '../../plan/issue';
import type { LayoutDocumentWallFirst, LayoutRegion } from '../../wall/types';

export type RegionPlannerOperation =
	| 'region-create'
	| 'region-move'
	| 'region-rotate'
	| 'region-footprint'
	| 'region-elevation'
	| 'region-thickness'
	| 'region-intended-gap'
	| 'region-rename'
	| 'region-remove'
	| 'region-duplicate'
	| 'region-fit-space'
	| 'region-fit-edge'
	| 'region-fit-walls'
	| 'region-fit-roof';

export type RegionPlannerRejectionCode =
	| 'unknown_region'
	| 'unknown_wall'
	| 'unknown_room'
	| 'invalid_capture'
	| 'invalid_value'
	| 'no_op'
	| 'curved_wall_unsupported'
	| 'no_horizontal_gap'
	| 'no_wall_contact'
	| 'edge_not_parallel'
	| 'no_gap_to_mark'
	| 'region_role_not_overhead'
	| 'no_covered_walls'
	| 'no_eligible_walls'
	| 'invalid_room_outline'
	| 'invalid_candidate_document'
	| 'opening_set_invalid'
	| 'candidate_does_not_compile'
	| 'captured_id_in_use'
	| (string & {});

export type RegionPlannerRejection = {
	code: RegionPlannerRejectionCode;
	message: string;
	targetIds?: readonly string[];
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue)[];
};

export type RegionPlan =
	| {
			kind: 'success';
			document: LayoutDocumentWallFirst;
			operation: RegionPlannerOperation;
			/** The region this planner addressed (the new id for create/duplicate). */
			regionId: string;
			createdRegionId?: string;
			changedWallIds?: readonly string[];
			/** Chosen Walls a fit used as its subject. */
			fittedWallIds?: readonly string[];
			/** Chosen Walls a fit left alone because they are only partly covered. */
			skippedWallIds?: readonly string[];
	  }
	| { kind: 'rejected'; rejection: RegionPlannerRejection };

export type RegionCreateIntent = {
	readonly role: LayoutRegion['role'];
	readonly footprint: readonly LayoutVec2[];
	readonly elevation: number;
	readonly thickness: number;
	readonly name?: string;
};
