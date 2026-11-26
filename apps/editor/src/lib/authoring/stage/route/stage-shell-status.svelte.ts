import type { SemanticReference } from '@portfolio/project-model/references';

export type StageShellStatusPorts = {
	readonly openCard: () => void;
};

export function createStageShellStatus(ports: StageShellStatusPorts) {
	/** Session status words; every owner writes through these methods. */
	let notice = $state('');
	/** The last Preview lowering refusal, worded like a source problem. */
	let previewProblem = $state<unknown | null>(null);
	let cardRenameRequest = $state(0);
	let cardRenameSequence = 0;
	let cardRenameTarget = $state.raw<SemanticReference | null>(null);
	let cardGesturing = $state(false);
	let stageGesturing = $state(false);

	function setNotice(message: string): void {
		notice = message;
	}

	/** Clear a notice only when it is still the one that scheduled the clear. */
	function clearNotice(shown: string): void {
		if (notice === shown) notice = '';
	}

	function setPreviewProblem(value: unknown | null): void {
		previewProblem = value;
	}

	function requestCardRename(target: SemanticReference | null = null): void {
		ports.openCard();
		cardRenameTarget = target;
		cardRenameRequest = ++cardRenameSequence;
	}

	function consumeCardRename(request: number): void {
		if (cardRenameRequest !== request) return;
		cardRenameRequest = 0;
		cardRenameTarget = null;
	}

	/** Mirror the one session lease into the Card's gesture fade. */
	function syncGestureFade(
		lease: { readonly navigation?: boolean; readonly owner: string } | null,
	): void {
		stageGesturing = lease !== null;
		const cameraEdit =
			lease !== null &&
			(lease.owner === 'experience-view-edit' || lease.owner === 'experience-path-point');
		const gesturing = lease !== null && lease.navigation !== true && !cameraEdit;
		if (gesturing !== cardGesturing) cardGesturing = gesturing;
	}

	return {
		get notice() {
			return notice;
		},
		get previewProblem() {
			return previewProblem;
		},
		get cardRenameRequest() {
			return cardRenameRequest;
		},
		get cardRenameTarget() {
			return cardRenameTarget;
		},
		get stageGesturing() {
			return stageGesturing;
		},
		get cardGesturing() {
			return cardGesturing;
		},
		setNotice,
		clearNotice,
		setPreviewProblem,
		requestCardRename,
		consumeCardRename,
		syncGestureFade,
	};
}
