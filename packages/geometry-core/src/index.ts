/**
 * `@portfolio/geometry-core` — the runtime-safe native-form kernel.
 *
 * It carries no Scene, Layout or Camera meaning, imports no renderer, DOM or
 * Svelte module, and depends on exactly `robust-predicates` (Unlicense) and
 * `earcut` (ISC). Inputs are plain numbers and arrays; output is a deterministic
 * closed mesh with regions, bounds, footprint and contact.
 */
export {
  GEOMETRY_CORE_EVALUATOR_VERSION,
  PROFILE_LIMITS,
  canonicalizeWinding,
  evaluateProfile,
  validateProfile,
  type EvaluatedProfile,
  type ProfileAnchor,
  type ProfileBounds,
  type ProfileIssue,
  type ProfileIssueCode
} from './profile';
export {
  extrudeProfile,
  type ExtrudeFormInput,
  type FormBounds,
  type FormMesh
} from './extrude';
export { formMeshDigest } from './digest';
export { GeometryCoreError } from './errors';
