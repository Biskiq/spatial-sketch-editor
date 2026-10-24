/**
 * `layout-issue.ts` — the shared structured issue record for a Layout payload.
 *
 * `LayoutDocumentIssue` is the one `{ path, code, message }` shape every Layout
 * reader reports and the shape `LayoutDocumentValidationError` carries. T1.P02.S05
 * moved it out of the retired legacy codec so the wall-first codec, the identity
 * capture and the precision planners keep one issue owner without depending on a
 * document generation.
 *
 * Compiled geometry has its own richer issue (`LayoutGeometryIssue`, which adds
 * `targetId`/`severity`); it is a different contract and stays in
 * `layout-geometry-types.ts`.
 */
export type LayoutDocumentIssue = {
	path: string;
	code: string;
	message: string;
};

/** Thrown by a canonical writer when the payload it was given is invalid. */
export class LayoutDocumentValidationError extends Error {
	readonly issue: LayoutDocumentIssue;

	constructor(issue: LayoutDocumentIssue) {
		super(`${issue.path} (${issue.code}): ${issue.message}`);
		this.name = 'LayoutDocumentValidationError';
		this.issue = issue;
	}
}
