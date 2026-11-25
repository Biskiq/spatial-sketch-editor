import type { SceneDocument } from '../scene';

/**
 * Public surface types for the scene document codec. The current canonical
 * shape is world-local (`formatVersion: 1`); the versionless room-local
 * shape is recognized legacy compatibility decoded through the explicit
 * legacy path.
 */
export type SceneDocumentIssue = {
	path: string;
	code: string;
	message: string;
};

export type SceneDocumentValidationResult =
	| { success: true; document: SceneDocument; canonicalJson: string }
	| { success: false; issues: SceneDocumentIssue[] };

export class SceneDocumentValidationError extends Error {
	readonly issue: SceneDocumentIssue;

	constructor(issue: SceneDocumentIssue) {
		super(`${issue.path} (${issue.code}): ${issue.message}`);
		this.name = 'SceneDocumentValidationError';
		this.issue = issue;
	}
}
