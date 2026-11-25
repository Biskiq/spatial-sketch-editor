export type {
	AcceptedRevision,
	SessionEpoch,
	SnapshotIdentity,
} from '../references/types';

export {
	freezeF4Data,
	immutableF4Data,
} from './immutable';

export {
	deterministicProblem,
	intentScope,
	validateAuthoringIntent,
} from './intent';

export type {
	DeterminismProblem,
	IntentScope,
	IntentValidationOptions,
} from './intent';

export {
	createPlannerRegistry,
	prepareIntent,
	sameRevision,
	SINGLE_DOMAIN_ADMISSION,
} from './prepare';

export type {
	PlannerAdmissionProfile,
	PlannerRegistry,
	PlannerRegistryAdmission,
	PrepareAdmission,
	PrepareFailure,
	PrepareResult,
	RegistrationOutcome,
	RegistrationRefusal,
} from './prepare';

export {
	F4_VERSION,
} from './types';

export type {
	AcceptanceRejection,
	AcceptanceRejectionCode,
	AcceptanceResult,
	AcceptanceSourceAdapter,
	AcceptedSnapshot,
	AdmissionIssue,
	AdmittedSource,
	AuthoringIntent,
	CapturedIdAllocation,
	CapturedInput,
	CorrespondenceEntry,
	CorrespondenceRelation,
	DomainPlanner,
	DomainReadAccess,
	F4JsonValue,
	OperationChange,
	PlannerAdmission,
	PlannerOutcome,
	PlannerRegistration,
	PlannerRequest,
	PreparedCandidate,
	SourceAdmission,
	UndoResult,
} from './types';
