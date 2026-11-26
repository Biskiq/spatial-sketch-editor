/**
 * Strict unit-envelope validation, one module per domain.
 *
 * The envelope module owns the header, lock closure and the findings walk; each
 * domain module owns only its own payload grammar and codec imports, so a
 * Camera change cannot widen the Scene or Experience read set.
 */
export { validateProjectEnvelope } from './envelope';
export { validateUnresolvedBinding } from './shared';
export { validateDependencyLock } from './lock';
export { validateLayoutPayload, validateUnitPayload } from './payload';
export { validateCameraFreeScenePayload, validateSceneSky } from './scene';
export { validateCameraPayload } from './camera';
export {
	readExperienceText,
	readInvitation,
	readPresentationViews,
	readStaySeconds,
	validateExperiencePayload,
} from './experience';
export { validateResourcePayload } from './resources';
export { freezePlainJsonSubgraph, isDeeplyFrozenPlainJson } from './frozen-json';
export { serializeProjectEnvelope, serializeValidatedProjectEnvelope } from './serialize';
export type { EnvelopeClosureFinding, EnvelopeDiagnostic, EnvelopeValidation } from './shared';
