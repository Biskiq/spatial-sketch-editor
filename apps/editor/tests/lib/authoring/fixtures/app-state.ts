/**
 * `$app/state` test double for mounted-route tests.
 *
 * The spatial route reads the project id and the boot intent from the page
 * object at component construction. The route harness mounts one fixed project
 * address (`project-1`, no `create=1`), which is exactly the explicitly-opened
 * case the preservation contract concerns.
 */
export const page = {
	params: { projectId: 'project-1' },
	url: new URL('http://localhost/project/project-1/spatial')
};
