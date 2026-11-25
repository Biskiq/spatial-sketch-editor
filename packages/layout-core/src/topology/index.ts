/**
 * Topology gates: whole-document and edit-scoped validation of the wall-first
 * document, plus the curve-level crossing authority.
 */
export {
	detectWallCurveTopologyCrossings
} from './curve-crossings';

export type {
	WallCurveTopologyCrossing,
	WallCurveTopologyCrossingSubject
} from './curve-crossings';

export {
	validateClosedWallContacts,
	validateWallFirstTopology
} from './wall-first';

export type {
	WallFirstTopologyOptions
} from './wall-first';
