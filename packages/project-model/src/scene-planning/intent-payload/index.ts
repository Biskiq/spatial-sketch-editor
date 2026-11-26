/**
 * Scene intent payload readers, one module per operation family.
 *
 * The dispatcher validates the shared payload envelope and then hands the
 * family-specific fields to the reader that owns them; the subject and
 * allocation readers are shared by every family.
 */
export {
	readSceneOperationAllocation,
	readSceneOperationSubject,
	sceneEntityTargetProblem,
} from './subject';
export type { SceneOperationPayload, SceneOperationSubject } from './types';
export { readSceneOperationPayload } from './dispatcher';
