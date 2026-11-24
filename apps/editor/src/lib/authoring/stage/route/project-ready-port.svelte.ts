import type { BootState } from '../boot-state';
import { stageEnvelope } from '../unit-stage-source';

export function createProjectReadyPort(boot: () => BootState) {
	const snapshot = $derived.by(() => {
		const current = boot();
		return current.status === 'ready' || current.status === 'empty' ? current.snapshot : null;
	});

	return {
		snapshot: () => snapshot,
		envelope: () => snapshot === null ? null : stageEnvelope(snapshot),
		datumMeters: () => snapshot?.domain.datumMeters ?? 0
	};
}
