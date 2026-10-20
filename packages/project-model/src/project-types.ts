/**
 * The shared project issue vocabulary.
 *
 * T3.P01.S04 retired `ProjectDocument`/`Project`/`ProjectValidationResult` with
 * the current-source codec. The one live source is the F.2 `ProjectEnvelope`
 * (`@portfolio/project-model/units`), and its own validation result is the
 * envelope reader's. Only the issue shape remains shared with callers that
 * describe a refused payload.
 */
export type ProjectIssue = {
	path: string;
	code: string;
	message: string;
};
