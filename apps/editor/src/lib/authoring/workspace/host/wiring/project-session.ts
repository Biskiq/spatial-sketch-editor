/**
 * The project-session wiring module.
 *
 * One function, one factory call with its argument literal. The host passes the
 * route's own sources and the notice accessors it already owns; the module keeps
 * the session's construction shape out of the host body.
 */
import { createProjectSession } from '../../../project-session/project-session.svelte';

type SessionInput = Parameters<typeof createProjectSession>[0];

export type ProjectSessionWiring = Omit<SessionInput, 'notice'> & {
	readonly readNotice: () => SessionInput['notice'];
	readonly writeNotice: (value: SessionInput['notice']) => void;
};

export function wireProjectSession(input: ProjectSessionWiring) {
	return createProjectSession({
		projectId: input.projectId,
		intent: input.intent,
		api: input.api,
		auth: input.auth,
		session: input.session,
		images: input.images,
		materialProofs: input.materialProofs,
		url: input.url,
		acceptance: input.acceptance,
		tornDown: input.tornDown,
		activate: input.activate,
		get notice() {
			return input.readNotice();
		},
		set notice(value) {
			input.writeNotice(value);
		},
	});
}
