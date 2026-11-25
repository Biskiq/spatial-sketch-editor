export {
	compareReferences,
	createReferenceResolverHost,
	matchesGeneration,
	REFERENCE_INTERFACE_VERSION,
	resolveDerivedSourceRef,
	resolveFrame,
	resolveReference,
} from './resolve';

export type {
	ReferenceResolverHost,
} from './resolve';

export {
	isReferenceDomain,
	isResourceDomain,
	REFERENCE_DOMAINS,
	REFERENCE_FAILURE_CODES,
	REFERENCES_VERSION,
} from './types';

export type {
	AcceptedRevision,
	DependencyLockReader,
	DerivedSourceRef,
	DerivedSourceResolution,
	DerivedSubRef,
	FrameOwner,
	FramePlacement,
	FrameReference,
	FrameResolution,
	FrameResolutionFailureCode,
	FrameResolver,
	FrameResolverOutcome,
	ReferenceDomain,
	ReferenceExtension,
	ReferenceFailureCode,
	ReferenceLocation,
	ReferenceReadContext,
	ReferenceReadRequest,
	ReferenceRepairAction,
	ReferenceResolution,
	ReferenceResolver,
	ReferenceResolverOutcome,
	ReferenceRevision,
	ReferenceSubject,
	ResolvedSubject,
	ResourceDomain,
	SemanticDomain,
	SemanticReference,
	SessionEpoch,
	SnapshotIdentity,
} from './types';

export {
	validateAcceptedRevision,
	validateDerivedSourceRef,
	validateFrameReference,
	validateSemanticReference,
	validateSnapshotIdentity,
} from './validate';

export type {
	ReferenceValidation,
	ReferenceValidationOptions,
} from './validate';
