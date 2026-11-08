/**
 * The Experience welcome's one session preference.
 *
 * The lens shows the welcome until the creator dismisses it; the preference is
 * best-effort, so a blocked store still allows dismissal for this visit.
 */
const WELCOME_DISMISSED_KEY = 'museum.experience.welcome-dismissed';

export function welcomeDismissed(): boolean {
	try {
		return localStorage.getItem(WELCOME_DISMISSED_KEY) === '1';
	} catch {
		return false;
	}
}

export function rememberWelcomeDismissed(): void {
	try {
		localStorage.setItem(WELCOME_DISMISSED_KEY, '1');
	} catch {
		// A blocked preference store still allows dismissal for this visit.
	}
}
